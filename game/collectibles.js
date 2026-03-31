import * as THREE from 'three';
import { COLORS, GAME } from './constants.js';

export class CollectiblesManager {
  constructor(scene) {
    this.scene    = scene;
    this._coins   = [];
    this._powerups = [];
  }

  // ── Coins ────────────────────────────────────────────────────
  spawnCoins(positions) {
    for (const [x, y, z] of positions) this._spawnCoin(x, y, z);
  }

  _spawnCoin(x, y, z) {
    const geo  = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 8);
    const mat  = new THREE.MeshLambertMaterial({ color: COLORS.COIN, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    this.scene.add(mesh);

    // Inner shine disc
    const shineGeo  = new THREE.CylinderGeometry(0.18, 0.18, 0.13, 6);
    const shineMat  = new THREE.MeshLambertMaterial({ color: COLORS.COIN_SHINE, flatShading: true });
    const shineMesh = new THREE.Mesh(shineGeo, shineMat);
    mesh.add(shineMesh);

    this._coins.push({ mesh, baseY: y, collected: false });
  }

  // ── Power-ups ─────────────────────────────────────────────────
  spawnPowerup(x, y, z, type) {
    const colorMap = {
      shield: COLORS.SHIELD_COLOR,
      rocket: COLORS.ROCKET_COLOR,
      magnet: COLORS.MAGNET_COLOR,
    };
    const color = colorMap[type] ?? 0xFFFFFF;

    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Outer rotating box
    const outerGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const outerMat = new THREE.MeshLambertMaterial({ color, flatShading: true });
    const outer    = new THREE.Mesh(outerGeo, outerMat);
    outer.castShadow = true;
    group.add(outer);

    // Inner smaller box (contrasting)
    const innerGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const innerMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, flatShading: true });
    const inner    = new THREE.Mesh(innerGeo, innerMat);
    inner.rotation.y = Math.PI / 4;
    group.add(inner);

    this.scene.add(group);
    this._powerups.push({ group, outer, inner, type, collected: false, baseY: y });
  }

  // ── Update ────────────────────────────────────────────────────
  update(playerPosition, player, audioManager, uiManager) {
    const t = Date.now() * 0.001;

    // Coins
    for (const coin of this._coins) {
      if (coin.collected) continue;

      coin.mesh.rotation.y += 0.055;
      coin.mesh.position.y  = coin.baseY + Math.sin(t * 2.5 + coin.baseY) * 0.18;

      // Magnet: pull coins toward player
      if (player.magnetActive) {
        const dist = playerPosition.distanceTo(coin.mesh.position);
        if (dist < 9) {
          const dir = playerPosition.clone().sub(coin.mesh.position).normalize();
          coin.mesh.position.addScaledVector(dir, 0.25);
        }
      }

      const dist = playerPosition.distanceTo(coin.mesh.position);
      if (dist < 1.2) {
        coin.collected = true;
        this.scene.remove(coin.mesh);
        player.score += GAME.COIN_VALUE;
        player.coins++;
        if (audioManager) audioManager.playCoin();
        if (uiManager) uiManager.updateScore(player.score, player.coins);
      }
    }

    // Power-ups
    const freshlyCollected = [];
    for (const pu of this._powerups) {
      if (pu.collected) continue;

      pu.outer.rotation.y += 0.04;
      pu.outer.rotation.z += 0.02;
      pu.inner.rotation.y -= 0.06;
      pu.group.position.y  = pu.baseY + Math.sin(t * 2 + pu.baseY) * 0.22;

      const dist = playerPosition.distanceTo(pu.group.position);
      if (dist < 1.5) {
        pu.collected = true;
        this.scene.remove(pu.group);
        player.activatePowerup(pu.type);
        freshlyCollected.push(pu.type);
        if (uiManager) uiManager.showPowerup(pu.type);
      }
    }

    return freshlyCollected;
  }

  remainingCoins() {
    return this._coins.filter(c => !c.collected).length;
  }

  reset() {
    for (const c of this._coins)  if (!c.collected) this.scene.remove(c.mesh);
    for (const p of this._powerups) if (!p.collected) this.scene.remove(p.group);
    this._coins    = [];
    this._powerups = [];
  }
}
