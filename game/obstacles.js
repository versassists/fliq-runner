import * as THREE from 'three';
import { COLORS } from './constants.js';

export class ObstaclesManager {
  constructor(scene) {
    this.scene      = scene;
    this._obstacles = [];
  }

  spawn(obstacleList) {
    for (const obs of obstacleList) {
      switch (obs.type) {
        case 'falling_receipt': this._addReceiptEmitter(obs); break;
        case 'debt_block':      this._addDebtBlock(obs);      break;
        case 'slime':           this._addSlime(obs);          break;
      }
    }
  }

  // ── Falling Receipt Emitter ───────────────────────────────────
  _addReceiptEmitter({ x, y, z, interval = 2400 }) {
    this._obstacles.push({
      type: 'receipt_emitter',
      x, y, z, interval,
      lastSpawn: Date.now() + Math.random() * interval,
      active: [],
    });
  }

  _createReceipt(emitter) {
    const geo  = new THREE.BoxGeometry(0.55, 1.3, 0.05);
    const mat  = new THREE.MeshLambertMaterial({ color: COLORS.RECEIPT, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      emitter.x + (Math.random() - 0.5) * 4,
      emitter.y + 8,
      emitter.z + (Math.random() - 0.5) * 4
    );
    mesh.rotation.set(
      (Math.random() - 0.5) * 0.4,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.4
    );
    mesh.castShadow = true;
    this.scene.add(mesh);
    return { mesh, vy: 0, alive: true };
  }

  // ── Debt Block ────────────────────────────────────────────────
  _addDebtBlock({ x, y, z, patrolRange = 4 }) {
    const group = new THREE.Group();

    const blockGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const blockMat = new THREE.MeshLambertMaterial({ color: COLORS.DEBT_BLOCK, flatShading: true });
    const block    = new THREE.Mesh(blockGeo, blockMat);
    block.castShadow = true;
    group.add(block);

    // "DEBT" label face (dark orange strip)
    const labelGeo = new THREE.BoxGeometry(1.2, 0.35, 0.1);
    const labelMat = new THREE.MeshLambertMaterial({ color: 0xFF4500 });
    const label    = new THREE.Mesh(labelGeo, labelMat);
    label.position.set(0, 0, 0.86);
    group.add(label);

    // Spiky bits on top
    for (let i = -1; i <= 1; i++) {
      const sGeo = new THREE.ConeGeometry(0.18, 0.55, 4);
      const sMat = new THREE.MeshLambertMaterial({ color: 0x4A0060, flatShading: true });
      const s    = new THREE.Mesh(sGeo, sMat);
      s.position.set(i * 0.5, 1.0, 0);
      group.add(s);
    }

    group.position.set(x, y, z);
    this.scene.add(group);

    this._obstacles.push({
      type: 'debt_block',
      group,
      startX: x, y, z,
      patrolRange,
      speed: 1.8,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // ── Subscription Slime ────────────────────────────────────────
  _addSlime({ x, y, z }) {
    const geo  = new THREE.SphereGeometry(0.6, 7, 6);
    const mat  = new THREE.MeshLambertMaterial({ color: 0x00CC44, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    this.scene.add(mesh);

    this._obstacles.push({
      type: 'slime',
      mesh,
      baseY: y,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // ── Per-Frame Update ──────────────────────────────────────────
  update(dt, playerPosition, player, audioManager, uiManager) {
    const now = Date.now();

    for (const obs of this._obstacles) {

      // ── Receipt Emitter ──
      if (obs.type === 'receipt_emitter') {
        if (now - obs.lastSpawn > obs.interval) {
          obs.lastSpawn = now;
          obs.active.push(this._createReceipt(obs));
        }

        for (const r of obs.active) {
          if (!r.alive) continue;
          r.vy -= 18 * dt;
          r.mesh.position.y    += r.vy * dt;
          r.mesh.rotation.z    += 0.06;

          if (r.mesh.position.y < -1) {
            r.alive = false;
            this.scene.remove(r.mesh);
            continue;
          }

          if (playerPosition.distanceTo(r.mesh.position) < 0.9) {
            r.alive = false;
            this.scene.remove(r.mesh);
            player.takeDamage();
            if (uiManager)   uiManager.updateHearts(player.hearts);
            if (audioManager) audioManager.playHurt();
          }
        }
        obs.active = obs.active.filter(r => r.alive);
      }

      // ── Debt Block ──
      if (obs.type === 'debt_block') {
        obs.phase += obs.speed * dt;
        obs.group.position.x  = obs.startX + Math.sin(obs.phase) * obs.patrolRange;
        obs.group.rotation.y += dt * 1.2;

        if (playerPosition.distanceTo(obs.group.position) < 1.5) {
          player.takeDamage();
          if (uiManager)   uiManager.updateHearts(player.hearts);
          if (audioManager) audioManager.playHurt();
        }
      }

      // ── Slime ──
      if (obs.type === 'slime') {
        obs.phase += 3 * dt;
        obs.mesh.position.y = obs.baseY + Math.abs(Math.sin(obs.phase)) * 1.2;
        obs.mesh.scale.y    = 0.8 + Math.abs(Math.sin(obs.phase)) * 0.4;

        if (playerPosition.distanceTo(obs.mesh.position) < 1.0) {
          player.takeDamage();
          if (uiManager)   uiManager.updateHearts(player.hearts);
          if (audioManager) audioManager.playHurt();
        }
      }
    }
  }

  reset() {
    for (const obs of this._obstacles) {
      if (obs.mesh)  this.scene.remove(obs.mesh);
      if (obs.group) this.scene.remove(obs.group);
      if (obs.active) obs.active.forEach(r => this.scene.remove(r.mesh));
    }
    this._obstacles = [];
  }
}
