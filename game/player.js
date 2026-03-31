import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PHYSICS, COLORS, GAME } from './constants.js';
// Character GLB loaded directly (bypass old preload system)

export const PlayerState = {
  IDLE:      'idle',
  WALKING:   'walking',
  SPRINTING: 'sprinting',
  JUMPING:   'jumping',
  FALLING:   'falling',
  CLIMBING:  'climbing',
  DEAD:      'dead',
};

export class Player {
  constructor(scene, physicsWorld) {
    this.scene        = scene;
    this.physicsWorld = physicsWorld;

    // Game stats
    this.hearts             = GAME.MAX_HEARTS;
    this.score              = 0;
    this.coins              = 0;
    this.spark              = 0;  // world energy resource
    this.inventory          = []; // harvested crop names
    this.state              = PlayerState.IDLE;
    this.invincibilityFrames = 0;
    this.canDoubleJump      = false;
    this.hasDoubleJumped    = false;

    // Spawn position (set by main.js when a level loads)
    this.spawnPos = { x: 0, y: 3, z: 0 };

    // Active power-ups
    this.shieldActive     = false;
    this.shieldTimer      = 0;
    this.rocketActive     = false;
    this.rocketTimer      = 0;
    this.magnetActive     = false;
    this.magnetTimer      = 0;

    this._spaceWasDown = false;
    this._sprintSparkTimer = 0;
    this.keys = { w: false, a: false, s: false, d: false, space: false, shift: false };

    // GLB animated character
    this._mixer = null;
    this._actions = {};
    this._currentAction = null;
    this._glbLoaded = false;

    this._createMesh();
    this._createPhysicsBody();
    this._setupInput();

    // Load GLB character and replace procedural mesh
    this._loadGLBCharacter();
  }

  // ── Roblox-Style Blocky Character ──────────────────────────────
  _createMesh() {
    this.group = new THREE.Group();

    // ── Shield aura ──
    const shieldGeo = new THREE.SphereGeometry(1.1, 10, 8);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: COLORS.SHIELD_COLOR, transparent: true, opacity: 0.25,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.visible = false;
    this.group.add(this.shieldMesh);

    // ── Sprint VFX — speed aura + trail particles ──
    // Glow aura ring
    const sprintAuraGeo = new THREE.RingGeometry(0.3, 0.6, 16);
    const sprintAuraMat = new THREE.MeshBasicMaterial({
      color: 0x44DDFF, transparent: true, opacity: 0, side: THREE.DoubleSide,
    });
    this._sprintAura = new THREE.Mesh(sprintAuraGeo, sprintAuraMat);
    this._sprintAura.rotation.x = -Math.PI / 2;
    this._sprintAura.position.y = 0.1;
    this.group.add(this._sprintAura);

    // Speed lines (3 stretched planes behind character)
    this._speedLines = [];
    const lineGeo = new THREE.PlaneGeometry(0.05, 1.2);
    for (let i = 0; i < 4; i++) {
      const lineMat = new THREE.MeshBasicMaterial({
        color: 0x88EEFF, transparent: true, opacity: 0, side: THREE.DoubleSide,
      });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set((i - 1.5) * 0.2, 0.3 + i * 0.15, -0.5);
      this.group.add(line);
      this._speedLines.push(line);
    }

    // Sprint trail particles (small glowing spheres that trail behind)
    this._sprintParticles = [];
    const pGeo = new THREE.SphereGeometry(0.06, 4, 4);
    for (let i = 0; i < 8; i++) {
      const pMat = new THREE.MeshBasicMaterial({
        color: 0x44DDFF, transparent: true, opacity: 0,
      });
      const p = new THREE.Mesh(pGeo, pMat);
      p.visible = false;
      this.scene.add(p); // add to scene, not group — so they stay behind
      this._sprintParticles.push({
        mesh: p, life: 0, active: false,
        vx: 0, vy: 0, vz: 0,
      });
    }
    this._sprintParticleIdx = 0;
    this._sprintSpawnTimer = 0;

    // ── Character Group ──
    const charGroup = new THREE.Group();

    // Torso (bright shirt)
    const torsoGeo = new THREE.BoxGeometry(0.9, 1.0, 0.5);
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0x4FC3F7, roughness: 0.6 });
    const torso    = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 0;
    torso.castShadow = true;
    charGroup.add(torso);

    // Head
    const headGeo = new THREE.BoxGeometry(0.72, 0.72, 0.72);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xFFCC88, roughness: 0.5 });
    const head    = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.86;
    head.castShadow = true;
    charGroup.add(head);

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.14, 0.14, 0.06);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const eyeL   = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR   = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.18, 0.92, 0.37);
    eyeR.position.set( 0.18, 0.92, 0.37);
    charGroup.add(eyeL, eyeR);

    // Smile
    const smileGeo = new THREE.BoxGeometry(0.22, 0.06, 0.04);
    const smileMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const smile    = new THREE.Mesh(smileGeo, smileMat);
    smile.position.set(0, 0.76, 0.37);
    charGroup.add(smile);

    // Hair (simple block)
    const hairGeo = new THREE.BoxGeometry(0.76, 0.2, 0.76);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3a2511, roughness: 0.9 });
    const hair    = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 1.28;
    hair.castShadow = true;
    charGroup.add(hair);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xFFCC88, roughness: 0.5 });
    const armL   = new THREE.Mesh(armGeo, armMat);
    const armR   = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.58, -0.1, 0);
    armR.position.set( 0.58, -0.1, 0);
    armL.castShadow = true;
    armR.castShadow = true;
    charGroup.add(armL, armR);
    this._armL = armL;
    this._armR = armR;

    // Legs
    const legGeo = new THREE.BoxGeometry(0.3, 0.7, 0.3);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2255AA, roughness: 0.6 });
    const legL   = new THREE.Mesh(legGeo, legMat);
    const legR   = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.22, -0.85, 0);
    legR.position.set( 0.22, -0.85, 0);
    legL.castShadow = true;
    legR.castShadow = true;
    charGroup.add(legL, legR);
    this._legL = legL;
    this._legR = legR;

    // Feet / Shoes (chunky Roblox-style sneakers)
    const shoeGeo = new THREE.BoxGeometry(0.38, 0.22, 0.5);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xFF5533, roughness: 0.5 });
    const shoeL   = new THREE.Mesh(shoeGeo, shoeMat);
    const shoeR   = new THREE.Mesh(shoeGeo, shoeMat);
    shoeL.position.set(-0.22, -1.26, 0.06);
    shoeR.position.set( 0.22, -1.26, 0.06);
    shoeL.castShadow = true;
    shoeR.castShadow = true;
    charGroup.add(shoeL, shoeR);

    // Shoe sole (darker strip on bottom)
    const soleGeo = new THREE.BoxGeometry(0.4, 0.06, 0.52);
    const soleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    const soleL = new THREE.Mesh(soleGeo, soleMat);
    const soleR = new THREE.Mesh(soleGeo, soleMat);
    soleL.position.set(-0.22, -1.38, 0.06);
    soleR.position.set( 0.22, -1.38, 0.06);
    charGroup.add(soleL, soleR);

    // Small backpack (explorer's pack)
    const packGeo = new THREE.BoxGeometry(0.44, 0.50, 0.24);
    const packMat = new THREE.MeshStandardMaterial({ color: 0xFFAA33, roughness: 0.7 });
    const pack    = new THREE.Mesh(packGeo, packMat);
    pack.position.set(0, 0.05, -0.38);
    pack.castShadow = true;
    charGroup.add(pack);

    // Offset charGroup UP so feet sit on the physics body bottom
    // Physics half-height = 0.85, shoe sole bottom = -1.41
    // Shift up by: 1.41 - 0.85 = 0.56
    charGroup.position.y = 0.56;

    this.bodyMesh = charGroup;
    this.group.add(charGroup);

    // ── Shadow disc ──
    const shadowGeo = new THREE.CircleGeometry(0.55, 8);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 });
    this.shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowDisc.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadowDisc);

    this.scene.add(this.group);
  }

  // ── Physics Body ──────────────────────────────────────────────
  _createPhysicsBody() {
    const shape = new CANNON.Box(new CANNON.Vec3(0.4, 0.85, 0.26));
    this.physicsBody = new CANNON.Body({
      mass:            1,
      shape,
      linearDamping:   PHYSICS.LINEAR_DAMPING,
      angularDamping:  PHYSICS.ANGULAR_DAMPING,
    });
    this.physicsBody.fixedRotation = true;
    this.physicsBody.updateMassProperties();
    this.physicsBody.position.set(0, 3, 0);
    this.physicsWorld.addBody(this.physicsBody);
  }

  // ── Input ─────────────────────────────────────────────────────
  _setupInput() {
    document.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    this.keys.w     = true; break;
        case 'KeyA': case 'ArrowLeft':  this.keys.a     = true; break;
        case 'KeyS': case 'ArrowDown':  this.keys.s     = true; break;
        case 'KeyD': case 'ArrowRight': this.keys.d     = true; break;
        case 'Space':                   this.keys.space = true; e.preventDefault(); break;
        case 'ShiftLeft': case 'ShiftRight': this.keys.shift = true; break;
      }
    });
    document.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    this.keys.w     = false; break;
        case 'KeyA': case 'ArrowLeft':  this.keys.a     = false; break;
        case 'KeyS': case 'ArrowDown':  this.keys.s     = false; break;
        case 'KeyD': case 'ArrowRight': this.keys.d     = false; break;
        case 'Space':                   this.keys.space = false; break;
        case 'ShiftLeft': case 'ShiftRight': this.keys.shift = false; break;
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  get position() { return this.group.position; }

  isGrounded() {
    const p      = this.physicsBody.position;
    const from   = new CANNON.Vec3(p.x, p.y, p.z);
    const to     = new CANNON.Vec3(p.x, p.y - 1.08, p.z);
    const result = new CANNON.RaycastResult();
    this.physicsWorld.raycastClosest(from, to, { skipBackfaces: true }, result);
    return result.hasHit;
  }

  takeDamage() {
    if (this.shieldActive) {
      this.shieldActive = false;
      this.shieldTimer  = 0;
      this.shieldMesh.visible = false;
      this.invincibilityFrames = GAME.INVINCIBILITY_FRAMES;
      return;
    }
    if (this.invincibilityFrames > 0) return;
    this.hearts--;
    this.invincibilityFrames = GAME.INVINCIBILITY_FRAMES;
    if (this.hearts <= 0) {
      this.hearts = 0;
      this.state  = PlayerState.DEAD;
    }
  }

  activatePowerup(type) {
    if (type === 'shield') {
      this.shieldActive       = true;
      this.shieldTimer        = 600;
      this.shieldMesh.visible = true;
    } else if (type === 'rocket') {
      this.rocketActive = true;
      this.rocketTimer  = 180;
    } else if (type === 'magnet') {
      this.magnetActive = true;
      this.magnetTimer  = 300;
    }
  }

  respawn(spawnPos) {
    const pos = spawnPos || { x: 0, y: 3, z: 0 };
    this.physicsBody.position.set(pos.x, pos.y, pos.z);
    this.physicsBody.velocity.set(0, 0, 0);
    this.invincibilityFrames = GAME.INVINCIBILITY_FRAMES;
  }

  reset(spawnPos) {
    this.hearts              = GAME.MAX_HEARTS;
    this.score               = 0;
    this.coins               = 0;
    this.spark               = 0;
    this.inventory           = [];
    this.state               = PlayerState.IDLE;
    this.invincibilityFrames = 0;
    this.canDoubleJump       = false;
    this.hasDoubleJumped     = false;
    this.shieldActive  = false;
    this.rocketActive  = false;
    this.magnetActive  = false;
    this.shieldMesh.visible = false;
    this.group.visible = true;
    this.respawn(spawnPos);
  }

  // ── Per-Frame Update ──────────────────────────────────────────
  update(cameraYaw, paused, dt = 1 / 60) {
    if (paused || this.state === PlayerState.DEAD) return;

    // ── Power-up timers ──
    if (this.shieldActive && --this.shieldTimer <= 0) {
      this.shieldActive = false;
      this.shieldMesh.visible = false;
    }
    if (this.rocketActive && --this.rocketTimer <= 0) this.rocketActive = false;
    if (this.magnetActive && --this.magnetTimer <= 0) this.magnetActive = false;

    // ── Invincibility blink ──
    if (this.invincibilityFrames > 0) {
      this.invincibilityFrames--;
      this.group.visible = Math.floor(this.invincibilityFrames / 5) % 2 === 0;
    } else {
      this.group.visible = true;
    }

    // ── Ground detection ──
    const grounded = this.isGrounded();
    if (grounded) {
      this.canDoubleJump   = true;
      this.hasDoubleJumped = false;
      if (this.physicsBody.velocity.y < 0) this.physicsBody.velocity.y = 0;
    }

    // ── Movement direction (relative to camera) ──
    let dx = 0, dz = 0;
    if (this.keys.w) dz -= 1;
    if (this.keys.s) dz += 1;
    if (this.keys.a) dx -= 1;
    if (this.keys.d) dx += 1;

    const isMoving = dx !== 0 || dz !== 0;
    const isSprinting = isMoving && (this.keys.shift || this.keys.space) && grounded;

    if (isMoving) {
      const len = Math.sqrt(dx * dx + dz * dz);
      dx /= len; dz /= len;
      const cos = Math.cos(cameraYaw), sin = Math.sin(cameraYaw);
      const rx = dx * cos - dz * sin;
      const rz = dx * sin + dz * cos;
      dx = rx; dz = rz;
      this.group.rotation.y = Math.atan2(dx, dz);
      if (grounded) this.state = isSprinting ? PlayerState.SPRINTING : PlayerState.WALKING;
    } else if (grounded) {
      this.state = PlayerState.IDLE;
    }

    // Sprint costs Spark (1 per 3 seconds)
    if (isSprinting) {
      this._sprintSparkTimer += dt;
      if (this._sprintSparkTimer >= 3) {
        this._sprintSparkTimer -= 3;
        this.spark = Math.max(0, this.spark - PHYSICS.SPRINT_SPARK_COST);
      }
    } else {
      this._sprintSparkTimer = 0;
    }

    let speed;
    if (this.rocketActive) speed = PHYSICS.SPRINT_SPEED * 1.2;
    else if (isSprinting)  speed = PHYSICS.SPRINT_SPEED;
    else                   speed = PHYSICS.WALK_SPEED;

    if (grounded) {
      if (isMoving) {
        this.physicsBody.velocity.x = dx * speed;
        this.physicsBody.velocity.z = dz * speed;
      } else {
        this.physicsBody.velocity.x = 0;
        this.physicsBody.velocity.z = 0;
      }
    } else {
      // In air: zero out horizontal — no forward movement while jumping
      this.physicsBody.velocity.x = 0;
      this.physicsBody.velocity.z = 0;
    }

    // Jump removed — space is now sprint

    // ── Aerial state ──
    if (!grounded) {
      this.state = this.physicsBody.velocity.y > 0 ? PlayerState.JUMPING : PlayerState.FALLING;
    }

    // ── Fall death ──
    if (this.physicsBody.position.y < GAME.FALL_DEATH_Y) {
      this.takeDamage();
      this.respawn(this.spawnPos);
    }

    // ── Sync mesh → physics ──
    this.group.position.set(
      this.physicsBody.position.x,
      this.physicsBody.position.y,
      this.physicsBody.position.z
    );

    // ── Shadow position ──
    this.shadowDisc.position.set(this.group.position.x, -0.45, this.group.position.z);

    // ── Animation ──
    if (this._glbLoaded && this._mixer) {
      // Update animation mixer
      this._mixer.update(dt);

      // Switch animation based on state
      const isMovingState = this.state === PlayerState.WALKING || this.state === PlayerState.SPRINTING;
      const isJumping = this.state === PlayerState.JUMPING || this.state === PlayerState.FALLING;

      if (isJumping) {
        this._playAction(this._actions.jump ? 'jump' : 'run');
      } else if (isMovingState) {
        // Always play run animation when moving
        this._playAction(this._actions.run ? 'run' : 'walk');
      } else {
        // Idle — stop all movement animations
        if (this._actions.idle) {
          this._playAction('idle');
        } else {
          // No idle clip — stop current animation
          if (this._currentAction) {
            const prev = this._actions[this._currentAction];
            if (prev) prev.fadeOut(0.2);
            this._currentAction = null;
          }
        }
      }
    } else if (!this._glbLoaded) {
      // Fallback procedural animation (before GLB loads)
      if (this.state === PlayerState.WALKING || this.state === PlayerState.SPRINTING) {
        const animSpeed = this.state === PlayerState.SPRINTING ? 0.018 : 0.012;
        const swingAmp  = this.state === PlayerState.SPRINTING ? 0.85 : 0.6;
        const t     = Date.now() * animSpeed;
        const swing = Math.sin(t) * swingAmp;
        if (this._armL) {
          this._armL.rotation.x =  swing;
          this._armR.rotation.x = -swing;
          this._legL.rotation.x = -swing;
          this._legR.rotation.x =  swing;
        }
        const bobAmp = this.state === PlayerState.SPRINTING ? 0.07 : 0.04;
        if (this.bodyMesh) this.bodyMesh.position.y = 0.56 + Math.sin(t * 2) * bobAmp;
      } else {
        if (this._armL) {
          this._armL.rotation.x = 0;
          this._armR.rotation.x = 0;
          this._legL.rotation.x = 0;
          this._legR.rotation.x = 0;
        }
        if (this.bodyMesh) this.bodyMesh.position.y = 0.56;
      }
    }

    // ── Sprint VFX ──
    const sprinting = this.state === PlayerState.SPRINTING;
    const t = Date.now() * 0.001;

    // Aura ring — pulses when sprinting
    if (this._sprintAura) {
      if (sprinting) {
        this._sprintAura.material.opacity = 0.3 + Math.sin(t * 8) * 0.15;
        this._sprintAura.scale.setScalar(1 + Math.sin(t * 6) * 0.3);
        this._sprintAura.rotation.z += 0.15;
      } else {
        this._sprintAura.material.opacity *= 0.85; // fade out
      }
    }

    // Speed lines — visible when sprinting
    for (const line of this._speedLines) {
      if (sprinting) {
        line.material.opacity = 0.4 + Math.sin(t * 10 + line.position.x * 5) * 0.2;
        line.position.z = -0.5 - Math.sin(t * 12 + line.position.x * 3) * 0.2;
      } else {
        line.material.opacity *= 0.85;
      }
    }

    // Trail particles — spawn behind while sprinting
    if (sprinting) {
      this._sprintSpawnTimer += dt;
      if (this._sprintSpawnTimer > 0.05) {
        this._sprintSpawnTimer = 0;
        const p = this._sprintParticles[this._sprintParticleIdx % this._sprintParticles.length];
        this._sprintParticleIdx++;
        p.active = true;
        p.life = 0;
        p.mesh.visible = true;
        p.mesh.position.set(
          this.group.position.x + (Math.random() - 0.5) * 0.4,
          this.group.position.y + 0.2 + Math.random() * 0.3,
          this.group.position.z + (Math.random() - 0.5) * 0.4,
        );
        p.mesh.material.opacity = 0.7;
        p.mesh.scale.setScalar(0.8 + Math.random() * 0.5);
      }
    }

    // Update trail particles
    for (const p of this._sprintParticles) {
      if (!p.active) continue;
      p.life += dt;
      p.mesh.material.opacity = Math.max(0, 0.7 - p.life * 1.5);
      p.mesh.position.y += dt * 0.5;
      p.mesh.scale.multiplyScalar(0.97);
      if (p.life > 0.5) {
        p.active = false;
        p.mesh.visible = false;
      }
    }

    // ── Shield pulse ──
    if (this.shieldActive) {
      this.shieldMesh.rotation.y += 0.04;
      this.shieldMesh.rotation.z += 0.02;
      this.shieldMesh.material.opacity = 0.18 + Math.sin(Date.now() * 0.006) * 0.08;
    }
  }

  _playAction(name) {
    if (this._currentAction === name) return;
    // Crossfade to new action
    const prev = this._currentAction ? this._actions[this._currentAction] : null;
    const next = this._actions[name];
    if (!next) return;

    if (prev) {
      prev.fadeOut(0.2);
    }
    next.reset().fadeIn(0.2).play();
    next.timeScale = 1.0;
    this._currentAction = name;
  }

  _loadGLBCharacter() {
    const BASE_PATH = '3d asset/sample character/Meshy_AI_SAI_biped/';
    const WALK_FILE = BASE_PATH + 'Meshy_AI_SAI_biped_Animation_Walking_withSkin.glb';
    const RUN_FILE  = BASE_PATH + 'Running_withSkin.glb';
    const JUMP_FILE = BASE_PATH + 'Jump_Run_withSkin.glb';
    const targetHeight = 0.8;

    import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
      const loader = new GLTFLoader();
      console.log('[Player] Loading character GLBs (walk + run + jump)...');

      const loadGLB = (url) => new Promise((resolve) => {
        loader.load(url,
          (gltf) => { console.log(`[Player] Loaded ${url}`); resolve(gltf); },
          undefined,
          (err) => { console.warn(`[Player] Failed ${url}:`, err); resolve(null); }
        );
      });

      // Load walk (base model), run, and jump in parallel
      Promise.all([loadGLB(WALK_FILE), loadGLB(RUN_FILE), loadGLB(JUMP_FILE)]).then(([walkGLTF, runGLTF, jumpGLTF]) => {
        if (!walkGLTF) {
          console.error('[Player] Walk GLB failed — keeping procedural character');
          return;
        }

        const model = walkGLTF.scene;
        model.traverse((child) => {
          if (child.isMesh || child.isSkinnedMesh) {
            child.castShadow = true;
            child.receiveShadow = false;
            child.frustumCulled = false;
            if (child.material) child.material.side = THREE.DoubleSide;
          }
        });

        // Scale to target height
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const scale = targetHeight / (size.y || 1);
        model.scale.setScalar(scale);

        // Center and align bottom
        const box2 = new THREE.Box3().setFromObject(model);
        const center = box2.getCenter(new THREE.Vector3());
        model.position.x -= center.x;
        model.position.z -= center.z;
        model.position.y -= box2.min.y;
        model.position.y -= targetHeight / 2;

        const charGroup = new THREE.Group();
        charGroup.add(model);

        // Remove procedural character
        if (this.bodyMesh) {
          this.group.remove(this.bodyMesh);
        }

        this.group.add(charGroup);
        this.bodyMesh = charGroup;

        // Animation mixer on the walk model
        this._mixer = new THREE.AnimationMixer(model);
        this._actions = {};

        // Walk animation (from walk GLB)
        if (walkGLTF.animations.length > 0) {
          this._actions.walk = this._mixer.clipAction(walkGLTF.animations[0]);
          this._actions.walk.setLoop(THREE.LoopRepeat);
          console.log('[Player] Walk clip:', walkGLTF.animations[0].name);
        }

        // Run animation (from run GLB — apply to same skeleton)
        if (runGLTF && runGLTF.animations.length > 0) {
          this._actions.run = this._mixer.clipAction(runGLTF.animations[0]);
          this._actions.run.setLoop(THREE.LoopRepeat);
          console.log('[Player] Run clip:', runGLTF.animations[0].name);
        }

        // Jump animation (from jump GLB)
        if (jumpGLTF && jumpGLTF.animations.length > 0) {
          this._actions.jump = this._mixer.clipAction(jumpGLTF.animations[0]);
          this._actions.jump.setLoop(THREE.LoopOnce);
          this._actions.jump.clampWhenFinished = true;
          console.log('[Player] Jump clip:', jumpGLTF.animations[0].name);
        }

        this._glbLoaded = true;
        this._currentAction = null;
        this._armL = null;
        this._armR = null;
        this._legL = null;
        this._legR = null;

        console.log('[Player] Character ready — actions:', Object.keys(this._actions));
      });
    }).catch((err) => {
      console.error('[Player] GLTFLoader import failed:', err);
    });
  }
}
