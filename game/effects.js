/**
 * effects.js — Visual World Guide effects system.
 * Implements: ambient floating particles, discovery pulses,
 * ground energy trails, and color meaning system.
 * Makes the world feel magical, alive, and responsive.
 */
import * as THREE from 'three';
import { isMobile } from './materials.js';

const _dummy = new THREE.Object3D();

/* ═══════════════════════════════════════════════════════════════
   COLOR MEANING SYSTEM (from Visual World Guide)
   Gold = reward/discovery, Blue = exploration/pathways,
   Green = growth/garden, Purple = mystery/secrets, Orange = missions
   ═══════════════════════════════════════════════════════════════ */
export const COLOR_MEANINGS = {
  gold:   { color: 0xFFDD44, emissive: 0xFFAA22 },
  blue:   { color: 0x44AAFF, emissive: 0x2288DD },
  green:  { color: 0x44FF88, emissive: 0x22CC55 },
  purple: { color: 0xBB66FF, emissive: 0x8833CC },
  orange: { color: 0xFF8844, emissive: 0xDD5522 },
};

// Map zone IDs to color meanings
export const ZONE_COLORS = {
  wishing_fountain:  'gold',
  corner_shop:       'orange',
  arcade:            'purple',
  playground:        'blue',
  toy_store:         'orange',
  lemonade_stand:    'green',
  lost_and_found:    'blue',
  community_board:   'orange',
  vending_machine:   'purple',
  garden_patch:      'green',
};

export class EffectsManager {
  constructor(scene) {
    this.scene = scene;
    this._time = 0;

    // ── Ambient Floating Particles ──
    this._initAmbientParticles();

    // ── Discovery Pulses ──
    this._pulses = [];
    this._pulsePool = [];
    this._initPulsePool();

    // ── Ground Energy Trails (glowing path lines) ──
    this._energyTrails = [];
    this._initEnergyTrails();

    // ── Zone Glow Rings (color-coded halos under zones) ──
    this._zoneGlows = [];
  }

  /* ═══════════════════════════════════════════════════════════════
     AMBIENT FLOATING PARTICLES — magical sparkles drifting in air
     ═══════════════════════════════════════════════════════════════ */
  _initAmbientParticles() {
    const count = isMobile ? 60 : 150;
    const geo = new THREE.SphereGeometry(0.08, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xFFEEAA, transparent: true, opacity: 0.6,
    });

    this._particleIM = new THREE.InstancedMesh(geo, mat, count);
    this._particleIM.frustumCulled = false;
    this._particleCount = count;

    // Per-particle data
    this._particleData = [];
    for (let i = 0; i < count; i++) {
      this._particleData.push({
        x: (Math.random() - 0.5) * 120,
        y: 1 + Math.random() * 8,
        z: (Math.random() - 0.5) * 120,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: 0.1 + Math.random() * 0.2,
        speedZ: (Math.random() - 0.5) * 0.3,
        phase: Math.random() * Math.PI * 2,
        baseScale: 0.5 + Math.random() * 1.0,
      });

      const p = this._particleData[i];
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.scale.setScalar(p.baseScale);
      _dummy.updateMatrix();
      this._particleIM.setMatrixAt(i, _dummy.matrix);
    }

    // Color variation — gold, blue, green, purple sparkles
    const colors = [
      new THREE.Color(0xFFEEAA), // gold
      new THREE.Color(0xAADDFF), // blue
      new THREE.Color(0xAAFFCC), // green
      new THREE.Color(0xDDBBFF), // purple
    ];
    for (let i = 0; i < count; i++) {
      this._particleIM.setColorAt(i, colors[i % colors.length]);
    }
    this._particleIM.instanceColor.needsUpdate = true;

    this.scene.add(this._particleIM);
  }

  /* ═══════════════════════════════════════════════════════════════
     DISCOVERY PULSES — expanding rings near interactive objects
     ═══════════════════════════════════════════════════════════════ */
  _initPulsePool() {
    const ringGeo = new THREE.RingGeometry(0.5, 0.8, 24);
    const count = isMobile ? 10 : 20;

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xFFDD44, transparent: true, opacity: 0,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      this.scene.add(ring);
      this._pulsePool.push({
        mesh: ring,
        active: false,
        life: 0,
        maxLife: 3,
        x: 0, z: 0,
        color: new THREE.Color(0xFFDD44),
      });
    }
  }

  /** Register zones to pulse near — call after interaction zones are set up */
  registerZonePulses(zones) {
    this._zonePositions = zones.map(z => ({
      x: z.position.x,
      z: z.position.z,
      colorKey: ZONE_COLORS[z.id] || 'gold',
    }));
  }

  /* ═══════════════════════════════════════════════════════════════
     GROUND ENERGY TRAILS — glowing path lines connecting zones
     Represent "opportunity" pathways through the world
     ═══════════════════════════════════════════════════════════════ */
  _initEnergyTrails() {
    // Define key pathways between zones (curved, not rigid)
    const pathways = [
      // Center hub outward — 4 main directions with curves
      { points: [{ x: 0, z: 0 }, { x: 5, z: 8 }, { x: 12, z: 18 }, { x: 18, z: 30 }], color: 'gold' },
      { points: [{ x: 0, z: 0 }, { x: -8, z: 5 }, { x: -22, z: 12 }, { x: -30, z: 30 }], color: 'blue' },
      { points: [{ x: 0, z: 0 }, { x: -5, z: -8 }, { x: -15, z: -20 }, { x: -30, z: -30 }], color: 'purple' },
      { points: [{ x: 0, z: 0 }, { x: 8, z: -5 }, { x: 20, z: -15 }, { x: 25, z: -25 }], color: 'green' },
      // Cross paths
      { points: [{ x: 30, z: 30 }, { x: 25, z: 15 }, { x: 30, z: 0 }, { x: 38, z: 10 }], color: 'orange' },
      { points: [{ x: -30, z: 30 }, { x: -20, z: 20 }, { x: -10, z: 25 }, { x: 0, z: 40 }], color: 'blue' },
    ];

    const trailWidth = 0.6;

    for (const pathway of pathways) {
      const colorData = COLOR_MEANINGS[pathway.color] || COLOR_MEANINGS.gold;

      // Create flat ribbon on the ground (NOT a tube)
      const curve = new THREE.CatmullRomCurve3(
        pathway.points.map(p => new THREE.Vector3(p.x, 0, p.z))
      );
      const segments = 32;
      const positions = [];
      const indices = [];

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const pt = curve.getPointAt(t);
        const tan = curve.getTangentAt(t);
        const nx = -tan.z, nz = tan.x;
        const len = Math.sqrt(nx * nx + nz * nz) || 1;
        positions.push(
          pt.x + (nx / len) * trailWidth * 0.5, 0.06, pt.z + (nz / len) * trailWidth * 0.5,
          pt.x - (nx / len) * trailWidth * 0.5, 0.06, pt.z - (nz / len) * trailWidth * 0.5,
        );
        if (i < segments) {
          const base = i * 2;
          indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const mat = new THREE.MeshBasicMaterial({
        color: colorData.color, transparent: true, opacity: 0.3,
        side: THREE.DoubleSide,
      });

      const ribbon = new THREE.Mesh(geo, mat);
      this.scene.add(ribbon);
      this._energyTrails.push({ mesh: ribbon, mat, phase: Math.random() * Math.PI * 2, colorData });

      // Glowing dots along the trail — bigger and brighter
      const dotCount = isMobile ? 6 : 12;
      const dotGeo = new THREE.SphereGeometry(0.2, 6, 6);

      for (let i = 0; i < dotCount; i++) {
        const t = i / dotCount;
        const pos = curve.getPointAt(t);
        const dotMat = new THREE.MeshBasicMaterial({
          color: colorData.color, transparent: true, opacity: 0.6,
        });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(pos.x, 0.25, pos.z);
        this.scene.add(dot);
        this._energyTrails.push({
          mesh: dot,
          mat: dotMat,
          phase: Math.random() * Math.PI * 2,
          isDot: true,
          baseY: 0.25,
          colorData,
        });
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     ZONE GLOW RINGS — Color-coded halos under interactive zones
     ═══════════════════════════════════════════════════════════════ */
  addZoneGlow(position, zoneId) {
    const colorKey = ZONE_COLORS[zoneId] || 'gold';
    const colorData = COLOR_MEANINGS[colorKey];

    // Outer glow ring on the ground
    const ringGeo = new THREE.RingGeometry(2.5, 3.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorData.color, transparent: true, opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(position.x, 0.06, position.z);
    this.scene.add(ring);

    // Inner glow circle
    const innerGeo = new THREE.CircleGeometry(2.5, 24);
    const innerMat = new THREE.MeshBasicMaterial({
      color: colorData.color, transparent: true, opacity: 0.06,
      side: THREE.DoubleSide,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(position.x, 0.05, position.z);
    this.scene.add(inner);

    this._zoneGlows.push({
      ring, inner, ringMat, innerMat,
      phase: Math.random() * Math.PI * 2,
      colorData,
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     UPDATE — Called each frame from main.js
     ═══════════════════════════════════════════════════════════════ */
  update(dt, playerPos) {
    this._time += dt;
    const t = this._time;

    // ── Ambient particles: drift and shimmer ──
    for (let i = 0; i < this._particleCount; i++) {
      const p = this._particleData[i];
      p.x += p.speedX * dt;
      p.y += Math.sin(t * p.speedY + p.phase) * 0.01;
      p.z += p.speedZ * dt;

      // Wrap around
      if (p.x > 60) p.x = -60;
      if (p.x < -60) p.x = 60;
      if (p.z > 60) p.z = -60;
      if (p.z < -60) p.z = 60;

      const shimmer = 0.3 + Math.sin(t * 2 + p.phase) * 0.3;
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.scale.setScalar(p.baseScale * (0.5 + shimmer * 0.5));
      _dummy.updateMatrix();
      this._particleIM.setMatrixAt(i, _dummy.matrix);
    }
    this._particleIM.instanceMatrix.needsUpdate = true;

    // ── Discovery pulses: trigger near player ──
    if (this._zonePositions) {
      for (const zp of this._zonePositions) {
        const dx = (playerPos?.x ?? 0) - zp.x;
        const dz = (playerPos?.z ?? 0) - zp.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Pulse when player is within 15 units
        if (dist < 15 && dist > 4) {
          this._trySpawnPulse(zp.x, zp.z, zp.colorKey);
        }
      }
    }

    // Update active pulses
    for (const pulse of this._pulsePool) {
      if (!pulse.active) continue;
      pulse.life += dt;
      const progress = pulse.life / pulse.maxLife;

      if (progress >= 1) {
        pulse.active = false;
        pulse.mesh.visible = false;
        continue;
      }

      const scale = 1 + progress * 4;
      pulse.mesh.scale.setScalar(scale);
      pulse.mesh.position.set(pulse.x, 0.08, pulse.z);
      pulse.mesh.material.opacity = 0.3 * (1 - progress);
      pulse.mesh.visible = true;
    }

    // ── Energy trails: pulse opacity (boosted visibility) ──
    for (const trail of this._energyTrails) {
      if (trail.isDot) {
        // Dots: floating bob + shimmer — bright and visible
        const shimmer = 0.4 + Math.sin(t * 3 + trail.phase) * 0.3;
        trail.mat.opacity = shimmer;
        trail.mesh.position.y = trail.baseY + Math.sin(t * 2 + trail.phase) * 0.15;
      } else {
        // Trail ribbons: visible pulsing glow
        trail.mat.opacity = 0.2 + Math.sin(t * 1.5 + trail.phase) * 0.12;
      }
    }

    // ── Zone glow rings: pulse ──
    for (const glow of this._zoneGlows) {
      const pulse = 0.1 + Math.sin(t * 2 + glow.phase) * 0.08;
      glow.ringMat.opacity = pulse;
      glow.innerMat.opacity = pulse * 0.5;
    }
  }

  _trySpawnPulse(x, z, colorKey) {
    // Rate limit: only spawn every ~3s per position
    const key = `${Math.round(x)}_${Math.round(z)}`;
    if (!this._lastPulse) this._lastPulse = {};
    const now = this._time;
    if (this._lastPulse[key] && now - this._lastPulse[key] < 3) return;
    this._lastPulse[key] = now;

    // Find an inactive pulse
    const pulse = this._pulsePool.find(p => !p.active);
    if (!pulse) return;

    const colorData = COLOR_MEANINGS[colorKey] || COLOR_MEANINGS.gold;
    pulse.active = true;
    pulse.life = 0;
    pulse.x = x;
    pulse.z = z;
    pulse.mesh.material.color.setHex(colorData.color);
    pulse.mesh.scale.setScalar(1);
    pulse.mesh.visible = true;
  }

  clear() {
    if (this._particleIM) {
      this.scene.remove(this._particleIM);
      this._particleIM.geometry.dispose();
    }
    for (const pulse of this._pulsePool) {
      this.scene.remove(pulse.mesh);
      pulse.mesh.geometry.dispose();
    }
    for (const trail of this._energyTrails) {
      this.scene.remove(trail.mesh);
      trail.mesh.geometry.dispose();
    }
    for (const glow of this._zoneGlows) {
      this.scene.remove(glow.ring);
      this.scene.remove(glow.inner);
      glow.ring.geometry.dispose();
      glow.inner.geometry.dispose();
    }
  }
}
