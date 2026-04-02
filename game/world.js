/**
 * world.js — Neighborhood environment builder.
 * Optimized: shared materials, InstancedMesh for bushes/trees/clouds/lamps,
 * merged static geometry for sidewalks.
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { loadHouseModel, loadShopModel, loadCommunityHubModel } from './modelLoader.js';
import {
  grassMat, grassOuterMat, sidewalkMat, woodMat, darkWoodMat,
  metalMat, metalLightMat, stoneMat, stoneGrayMat, trunkMat,
  canopyMats, bushMats, cloudMat, lampGlowMat, windowMat,
  chimneyMat, doorMat, trampolineFrameMat, trampolinePadMat,
  sparkRingMat, highlightStoneMat, flowerStemMat, flowerPetalMats,
  awningMats, tileGapMat,
  hillGrassMat, hillDarkMat, hillSnowMat, isMobile,
} from './materials.js';

const _dummy = new THREE.Object3D();

export class WorldBuilder {
  constructor(scene, physicsWorld) {
    this.scene        = scene;
    this.physicsWorld = physicsWorld;
    this._meshes  = [];
    this._bodies  = [];
    this._instancedMeshes = [];

    // Animation data
    this._cloudData  = [];   // { imIdx, startX, dir }
    this._bushData   = [];   // { imIdx, baseY, offset }
    this.trampolines = [];
    this._signs      = [];   // decorative bobbing signs

    // Instanced meshes (created in buildLevel)
    this._cloudIM = null;
    this._bushIM  = null;
    this._trunkIM = null;
    this._canopyIMs = [];
    this._lampPoleIM = null;
    this._lampGlobeIM = null;
  }

  update(dt) {
    const t = Date.now() * 0.001;

    // Cloud drift (update instance matrices)
    if (this._cloudIM && this._cloudData.length > 0) {
      for (const c of this._cloudData) {
        c.x += 0.012 * c.dir;
        if (c.x > 100) c.x = -100;
        if (c.x < -100) c.x = 100;
        _dummy.position.set(c.x, c.y, c.z);
        _dummy.scale.set(c.sx, c.sy, c.sz);
        _dummy.updateMatrix();
        this._cloudIM.setMatrixAt(c.imIdx, _dummy.matrix);
      }
      this._cloudIM.instanceMatrix.needsUpdate = true;
    }

    // Bush bob
    if (this._bushIM && this._bushData.length > 0) {
      for (const b of this._bushData) {
        const y = b.baseY + Math.sin(t + b.offset) * 0.1;
        _dummy.position.set(b.x, y, b.z);
        _dummy.scale.set(b.sx, b.sy, b.sz);
        _dummy.updateMatrix();
        this._bushIM.setMatrixAt(b.imIdx, _dummy.matrix);
      }
      this._bushIM.instanceMatrix.needsUpdate = true;
    }

    // Trampoline pad bob
    for (const tp of this.trampolines) {
      const pad = tp.userData.pad;
      if (pad) pad.position.y = tp.userData.padBaseY + Math.sin(t * 4) * 0.05;
    }

    // Lamp glow flicker (living environment)
    if (this._lampGlobeIM) {
      const flicker = 0.25 + Math.sin(t * 3.7) * 0.08 + Math.sin(t * 7.1) * 0.04;
      lampGlowMat.emissiveIntensity = flicker;
    }

    // Sparkle float animation (grass)
    if (this._sparklePositions && this._sparkleGeo) {
      const sp = this._sparklePositions;
      for (let i = 0; i < sp.length / 3; i++) {
        sp[i * 3 + 1] += Math.sin(t * 1.5 + i * 0.7) * 0.003;
      }
      this._sparkleGeo.attributes.position.needsUpdate = true;
    }
    // Decorative sign bobbing (animated signage)
    if (this._signs) {
      for (const s of this._signs) {
        const bob = Math.sin(t * 1.5 + s.phase) * 0.15;
        const tilt = Math.sin(t * 0.8 + s.phase) * 0.05;
        if (s.board) {
          s.board.position.y = s.baseY + bob;
          s.board.rotation.z = tilt;
        }
      }
    }
  }

  buildLevel(levelData) {
    this.clear();

    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x99ddff, isMobile ? 60 : 120, isMobile ? 140 : 280);

    // ── Ground physics ──
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    groundBody.position.y = -0.02;
    this.physicsWorld.addBody(groundBody);
    this._bodies.push(groundBody);

    // ═══ PHASE 1: Instant (code-only, no GLB) — renders immediately ═══
    this._createGroundAreas();
    this._createHills();
    this._createFlowingPaths();
    this._createCentralPlaza();
    this._createTerrainDepth();
    this._createStreetLamps();
    this._createClouds();
    this._createTrampolines();
    this._createSteppingStones();
    this._createParkAreas();
    if (!isMobile) this._createFlowerBeds();
    if (!isMobile) this._createDecorativeSigns();

    if (levelData.platforms) {
      for (const p of levelData.platforms) this._addPlatform(...p);
    }

    // ═══ PHASE 2: Staggered GLB loading (one at a time, prevents choking) ═══
    this._loadAssetsStaggered();
  }

  async _loadAssetsStaggered() {
    // Procedural assets (instant, no GLB needed)
    this._createTrees();       // InstancedMesh — 2 draw calls
    this._createBushes();      // InstancedMesh — 1 draw call
    this._createRocks();       // InstancedMesh — 1 draw call
    if (!isMobile) {
      this._createFences();    // InstancedMesh — 2 draw calls
      this._createDistantBuildings(); // InstancedMesh — 1 draw call
    }

    // GLB assets (only 2-3 models — staggered)
    await new Promise(r => setTimeout(r, 50));
    this._createNeighborhoodBuildings(); // 2 GLBs: house + shop

    if (!isMobile) {
      await new Promise(r => setTimeout(r, 100));
      this._createCommunityHub(); // 1 GLB
    }

    console.log('[World] All assets loaded — GLBs: ' + (isMobile ? '2' : '3'));
  }

  /* ═══════════════════════════════════════════════════
     TERRAIN DEPTH — Gentle elevation changes for natural feel
     95% flat, small raised areas near buildings and along edges
     ═══════════════════════════════════════════════════ */
  _createTerrainDepth() {
    const bumpMat = new THREE.MeshStandardMaterial({
      color: 0x6AAF5C, roughness: 0.9,
    });

    // Gentle mounds near key locations
    const mounds = [
      // Raised area under house (0, -52) — sits on small hill
      { x: 0, z: -52, r: 6, h: 1.2 },
      // Slight rise near garden (25, -25)
      { x: 25, z: -25, r: 5, h: 0.8 },
      // Rise near community hub (-15, -15)
      { x: -15, z: -15, r: 5, h: 0.8 },
      // Gentle bump near toy store (30, 30)
      { x: 30, z: 30, r: 5, h: 0.6 },
      // Rise near recipe workshop (-38, 32)
      { x: -38, z: 32, r: 5, h: 0.7 },
      // Rolling terrain at edges
      { x: -45, z: 0, r: 8, h: 1.5 },
      { x: 45, z: 0, r: 7, h: 1.0 },
      { x: 0, z: 45, r: 6, h: 0.9 },
      { x: 0, z: -42, r: 5, h: 0.7 },
      // Small bumps scattered for variety
      { x: -20, z: -38, r: 4, h: 0.5 },
      { x: 35, z: -15, r: 3.5, h: 0.4 },
      { x: -15, z: 20, r: 4, h: 0.5 },
    ];

    const moundList = isMobile ? mounds.slice(0, 5) : mounds;

    for (const m of moundList) {
      // Flattened half-sphere for natural terrain bump
      const geo = new THREE.SphereGeometry(m.r, isMobile ? 8 : 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      const mesh = new THREE.Mesh(geo, bumpMat);
      mesh.scale.y = m.h / m.r; // flatten
      mesh.position.set(m.x, 0, m.z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this._meshes.push(mesh);
    }

    // Small ramp/steps near the arcade (-30, -52)
    const rampGeo = new THREE.BoxGeometry(4, 0.4, 2);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xCCBBA8, roughness: 0.7 });
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.position.set(-30, 0.2, -48);
    ramp.rotation.x = -0.15; // slight angle
    ramp.receiveShadow = true;
    this.scene.add(ramp);
    this._meshes.push(ramp);

    // Add physics for the ramp
    const rampBody = new CANNON.Body({ mass: 0 });
    rampBody.addShape(new CANNON.Box(new CANNON.Vec3(2, 0.2, 1)));
    rampBody.position.set(-30, 0.2, -48);
    rampBody.quaternion.setFromEuler(-0.15, 0, 0);
    this.physicsWorld.addBody(rampBody);
    this._bodies.push(rampBody);
  }

  /* ═══════════════════════════════════════════════════
     BUILDINGS — Clustered Flow Geometry™ GLB houses & shops
     Scattered asymmetrically per Phase 4 (no grid walls)
     ═══════════════════════════════════════════════════ */
  _createNeighborhoodBuildings() {
    // Asymmetric, scattered positions — NOT forming walls
    // Staggered placement with varied rotation for organic feel
    const buildingSpots = [
      // 1 house — behind the arcade (0, -38)
      { x: 0, z: -52, rot: 0, type: 'house' },
      // 1 shop (Recipe Workshop) — offset from Lemonade Stand at (-30, 30)
      { x: -38, z: 32, rot: -0.4, type: 'shop' },
    ];

    const targetHeight = 8; // Consistent building height

    const placeGLBBuilding = (model, spot) => {
      const box = new THREE.Box3().setFromObject(model);
      const sz = box.getSize(new THREE.Vector3());
      const s = targetHeight / (sz.y || 1);
      model.scale.setScalar(s);
      // Re-measure after scaling
      const box2 = new THREE.Box3().setFromObject(model);
      model.position.set(spot.x, -box2.min.y, spot.z);
      model.rotation.y = spot.rot;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = !isMobile;
          child.receiveShadow = true;
        }
      });
      this.scene.add(model);
      this._meshes.push(model);
    };

    // Load and place all buildings
    const placeAll = async () => {
      for (const spot of buildingSpots) {
        const loader = spot.type === 'shop' ? loadShopModel : loadHouseModel;
        const model = await loader();
        if (!model) {
          // Fallback: procedural box building
          const fallback = this._createFallbackBuilding(spot);
          this.scene.add(fallback);
          this._meshes.push(fallback);
          continue;
        }
        placeGLBBuilding(model, spot);
      }
      console.log(`[Buildings] Placed ${buildingSpots.length} CFG buildings`);
    };
    placeAll();
  }

  _createFallbackBuilding(spot) {
    const group = new THREE.Group();
    const h = 6 + Math.random() * 3;
    const bodyGeo = this._roundedBoxGeo(5, h, 5, 0.3);
    const colors = [0xFFBBCC, 0xBBDDFF, 0xFFEEAA, 0xBBEEBB, 0xDDBBFF];
    const bodyMat = new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)], roughness: 0.5 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = h / 2;
    body.castShadow = !isMobile;
    group.add(body);
    group.position.set(spot.x, 0, spot.z);
    group.rotation.y = spot.rot;
    return group;
  }

  _addYardDetails(buildingData) {
    const { x, z, w, faceFront, ci } = buildingData;
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0xEEDDCC, roughness: 0.7 });
    const fencePostGeo = new THREE.BoxGeometry(0.12, 0.8, 0.12);

    // Small fence in front yard
    let fenceX = x, fenceZ = z;
    let fenceLen = w + 2;
    let isHorizontal = true;

    if (faceFront === 'south') fenceZ = z + 4.5;
    else if (faceFront === 'north') fenceZ = z - 4.5;
    else if (faceFront === 'east') { fenceX = x - 4.5; isHorizontal = false; }
    else if (faceFront === 'west') { fenceX = x + 4.5; isHorizontal = false; }

    // Fence posts
    const postCount = 4;
    for (let i = 0; i < postCount; i++) {
      const t = (i / (postCount - 1) - 0.5) * fenceLen;
      const post = new THREE.Mesh(fencePostGeo, fenceMat);
      if (isHorizontal) post.position.set(x + t, 0.4, fenceZ);
      else post.position.set(fenceX, 0.4, z + t);
      this.scene.add(post);
      this._meshes.push(post);
    }

    // Fence rails
    for (let i = 0; i < postCount - 1; i++) {
      const t1 = (i / (postCount - 1) - 0.5) * fenceLen;
      const t2 = ((i + 1) / (postCount - 1) - 0.5) * fenceLen;
      const mid = (t1 + t2) / 2;
      const len = Math.abs(t2 - t1);
      for (const ry of [0.3, 0.6]) {
        if (isHorizontal) {
          const railGeo = new THREE.BoxGeometry(len, 0.06, 0.06);
          const rail = new THREE.Mesh(railGeo, fenceMat);
          rail.position.set(x + mid, ry, fenceZ);
          this.scene.add(rail); this._meshes.push(rail);
        } else {
          const railGeo = new THREE.BoxGeometry(0.06, 0.06, len);
          const rail = new THREE.Mesh(railGeo, fenceMat);
          rail.position.set(fenceX, ry, z + mid);
          this.scene.add(rail); this._meshes.push(rail);
        }
      }
    }

    // Mailbox (every other building)
    if (ci % 3 === 0) {
      const mailGroup = new THREE.Group();
      const mailPostGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6);
      const mailPost = new THREE.Mesh(mailPostGeo, new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.3 }));
      mailPost.position.y = 0.5;
      mailGroup.add(mailPost);
      const mailBoxGeo = new THREE.BoxGeometry(0.5, 0.35, 0.3);
      const mailBoxColors = [0xEE4444, 0x4488DD, 0x44AA55, 0xFFAA33];
      const mailBox = new THREE.Mesh(mailBoxGeo, new THREE.MeshStandardMaterial({ color: mailBoxColors[ci % 4], roughness: 0.5 }));
      mailBox.position.y = 1.1;
      mailGroup.add(mailBox);

      let mx = x + (w / 2 + 1.5), mz = z;
      if (faceFront === 'south') { mx = x + w / 2 + 1; mz = z + 3; }
      else if (faceFront === 'north') { mx = x + w / 2 + 1; mz = z - 3; }
      else if (faceFront === 'east') { mx = x - 3; mz = z + w / 2 + 1; }
      else if (faceFront === 'west') { mx = x + 3; mz = z + w / 2 + 1; }

      mailGroup.position.set(mx, 0, mz);
      this.scene.add(mailGroup);
      this._meshes.push(mailGroup);
    }

    // Planter box (every other building, offset from mailbox)
    if (ci % 3 === 1) {
      const planterGeo = new THREE.BoxGeometry(1.2, 0.5, 0.8);
      const planterMat = new THREE.MeshStandardMaterial({ color: 0xBB8855, roughness: 0.8 });
      const planter = new THREE.Mesh(planterGeo, planterMat);
      const soilGeo = new THREE.BoxGeometry(1.0, 0.1, 0.6);
      const soilMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 1.0 });
      const soil = new THREE.Mesh(soilGeo, soilMat);
      soil.position.y = 0.25;
      const planterGroup = new THREE.Group();
      planterGroup.add(planter);
      planterGroup.add(soil);
      // Add small round bushes in planter
      const pBushGeo = new THREE.SphereGeometry(0.25, 6, 6);
      const pBushMat = new THREE.MeshStandardMaterial({ color: 0x55AA55, roughness: 0.8 });
      for (const ox of [-0.3, 0.3]) {
        const pb = new THREE.Mesh(pBushGeo, pBushMat);
        pb.position.set(ox, 0.5, 0);
        planterGroup.add(pb);
      }

      let px = x - w / 2 - 1, pz = z;
      if (faceFront === 'south') { px = x - w / 2 - 0.5; pz = z + 3; }
      else if (faceFront === 'north') { px = x - w / 2 - 0.5; pz = z - 3; }
      else if (faceFront === 'east') { px = x - 3; pz = z - w / 2 - 0.5; }
      else if (faceFront === 'west') { px = x + 3; pz = z - w / 2 - 0.5; }

      planterGroup.position.set(px, 0.25, pz);
      this.scene.add(planterGroup);
      this._meshes.push(planterGroup);
    }
  }

  _createCartoonBuilding(bodyColor, roofColor, w, h, d, faceFront, idx) {
    const group = new THREE.Group();

    // ── Main body — rounded edges for toy-like feel ──
    const bodyGeo = this._roundedBoxGeo(w, h, d, 0.3);
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = h / 2;
    body.castShadow = !isMobile;
    body.receiveShadow = true;
    group.add(body);

    // ── Roof — varied styles for neighborhood feel ──
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.4 });
    const roofStyle = idx % 3;

    if (roofStyle === 0) {
      // ── Pitched / gable roof (triangle prism) ──
      const roofH = h * 0.35;
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2 - 0.3, 0);
      shape.lineTo(0, roofH);
      shape.lineTo(w / 2 + 0.3, 0);
      shape.closePath();
      const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: d + 0.6, bevelEnabled: false,
      });
      extrudeGeo.translate(0, 0, -(d + 0.6) / 2);
      const roof = new THREE.Mesh(extrudeGeo, roofMat);
      roof.position.y = h;
      roof.castShadow = !isMobile;
      group.add(roof);
    } else if (roofStyle === 1) {
      // ── Hip roof (4-sided sloped) — approximated with a squished cone ──
      const roofH = h * 0.3;
      const roofGeo = new THREE.ConeGeometry(
        Math.max(w, d) * 0.75, roofH, 4
      );
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = h + roofH / 2;
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(w / Math.max(w, d) * 1.1, 1, d / Math.max(w, d) * 1.1);
      roof.castShadow = !isMobile;
      group.add(roof);
    } else {
      // ── Flat roof with trim (original style but cleaner) ──
      const roofGeo = this._roundedBoxGeo(w + 0.6, 0.4, d + 0.6, 0.12);
      const roofBase = new THREE.Mesh(roofGeo, roofMat);
      roofBase.position.y = h + 0.2;
      roofBase.castShadow = !isMobile;
      group.add(roofBase);

      // Small railing on flat roof
      const railMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.5 });
      for (const [cx, cz] of [[-(w/2), (d/2)], [(w/2), (d/2)], [-(w/2), -(d/2)], [(w/2), -(d/2)]]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), railMat);
        post.position.set(cx, h + 0.65, cz);
        group.add(post);
      }
    }

    // ── Determine front face offset based on direction ──
    let frontX = 0, frontZ = 0, frontRot = 0;
    if (faceFront === 'south') { frontZ = d / 2 + 0.05; frontRot = 0; }
    else if (faceFront === 'north') { frontZ = -(d / 2 + 0.05); frontRot = Math.PI; }
    else if (faceFront === 'east')  { frontX = -(w / 2 + 0.05); frontRot = -Math.PI / 2; }
    else if (faceFront === 'west')  { frontX = (w / 2 + 0.05); frontRot = Math.PI / 2; }

    // ── Door ──
    const doorH = Math.min(2.2, h * 0.35);
    const doorGeo = new THREE.BoxGeometry(1.2, doorH, 0.15);
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(frontX, doorH / 2, frontZ);
    door.rotation.y = frontRot;
    group.add(door);

    // ── Awning over the door ──
    const awningW = 2.2;
    const awningD = 1.2;
    const awningGeo = new THREE.BoxGeometry(awningW, 0.1, awningD);
    const awning = new THREE.Mesh(awningGeo, awningMats[idx % awningMats.length]);
    const awningY = doorH + 0.3;
    if (faceFront === 'south') awning.position.set(0, awningY, d / 2 + awningD / 2);
    else if (faceFront === 'north') awning.position.set(0, awningY, -(d / 2 + awningD / 2));
    else if (faceFront === 'east') { awning.rotation.y = Math.PI / 2; awning.position.set(-(w / 2 + awningD / 2), awningY, 0); }
    else if (faceFront === 'west') { awning.rotation.y = Math.PI / 2; awning.position.set((w / 2 + awningD / 2), awningY, 0); }
    awning.castShadow = !isMobile;
    group.add(awning);

    // ── Awning front slant piece ──
    const slantGeo = new THREE.BoxGeometry(awningW, 0.6, 0.08);
    const slant = new THREE.Mesh(slantGeo, awningMats[idx % awningMats.length]);
    if (faceFront === 'south') slant.position.set(0, awningY - 0.25, d / 2 + awningD);
    else if (faceFront === 'north') slant.position.set(0, awningY - 0.25, -(d / 2 + awningD));
    else if (faceFront === 'east') { slant.rotation.y = Math.PI / 2; slant.position.set(-(w / 2 + awningD), awningY - 0.25, 0); }
    else if (faceFront === 'west') { slant.rotation.y = Math.PI / 2; slant.position.set((w / 2 + awningD), awningY - 0.25, 0); }
    group.add(slant);

    // ── Windows — multiple per floor, on front face ──
    const winGeo = new THREE.BoxGeometry(0.8, 1.0, 0.1);
    const numFloors = Math.max(1, Math.floor((h - 1) / 3));
    const winPositions = w > 5 ? [-w * 0.3, 0, w * 0.3] : [-w * 0.25, w * 0.25];

    for (let f = 0; f < numFloors; f++) {
      const wy = 3.5 + f * 3;
      if (wy > h - 1) break;
      for (const wx of winPositions) {
        const win = new THREE.Mesh(winGeo, windowMat);
        if (faceFront === 'south') win.position.set(wx, wy, d / 2 + 0.05);
        else if (faceFront === 'north') win.position.set(wx, wy, -(d / 2 + 0.05));
        else if (faceFront === 'east') win.position.set(-(w / 2 + 0.05), wy, wx);
        else if (faceFront === 'west') win.position.set((w / 2 + 0.05), wy, wx);
        win.rotation.y = frontRot;
        group.add(win);
      }

      // Side windows (one per side per floor)
      if (faceFront === 'south' || faceFront === 'north') {
        for (const sx of [-1, 1]) {
          const sideWin = new THREE.Mesh(winGeo, windowMat);
          sideWin.rotation.y = Math.PI / 2;
          sideWin.position.set(sx * (w / 2 + 0.05), wy, 0);
          group.add(sideWin);
        }
      } else {
        for (const sz of [-1, 1]) {
          const sideWin = new THREE.Mesh(winGeo, windowMat);
          sideWin.position.set(0, wy, sz * (d / 2 + 0.05));
          group.add(sideWin);
        }
      }
    }

    // ── Ground-floor storefront windows (large) ──
    const shopWinGeo = new THREE.BoxGeometry(1.4, 1.4, 0.1);
    for (const wx of [-w * 0.3, w * 0.3]) {
      const shopWin = new THREE.Mesh(shopWinGeo, windowMat);
      shopWin.position.set(
        faceFront === 'east' || faceFront === 'west' ? frontX : wx,
        1.2,
        faceFront === 'south' || faceFront === 'north' ? frontZ : wx
      );
      shopWin.rotation.y = frontRot;
      group.add(shopWin);
    }

    // ── Rooftop decorations (only on flat-roof buildings) ──
    if (roofStyle === 2) {
      const deco = idx % 3;
      if (deco === 0) {
        // Small chimney
        const chimGeo = new THREE.BoxGeometry(0.6, 1.5, 0.6);
        const chimney = new THREE.Mesh(chimGeo, chimneyMat);
        chimney.position.set(w * 0.25, h + 1.15, -d * 0.2);
        chimney.castShadow = !isMobile;
        group.add(chimney);
      } else if (deco === 1) {
        // Water tank (toy-like cylinder)
        const tankGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 8);
        const tank = new THREE.Mesh(tankGeo, new THREE.MeshStandardMaterial({ color: 0xAABBCC, roughness: 0.5 }));
        tank.position.set(-w * 0.2, h + 0.8, d * 0.15);
        group.add(tank);
      }
    } else if (roofStyle === 0) {
      // Chimney on pitched roof
      const chimGeo = new THREE.BoxGeometry(0.5, 1.5, 0.5);
      const chimney = new THREE.Mesh(chimGeo, chimneyMat);
      chimney.position.set(w * 0.25, h + h * 0.2, -d * 0.2);
      chimney.castShadow = !isMobile;
      group.add(chimney);
    }

    return group;
  }

  /* ═══════════════════════════════════════════════════
     FLOWING PATHS — Simple soft pavement curved walkways
     ═══════════════════════════════════════════════════ */
  _createFlowingPaths() {
    const pathMat = new THREE.MeshStandardMaterial({ color: 0xD8CCBB, roughness: 0.75 });

    const pathDefs = [
      { points: [{x:0,z:0},{x:8,z:-8},{x:18,z:-16},{x:28,z:-22},{x:38,z:-30},{x:48,z:-35}], width: 5 },
      { points: [{x:0,z:0},{x:-10,z:-6},{x:-22,z:-14},{x:-30,z:-24},{x:-38,z:-32}], width: 5 },
      { points: [{x:0,z:0},{x:6,z:10},{x:14,z:20},{x:20,z:30},{x:24,z:40}], width: 5 },
      { points: [{x:0,z:0},{x:-8,z:8},{x:-18,z:18},{x:-28,z:26},{x:-38,z:32}], width: 5 },
      { points: [{x:0,z:0},{x:-2,z:-12},{x:-4,z:-24},{x:-2,z:-38},{x:0,z:-48}], width: 4 },
      { points: [{x:0,z:0},{x:2,z:14},{x:0,z:28},{x:-2,z:40},{x:0,z:50}], width: 4 },
      { points: [{x:28,z:-22},{x:34,z:-16},{x:38,z:-8},{x:40,z:0}], width: 3.5 },
      { points: [{x:14,z:20},{x:24,z:18},{x:34,z:14},{x:42,z:10}], width: 3.5 },
      { points: [{x:-22,z:-14},{x:-30,z:-8},{x:-36,z:0},{x:-40,z:10}], width: 3.5 },
    ];

    this._pathCurves = [];

    for (const def of pathDefs) {
      const curve = new THREE.CatmullRomCurve3(
        def.points.map(p => new THREE.Vector3(p.x, 0, p.z))
      );
      this._pathCurves.push({ curve, width: def.width });

      const segments = 48;
      const hw = def.width * 0.5;
      const positions = [];
      const indices = [];

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const pt = curve.getPointAt(t);
        const tan = curve.getTangentAt(t);
        const nx = -tan.z, nz = tan.x;
        const len = Math.sqrt(nx * nx + nz * nz) || 1;
        const px = nx / len, pz = nz / len;

        positions.push(
          pt.x + px * hw, 0.06, pt.z + pz * hw,
          pt.x - px * hw, 0.06, pt.z - pz * hw,
        );

        if (i < segments) {
          const b = i * 2;
          indices.push(b, b+1, b+2, b+1, b+3, b+2);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, pathMat);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this._meshes.push(mesh);
    }

    // Grass sparkles
    this._createGrassSparkles();
  }

  _createGrassSparkles() {
    const count = isMobile ? 20 : 150;
    const sparkleGeo = new THREE.BufferGeometry();
    const sparklePositions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 55;
      sparklePositions[i * 3] = Math.cos(angle) * dist;
      sparklePositions[i * 3 + 1] = 0.5 + Math.random() * 3;
      sparklePositions[i * 3 + 2] = Math.sin(angle) * dist;
    }
    sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));

    const sparkleMat = new THREE.PointsMaterial({
      color: 0xAAFFEE, size: 0.3, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sparkles = new THREE.Points(sparkleGeo, sparkleMat);
    this.scene.add(sparkles);
    this._meshes.push(sparkles);
    this._sparklePositions = sparklePositions;
    this._sparkleGeo = sparkleGeo;
  }

  /* ═══════════════════════════════════════════════════
     GROUND AREAS — Grass, blue plains, outer landscape
     ═══════════════════════════════════════════════════ */
  _createGroundAreas() {
    // ── FULL ground cover — NO black patches anywhere ──
    // Giant grass base covering the entire play area
    const fullGroundGeo = new THREE.PlaneGeometry(200, 200);
    const fullGround = new THREE.Mesh(fullGroundGeo, grassMat);
    fullGround.rotation.x = -Math.PI / 2;
    fullGround.position.y = -0.01;
    fullGround.receiveShadow = true;
    this.scene.add(fullGround);
    this._meshes.push(fullGround);

    // ── Grass patches (between roads — the 4 quadrants) slightly raised ──
    const grassAreas = [
      { x: -30, z: -30, w: 50, d: 50 },
      { x:  30, z: -30, w: 50, d: 50 },
      { x: -30, z:  30, w: 50, d: 50 },
      { x:  30, z:  30, w: 50, d: 50 },
    ];
    for (const g of grassAreas) {
      const geo = new THREE.PlaneGeometry(g.w, g.d);
      const mesh = new THREE.Mesh(geo, grassMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(g.x, 0.01, g.z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this._meshes.push(mesh);
    }

    // ── Light green patches along building edges ──
    const edgeGrass = [
      { x:   0, z: -60, w: 130, d: 20 },
      { x:   0, z:  60, w: 130, d: 20 },
      { x: -60, z:   0, w: 20,  d: 130 },
      { x:  60, z:   0, w: 20,  d: 130 },
    ];
    for (const g of edgeGrass) {
      const geo = new THREE.PlaneGeometry(g.w, g.d);
      const mesh = new THREE.Mesh(geo, grassOuterMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(g.x, 0.005, g.z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this._meshes.push(mesh);
    }

    // ── Soft transition patches at road/grass borders ──
    const blendMat = new THREE.MeshStandardMaterial({
      color: 0x8ABB7A, roughness: 0.9, transparent: true, opacity: 0.6,
    });
    // Scatter soft circles along road edges to break the hard line
    const blendGeo = new THREE.CircleGeometry(1.5, 12);
    const blendPositions = [];
    for (let z = -48; z <= 48; z += 4) {
      blendPositions.push({ x: -5.8, z }, { x: 5.8, z });
    }
    for (let x = -48; x <= 48; x += 4) {
      blendPositions.push({ x, z: -5.8 }, { x, z: 5.8 });
    }
    for (const bp of blendPositions) {
      const blend = new THREE.Mesh(blendGeo, blendMat);
      blend.rotation.x = -Math.PI / 2;
      blend.position.set(bp.x + (Math.random() - 0.5) * 1.5, 0.02, bp.z + (Math.random() - 0.5) * 1.5);
      blend.scale.setScalar(0.8 + Math.random() * 0.6);
      this.scene.add(blend);
      this._meshes.push(blend);
    }

    // ── Dirt path patches (natural transition near buildings) ──
    const dirtMat = new THREE.MeshStandardMaterial({ color: 0xC4A882, roughness: 0.9 });
    const dirtGeo = new THREE.CircleGeometry(2.5, 12);
    const dirtPatches = [
      { x: -30, z: -40 }, { x: 30, z: -40 },
      { x: -30, z: 40 }, { x: 30, z: 40 },
      { x: -42, z: -20 }, { x: 42, z: -20 },
      { x: -42, z: 20 }, { x: 42, z: 20 },
    ];
    for (const dp of dirtPatches) {
      const dirt = new THREE.Mesh(dirtGeo, dirtMat);
      dirt.rotation.x = -Math.PI / 2;
      dirt.position.set(dp.x, 0.015, dp.z);
      dirt.scale.setScalar(0.8 + Math.random() * 0.5);
      this.scene.add(dirt);
      this._meshes.push(dirt);
    }

    // ── Outer grass ring (far landscape) ──
    const outerGeo = new THREE.CircleGeometry(200, 48);
    const outer = new THREE.Mesh(outerGeo, grassOuterMat);
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    outer.receiveShadow = true;
    this.scene.add(outer);
    this._meshes.push(outer);
  }

  /* ═══════════════════════════════════════════════════
     HILLS & MOUNTAINS — Scattered around outer areas
     ═══════════════════════════════════════════════════ */
  _createHills() {
    const allHills = [
      // Large mountains in the far background
      { x: -85, z: -70, r: 18, h: 22, mat: hillGrassMat, snow: true },
      { x:  90, z: -80, r: 15, h: 18, mat: hillDarkMat,  snow: true },
      { x: -80, z:  85, r: 20, h: 25, mat: hillGrassMat, snow: true },
      { x:  85, z:  75, r: 14, h: 16, mat: hillDarkMat,  snow: true },
      // Medium hills closer in
      { x: -65, z: -45, r: 8, h: 8, mat: hillGrassMat, snow: false },
      { x:  70, z: -40, r: 10, h: 10, mat: hillDarkMat, snow: false },
      { x: -70, z:  50, r: 9, h: 9, mat: hillGrassMat, snow: false },
      { x:  65, z:  45, r: 7, h: 7, mat: hillDarkMat, snow: false },
      // Small rolling hills near edges
      { x: -50, z: -65, r: 6, h: 4, mat: hillGrassMat, snow: false },
      { x:  55, z: -60, r: 5, h: 3.5, mat: hillGrassMat, snow: false },
      { x: -55, z:  65, r: 7, h: 5, mat: hillDarkMat, snow: false },
      { x:  50, z:  60, r: 5, h: 3, mat: hillGrassMat, snow: false },
      // Extra background peaks
      { x:   0, z: -95, r: 16, h: 20, mat: hillGrassMat, snow: true },
      { x:   0, z:  95, r: 14, h: 17, mat: hillDarkMat, snow: true },
      { x: -95, z:   0, r: 12, h: 15, mat: hillGrassMat, snow: true },
      { x:  95, z:   0, r: 13, h: 16, mat: hillDarkMat, snow: true },
    ];
    // Mobile: only large mountains (first 4) for background depth
    const hills = isMobile ? allHills.slice(0, 4) : allHills;

    for (const hill of hills) {
      const group = new THREE.Group();

      // Main hill body (cone)
      const coneGeo = new THREE.ConeGeometry(hill.r, hill.h, isMobile ? 8 : 16);
      const cone = new THREE.Mesh(coneGeo, hill.mat);
      cone.position.y = hill.h / 2;
      cone.castShadow = !isMobile;
      cone.receiveShadow = true;
      group.add(cone);

      // Snow cap on tall mountains
      if (hill.snow) {
        const snowR = hill.r * 0.35;
        const snowH = hill.h * 0.25;
        const snowGeo = new THREE.ConeGeometry(snowR, snowH, isMobile ? 6 : 12);
        const snow = new THREE.Mesh(snowGeo, hillSnowMat);
        snow.position.y = hill.h - snowH * 0.3;
        group.add(snow);
      }

      // Base blend (flattened sphere to smooth the ground transition)
      const baseGeo = new THREE.SphereGeometry(hill.r * 1.1, isMobile ? 8 : 12, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      const base = new THREE.Mesh(baseGeo, hill.mat);
      base.scale.y = 0.3;
      base.receiveShadow = true;
      group.add(base);

      group.position.set(hill.x, 0, hill.z);
      this.scene.add(group);
      this._meshes.push(group);
    }
  }

  /* _createCurvedPathways removed — replaced by _createFlowingPaths */

  /* ═══════════════════════════════════════════════════
     CENTRAL PLAZA — Expanded hub around the fountain
     ═══════════════════════════════════════════════════ */
  _createCentralPlaza() {
    // Simple circular plaza
    const plazaGeo = new THREE.CircleGeometry(14, 32);
    const plazaMat = new THREE.MeshStandardMaterial({ color: 0xE8D5BB, roughness: 0.7 });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, 0.07, 0);
    plaza.receiveShadow = true;
    this.scene.add(plaza);
    this._meshes.push(plaza);

    // Decorative ring border
    const borderGeo = new THREE.RingGeometry(13.5, 14.5, 32);
    const borderMat = new THREE.MeshStandardMaterial({
      color: 0xFFDD88, roughness: 0.4, emissive: 0xFFAA44, emissiveIntensity: 0.1,
    });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.rotation.x = -Math.PI / 2;
    border.position.set(0, 0.08, 0);
    this.scene.add(border);
    this._meshes.push(border);
  }

  /* ═══════════════════════════════════════════════════
     STREET LAMPS — InstancedMesh (poles + globes)
     ═══════════════════════════════════════════════════ */
  _createStreetLamps() {
    // Lamp positions along flowing paths (offset from benches/objects)
    const positions = [
      // Along NE path (shifted to avoid bench at 10,-10)
      { x: 14, z: -10 }, { x: 22, z: -18 }, { x: 36, z: -28 },
      // Along NW path
      { x: -12, z: -8 }, { x: -26, z: -20 }, { x: -34, z: -30 },
      // Along SE path
      { x: 8, z: 12 }, { x: 16, z: 22 }, { x: 22, z: 35 },
      // Along SW path (shifted to avoid bench at -10,10)
      { x: -14, z: 10 }, { x: -22, z: 22 }, { x: -32, z: 30 },
      // Along N connector
      { x: -2, z: -18 }, { x: 0, z: -38 },
      // Around plaza
      { x: 12, z: 6 }, { x: -12, z: -6 },
    ];

    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4, 6);
    const globeGeo = new THREE.SphereGeometry(0.3, 6, 6);
    const count = positions.length;

    this._lampPoleIM = new THREE.InstancedMesh(poleGeo, metalMat, count);
    this._lampGlobeIM = new THREE.InstancedMesh(globeGeo, lampGlowMat, count);

    for (let i = 0; i < count; i++) {
      _dummy.position.set(positions[i].x, 2, positions[i].z);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      this._lampPoleIM.setMatrixAt(i, _dummy.matrix);

      _dummy.position.set(positions[i].x, 4.2, positions[i].z);
      _dummy.updateMatrix();
      this._lampGlobeIM.setMatrixAt(i, _dummy.matrix);
    }

    this._lampPoleIM.castShadow = !isMobile;
    this.scene.add(this._lampPoleIM);
    this.scene.add(this._lampGlobeIM);
    this._instancedMeshes.push(this._lampPoleIM, this._lampGlobeIM);
  }

  /* ═══════════════════════════════════════════════════
     CLOUDS — InstancedMesh (all cloud parts)
     ═══════════════════════════════════════════════════ */
  _createClouds() {
    const cloudCount = isMobile ? 4 : 14;
    const partsPerCloud = isMobile ? 2 : 5;
    const totalParts = cloudCount * partsPerCloud;

    const sphereGeo = new THREE.SphereGeometry(1, isMobile ? 8 : 12, isMobile ? 8 : 12);
    this._cloudIM = new THREE.InstancedMesh(sphereGeo, cloudMat, totalParts);
    this._cloudIM.castShadow = !isMobile;

    let idx = 0;
    for (let c = 0; c < cloudCount; c++) {
      const cx = (Math.random() - 0.5) * 180;
      const cy = 20 + Math.random() * 12;
      const cz = (Math.random() - 0.5) * 180;
      const dir = c % 2 === 0 ? 1 : -1;

      for (let p = 0; p < partsPerCloud; p++) {
        const size = 1.5 + Math.random();
        const ox = (p - Math.floor(partsPerCloud / 2)) * 1.5;
        const oy = Math.random() * 0.5;
        const oz = (Math.random() - 0.5);

        this._cloudData.push({
          imIdx: idx,
          x: cx + ox, y: cy + oy, z: cz + oz,
          sx: size, sy: size, sz: size,
          dir, baseOx: ox, baseOy: oy, baseOz: oz,
          cloudCx: cx,
        });

        _dummy.position.set(cx + ox, cy + oy, cz + oz);
        _dummy.scale.setScalar(size);
        _dummy.updateMatrix();
        this._cloudIM.setMatrixAt(idx, _dummy.matrix);
        idx++;
      }
    }

    this.scene.add(this._cloudIM);
    this._instancedMeshes.push(this._cloudIM);
  }

  /* ═══════════════════════════════════════════════════
     BUSHES — InstancedMesh (procedural, 1 draw call for all)
     ═══════════════════════════════════════════════════ */
  _createBushes() {
    const count = isMobile ? 6 : 16;
    const positions = [];
    let attempts = 0;
    while (positions.length < count && attempts < 500) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const dist = 12 + Math.random() * 50;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
      positions.push({ x, z, s: 0.8 + Math.random() * 1.2 });
    }

    // Single InstancedMesh = 1 draw call for ALL bushes
    const bushGeo = new THREE.SphereGeometry(1, 8, 6);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x55AA44, roughness: 0.85 });
    const im = new THREE.InstancedMesh(bushGeo, bushMat, count);
    im.castShadow = !isMobile;
    im.receiveShadow = true;

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      _dummy.position.set(p.x, p.s * 0.4, p.z);
      _dummy.scale.set(p.s, p.s * 0.6, p.s);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
    }
    this.scene.add(im);
    this._instancedMeshes.push(im);
  }

  /* ═══════════════════════════════════════════════════
     TREES — InstancedMesh (procedural, 2 draw calls total)
     ═══════════════════════════════════════════════════ */
  _createTrees() {
    const allTreePos = [
      { x: -12, z: -12 }, { x: 12, z: -12 }, { x: -12, z: 12 }, { x: 12, z: 12 },
      { x: -28, z: 10 }, { x: 28, z: 10 }, { x: 10, z: -28 }, { x: 10, z: 28 },
      { x: -25, z: -25 }, { x: 32, z: -20 }, { x: -25, z: 25 }, { x: 25, z: 25 },
      { x: -40, z: -15 }, { x: 40, z: 20 }, { x: -18, z: 40 }, { x: 18, z: -40 },
    ].filter(p => !(Math.abs(p.x) < 8 && Math.abs(p.z) < 8));
    const treePositions = isMobile ? allTreePos.slice(0, 6) : allTreePos;
    const count = treePositions.length;

    // Trunk InstancedMesh (1 draw call)
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 3, 6);
    const im_trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    im_trunk.castShadow = !isMobile;

    // Canopy InstancedMesh (1 draw call) — clustered sphere look
    const canopyGeo = new THREE.SphereGeometry(1.8, isMobile ? 6 : 8, isMobile ? 6 : 8);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x44AA33, roughness: 0.85 });
    const im_canopy = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
    im_canopy.castShadow = !isMobile;
    im_canopy.receiveShadow = true;

    for (let i = 0; i < count; i++) {
      const p = treePositions[i];
      const s = 0.8 + Math.random() * 0.6;

      // Trunk
      _dummy.position.set(p.x, 1.5 * s, p.z);
      _dummy.scale.set(s, s, s);
      _dummy.updateMatrix();
      im_trunk.setMatrixAt(i, _dummy.matrix);

      // Canopy (above trunk)
      _dummy.position.set(p.x, 3.5 * s, p.z);
      _dummy.scale.set(s * 1.1, s * 0.9, s * 1.1);
      _dummy.updateMatrix();
      im_canopy.setMatrixAt(i, _dummy.matrix);
    }

    this.scene.add(im_trunk);
    this.scene.add(im_canopy);
    this._instancedMeshes.push(im_trunk, im_canopy);
    console.log(`[Trees] ${count} trees (2 draw calls via InstancedMesh)`);
  }

  /* ═══════════════════════════════════════════════════
     FLOWER BEDS — Small groups near center
     ═══════════════════════════════════════════════════ */
  _createFlowerBeds() {
    if (isMobile) return; // 56 meshes — skip on mobile
    const bedPositions = [
      { x: -15, z: -15 }, { x: 15, z: -15 }, { x: -15, z: 15 }, { x: 15, z: 15 },
    ];
    for (const pos of bedPositions) {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 3), woodMat));
      const soil = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 2.6), darkWoodMat);
      soil.position.y = 0.15;
      group.add(soil);
      for (let i = 0; i < 6; i++) {
        const fx = (Math.random() - 0.5) * 2, fz = (Math.random() - 0.5) * 2;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), flowerStemMat);
        stem.position.set(fx, 0.45, fz);
        group.add(stem);
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.15, 5, 5), flowerPetalMats[i % 6]);
        petal.position.set(fx, 0.75, fz);
        group.add(petal);
      }
      group.position.set(pos.x, 0, pos.z);
      this.scene.add(group);
      this._meshes.push(group);
    }
  }

  /* ═══════════════════════════════════════════════════
     TRAMPOLINES — Keep as groups (have physics bodies)
     ═══════════════════════════════════════════════════ */
  _createTrampolines() {
    const allTrampolines = [
      { x: 20, z: -32 }, { x: -18, z: 28 }, { x: -26, z: -36 }, { x: 30, z: 18 },
      { x: 12, z: 38 }, { x: -36, z: -10 },
    ];
    const positions = isMobile ? allTrampolines.slice(0, 2) : allTrampolines;

    for (const pos of positions) {
      const group = new THREE.Group();

      const frameGeo = new THREE.TorusGeometry(1.2, 0.12, 6, 12);
      const frame = new THREE.Mesh(frameGeo, trampolineFrameMat);
      frame.rotation.x = Math.PI / 2;
      frame.position.y = 0.4;
      group.add(frame);

      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 4), metalMat);
        leg.position.set(Math.cos(angle) * 1.0, 0.2, Math.sin(angle) * 1.0);
        group.add(leg);
      }

      const padGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.08, 12);
      const pad = new THREE.Mesh(padGeo, trampolinePadMat);
      pad.position.y = 0.4;
      group.add(pad);

      group.position.set(pos.x, 0, pos.z);
      group.userData.pad = pad;
      group.userData.padBaseY = 0.4;
      this.scene.add(group);
      this._meshes.push(group);
      this.trampolines.push(group);

      const body = new CANNON.Body({ mass: 0 });
      body.addShape(new CANNON.Cylinder(1.1, 1.1, 0.15, 8));
      body.position.set(pos.x, 0.35, pos.z);
      body.material = new CANNON.Material({ restitution: 2.5 });
      this.physicsWorld.addBody(body);
      this._bodies.push(body);
    }
  }

  /* ═══════════════════════════════════════════════════
     STEPPING STONES
     ═══════════════════════════════════════════════════ */
  _createSteppingStones() {
    const path1 = [
      { x: 8, z: 10, r: 0.6 }, { x: 13, z: 16, r: 0.5 },
      { x: 18, z: 22, r: 0.7 }, { x: 23, z: 28, r: 0.5 },
    ];
    const path2 = [
      { x: -8, z: -10, r: 0.6 }, { x: -14, z: -16, r: 0.5 },
      { x: -20, z: -22, r: 0.7 }, { x: -25, z: -27, r: 0.5 },
    ];

    for (const paths of [path1, path2]) {
      paths.forEach((s, i) => {
        const mat = i === paths.length - 1 ? highlightStoneMat : stoneMat;
        const geo = new THREE.CylinderGeometry(s.r, s.r + 0.1, 0.2, 8);
        const stone = new THREE.Mesh(geo, mat);
        stone.position.set(s.x, 0.1, s.z);
        stone.receiveShadow = true;
        this.scene.add(stone);
        this._meshes.push(stone);
      });
    }
  }

  /* ═══════════════════════════════════════════════════
     PARK AREAS — Benches, picnic table
     ═══════════════════════════════════════════════════ */
  _createParkAreas() {
    const benchPositions = [
      { x: 10, z: -10, ry: 0 }, { x: -10, z: 10, ry: Math.PI / 2 },
      { x: 35, z: 20, ry: -0.3 }, { x: -35, z: -20, ry: 0.5 },
      { x: 0, z: 20, ry: 0 }, { x: 20, z: 0, ry: Math.PI / 2 },
    ];
    for (const bp of benchPositions) {
      const bench = new THREE.Group();
      bench.add(new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.15, 0.7), woodMat));
      bench.children[0].position.y = 0.55;
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.7, 0.12), woodMat);
      back.position.set(0, 1.0, -0.3);
      bench.add(back);
      for (const lx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.5), metalLightMat);
        leg.position.set(lx, 0.28, 0);
        bench.add(leg);
      }
      bench.position.set(bp.x, 0, bp.z);
      bench.rotation.y = bp.ry;
      this.scene.add(bench);
      this._meshes.push(bench);
    }

    // Picnic table
    const picnic = new THREE.Group();
    picnic.add(new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 1.5), woodMat));
    picnic.children[0].position.y = 1.0;
    for (const side of [-0.9, 0.9]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.5), woodMat);
      plank.position.set(0, 0.6, side);
      picnic.add(plank);
    }
    for (const lx of [-1.2, 1.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 2.5), woodMat);
      leg.position.set(lx, 0.5, 0);
      picnic.add(leg);
    }
    picnic.position.set(-10, 0, -25);
    this.scene.add(picnic);
    this._meshes.push(picnic);
  }

  /* ═══════════════════════════════════════════════════
     SPARK RING TRAILS
     ═══════════════════════════════════════════════════ */
  _createSparkRingTrails() {
    // Spark rings along flowing paths (discovery cues)
    const ringPositions = [
      // Along NE path
      { x: 14, z: -12 }, { x: 24, z: -20 },
      // Along SE path
      { x: 10, z: 16 }, { x: 18, z: 28 },
      // Along NW path
      { x: -16, z: -12 }, { x: -28, z: -22 },
      // Along SW path
      { x: -14, z: 14 }, { x: -24, z: 24 },
      // Along connectors
      { x: -1, z: -20 }, { x: 1, z: 20 },
    ];

    const ringGeo = new THREE.TorusGeometry(1.2, 0.08, 6, 16);
    for (const p of ringPositions) {
      const ring = new THREE.Mesh(ringGeo, sparkRingMat);
      ring.position.set(p.x, 2.0, p.z);
      ring.rotation.x = Math.PI / 4;
      ring.rotation.y = Math.random() * Math.PI;
      this.scene.add(ring);
      this._meshes.push(ring);
    }
  }

  /* ═══════════════════════════════════════════════════
     DECORATIVE SIGNS — Bobbing signage near shops
     Animated in update() for living environment feel
     ═══════════════════════════════════════════════════ */
  _createDecorativeSigns() {
    this._signs = [];
    const signDefs = [
      { x: 36, z: 12, text: 'SHOP', color: 0xFF7799 },
      { x: -36, z: 12, text: 'PLAY', color: 0x66BBEE },
      { x: 28, z: 32, text: 'TOYS', color: 0xFFCC55 },
      { x: -28, z: 32, text: 'CAFE', color: 0x77DD88 },
      { x: -28, z: -28, text: 'FIND', color: 0xCC88FF },
      { x: 20, z: -18, text: 'GROW', color: 0x44FF88 },
    ];

    for (const def of signDefs) {
      const group = new THREE.Group();

      // Sign post
      const postGeo = new THREE.CylinderGeometry(0.1, 0.12, 3, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.4 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.y = 1.5;
      group.add(post);

      // Sign board (rounded box)
      const boardGeo = this._roundedBoxGeo(2.5, 1.2, 0.2, 0.1);
      const boardMat = new THREE.MeshStandardMaterial({
        color: def.color, roughness: 0.4,
        emissive: def.color, emissiveIntensity: 0.15,
      });
      const board = new THREE.Mesh(boardGeo, boardMat);
      board.position.y = 3.5;
      board.castShadow = !isMobile;
      group.add(board);

      group.position.set(def.x, 0, def.z);
      this.scene.add(group);
      this._meshes.push(group);
      this._signs.push({ group, baseY: 3.5, phase: Math.random() * Math.PI * 2, board });
    }
  }

  /* ═══════════════════════════════════════════════════
     ROCKS — Scattered around landscape for natural feel
     ═══════════════════════════════════════════════════ */
  _createRocks() {
    const allSpots = [
      { x: -18, z: -20, s: 1.5 }, { x: 22, z: -35, s: 1.2 },
      { x: -35, z: 15, s: 1.8 }, { x: 30, z: 38, s: 1.4 },
      { x: -12, z: 35, s: 1.0 }, { x: 40, z: -15, s: 1.5 },
      { x: -42, z: -25, s: 1.2 }, { x: 15, z: -42, s: 1.6 },
    ];
    const spots = isMobile ? allSpots.slice(0, 4) : allSpots;

    // Procedural rocks — 1 draw call via InstancedMesh
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x998877, roughness: 0.9 });
    const im = new THREE.InstancedMesh(rockGeo, rockMat, spots.length);
    im.castShadow = !isMobile;
    im.receiveShadow = true;

    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      _dummy.position.set(s.x, s.s * 0.3, s.z);
      _dummy.scale.set(s.s, s.s * 0.6, s.s);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
    }
    this.scene.add(im);
    this._instancedMeshes.push(im);
  }

  /* ═══════════════════════════════════════════════════
     FENCES — Around garden and house areas
     ═══════════════════════════════════════════════════ */
  _createFences() {
    if (isMobile) return;
    // Procedural fence posts + rails — InstancedMesh (2 draw calls)
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x8B6B4A, roughness: 0.8 });
    const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.2, 5);
    const railGeo = new THREE.BoxGeometry(3, 0.1, 0.08);

    // Garden perimeter posts
    const postPositions = [];
    for (let x = 17; x <= 33; x += 4) {
      postPositions.push({ x, z: -19 }, { x, z: -31 });
    }
    // Side posts
    for (let z = -22; z >= -28; z -= 3) {
      postPositions.push({ x: 16, z }, { x: 34, z });
    }
    // House yard
    postPositions.push({ x: -3, z: -49 }, { x: 0, z: -49 }, { x: 3, z: -49 });

    const postIM = new THREE.InstancedMesh(postGeo, fenceMat, postPositions.length);
    for (let i = 0; i < postPositions.length; i++) {
      _dummy.position.set(postPositions[i].x, 0.6, postPositions[i].z);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      postIM.setMatrixAt(i, _dummy.matrix);
    }
    this.scene.add(postIM);
    this._instancedMeshes.push(postIM);

    // Rails along garden front and back
    const rails = [
      { x: 25, z: -19 }, { x: 25, z: -31 },
      { x: -1, z: -49 },
    ];
    const railIM = new THREE.InstancedMesh(railGeo, fenceMat, rails.length * 2);
    let ri = 0;
    for (const r of rails) {
      // Top rail
      _dummy.position.set(r.x, 0.9, r.z);
      _dummy.scale.set(2.5, 1, 1);
      _dummy.updateMatrix();
      railIM.setMatrixAt(ri++, _dummy.matrix);
      // Bottom rail
      _dummy.position.set(r.x, 0.4, r.z);
      _dummy.updateMatrix();
      railIM.setMatrixAt(ri++, _dummy.matrix);
    }
    this.scene.add(railIM);
    this._instancedMeshes.push(railIM);
  }

  /* ═══════════════════════════════════════════════════
     COMMUNITY HUB — Central meeting building near plaza
     ═══════════════════════════════════════════════════ */
  _createCommunityHub() {
    if (isMobile) return; // Skip on mobile — too heavy
    loadCommunityHubModel().then((model) => {
      if (!model) return;
      const targetHeight = 6; // Reduced from 10 — was too large
      const box = new THREE.Box3().setFromObject(model);
      const sz = box.getSize(new THREE.Vector3());
      const scale = targetHeight / (sz.y || 1);
      model.scale.setScalar(scale);
      const box2 = new THREE.Box3().setFromObject(model);
      const center = box2.getCenter(new THREE.Vector3());
      // Moved to (-15, -15) — away from garden at (25, -25)
      model.position.set(-15, -box2.min.y, -15);
      model.position.x -= center.x + 15;
      model.position.z -= center.z + 15;
      model.rotation.y = 0.3;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = !isMobile;
          child.receiveShadow = true;
        }
      });
      this.scene.add(model);
      this._meshes.push(model);
      console.log('[CommunityHub] Placed at (12, -12)');
    });
  }

  /* ═══════════════════════════════════════════════════
     DISTANT BUILDINGS — Background silhouettes for depth
     ═══════════════════════════════════════════════════ */
  _createDistantBuildings() {
    if (isMobile) return;
    // Procedural distant buildings — InstancedMesh (1 draw call)
    const spots = [
      { x: -75, z: -55, h: 12, w: 6 }, { x: -68, z: -48, h: 8, w: 5 },
      { x: 75, z: -50, h: 14, w: 7 }, { x: 82, z: -42, h: 9, w: 5 },
      { x: -72, z: 50, h: 11, w: 6 }, { x: 70, z: 55, h: 13, w: 6 },
      { x: -55, z: -72, h: 10, w: 5 }, { x: 55, z: 72, h: 10, w: 5 },
    ];
    const distMat = new THREE.MeshStandardMaterial({
      color: 0xAABBCC, roughness: 0.7, transparent: true, opacity: 0.6,
    });
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const im = new THREE.InstancedMesh(boxGeo, distMat, spots.length);

    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      _dummy.position.set(s.x, s.h / 2, s.z);
      _dummy.scale.set(s.w, s.h, s.w);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
    }
    this.scene.add(im);
    this._instancedMeshes.push(im);
  }

  /* ═══════════════════════════════════════════════════
     ROUNDED BOX — Soft toy-like geometry helper
     ═══════════════════════════════════════════════════ */
  _roundedBoxGeo(w, h, d, r) {
    // Use segments for beveled edges
    const shape = new THREE.Shape();
    const hw = w / 2, hh = h / 2;
    shape.moveTo(-hw + r, -hh);
    shape.lineTo(hw - r, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
    shape.lineTo(hw, hh - r);
    shape.quadraticCurveTo(hw, hh, hw - r, hh);
    shape.lineTo(-hw + r, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
    shape.lineTo(-hw, -hh + r);
    shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

    const extrudeSettings = { depth: d, bevelEnabled: true, bevelThickness: r * 0.3, bevelSize: r * 0.3, bevelSegments: 2 };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Center the depth
    geo.translate(0, 0, -d / 2);
    return geo;
  }

  /* ═══════════════════════════════════════════════════
     UTILITIES
     ═══════════════════════════════════════════════════ */
  _mergeGeometries(geometries) {
    // Simple manual merge for indexed BufferGeometries
    const positions = [];
    const normals = [];
    const indices = [];
    let vertexOffset = 0;

    for (const geo of geometries) {
      const posAttr = geo.getAttribute('position');
      const normAttr = geo.getAttribute('normal');
      const idx = geo.getIndex();

      for (let i = 0; i < posAttr.count; i++) {
        positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        if (normAttr) normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
      }

      if (idx) {
        for (let i = 0; i < idx.count; i++) {
          indices.push(idx.getX(i) + vertexOffset);
        }
      } else {
        for (let i = 0; i < posAttr.count; i++) {
          indices.push(i + vertexOffset);
        }
      }

      vertexOffset += posAttr.count;
      geo.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (normals.length) merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    merged.setIndex(indices);
    merged.computeVertexNormals();
    return merged;
  }

  _addPlatform(x, y, z, w, h, d, color) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: color ?? 0xFF9F45, roughness: 0.6 })
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = !isMobile;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this._meshes.push(mesh);

    const body = new CANNON.Body({ mass: 0 });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
    body.position.set(x, y, z);
    this.physicsWorld.addBody(body);
    this._bodies.push(body);
  }

  clear() {
    for (const m of this._meshes) {
      this.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
    }
    for (const im of this._instancedMeshes) {
      this.scene.remove(im);
      if (im.geometry) im.geometry.dispose();
    }
    for (const b of this._bodies) this.physicsWorld.removeBody(b);
    this._meshes = [];
    this._instancedMeshes = [];
    this._bodies = [];
    this._cloudData = [];
    this._bushData = [];
    this.trampolines = [];
    this._cloudIM = null;
    this._bushIM = null;
    this._trunkIM = null;
    this._canopyIMs = [];
    this._lampPoleIM = null;
    this._lampGlobeIM = null;
    this._signs = [];
  }
}
