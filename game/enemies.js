import * as THREE from 'three';
import { preloadCharacterModel, buildCharacterMesh } from './modelLoader.js';

export class EnemyManager {
  constructor(scene) {
    this.scene    = scene;
    this._enemies = [];
  }

  // ── The Collector ─────────────────────────────────────────────
  spawnCollector(x, y, z) {
    const group = new THREE.Group();

    // ── Placeholder: blocky villain (shown while model loads) ──
    // Body (dark red)
    const bodyGeo = new THREE.BoxGeometry(1.0, 1.2, 0.6);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8B0000, flatShading: true });
    group.add(new THREE.Mesh(bodyGeo, bodyMat));

    // Head
    const headGeo = new THREE.BoxGeometry(0.85, 0.8, 0.8);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xCC5500, flatShading: true });
    const head    = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.0;
    group.add(head);

    // Top hat
    const brimGeo  = new THREE.BoxGeometry(1.1, 0.12, 1.1);
    const crownGeo = new THREE.BoxGeometry(0.6, 0.55, 0.6);
    const hatMat   = new THREE.MeshLambertMaterial({ color: 0x1A1A1A, flatShading: true });
    const brim     = new THREE.Mesh(brimGeo, hatMat);
    const crown    = new THREE.Mesh(crownGeo, hatMat);
    brim.position.y  = 1.46;
    crown.position.y = 1.8;
    group.add(brim, crown);

    // Coin bag (stays after model swap — it's the villain's prop)
    const bagGeo = new THREE.SphereGeometry(0.35, 6, 6);
    const bagMat = new THREE.MeshLambertMaterial({ color: 0xFFD700, flatShading: true });
    const bag    = new THREE.Mesh(bagGeo, bagMat);
    bag.position.set(0.62, 0, 0.3);
    bag.castShadow = true;
    group.add(bag);

    group.position.set(x, y, z);
    this.scene.add(group);

    const enemy = {
      type:       'collector',
      group,
      bag,           // keep reference so we can re-add after model swap
      startX:     x,
      y, z,
      patrolRange: 6,
      speed:       2.8,
      chargeSpeed: 8,
      phase:       Math.random() * Math.PI * 2,
      alive:       true,
      isCharging:  false,
    };
    this._enemies.push(enemy);

    // ── Async swap to Pongo model (white + bowler hat = The Collector) ──
    preloadCharacterModel().then((obj) => {
      if (!obj || !enemy.alive) return;
      const charMesh = buildCharacterMesh(0xF5F5F5, 1.9, true); // off-white + hat
      if (!charMesh) return;
      // Clear placeholder, keep coin bag
      while (group.children.length > 0) group.remove(group.children[0]);
      group.add(charMesh);
      group.add(enemy.bag); // re-attach coin bag
    });
  }

  // ── Per-Frame Update ──────────────────────────────────────────
  update(dt, playerPosition, player, uiManager, audioManager) {
    for (const e of this._enemies) {
      if (!e.alive) continue;

      const distXZ = Math.sqrt(
        (playerPosition.x - e.group.position.x) ** 2 +
        (playerPosition.z - e.group.position.z) ** 2
      );

      // ── AI: patrol vs. charge ──
      if (distXZ < 12) {
        // Charge toward player
        e.isCharging = true;
        const dx = playerPosition.x - e.group.position.x;
        const dz = playerPosition.z - e.group.position.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        e.group.position.x += (dx / len) * e.chargeSpeed * dt;
        e.group.position.z += (dz / len) * e.chargeSpeed * dt;
        e.group.rotation.y  = Math.atan2(dx, dz);
      } else {
        e.isCharging = false;
        e.phase     += e.speed * dt;
        e.group.position.x = e.startX + Math.sin(e.phase) * e.patrolRange;
        e.group.rotation.y = Math.cos(e.phase) > 0 ? 0 : Math.PI;
      }

      // ── Bob when patrolling ──
      if (!e.isCharging) {
        e.group.position.y = e.y + Math.abs(Math.sin(e.phase * 2)) * 0.1;
      }

      // ── Hit detection ──
      const fullDist = playerPosition.distanceTo(e.group.position);
      if (fullDist < 1.2) {
        const playerAbove   = playerPosition.y > e.group.position.y + 0.9;
        const playerFalling = player.physicsBody && player.physicsBody.velocity.y < -1.5;

        if (playerAbove && playerFalling) {
          // Stomp defeat
          e.alive = false;
          this.scene.remove(e.group);
          player.score += 100;
          player.physicsBody.velocity.y = 9; // bounce
          if (uiManager) uiManager.updateScore(player.score, player.coins);
          if (audioManager) audioManager.playLevelComplete(); // victory chord
        } else {
          player.takeDamage();
          if (uiManager)   uiManager.updateHearts(player.hearts);
          if (audioManager) audioManager.playHurt();
        }
      }
    }
  }

  reset() {
    for (const e of this._enemies) {
      if (e.alive) this.scene.remove(e.group);
    }
    this._enemies = [];
  }
}
