/**
 * missions.js — Kid-friendly mission system for FLIQ Runner.
 * Missions have visible markers, clear directions, and simple instructions.
 * Implements: Explore → Notice → Decide → Act → Consequence → Discovery
 */
import * as THREE from 'three';

const _dummy = new THREE.Object3D();

const MISSION_DEFS = [
  // ── Delivery missions ──
  {
    id: 'delivery_park_to_garden', type: 'delivery',
    title: 'Special Delivery!',
    desc: 'Carry supplies from the Playground to the Garden!',
    hint: 'Run to the Garden & Share Stand! Look for the green glow!',
    fromZone: 'playground', toZone: 'garden_patch',
    reward: 8, timeLimit: 60,
    fliqDomains: ['decision_timing', 'pattern_recognition'],
  },
  {
    id: 'delivery_shop_to_board', type: 'delivery',
    title: 'Community Supplies',
    desc: 'Bring materials from the Discovery Exchange to the Mission Board!',
    hint: 'Run to the Mission Board! Follow the glowing marker!',
    fromZone: 'corner_shop', toZone: 'community_board',
    reward: 6, timeLimit: 45,
    fliqDomains: ['decision_timing', 'resource_judgment'],
  },
  {
    id: 'delivery_fountain_to_lost', type: 'delivery',
    title: 'Return the Crystal',
    desc: 'Someone dropped a crystal! Return it to Lost & Found!',
    hint: 'Run to the Lost & Found box! Look for the glowing marker!',
    fromZone: 'wishing_fountain', toZone: 'lost_and_found',
    reward: 7, timeLimit: 50,
    fliqDomains: ['social_intelligence', 'decision_timing'],
  },
  // ── NPC Assistance ──
  {
    id: 'help_fix_swings', type: 'npc_assist',
    title: 'Fix the Swings',
    desc: 'Find 3 glowing repair parts around the neighborhood!',
    hint: 'Look for floating golden stars! Walk into them to collect!',
    targetZone: 'playground',
    collectibles: 3, searchRadius: 40,
    reward: 10,
    fliqDomains: ['pattern_recognition', 'adaptation'],
  },
  {
    id: 'help_plant_flowers', type: 'npc_assist',
    title: 'Flower Planting',
    desc: 'Find 4 glowing seed bags hidden around the neighborhood!',
    hint: 'Look for floating golden stars! Walk into them to pick up!',
    targetZone: 'garden_patch',
    collectibles: 4, searchRadius: 45,
    reward: 8,
    fliqDomains: ['delayed_gratification', 'pattern_recognition'],
  },
  // ── Trail Hunts ──
  {
    id: 'trail_rooftop_run', type: 'trail',
    title: 'Rooftop Runner',
    desc: 'Follow the glowing rings across the neighborhood!',
    hint: 'Run through each glowing ring! The next one lights up!',
    waypointCount: 8, radius: 50,
    reward: 12, timeLimit: 40,
    fliqDomains: ['pattern_recognition', 'decision_timing', 'adaptation'],
  },
  {
    id: 'trail_hidden_garden', type: 'trail',
    title: 'Secret Path',
    desc: 'Follow the mysterious markers to a hidden discovery!',
    hint: 'Run to the bright ring! Each one leads to the next!',
    waypointCount: 6, radius: 40,
    reward: 10,
    fliqDomains: ['pattern_recognition', 'risk_awareness'],
  },
];

const ZONE_FRIENDLY_NAMES = {
  playground: 'The Playground',
  garden_patch: 'The Garden',
  corner_shop: 'Discovery Exchange',
  community_board: 'Mission Board',
  wishing_fountain: 'The Fountain',
  lost_and_found: 'Lost & Found',
  toy_store: 'Toy Store',
  arcade: 'The Arcade',
  lemonade_stand: 'Recipe Workshop',
  vending_machine: 'Vending Machine',
};

export class MissionManager {
  constructor(scene, fliq) {
    this.scene = scene;
    this._fliq = fliq;
    this._activeMission = null;
    this._completedIds = new Set();
    this._missionTimer = 0;
    this._collectiblesFound = 0;
    this._lastOfferTime = 0;
    this._pendingOffer = null;
    this._lastReward = 0;

    // ── Visual markers for collectibles (golden floating stars) ──
    const starGeo = new THREE.OctahedronGeometry(0.5, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.9 });
    this._collectibleMeshes = [];
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(starGeo, starMat);
      mesh.visible = false;
      scene.add(mesh);
      this._collectibleMeshes.push(mesh);
    }

    // ── Delivery destination beacon (tall glowing pillar) ──
    const beaconGeo = new THREE.CylinderGeometry(0.3, 0.3, 8, 6);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.25 });
    this._deliveryBeacon = new THREE.Mesh(beaconGeo, beaconMat);
    this._deliveryBeacon.visible = false;
    scene.add(this._deliveryBeacon);

    // Beacon ring on ground
    const ringGeo = new THREE.TorusGeometry(2, 0.15, 6, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.4 });
    this._deliveryRing = new THREE.Mesh(ringGeo, ringMat);
    this._deliveryRing.rotation.x = -Math.PI / 2;
    this._deliveryRing.visible = false;
    scene.add(this._deliveryRing);

    // ── HUD ──
    this._hudEl = null;
    this._hudHint = null;
    this._hudTimer = null;
    this._createHUD();
  }

  get activeMission() { return this._activeMission; }

  _createHUD() {
    // Main mission bar
    this._hudEl = document.createElement('div');
    this._hudEl.id = 'mission-hud';
    this._hudEl.style.cssText = `
      position:fixed; top:50px; left:50%; transform:translateX(-50%);
      background:rgba(15,8,35,0.9); color:#ffdd44; font-size:16px;
      font-weight:bold; padding:10px 24px; border-radius:12px;
      border:2px solid rgba(255,221,68,0.4); pointer-events:none;
      z-index:15; font-family:'Segoe UI',Arial,sans-serif;
      transition:opacity 0.3s; opacity:0; text-align:center;
      max-width:90vw;
    `;
    document.body.appendChild(this._hudEl);

    // Hint text below
    this._hudHint = document.createElement('div');
    this._hudHint.style.cssText = `
      position:fixed; top:90px; left:50%; transform:translateX(-50%);
      color:#88ddff; font-size:13px; font-weight:600;
      pointer-events:none; z-index:15; font-family:'Segoe UI',Arial,sans-serif;
      transition:opacity 0.3s; opacity:0; text-align:center;
      max-width:80vw;
    `;
    document.body.appendChild(this._hudHint);

    // Timer
    this._hudTimer = document.createElement('div');
    this._hudTimer.style.cssText = `
      position:fixed; top:112px; left:50%; transform:translateX(-50%);
      color:#ffaa44; font-size:20px; font-weight:bold;
      pointer-events:none; z-index:15; font-family:'Segoe UI',Arial,sans-serif;
      transition:opacity 0.3s; opacity:0;
    `;
    document.body.appendChild(this._hudTimer);
  }

  /** Call each frame */
  update(dt, playerPos, zonePositions) {
    this._lastOfferTime += dt;
    if (!this._activeMission && this._lastOfferTime > 30) {
      this._lastOfferTime = 0;
      this._generateOffer();
    }

    if (!this._activeMission) return;

    const m = this._activeMission;

    // Timer
    if (m.timeLimit) {
      this._missionTimer += dt;
      if (this._missionTimer >= m.timeLimit) {
        this._failMission('Time ran out!');
        return;
      }
      const remaining = Math.ceil(m.timeLimit - this._missionTimer);
      this._hudTimer.textContent = `⏱ ${remaining}s`;
      this._hudTimer.style.opacity = '1';
      this._hudTimer.style.color = remaining <= 10 ? '#ff4444' : '#ffaa44';
    }

    // Animate collectible markers
    const t = Date.now() * 0.003;
    if (m.type === 'npc_assist' && m._collectiblePositions) {
      for (let i = 0; i < m._collectiblePositions.length; i++) {
        const cp = m._collectiblePositions[i];
        const mesh = this._collectibleMeshes[i];
        if (!mesh) break;
        if (cp.found) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        mesh.position.set(cp.x, 2.5 + Math.sin(t + i) * 0.5, cp.z);
        mesh.rotation.y = t * 2;
        mesh.rotation.x = t;
      }
    }

    // Animate delivery beacon
    if (m.type === 'delivery' && zonePositions[m.toZone]) {
      const target = zonePositions[m.toZone];
      this._deliveryBeacon.visible = true;
      this._deliveryBeacon.position.set(target.x, 4, target.z);
      this._deliveryBeacon.material.opacity = 0.15 + Math.sin(t) * 0.1;
      this._deliveryRing.visible = true;
      this._deliveryRing.position.set(target.x, 0.1, target.z);
      this._deliveryRing.rotation.z = t;

      // Update HUD with distance
      const dx = playerPos.x - target.x;
      const dz = playerPos.z - target.z;
      const dist = Math.round(Math.sqrt(dx * dx + dz * dz));
      const zoneName = ZONE_FRIENDLY_NAMES[m.toZone] || m.toZone;
      this._hudHint.textContent = `🏃 Run to ${zoneName}! (${dist}m away)`;
      this._hudHint.style.opacity = '1';
    }

    // Update HUD for NPC assist
    if (m.type === 'npc_assist') {
      this._hudHint.textContent = `⭐ Found ${this._collectiblesFound}/${m.collectibles} — ${m.hint}`;
      this._hudHint.style.opacity = '1';
    }

    // Check completion
    if (m.type === 'delivery') {
      this._checkDelivery(playerPos, zonePositions);
    } else if (m.type === 'npc_assist') {
      this._checkCollectibles(playerPos);
    }
  }

  _generateOffer() {
    const available = MISSION_DEFS.filter(d => !this._completedIds.has(d.id));
    if (available.length === 0) {
      this._completedIds.clear();
      return;
    }
    this._pendingOffer = available[Math.floor(Math.random() * available.length)];
  }

  getOfferForZone(zoneId) {
    if (this._activeMission) return null;
    if (!this._pendingOffer) return null;

    const def = this._pendingOffer;
    if (def.type === 'delivery' && def.fromZone === zoneId) return def;
    if (def.type === 'npc_assist' && def.targetZone === zoneId) return def;
    if (def.type === 'trail' && ['wishing_fountain', 'community_board', 'corner_shop'].includes(zoneId)) return def;
    return null;
  }

  acceptMission(def) {
    this._activeMission = { ...def };
    this._missionTimer = 0;
    this._collectiblesFound = 0;
    this._pendingOffer = null;

    // Show mission title
    this._hudEl.textContent = `📋 ${def.title}`;
    this._hudEl.style.opacity = '1';
    this._hudHint.textContent = def.hint || def.desc;
    this._hudHint.style.opacity = '1';

    // Generate visible collectible positions for NPC assist
    if (def.type === 'npc_assist') {
      this._activeMission._collectiblePositions = [];
      for (let i = 0; i < def.collectibles; i++) {
        const angle = (i / def.collectibles) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const dist = 15 + Math.random() * (def.searchRadius - 15);
        this._activeMission._collectiblePositions.push({
          x: Math.cos(angle) * dist,
          z: Math.sin(angle) * dist,
          found: false,
        });
      }
    }

    // Big announcement
    this._showAnnouncement(def.title, def.hint || def.desc, '#ffdd44');

    if (this._fliq) {
      this._fliq.record('decision_timing', 0.7, `accepted mission: ${def.title}`);
    }
  }

  _checkDelivery(playerPos, zonePositions) {
    const targetPos = zonePositions[this._activeMission.toZone];
    if (!targetPos) return;

    const dx = playerPos.x - targetPos.x;
    const dz = playerPos.z - targetPos.z;
    if (Math.sqrt(dx * dx + dz * dz) < 6) {
      this._completeMission();
    }
  }

  _checkCollectibles(playerPos) {
    if (!this._activeMission._collectiblePositions) return;

    for (const cp of this._activeMission._collectiblePositions) {
      if (cp.found) continue;
      const dx = playerPos.x - cp.x;
      const dz = playerPos.z - cp.z;
      if (Math.sqrt(dx * dx + dz * dz) < 3.5) {
        cp.found = true;
        this._collectiblesFound++;
        const remaining = this._activeMission.collectibles - this._collectiblesFound;
        if (remaining > 0) {
          this._showFloating(`⭐ Got one! ${remaining} more to find!`, '#ffdd44');
        } else {
          this._showFloating(`⭐ Found them all!`, '#44ff44');
        }
      }
    }

    if (this._collectiblesFound >= this._activeMission.collectibles) {
      this._completeMission();
    }
  }

  completeTrailMission() {
    if (this._activeMission && this._activeMission.type === 'trail') {
      this._completeMission();
    }
  }

  _completeMission() {
    const m = this._activeMission;
    this._completedIds.add(m.id);

    const timeTaken = this._missionTimer;
    const efficiency = m.timeLimit ? Math.max(0, 1 - timeTaken / m.timeLimit) : 0.7;

    if (this._fliq) {
      for (const domain of m.fliqDomains) {
        this._fliq.record(domain, 0.6 + efficiency * 0.3, `completed: ${m.title}`);
      }
    }

    // Phase 3 Tier 2: Mission-end feedback card
    const insights = this._generateMissionInsights(m, timeTaken, efficiency);
    this._showMissionFeedbackCard(m, insights, true);

    this._lastReward = m.reward;
    this._cleanup();
    return m.reward;
  }

  _failMission(reason) {
    if (this._fliq) {
      this._fliq.record('adaptation', 0.3, `mission failed: ${reason}`);
    }

    // Phase 3 Tier 2: Failure feedback card
    const m = this._activeMission;
    this._showMissionFeedbackCard(m, [
      { icon: '💪', text: 'Keep exploring — every attempt teaches something!' },
      { icon: '🔄', text: reason },
    ], false);

    this._lastReward = 0;
    this._cleanup();
    return 0;
  }

  /** Phase 3: Generate insight strings based on mission performance */
  _generateMissionInsights(mission, timeTaken, efficiency) {
    const insights = [];

    // Time-based insight
    if (efficiency > 0.7) {
      insights.push({ icon: '⚡', text: 'Lightning fast! You found the best route!' });
    } else if (efficiency > 0.4) {
      insights.push({ icon: '🏃', text: 'Good pace — you balanced speed and exploration!' });
    } else {
      insights.push({ icon: '🔍', text: 'You took your time exploring — patience pays off!' });
    }

    // Domain-based insights
    for (const domain of mission.fliqDomains) {
      switch (domain) {
        case 'pattern_recognition':
          insights.push({ icon: '👁', text: 'You spotted hidden routes others might miss!' });
          break;
        case 'social_intelligence':
          insights.push({ icon: '🤝', text: 'You helped the neighborhood!' });
          break;
        case 'delayed_gratification':
          insights.push({ icon: '🌱', text: 'You stayed patient for the bigger reward!' });
          break;
        case 'risk_awareness':
          insights.push({ icon: '🎯', text: 'You weighed risks before acting!' });
          break;
        case 'decision_timing':
          insights.push({ icon: '⏱', text: 'Quick thinking when it mattered!' });
          break;
        case 'adaptation':
          insights.push({ icon: '🔄', text: 'You adapted your approach — great resilience!' });
          break;
        case 'resource_judgment':
          insights.push({ icon: '✨', text: 'Smart use of your resources!' });
          break;
      }
    }

    return insights.slice(0, 3); // Max 3 insights per card
  }

  /** Phase 3 Tier 2: Show mission-end feedback card */
  _showMissionFeedbackCard(mission, insights, success) {
    const card = document.createElement('div');
    card.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      background:rgba(15,8,35,0.95); border:3px solid ${success ? '#44ff88' : '#ff6666'};
      border-radius:16px; padding:24px 32px; max-width:400px; width:85%;
      color:white; z-index:250; font-family:'Segoe UI',Arial,sans-serif;
      text-align:center; animation: cardSlideIn 0.3s ease-out;
    `;

    const title = success ? 'Mission Complete!' : 'Mission Over';
    const titleColor = success ? '#44ff88' : '#ff6666';
    const reward = success ? `<div style="font-size:24px; color:#ffdd44; margin:8px 0;">+${mission.reward} Spark ✨</div>` : '';

    let insightsHTML = insights.map(i =>
      `<div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
        <span style="font-size:18px;">${i.icon}</span>
        <span style="color:#cccccc; font-size:13px; text-align:left;">${i.text}</span>
      </div>`
    ).join('');

    card.innerHTML = `
      <h3 style="color:${titleColor}; margin:0 0 4px; font-size:20px;">${title}</h3>
      <p style="color:#888; font-size:12px; margin:0 0 8px;">${mission.title}</p>
      ${reward}
      <div style="margin:12px 0; text-align:left;">${insightsHTML}</div>
      <div style="color:#666; font-size:11px; margin-top:8px;">Card fades in 4 seconds...</div>
    `;

    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `@keyframes cardSlideIn { from { opacity:0; transform:translate(-50%,-60%); } to { opacity:1; transform:translate(-50%,-50%); } }`;
    document.head.appendChild(style);

    document.body.appendChild(card);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      card.style.transition = 'opacity 0.5s';
      card.style.opacity = '0';
      setTimeout(() => { card.remove(); style.remove(); }, 500);
    }, 4000);
  }

  _cleanup() {
    this._activeMission = null;
    this._hudEl.style.opacity = '0';
    this._hudHint.style.opacity = '0';
    this._hudTimer.style.opacity = '0';
    // Hide all markers
    for (const m of this._collectibleMeshes) m.visible = false;
    this._deliveryBeacon.visible = false;
    this._deliveryRing.visible = false;
  }

  _showAnnouncement(title, subtitle, color) {
    const div = document.createElement('div');
    div.innerHTML = `
      <div style="font-size:28px; font-weight:bold; color:${color};">${title}</div>
      <div style="font-size:16px; color:#ccc; margin-top:6px;">${subtitle}</div>
    `;
    div.style.cssText = `
      position:fixed; top:35%; left:50%; transform:translate(-50%,-50%);
      text-align:center; font-family:'Segoe UI',Arial,sans-serif;
      text-shadow:0 2px 12px rgba(0,0,0,0.8);
      pointer-events:none; z-index:100; transition:all 2s;
    `;
    document.body.appendChild(div);
    requestAnimationFrame(() => { div.style.top = '28%'; div.style.opacity = '0'; });
    setTimeout(() => div.remove(), 2200);
  }

  _showFloating(text, color) {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.cssText = `
      position:fixed; top:40%; left:50%; transform:translate(-50%,-50%);
      color:${color}; font-size:22px; font-weight:bold;
      font-family:'Segoe UI',Arial,sans-serif;
      text-shadow:0 2px 8px rgba(0,0,0,0.6);
      pointer-events:none; z-index:100; transition:all 1.5s;
    `;
    document.body.appendChild(div);
    requestAnimationFrame(() => { div.style.top = '32%'; div.style.opacity = '0'; });
    setTimeout(() => div.remove(), 1600);
  }
}
