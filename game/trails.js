/**
 * trails.js — Exploration trail system.
 * Glowing waypoint markers form trails through the world.
 * Player reaches a waypoint → it fades → next lights up.
 * Uses InstancedMesh for all waypoint markers (single draw call).
 */
import * as THREE from 'three';

const MAX_WAYPOINTS = 40;
const WAYPOINT_RADIUS = 3.0;
const WAYPOINT_Y = 1.5;

const _dummy = new THREE.Object3D();

export class TrailManager {
  constructor(scene, fliq) {
    this.scene = scene;
    this._fliq = fliq;
    this._activeTrail = null;
    this._currentWP = 0;
    this._trailTimer = 0;
    this._trailsCompleted = 0;

    // InstancedMesh for waypoint rings
    const ringGeo = new THREE.TorusGeometry(0.8, 0.1, 6, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffdd44, transparent: true, opacity: 0.7,
    });
    this._waypointIM = new THREE.InstancedMesh(ringGeo, ringMat, MAX_WAYPOINTS);
    this._waypointIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._waypointIM.frustumCulled = false;
    this._hideAll();
    scene.add(this._waypointIM);

    // Glow pillar for active waypoint
    const pillarGeo = new THREE.CylinderGeometry(0.15, 0.15, 4, 6);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0xffdd44, transparent: true, opacity: 0.2,
    });
    this._pillar = new THREE.Mesh(pillarGeo, pillarMat);
    this._pillar.visible = false;
    scene.add(this._pillar);
  }

  /** Start a trail with given waypoints [{x, z}] */
  startTrail(waypoints, timeLimit = null) {
    this._activeTrail = waypoints.map(wp => ({ x: wp.x, z: wp.z, reached: false }));
    this._currentWP = 0;
    this._trailTimer = 0;
    this._timeLimit = timeLimit;
    this._updateWaypointVisuals();
  }

  /** Generate a random trail with N waypoints within radius */
  generateRandomTrail(count = 6, radius = 45, timeLimit = null) {
    const waypoints = [];
    let prevX = 0, prevZ = 0;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const dist = 15 + Math.random() * (radius - 15);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      waypoints.push({ x, z });
      prevX = x;
      prevZ = z;
    }
    this.startTrail(waypoints, timeLimit);
  }

  get isActive() { return this._activeTrail !== null; }
  get progress() {
    if (!this._activeTrail) return 0;
    return this._currentWP / this._activeTrail.length;
  }

  /** Call each frame */
  update(dt, playerPos) {
    if (!this._activeTrail) return;

    this._trailTimer += dt;

    // Check time limit
    if (this._timeLimit && this._trailTimer > this._timeLimit) {
      this._failTrail();
      return;
    }

    // Check if player reached current waypoint
    const wp = this._activeTrail[this._currentWP];
    if (!wp) return;

    const dx = playerPos.x - wp.x;
    const dz = playerPos.z - wp.z;
    if (Math.sqrt(dx * dx + dz * dz) < WAYPOINT_RADIUS) {
      wp.reached = true;
      this._currentWP++;

      if (this._currentWP >= this._activeTrail.length) {
        this._completeTrail();
        return;
      }

      // FLIQ signal for progress
      if (this._fliq) {
        this._fliq.record('pattern_recognition', 0.6 + this.progress * 0.3,
          `trail waypoint ${this._currentWP}/${this._activeTrail.length}`);
      }

      this._updateWaypointVisuals();
    }

    // Animate active waypoint pillar
    const activeWP = this._activeTrail[this._currentWP];
    if (activeWP) {
      this._pillar.visible = true;
      this._pillar.position.set(activeWP.x, 2, activeWP.z);
      this._pillar.material.opacity = 0.15 + Math.sin(Date.now() * 0.004) * 0.1;
    }

    // Pulse the ring instances
    const t = Date.now() * 0.003;
    for (let i = this._currentWP; i < this._activeTrail.length; i++) {
      const w = this._activeTrail[i];
      const isActive = i === this._currentWP;
      const scale = isActive ? 1.0 + Math.sin(t) * 0.2 : 0.7;
      const rotSpeed = isActive ? t * 2 : t * 0.5;

      _dummy.position.set(w.x, WAYPOINT_Y + (isActive ? Math.sin(t) * 0.3 : 0), w.z);
      _dummy.rotation.set(Math.PI / 2, rotSpeed, 0);
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      this._waypointIM.setMatrixAt(i, _dummy.matrix);
    }
    this._waypointIM.instanceMatrix.needsUpdate = true;
  }

  _updateWaypointVisuals() {
    // Hide reached waypoints, show remaining
    for (let i = 0; i < MAX_WAYPOINTS; i++) {
      if (!this._activeTrail || i >= this._activeTrail.length || this._activeTrail[i].reached) {
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0);
      } else {
        const w = this._activeTrail[i];
        _dummy.position.set(w.x, WAYPOINT_Y, w.z);
        _dummy.rotation.set(Math.PI / 2, 0, 0);
        _dummy.scale.setScalar(i === this._currentWP ? 1.0 : 0.7);
      }
      _dummy.updateMatrix();
      this._waypointIM.setMatrixAt(i, _dummy.matrix);
    }
    this._waypointIM.instanceMatrix.needsUpdate = true;
  }

  _completeTrail() {
    this._trailsCompleted++;
    const efficiency = this._timeLimit ? Math.max(0, 1 - this._trailTimer / this._timeLimit) : 0.7;

    if (this._fliq) {
      this._fliq.record('pattern_recognition', 0.8 + efficiency * 0.15, `trail completed in ${Math.round(this._trailTimer)}s`);
      this._fliq.record('adaptation', this._trailsCompleted > 1 ? 0.8 : 0.6, `${this._trailsCompleted} trails done`);
    }

    this._showFloating('Trail Complete!', '#ffdd44');
    this._cleanup();
    return true;
  }

  _failTrail() {
    if (this._fliq) {
      this._fliq.record('adaptation', 0.35, 'trail timed out');
    }
    this._showFloating('Trail expired...', '#ff6666');
    this._cleanup();
  }

  _cleanup() {
    this._activeTrail = null;
    this._pillar.visible = false;
    this._hideAll();
  }

  _hideAll() {
    _dummy.position.set(0, -100, 0);
    _dummy.scale.setScalar(0);
    _dummy.updateMatrix();
    for (let i = 0; i < MAX_WAYPOINTS; i++) {
      this._waypointIM.setMatrixAt(i, _dummy.matrix);
    }
    this._waypointIM.instanceMatrix.needsUpdate = true;
  }

  /** Get spark reward for completing trail */
  getReward() {
    return 5 + this._trailsCompleted * 2;
  }

  _showFloating(text, color) {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.cssText = `
      position:fixed; top:35%; left:50%; transform:translate(-50%,-50%);
      color:${color}; font-size:22px; font-weight:bold;
      font-family:'Segoe UI',Arial,sans-serif;
      text-shadow:0 2px 8px rgba(0,0,0,0.6);
      pointer-events:none; z-index:100; transition:all 1.5s;
    `;
    document.body.appendChild(div);
    requestAnimationFrame(() => { div.style.top = '25%'; div.style.opacity = '0'; });
    setTimeout(() => div.remove(), 1600);
  }
}
