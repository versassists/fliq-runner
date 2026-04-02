/**
 * modelLoader.js
 * Loads the Meshy AI biped character GLB files (walking + running animations).
 * Uses GLTFLoader to parse skinned meshes and AnimationClips.
 *
 * Two GLB files:
 *   - Meshy_AI_Animation_Walking_withSkin.glb  → walking clip + skinned mesh
 *   - Meshy_AI_Animation_Running_withSkin.glb  → running clip
 *
 * The walking GLB provides the base skinned mesh (skeleton + skin).
 * The running GLB provides an additional animation clip applied to the same skeleton.
 */

import * as THREE from 'three';

// ── Paths (relative to index.html) ─────────────────────────────────
const CHARACTER_GLB = '3d asset/sample character/Meshy_AI_SAI_biped/Meshy_AI_Meshy_Merged_Animations.glb';
const GARDEN_GLB = '3d asset/garden.glb';
const TREE1_GLB  = '3d asset/Meshy_AI_tree_0323123943_texture_opt.glb';
const TREE2_GLB  = '3d asset/Meshy_AI_tree_0323123943_texture_opt.glb';
const GRASS1_GLB    = '3d asset/Meshy_AI_bush_0323123756_texture_opt.glb';
const FOUNTAIN_GLB  = '3d asset/Meshy_AI_fountain_0323123957_texture_opt.glb';
const ARCADE_GLB    = '3d asset/arcade.glb';
const HOUSE_GLB     = '3d asset/Meshy_AI_house1_0323123910_texture_opt.glb';
const SHOP_GLB      = '3d asset/Meshy_AI_shop_0323123928_texture_opt.glb';
const ROCK_GLB      = '3d asset/meshy_rock1_opt.glb';
const FENCE_GLB     = '3d asset/meshy_fence_opt.glb';
const COMMUNITY_HUB_GLB = '3d asset/meshy_community_hub_opt.glb';
const DISTANT_BLDG_GLB  = '3d asset/meshy_distant_building_opt.glb';

// ── Module-level cache ─────────────────────────────────────────────
let _loadPromise = null;
let _cached = null; // { scene, walkClip, runClip, SkeletonUtils }
let _gardenPromise = null;
let _gardenCached  = null;

// Generic asset cache
const _assetCache   = {};
const _assetPromise = {};

// ── Preload (call once on startup) ─────────────────────────────────
export function preloadCharacterModel() {
  if (_loadPromise) return _loadPromise;

  _loadPromise = Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/utils/SkeletonUtils.js'),
  ])
    .then(([{ GLTFLoader }, SkeletonUtilsModule]) => {
      const loader = new GLTFLoader();
      // SkeletonUtils may export as default or named
      const SkeletonUtils = SkeletonUtilsModule.SkeletonUtils || SkeletonUtilsModule.default || SkeletonUtilsModule;

      const loadGLB = (url) =>
        new Promise((resolve) => {
          loader.load(
            url,
            (gltf) => {
              console.log(`[Character] Loaded ${url} — animations: ${gltf.animations.length}`);
              resolve(gltf);
            },
            (progress) => {
              if (progress.total) console.log(`[Character] Loading ${url}: ${Math.round(progress.loaded / progress.total * 100)}%`);
            },
            (err) => {
              console.warn(`[Character] Failed to load ${url}:`, err.message ?? err);
              resolve(null);
            }
          );
        });

      return loadGLB(CHARACTER_GLB).then((gltf) => {
        return { gltf, SkeletonUtils };
      });
    })
    .then(({ gltf, SkeletonUtils }) => {
      if (!gltf) {
        console.warn('[Character] Merged GLB failed — using fallback boxes.');
        return null;
      }

      // Extract all animation clips from the merged file
      const clips = gltf.animations || [];
      console.log(`[Character] Found ${clips.length} animations:`, clips.map(c => c.name));

      // Try to identify walk/run/idle/jump clips by name
      let walkClip = null, runClip = null, idleClip = null, jumpClip = null;
      for (const clip of clips) {
        const n = clip.name.toLowerCase();
        if (!walkClip && (n.includes('walk') || n.includes('walking'))) walkClip = clip;
        else if (!runClip && (n.includes('run') || n.includes('sprint'))) runClip = clip;
        else if (!idleClip && (n.includes('idle') || n.includes('stand'))) idleClip = clip;
        else if (!jumpClip && (n.includes('jump') || n.includes('leap'))) jumpClip = clip;
      }

      // Fallback: assign by index if names didn't match
      if (!walkClip && clips.length > 0) walkClip = clips[0];
      if (!runClip && clips.length > 1)  runClip  = clips[1];
      if (!jumpClip && clips.length > 2) jumpClip = clips[2];
      if (!idleClip && clips.length > 3) idleClip = clips[3];

      if (walkClip) walkClip.name = 'walk';
      if (runClip)  runClip.name  = 'run';
      if (jumpClip) jumpClip.name = 'jump';
      if (idleClip) idleClip.name = 'idle';

      _cached = {
        scene:    gltf.scene,
        walkClip,
        runClip,
        jumpClip,
        idleClip,
        allClips: clips,
        SkeletonUtils,
      };

      console.log(
        `[Character] Meshy biped loaded ✓  walk:${!!walkClip}  run:${!!runClip}  jump:${!!jumpClip}  idle:${!!idleClip}`
      );
      return _cached;
    })
    .catch((err) => {
      console.warn('[Character] GLTFLoader unavailable — using fallback:', err.message ?? err);
      return null;
    });

  return _loadPromise;
}

// ── Is the model ready? ────────────────────────────────────────────
export function characterModelReady() {
  return _cached !== null;
}

/**
 * Build an animated character instance ready to add to the scene.
 *
 * @param {number}  targetHeight  World-unit height to scale the model to
 * @returns {{ group: THREE.Group, mixer: THREE.AnimationMixer, actions: Object } | null}
 */
export function buildAnimatedCharacter(targetHeight = 1.75) {
  if (!_cached) return null;

  const group = new THREE.Group();

  // Use SkeletonUtils.clone for proper skinned mesh cloning (handles skeleton rebinding)
  let model;
  try {
    model = _cached.SkeletonUtils.clone(_cached.scene);
    console.log('[Character] SkeletonUtils.clone succeeded');
  } catch (e) {
    console.warn('[Character] SkeletonUtils.clone failed, using original scene:', e);
    model = _cached.scene;
  }

  // ── Traverse and set up materials / shadows ──────────────────────
  model.traverse((child) => {
    if (child.isMesh || child.isSkinnedMesh) {
      child.castShadow    = true;
      child.receiveShadow = false;
      child.frustumCulled = false;
      if (child.material) {
        child.material.side = THREE.DoubleSide;
      }
    }
  });

  // ── Auto-scale to targetHeight ───────────────────────────────────
  const box1  = new THREE.Box3().setFromObject(model);
  const size  = box1.getSize(new THREE.Vector3());
  console.log('[Character] Model bounding box size:', size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));
  const scale = targetHeight / (size.y || 1);
  model.scale.setScalar(scale);

  // ── Center horizontally, align bottom to y = 0, then offset to body centre ──
  const box2   = new THREE.Box3().setFromObject(model);
  const center = box2.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box2.min.y;          // bottom at y=0
  model.position.y -= targetHeight / 2;    // group origin = body centre

  group.add(model);

  // ── Animation Mixer ──────────────────────────────────────────────
  const mixer   = new THREE.AnimationMixer(model);
  const actions = {};

  if (_cached.walkClip) {
    actions.walk = mixer.clipAction(_cached.walkClip);
    actions.walk.setLoop(THREE.LoopRepeat);
  }

  if (_cached.runClip) {
    actions.run = mixer.clipAction(_cached.runClip);
    actions.run.setLoop(THREE.LoopRepeat);
  }

  if (_cached.jumpClip) {
    actions.jump = mixer.clipAction(_cached.jumpClip);
    actions.jump.setLoop(THREE.LoopOnce);
    actions.jump.clampWhenFinished = true;
  }

  if (_cached.idleClip) {
    actions.idle = mixer.clipAction(_cached.idleClip);
    actions.idle.setLoop(THREE.LoopRepeat);
  }

  console.log('[Character] buildAnimatedCharacter complete — actions:', Object.keys(actions));
  return { group, mixer, actions };
}

/**
 * Legacy buildCharacterMesh — kept for enemy usage (static, no animation).
 *
 * @param {number}  color        Hex colour for MeshToonMaterial tint
 * @param {number}  targetHeight World-unit height
 * @param {boolean} addHat       Add a bowler hat (for The Collector)
 * @returns {THREE.Group | null}
 */
export function buildCharacterMesh(color, targetHeight = 1.75, addHat = false) {
  if (!_cached) return null;

  const group = new THREE.Group();
  let model;
  try {
    model = _cached.SkeletonUtils.clone(_cached.scene);
  } catch (e) {
    model = _cached.scene.clone(true);
  }

  const mat = new THREE.MeshToonMaterial({ color, flatShading: false });
  model.traverse((child) => {
    if (child.isMesh || child.isSkinnedMesh) {
      child.material      = mat;
      child.castShadow    = true;
      child.receiveShadow = false;
    }
  });

  const box1  = new THREE.Box3().setFromObject(model);
  const size  = box1.getSize(new THREE.Vector3());
  const sc    = targetHeight / (size.y || 1);
  model.scale.setScalar(sc);

  const box2   = new THREE.Box3().setFromObject(model);
  const center = box2.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box2.min.y;
  model.position.y -= targetHeight / 2;

  group.add(model);

  if (addHat) {
    const brimGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.08, 12);
    const brimMat = new THREE.MeshToonMaterial({ color: 0x222222 });
    const brim    = new THREE.Mesh(brimGeo, brimMat);
    brim.castShadow = true;

    const crownGeo = new THREE.CylinderGeometry(0.28, 0.30, 0.45, 12);
    const crown    = new THREE.Mesh(crownGeo, brimMat);
    crown.castShadow = true;

    const topY = targetHeight / 2 + 0.04;
    brim.position.y  = topY;
    crown.position.y = topY + 0.265;
    group.add(brim, crown);
  }

  return group;
}

// ── Garden GLB Loader ───────────────────────────────────────────────

/**
 * Load the garden GLB model. Returns a promise that resolves to the
 * cloned THREE.Group (or null on failure).
 */
export function loadGardenModel() {
  if (_gardenCached) return Promise.resolve(_gardenCached.clone());
  if (_gardenPromise) return _gardenPromise.then((m) => m ? m.clone() : null);

  _gardenPromise = import('three/addons/loaders/GLTFLoader.js')
    .then(({ GLTFLoader }) => {
      const loader = new GLTFLoader();
      return new Promise((resolve) => {
        loader.load(
          GARDEN_GLB,
          (gltf) => {
            console.log('[Garden] Loaded garden.glb');
            const model = gltf.scene;
            model.traverse((child) => {
              if (child.isMesh) {
                child.castShadow    = true;
                child.receiveShadow = true;
              }
            });
            _gardenCached = model;
            resolve(model.clone());
          },
          undefined,
          (err) => {
            console.warn('[Garden] Failed to load garden.glb:', err.message ?? err);
            resolve(null);
          }
        );
      });
    })
    .catch((err) => {
      console.warn('[Garden] GLTFLoader unavailable:', err.message ?? err);
      return null;
    });

  return _gardenPromise;
}

// ── Generic GLB asset loader (cached, clones on each call) ──────────

function _loadAsset(url, label) {
  if (_assetCache[url]) return Promise.resolve(_assetCache[url].clone());
  if (_assetPromise[url]) return _assetPromise[url].then((m) => m ? m.clone() : null);

  _assetPromise[url] = Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/loaders/DRACOLoader.js'),
  ])
    .then(([{ GLTFLoader }, { DRACOLoader }]) => {
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
      dracoLoader.setDecoderConfig({ type: 'js' });
      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);
      return new Promise((resolve) => {
        loader.load(
          url,
          (gltf) => {
            console.log(`[${label}] Loaded ${url}`);
            const model = gltf.scene;
            model.traverse((child) => {
              if (child.isMesh) {
                child.castShadow    = true;
                child.receiveShadow = true;
              }
            });
            _assetCache[url] = model;
            resolve(model.clone());
          },
          undefined,
          (err) => {
            console.warn(`[${label}] Failed to load ${url}:`, err.message ?? err);
            resolve(null);
          }
        );
      });
    })
    .catch((err) => {
      console.warn(`[${label}] GLTFLoader unavailable:`, err.message ?? err);
      return null;
    });

  return _assetPromise[url];
}

export function loadTree1Model() { return _loadAsset(TREE1_GLB, 'Tree1'); }
export function loadTree2Model() { return _loadAsset(TREE2_GLB, 'Tree2'); }
export function loadGrassModel()    { return _loadAsset(GRASS1_GLB, 'Bush'); }
export function loadFountainModel() { return _loadAsset(FOUNTAIN_GLB, 'Fountain'); }
export function loadArcadeModel()   { return _loadAsset(ARCADE_GLB, 'Arcade'); }
export function loadHouseModel()    { return _loadAsset(HOUSE_GLB, 'House'); }
export function loadShopModel()     { return _loadAsset(SHOP_GLB, 'Shop'); }
export function loadRockModel()     { return _loadAsset(ROCK_GLB, 'Rock'); }
export function loadFenceModel()    { return _loadAsset(FENCE_GLB, 'Fence'); }
export function loadCommunityHubModel() { return _loadAsset(COMMUNITY_HUB_GLB, 'CommunityHub'); }
export function loadDistantBuildingModel() { return _loadAsset(DISTANT_BLDG_GLB, 'DistantBuilding'); }
