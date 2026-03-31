/**
 * spark.js — Spark orb system using InstancedMesh for performance.
 * Spark is the world's mysterious energy resource — NOT money.
 * Uses 2 InstancedMesh objects instead of 210+ individual meshes.
 * Zero PointLights — emissive materials handle the glow.
 */
import * as THREE from 'three';
import { sparkCoreMat, sparkGlowMat, sparkParticleMat } from './materials.js';

const ORB_COLLECT_RADIUS = 2.5;
const ORB_MAGNET_RADIUS  = 5;
const MAX_ORBS = 100;
const PARTICLE_POOL_SIZE = 12;

const _dummy = new THREE.Object3D();
const _vec   = new THREE.Vector3();

export class SparkManager {
  constructor(scene) {
    this.scene = scene;
    this._fliq          = null;
    this._collectCount   = 0;
    this._lastBatchEmit  = 0;
    this._count = 0;

    // Per-orb data arrays (flat, cache-friendly)
    this._posX   = new Float32Array(MAX_ORBS);
    this._posZ   = new Float32Array(MAX_ORBS);
    this._baseY  = new Float32Array(MAX_ORBS);
    this._phase  = new Float32Array(MAX_ORBS);
    this._alive  = new Uint8Array(MAX_ORBS);   // 1 = alive, 0 = collected

    // Shared geometries
    const coreGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const glowGeo = new THREE.SphereGeometry(0.4, 6, 6);

    // InstancedMesh — single draw call each
    this._coreIM = new THREE.InstancedMesh(coreGeo, sparkCoreMat, MAX_ORBS);
    this._glowIM = new THREE.InstancedMesh(glowGeo, sparkGlowMat, MAX_ORBS);
    this._coreIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._glowIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._coreIM.frustumCulled = false;
    this._glowIM.frustumCulled = false;

    scene.add(this._coreIM);
    scene.add(this._glowIM);

    // Particle pool for collect effects (reused, never created/destroyed)
    this._particles = [];
    this._particleGeo = new THREE.SphereGeometry(0.15, 4, 4);
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(this._particleGeo, sparkParticleMat.clone());
      mesh.visible = false;
      scene.add(mesh);
      this._particles.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0 });
    }
    this._nextParticle = 0;
  }

  setFLIQ(fliq) { this._fliq = fliq; }

  scatterOrbs(count, maxRadius) {
    const n = Math.min(count, MAX_ORBS);
    this._count = n;
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist  = 5 + Math.random() * (maxRadius - 5);
      this._posX[i]  = Math.cos(angle) * dist;
      this._posZ[i]  = Math.sin(angle) * dist;
      this._baseY[i] = 1.2 + Math.random() * 0.5;
      this._phase[i] = Math.random() * Math.PI * 2;
      this._alive[i] = 1;
    }
    // Hide unused instances off-screen
    _dummy.position.set(0, -100, 0);
    _dummy.scale.setScalar(0);
    _dummy.updateMatrix();
    for (let i = n; i < MAX_ORBS; i++) {
      this._coreIM.setMatrixAt(i, _dummy.matrix);
      this._glowIM.setMatrixAt(i, _dummy.matrix);
    }
    this._updateMatrices(0);
  }

  update(dt, playerPos, player) {
    const t = Date.now() * 0.003;

    for (let i = 0; i < this._count; i++) {
      if (!this._alive[i]) continue;

      // Distance to player
      const dx = playerPos.x - this._posX[i];
      const dz = playerPos.z - this._posZ[i];
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Magnet pull
      if (dist < ORB_MAGNET_RADIUS && player.magnetActive) {
        this._posX[i] += dx * 0.05;
        this._posZ[i] += dz * 0.05;
      }

      // Collect
      if (dist < ORB_COLLECT_RADIUS) {
        this._alive[i] = 0;
        player.spark = (player.spark || 0) + 1;
        this._collectCount++;
        this._spawnCollectEffect(this._posX[i], this._baseY[i], this._posZ[i]);

        // Hide this instance
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this._coreIM.setMatrixAt(i, _dummy.matrix);
        this._glowIM.setMatrixAt(i, _dummy.matrix);

        if (this._fliq && this._collectCount - this._lastBatchEmit >= 5) {
          this._lastBatchEmit = this._collectCount;
          this._fliq.record('resource_judgment', 0.6,
            `collected ${this._collectCount} Spark orbs`);
        }
      }
    }

    // Update visible orb positions (batch)
    this._updateMatrices(t);

    // Update particle pool
    this._updateParticles();
  }

  _updateMatrices(t) {
    for (let i = 0; i < this._count; i++) {
      if (!this._alive[i]) continue;

      const y = this._baseY[i] + Math.sin(t + this._phase[i]) * 0.3;
      const pulse = 0.9 + Math.sin(t * 2 + this._phase[i]) * 0.15;

      // Core orb
      _dummy.position.set(this._posX[i], y, this._posZ[i]);
      _dummy.rotation.y = t * 2;
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      this._coreIM.setMatrixAt(i, _dummy.matrix);

      // Glow shell
      _dummy.scale.setScalar(pulse);
      _dummy.updateMatrix();
      this._glowIM.setMatrixAt(i, _dummy.matrix);
    }
    this._coreIM.instanceMatrix.needsUpdate = true;
    this._glowIM.instanceMatrix.needsUpdate = true;
  }

  _spawnCollectEffect(x, y, z) {
    for (let j = 0; j < 4; j++) {
      const p = this._particles[this._nextParticle % PARTICLE_POOL_SIZE];
      this._nextParticle++;
      p.mesh.position.set(x, y, z);
      p.mesh.visible = true;
      p.mesh.material.opacity = 1;
      p.vx = (Math.random() - 0.5) * 3;
      p.vy = Math.random() * 2 + 1;
      p.vz = (Math.random() - 0.5) * 3;
      p.life = 25; // frames
    }
  }

  _updateParticles() {
    for (const p of this._particles) {
      if (p.life <= 0) continue;
      p.mesh.position.x += p.vx * 0.03;
      p.mesh.position.y += p.vy * 0.03;
      p.mesh.position.z += p.vz * 0.03;
      p.mesh.material.opacity -= 0.04;
      p.life--;
      if (p.life <= 0) {
        p.mesh.visible = false;
      }
    }
  }

  reset() {
    this._count = 0;
    _dummy.position.set(0, -100, 0);
    _dummy.scale.setScalar(0);
    _dummy.updateMatrix();
    for (let i = 0; i < MAX_ORBS; i++) {
      this._coreIM.setMatrixAt(i, _dummy.matrix);
      this._glowIM.setMatrixAt(i, _dummy.matrix);
    }
    this._coreIM.instanceMatrix.needsUpdate = true;
    this._glowIM.instanceMatrix.needsUpdate = true;
  }
}
