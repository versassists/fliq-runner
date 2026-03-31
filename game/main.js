import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import { PHYSICS } from './constants.js';
import { isMobile } from './materials.js';
import { Player, PlayerState } from './player.js';
import { ThirdPersonCamera } from './camera.js';
import { WorldBuilder } from './world.js';
import { InteractionManager } from './interaction.js';
import { SparkManager } from './spark.js';
import { FLIQTracker } from './fliqTracker.js';
import { BehaviorTracker } from './behaviorTracker.js';
import { AudioManager } from './audio.js';
import { TouchControls } from './touchControls.js';
import { MissionManager } from './missions.js';
import { TrailManager } from './trails.js';
import { EffectsManager } from './effects.js';

// ── Shared Game State ────────────────────────────────────────────
const gameState = {
  started: false,
  paused:  false,
};

// ── Device tier ──────────────────────────────────────────────────
const gpuTier = isMobile ? 'low' : 'high';

// ── Renderer (tuned for device) ─────────────────────────────────
const canvas   = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.toneMapping       = THREE.LinearToneMapping;
renderer.toneMappingExposure = 1.1;

// ── Scene ────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x66ccff);
scene.fog = new THREE.Fog(0x88ccff, isMobile ? 80 : 120, isMobile ? 180 : 280);

// ── Camera ───────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);

// ── Lighting (reduced for mobile) ────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const shadowSize = isMobile ? 512 : 1024;
const sun = new THREE.DirectionalLight(0xffffee, 1.5);
sun.position.set(20, 30, 15);
sun.castShadow            = true;
sun.shadow.mapSize.width  = shadowSize;
sun.shadow.mapSize.height = shadowSize;
sun.shadow.camera.left    = -60;
sun.shadow.camera.right   = 60;
sun.shadow.camera.top     = 60;
sun.shadow.camera.bottom  = -60;
sun.shadow.camera.near    = 1;
sun.shadow.camera.far     = 80;
scene.add(sun);

scene.add(new THREE.HemisphereLight(0x88ddff, 0x44dd44, 0.8));

// Fill light only on desktop
if (!isMobile) {
  const fill = new THREE.DirectionalLight(0xaaccff, 0.3);
  fill.position.set(-10, 10, -10);
  scene.add(fill);
}

// ── Physics World (SAPBroadphase for better perf) ────────────────
const physicsWorld = new CANNON.World();
physicsWorld.gravity.set(0, PHYSICS.GRAVITY, 0);
physicsWorld.broadphase        = new CANNON.SAPBroadphase(physicsWorld);
physicsWorld.solver.iterations = 5;

// ── Game Systems ─────────────────────────────────────────────────
const player      = new Player(scene, physicsWorld);
const camRig      = new ThirdPersonCamera(camera);
const worldBuild  = new WorldBuilder(scene, physicsWorld);
const sparks      = new SparkManager(scene);
const interact    = new InteractionManager(scene, player, gameState);
const fliq        = new FLIQTracker();
const behavior    = new BehaviorTracker(fliq, player);
const audio       = new AudioManager();

// ── Mission & Trail systems ─────────────────────────────────────
const missions = new MissionManager(scene, fliq);
const trails   = new TrailManager(scene, fliq);

// ── Visual Effects (particles, pulses, energy trails) ──────────
const effects  = new EffectsManager(scene);

// Connect trackers
interact.setBehaviorTracker(behavior);
interact.setMissionManager(missions);
interact.setTrailManager(trails);
sparks.setFLIQ(fliq);

// ── Mobile touch controls ───────────────────────────────────────
const touchControls = new TouchControls(player.keys);

// Opportunity spawn timer (gameplay loop: periodically offer new events)
let opportunityTimer = 0;
const OPPORTUNITY_INTERVAL = 25; // seconds between trail/event spawns

// ── HUD Elements ─────────────────────────────────────────────────
const hudSpark    = document.getElementById('fliq-coins');
const hudPrompt   = document.getElementById('powerup-indicator');

const hudInventory = document.getElementById('hud-inventory');

function updateHUD() {
  if (hudSpark) hudSpark.textContent = `✨ ${player.spark} Spark`;
  if (hudInventory) {
    if (player.inventory.length > 0) {
      hudInventory.textContent = `🎒 ${player.inventory.join(', ')}`;
      hudInventory.style.display = '';
    } else {
      hudInventory.style.display = 'none';
    }
  }
}

// ── Harvest notification timer ──
let harvestNotifyTimer = 0;

// ── Build the open world ─────────────────────────────────────────
function loadWorld() {
  // Simple level data (no platforms — flat arena only)
  worldBuild.buildLevel({
    name: 'The Neighborhood',
    platforms: [],
    decorations: [],
  });

  // Scatter Spark orbs around the neighborhood
  sparks.scatterOrbs(70, 65); // 70 orbs within radius 65 — spread across the expanded neighborhood

  // Set spawn
  const sp = { x: 0, y: 1, z: 10 };
  player.spawnPos = sp;
  player.physicsBody.position.set(sp.x, sp.y, sp.z);
  player.physicsBody.velocity.set(0, 0, 0);

  // Register interactive zones
  interact.registerAll(fliq);

  // Register zone glow effects (color-coded halos + discovery pulses)
  for (const zone of interact.zones) {
    effects.addZoneGlow(zone.position, zone.id);
  }
  effects.registerZonePulses(interact.zones);
}

// ── Window Resize ────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Explorer's Chronicle (C key) ─────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyC' && gameState.started) {
    if (document.getElementById('_chronicle_overlay')) return; // already open
    if (!fliq.hasEnoughData()) return; // not enough data yet
    gameState.paused = true;
    showChronicle();
  }
});

function showChronicle() {
  const data  = fliq.getChronicle();
  const stats = behavior.getStats();
  const overlay = document.createElement('div');
  overlay.id = '_chronicle_overlay';
  overlay.style.cssText = `
    position:fixed; top:0; left:0; width:100vw; height:100vh;
    background:rgba(0,0,0,0.75); display:flex; align-items:center;
    justify-content:center; z-index:300; font-family:'Segoe UI',Arial,sans-serif;
    overflow-y:auto;
  `;

  const tierColors = {
    Legendary: '#ffdd44', Skilled: '#44ddff', Growing: '#44ff88',
    Awakening: '#ffaa44', Novice: '#ff6666', Unexplored: '#666666',
  };

  const trendColors = { improving: '#44ff88', declining: '#ff6666', stable: '#888888' };

  let domainHTML = data.domains.map(d => {
    // Build a mini progress bar
    const barWidth = Math.max(2, d.score);
    const barColor = tierColors[d.tier];
    return `
    <div style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="color:#ccc; font-size:14px;">${d.label}</span>
        <span style="color:${tierColors[d.tier]}; font-weight:bold; font-size:13px;">
          ${d.tier}${d.trendIcon ? `<span style="color:${trendColors[d.trend]}">${d.trendIcon}</span>` : ''}
          ${d.signals > 0 ? ` (${d.score})` : ''}
        </span>
      </div>
      <div style="background:rgba(255,255,255,0.08); border-radius:4px; height:6px; overflow:hidden;">
        <div style="background:${barColor}; width:${barWidth}%; height:100%; border-radius:4px;
          transition:width 0.5s;"></div>
      </div>
    </div>`;
  }).join('');

  // Overall grade label
  let gradeLabel, gradeColor;
  if (data.overall >= 80)      { gradeLabel = 'Legendary Explorer';  gradeColor = '#ffdd44'; }
  else if (data.overall >= 60) { gradeLabel = 'Skilled Pathfinder';  gradeColor = '#44ddff'; }
  else if (data.overall >= 40) { gradeLabel = 'Growing Wanderer';    gradeColor = '#44ff88'; }
  else if (data.overall >= 20) { gradeLabel = 'Awakening Traveler';  gradeColor = '#ffaa44'; }
  else                         { gradeLabel = 'Novice Explorer';     gradeColor = '#ff6666'; }

  // Phase 3 Tier 3: Top 3 strengths and growth areas
  const activeDomains = data.domains.filter(d => d.signals > 0).sort((a, b) => b.score - a.score);
  const top3 = activeDomains.slice(0, 3);
  const growth = activeDomains.filter(d => d.score < 50).slice(0, 2);

  let strengthsHTML = '';
  if (top3.length > 0) {
    strengthsHTML = `
      <div style="margin-top:14px; padding:10px 12px; background:rgba(68,255,136,0.06);
        border-radius:10px; border:1px solid rgba(68,255,136,0.15);">
        <div style="color:#44ff88; font-size:12px; font-weight:bold; margin-bottom:6px;">Your Strengths</div>
        ${top3.map(d => `<div style="color:#aaeebb; font-size:12px; padding:2px 0;">
          ✦ ${d.label} — ${d.desc}</div>`).join('')}
      </div>`;
  }

  let growthHTML = '';
  if (growth.length > 0) {
    growthHTML = `
      <div style="margin-top:8px; padding:10px 12px; background:rgba(255,170,68,0.06);
        border-radius:10px; border:1px solid rgba(255,170,68,0.15);">
        <div style="color:#ffaa44; font-size:12px; font-weight:bold; margin-bottom:6px;">Keep Exploring</div>
        ${growth.map(d => `<div style="color:#ddbb88; font-size:12px; padding:2px 0;">
          ◇ ${d.label} — Try new approaches to grow this skill!</div>`).join('')}
      </div>`;
  }

  overlay.innerHTML = `
    <div style="background:rgba(15,8,35,0.97); border:3px solid #aa88ff;
      border-radius:18px; padding:32px; max-width:480px; width:90%; color:white; margin:20px auto;">
      <h2 style="text-align:center; color:#aa88ff; margin:0 0 4px;">
        Explorer's Chronicle</h2>
      <p style="text-align:center; color:#888; font-size:12px; margin:0 0 20px;">
        ${data.totalSignals} signals recorded · ${data.activeDomains}/7 domains active · ${data.sessionTime} exploring</p>

      <div style="text-align:center; margin:0 0 6px;">
        <span style="font-size:52px; font-weight:bold; color:#88ddff;">${data.overall}</span>
        <span style="font-size:16px; color:#888;"> / 100</span>
      </div>
      <p style="text-align:center; color:${gradeColor}; font-size:14px; font-weight:bold; margin:0 0 20px;">
        ${gradeLabel}</p>

      ${domainHTML}

      ${strengthsHTML}
      ${growthHTML}

      <div style="margin-top:16px; padding:12px; background:rgba(255,255,255,0.04);
        border-radius:10px; font-size:12px; color:#777;">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>Distance traveled</span><span style="color:#aaa;">${stats.totalDistance} units</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>Areas explored</span><span style="color:#aaa;">${stats.cellsExplored} regions</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>Zones visited</span><span style="color:#aaa;">${stats.zonesVisited} / 10</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>Peak Spark</span><span style="color:#aaa;">${stats.peakSpark}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>NPCs helped</span><span style="color:#aaa;">${stats.npcHelped || 0}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>Puzzles attempted</span><span style="color:#aaa;">${stats.puzzlesAttempted || 0}</span>
        </div>
      </div>

      <button id="_chronicle_close" style="display:block; width:100%; margin-top:16px;
        padding:14px; background:linear-gradient(135deg,#6644cc,#aa88ff);
        border:none; border-radius:10px; color:white; font-size:16px;
        font-weight:bold; cursor:pointer;">Continue Exploring</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#_chronicle_close').onclick = () => {
    overlay.remove();
    gameState.paused = false;
  };
}

// ── Start Button ─────────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', () => {
  try {
    gameState.started = true;
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.classList.add('hidden');
    player.reset({ x: 0, y: 1, z: 10 });
    loadWorld();
    audio.startBgMusic();
  } catch (err) {
    console.error('LOAD ERROR:', err);
    alert('Error starting game: ' + err.message);
  }
});

// ── Game Loop ────────────────────────────────────────────────────
let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (!gameState.started) return;

  if (!gameState.paused) {
    physicsWorld.step(1 / 60, dt, 3);

    // Player
    player.update(camRig.yaw, false, dt);

    // Spark orb collection
    sparks.update(dt, player.group.position, player);

    // Arena animations (clouds, bushes)
    worldBuild.update(dt);

    // Interaction proximity check (shows/hides E prompt)
    interact.update(player.group.position, hudPrompt);

    // Mission system
    const zonePositions = {};
    for (const z of interact.zones) zonePositions[z.id] = z.position;
    missions.update(dt, player.group.position, zonePositions);

    // Collect mission reward if one just completed
    if (missions._lastReward > 0) {
      player.spark += missions._lastReward;
      missions._lastReward = 0;
    }

    // Trail system
    const hadTrail = trails.isActive;
    trails.update(dt, player.group.position);

    // Reward player when trail completes
    if (hadTrail && !trails.isActive) {
      player.spark += trails.getReward();
    }

    // Gameplay loop: periodically spawn exploration opportunities
    opportunityTimer += dt;
    if (opportunityTimer >= OPPORTUNITY_INTERVAL && !trails.isActive && !missions.activeMission) {
      opportunityTimer = 0;
      const trailLength = 5 + Math.floor(Math.random() * 4);
      trails.generateRandomTrail(trailLength, 50, 45);
    }

    // Animate garden crops (growing plants)
    if (interact._gardenAnimateCrops) interact._gardenAnimateCrops();

    // Harvest notification (check every 10 seconds)
    harvestNotifyTimer += dt;
    if (harvestNotifyTimer >= 10 && interact._gardenCheckHarvest) {
      harvestNotifyTimer = 0;
      const ready = interact._gardenCheckHarvest();
      if (ready) {
        const notif = document.createElement('div');
        notif.textContent = `${ready.emoji} Your ${ready.name} is ready to harvest!`;
        notif.style.cssText = `
          position:fixed; top:15%; left:50%; transform:translateX(-50%);
          color:#44ff44; font-size:18px; font-weight:bold;
          font-family:'Segoe UI',Arial,sans-serif;
          text-shadow:0 2px 8px rgba(0,0,0,0.7);
          background:rgba(15,8,35,0.85); padding:10px 24px; border-radius:10px;
          border:2px solid rgba(68,255,68,0.4);
          pointer-events:none; z-index:100; transition:opacity 2s ease 3s;
        `;
        document.body.appendChild(notif);
        requestAnimationFrame(() => { notif.style.opacity = '0'; });
        setTimeout(() => notif.remove(), 5000);
      }
    }

    // Visual effects (particles, pulses, energy trails)
    effects.update(dt, player.group.position);

    // Passive behavioral tracking
    behavior.update(dt);

    // HUD
    updateHUD();
  }

  camRig.update(player.group.position);
  renderer.render(scene, camera);
}

// ── Initial UI ───────────────────────────────────────────────────
const startScreen = document.getElementById('start-screen');
if (startScreen) startScreen.classList.remove('hidden');
requestAnimationFrame(animate);
