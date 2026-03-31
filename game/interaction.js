/**
 * interaction.js — Proximity-based "Press E" interaction system.
 * 10 neighborhood-themed zones, each silently measuring FLIQ behavioral domains.
 * The player never sees financial terminology — only adventure gameplay.
 */
import * as THREE from 'three';
import { loadGardenModel, loadFountainModel, loadArcadeModel } from './modelLoader.js';
import { ZONE_COLORS, COLOR_MEANINGS } from './effects.js';

const INTERACT_RADIUS = 4;
const PROMPT_TEXT_DEFAULT = 'Press E to interact';
const ENTER_RADIUS_MULT  = 1.8;

export class InteractionManager {
  constructor(scene, player, gameState) {
    this.scene     = scene;
    this.player    = player;
    this.gameState = gameState;
    this.zones     = [];
    this._activeZone   = null;
    this._insideZone   = null;
    this._cooldowns    = new Map();
    this._shownEnterFor = null;
    this._behaviorTracker = null;
    this._missionManager  = null;
    this._trailManager    = null;

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && this._activeZone && !this.gameState.paused) {
        const zone = this._activeZone;
        const cdKey = zone.id;
        const now   = Date.now();
        if (this._cooldowns.has(cdKey) && now - this._cooldowns.get(cdKey) < (zone.cooldownMs ?? 1000)) return;
        this._cooldowns.set(cdKey, now);
        zone.onInteract(this.player, this.gameState);
      }
    });
  }

  addZone(opts) {
    const zone = {
      id:          opts.id,
      position:    opts.position,
      radius:      opts.radius ?? INTERACT_RADIUS,
      label:       opts.label ?? PROMPT_TEXT_DEFAULT,
      zoneName:    opts.zoneName ?? opts.id,
      enterText:   opts.enterText ?? '',
      onInteract:  opts.onInteract,
      cooldownMs:  opts.cooldownMs ?? 1000,
      mesh:        opts.mesh ?? null,
      nameSprite:  null,
    };
    if (zone.mesh) this.scene.add(zone.mesh);
    zone.nameSprite = this._createNameSprite(zone.zoneName, zone.position, zone.id);
    this.scene.add(zone.nameSprite);
    this.zones.push(zone);
  }

  update(playerPos, promptEl) {
    let closest = null;
    let closestDist = Infinity;
    let insideZone  = null;

    for (const zone of this.zones) {
      const dx = playerPos.x - zone.position.x;
      const dz = playerPos.z - zone.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < zone.radius && dist < closestDist) {
        closest     = zone;
        closestDist = dist;
      }

      const enterRadius = zone.radius * ENTER_RADIUS_MULT;
      if (dist < enterRadius && !insideZone) {
        insideZone = zone;
      }
    }

    this._activeZone = closest;

    if (insideZone && insideZone.enterText && this._shownEnterFor !== insideZone.id) {
      this._shownEnterFor = insideZone.id;
      this._showEnterText(insideZone.enterText);
      if (this._behaviorTracker) this._behaviorTracker.onZoneEnter(insideZone.id);
    }
    if (!insideZone) {
      this._shownEnterFor = null;
    }

    if (promptEl) {
      if (closest) {
        promptEl.textContent = closest.label;
        promptEl.classList.remove('hidden');
      } else {
        promptEl.classList.add('hidden');
      }
    }

    const t = Date.now() * 0.002;
    for (const zone of this.zones) {
      if (zone.mesh && zone.mesh.userData.baseY !== undefined) {
        zone.mesh.position.y = zone.mesh.userData.baseY + Math.sin(t + zone.mesh.userData.phase) * 0.3;
      }
      if (zone.nameSprite) {
        zone.nameSprite.position.y = 6 + Math.sin(t + (zone.mesh?.userData.phase ?? 0)) * 0.2;
      }
    }
  }

  setBehaviorTracker(bt) { this._behaviorTracker = bt; }
  setMissionManager(mm) { this._missionManager = mm; }
  setTrailManager(tm)   { this._trailManager = tm; }

  /** Register all 10 neighborhood zones. */
  registerAll(fliq) {
    this._registerWishingFountain(fliq);
    this._registerCornerShop(fliq);
    this._registerArcade(fliq);
    this._registerPlayground(fliq);
    this._registerToyStore(fliq);
    this._registerLemonadeStand(fliq);
    this._registerLostAndFound(fliq);
    this._registerCommunityBoard(fliq);
    this._registerVendingMachine(fliq);
    this._registerGardenPatch(fliq);
  }

  /* ═════════════════════════════════════════════════════════════════
     ZONE 1 — THE WISHING FOUNTAIN (town center)
     Deposit Spark → get more back later.
     Measures: Delayed Gratification, Resource Judgment, Pattern Recognition
     ═════════════════════════════════════════════════════════════════ */
  _registerWishingFountain(fliq) {
    const pos = new THREE.Vector3(0, 0, 0);
    const group = new THREE.Group();

    // Load fountain GLB model
    loadFountainModel().then((fountainModel) => {
      if (fountainModel) {
        // Scale to roughly 12 world units wide
        const box = new THREE.Box3().setFromObject(fountainModel);
        const size = box.getSize(new THREE.Vector3());
        const targetWidth = 12;
        const scale = targetWidth / (Math.max(size.x, size.z) || 1);
        fountainModel.scale.setScalar(scale);
        // Center and place on ground
        const box2 = new THREE.Box3().setFromObject(fountainModel);
        const center = box2.getCenter(new THREE.Vector3());
        fountainModel.position.x -= center.x;
        fountainModel.position.z -= center.z;
        fountainModel.position.y -= box2.min.y;
        group.add(fountainModel);
        console.log('[Fountain] GLB model added to scene');
      } else {
        // Fallback: simple basin
        const basinGeo = new THREE.CylinderGeometry(2.0, 2.3, 1.0, 16);
        const basinMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.6, metalness: 0.3 });
        const basin = new THREE.Mesh(basinGeo, basinMat);
        basin.position.y = 0.5;
        basin.castShadow = true;
        group.add(basin);
        console.warn('[Fountain] Using fallback geometry');
      }
    });

    group.position.copy(pos);
    // No baseY/phase — fountain stays fixed on the ground (no bobbing)

    let deposited = 0, depositTime = 0, depositCount = 0, withdrawCount = 0;

    this.addZone({
      id: 'wishing_fountain', position: pos, radius: 5,
      label: '✨ Press E — The Wishing Fountain',
      zoneName: 'The Wishing Fountain',
      enterText: 'A beautiful fountain sparkles in the town square. Toss some Spark in and make a wish — come back later to see if it grew!',
      cooldownMs: 500, mesh: group,
      onInteract: (player, gs) => {
        // Check for trail missions at the town center
        const mm = this._missionManager;
        if (mm && !mm.activeMission) {
          const offer = mm.getOfferForZone('wishing_fountain');
          if (offer && offer.type === 'trail') {
            gs.paused = true;
            this._showMissionOfferUI(offer, (accepted) => {
              gs.paused = false;
              if (accepted) {
                mm.acceptMission(offer);
                if (this._trailManager) {
                  this._trailManager.generateRandomTrail(offer.waypointCount || 6, offer.radius || 45, offer.timeLimit);
                }
                fliq.record('pattern_recognition', 0.7, `accepted trail: ${offer.title}`);
                this._showFloatingText(pos, `Trail hunt started: ${offer.title}!`, '#ffdd44');
              } else {
                this._showFloatingText(pos, 'The trail fades for now...', '#aaaaaa');
              }
            });
            return;
          }
        }

        if (deposited > 0) {
          const reward = Math.floor(deposited * 1.5);
          player.spark += reward;
          withdrawCount++;
          const waitSecs = (Date.now() - depositTime) / 1000;
          let patienceScore;
          if (waitSecs < 5) patienceScore = 0.3;
          else if (waitSecs < 15) patienceScore = 0.5;
          else if (waitSecs < 45) patienceScore = 0.8;
          else patienceScore = 1.0;
          fliq.record('delayed_gratification', patienceScore, `waited ${Math.round(waitSecs)}s before collecting`);
          const rjScore = depositCount > 1 ? 0.8 : 0.65;
          fliq.record('resource_judgment', rjScore, `wish/collect cycle #${withdrawCount}`);
          if (depositCount >= 2) fliq.record('pattern_recognition', 0.7, 'repeated fountain wishes');
          this._showFloatingText(pos, `+${reward} Spark returned!`, '#88ddff');
          if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('wishing_fountain', true);
          deposited = 0;
        } else if (player.spark >= 5) {
          player.spark -= 5;
          deposited = 5;
          depositTime = Date.now();
          depositCount++;
          const dgScore = player.spark >= 10 ? 0.7 : 0.55;
          fliq.record('delayed_gratification', dgScore, `wished with ${player.spark + 5} total Spark`);
          this._showFloatingText(pos, 'Tossed 5 Spark into the fountain... make a wish!', '#aa88ff');
        } else {
          this._showFloatingText(pos, 'Need at least 5 Spark to make a wish', '#ff6666');
        }
      },
    });
  }

  /* ═════════════════════════════════════════════════════════════════
     ZONE 2 — THE DISCOVERY EXCHANGE (east side)
     NPC exchanges curiosities. Exploration-framed, not economic.
     Measures: Risk Awareness, Resource Judgment, Pattern Recognition, Adaptation
     ═════════════════════════════════════════════════════════════════ */
  _registerCornerShop(fliq) {
    const pos = new THREE.Vector3(38, 0, 10);
    const group = new THREE.Group();

    // Shop building
    const shopGeo = new THREE.BoxGeometry(5, 4, 4);
    const shopMat = new THREE.MeshStandardMaterial({ color: 0xFF9944, roughness: 0.7 });
    const shop = new THREE.Mesh(shopGeo, shopMat);
    shop.position.y = 2;
    shop.castShadow = true;
    group.add(shop);

    // Roof (flat awning)
    const awningGeo = new THREE.BoxGeometry(6, 0.3, 5);
    const awningMat = new THREE.MeshStandardMaterial({ color: 0xDD4444, roughness: 0.6 });
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.position.y = 4.2;
    awning.castShadow = true;
    group.add(awning);

    // Door
    const doorGeo = new THREE.BoxGeometry(1.2, 2.2, 0.2);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.1, 2.1);
    group.add(door);

    // Window display
    const winGeo = new THREE.BoxGeometry(1.5, 1.2, 0.1);
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xFFEE88, emissive: 0xFFDD44, emissiveIntensity: 0.3, roughness: 0.2
    });
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.set(-1.5, 2.5, 2.05);
    group.add(win);

    // Shopkeeper NPC
    const npc = this._createSimpleNPC(0x44AA88);
    npc.position.set(1.5, 0, 2.5);
    group.add(npc);

    group.position.copy(pos);
    group.userData.baseY = 0;
    group.userData.phase = 1.5;

    const trades = [
      { cost: 3, reward: 7, desc: 'Exchange a Glowing Feather for a Whispering Shell', good: true, obvious: true },
      { cost: 5, reward: 2, desc: 'Exchange a Moonstone for a Dusty Pebble', good: false, obvious: true },
      { cost: 4, reward: 8, desc: 'Exchange an Echo Crystal for an Ancient Rune', good: true, obvious: false },
      { cost: 6, reward: 3, desc: 'Exchange a Star Fragment for a Cloudy Marble', good: false, obvious: false },
      { cost: 2, reward: 5, desc: 'Exchange a Leaf Charm for a Wind Whistle', good: true, obvious: true },
      { cost: 8, reward: 4, desc: 'Exchange a Sun Shard for a Tarnished Compass', good: false, obvious: false },
      { cost: 3, reward: 6, desc: 'Exchange a Dew Drop for a Moonlit Shard', good: true, obvious: false },
    ];
    let tradeIdx = 0, goodAccepted = 0, badAccepted = 0, totalDeclined = 0;

    this.addZone({
      id: 'corner_shop', position: pos, radius: 5,
      label: '🔮 Press E — Discovery Exchange',
      zoneName: 'Discovery Exchange',
      enterText: 'A curious collector waves you over! They exchange mysterious artifacts from around the neighborhood. Not every exchange is equal...',
      cooldownMs: 2000, mesh: group,
      onInteract: (player, gs) => {
        // Check for delivery missions first
        const mm = this._missionManager;
        if (mm && !mm.activeMission) {
          const offer = mm.getOfferForZone('corner_shop');
          if (offer) {
            gs.paused = true;
            if (this._behaviorTracker) this._behaviorTracker.startDecisionTimer('corner_shop', 'mission');
            this._showMissionOfferUI(offer, (accepted) => {
              gs.paused = false;
              if (this._behaviorTracker) this._behaviorTracker.endDecisionTimer();
              if (accepted) {
                mm.acceptMission(offer);
                fliq.record('risk_awareness', 0.7, `accepted delivery: ${offer.title}`);
                this._showFloatingText(pos, `Mission accepted: ${offer.title}!`, '#44ff44');
                if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('corner_shop', true);
              } else {
                fliq.record('risk_awareness', 0.4, 'declined delivery mission');
                this._showFloatingText(pos, 'Maybe next time!', '#aaaaaa');
              }
            });
            return;
          }
        }

        // Normal exchange interaction
        const trade = trades[tradeIdx % trades.length];
        tradeIdx++;
        if (player.spark < trade.cost) {
          this._showFloatingText(pos, `Not enough Spark (need ${trade.cost})`, '#ff6666');
          return;
        }
        if (this._behaviorTracker) this._behaviorTracker.startDecisionTimer('corner_shop', 'trade');
        gs.paused = true;
        this._showTradeUI(trade, 'The Collector', (accepted) => {
          gs.paused = false;
          if (this._behaviorTracker) this._behaviorTracker.endDecisionTimer();
          if (accepted) {
            player.spark -= trade.cost;
            player.spark += trade.reward;
            if (trade.good) {
              goodAccepted++;
              fliq.record('risk_awareness', trade.obvious ? 0.65 : 0.85, `accepted good trade`);
              fliq.record('resource_judgment', 0.8, `net gain: +${trade.reward - trade.cost}`);
              this._showFloatingText(pos, `+${trade.reward} Spark! Great trade!`, '#44ff44');
              if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('corner_shop', true);
            } else {
              badAccepted++;
              fliq.record('risk_awareness', 0.2, `accepted bad trade`);
              fliq.record('resource_judgment', 0.25, `net loss: -${trade.cost - trade.reward}`);
              this._showFloatingText(pos, `Only ${trade.reward} back... not great!`, '#ff4444');
              if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('corner_shop', false);
              if (badAccepted >= 2) fliq.record('adaptation', 0.2, `fell for ${badAccepted} bad trades`);
            }
            const totalTrades = goodAccepted + badAccepted;
            if (totalTrades >= 3) {
              fliq.record('pattern_recognition', goodAccepted / totalTrades, `trade success rate`);
            }
          } else {
            totalDeclined++;
            if (trade.good) {
              fliq.record('risk_awareness', 0.4, 'declined a good deal');
            } else {
              fliq.record('risk_awareness', 0.8, 'correctly declined a bad deal');
              if (badAccepted > 0) fliq.record('adaptation', 0.85, 'learned to avoid bad trades');
            }
            this._showFloatingText(pos, 'Maybe next time!', '#ffcc44');
          }
        });
      },
    });
  }

  /* ═════════════════════════════════════════════════════════════════
     ZONE 3 — THE ARCADE (north side)
     Pattern matching color sequence game.
     Measures: Pattern Recognition, Adaptation, Decision Timing, Risk Awareness
     ═════════════════════════════════════════════════════════════════ */
  _registerArcade(fliq) {
    const pos = new THREE.Vector3(-30, 0, -52);
    const group = new THREE.Group();

    // Load arcade GLB model
    loadArcadeModel().then((arcadeModel) => {
      if (arcadeModel) {
        const box = new THREE.Box3().setFromObject(arcadeModel);
        const size = box.getSize(new THREE.Vector3());
        const targetHeight = 6;
        const scale = targetHeight / (size.y || 1);
        arcadeModel.scale.setScalar(scale);
        const box2 = new THREE.Box3().setFromObject(arcadeModel);
        const center = box2.getCenter(new THREE.Vector3());
        arcadeModel.position.x -= center.x;
        arcadeModel.position.z -= center.z;
        arcadeModel.position.y -= box2.min.y;
        group.add(arcadeModel);
        console.log('[Arcade] GLB model added to scene');
      } else {
        // Fallback: simple cabinet box
        const cabinetGeo = new THREE.BoxGeometry(3, 5, 2);
        const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x6644CC, roughness: 0.5 });
        const cabinet = new THREE.Mesh(cabinetGeo, cabinetMat);
        cabinet.position.y = 2.5;
        cabinet.castShadow = true;
        group.add(cabinet);
        console.warn('[Arcade] Using fallback geometry');
      }
    });

    group.position.copy(pos);
    // No bobbing — arcade stays fixed

    let difficulty = 3, attempts = 0, successes = 0;
    let consecutiveWins = 0, consecutiveFails = 0, peakDifficulty = 3;

    this.addZone({
      id: 'arcade', position: pos, radius: 5,
      label: '🎮 Press E — The Arcade',
      zoneName: 'The Arcade',
      enterText: 'A colorful arcade machine hums with energy! Watch the pattern of colors, then repeat it from memory to win Spark!',
      cooldownMs: 2000, mesh: group,
      onInteract: (player, gs) => {
        gs.paused = true;
        attempts++;
        if (this._behaviorTracker) this._behaviorTracker.startDecisionTimer('arcade', 'pattern');
        const colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44];
        const sequence = [];
        for (let i = 0; i < difficulty; i++) sequence.push(Math.floor(Math.random() * 4));

        this._showPatternGame(sequence, colors, (success) => {
          gs.paused = false;
          if (this._behaviorTracker) this._behaviorTracker.endDecisionTimer();
          if (success) {
            successes++;
            consecutiveWins++;
            consecutiveFails = 0;
            const reward = difficulty * 3;
            player.spark += reward;
            peakDifficulty = Math.max(peakDifficulty, difficulty);
            const prScore = Math.min(1, 0.4 + difficulty * 0.1 + (consecutiveWins > 2 ? 0.15 : 0));
            fliq.record('pattern_recognition', prScore, `matched level ${difficulty}`);
            if (difficulty > 3) fliq.record('adaptation', 0.8, `handling difficulty ${difficulty}`);
            if (difficulty >= 5) fliq.record('risk_awareness', 0.75, 'succeeding at high difficulty');
            this._showFloatingText(pos, `Pattern matched! +${reward} Spark`, '#44ff44');
            difficulty = Math.min(7, difficulty + 1);
            if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('arcade', true);
          } else {
            consecutiveFails++;
            consecutiveWins = 0;
            const prScore = Math.max(0.1, 0.15 + difficulty * 0.05);
            fliq.record('pattern_recognition', prScore, `failed level ${difficulty}`);
            if (attempts > 1) {
              fliq.record('adaptation', consecutiveFails > 3 ? 0.3 : 0.55, `retry #${attempts}`);
            }
            if (difficulty > 3) fliq.record('delayed_gratification', 0.6, 'persisting at hard level');
            this._showFloatingText(pos, 'Wrong pattern... try again!', '#ff4444');
            difficulty = Math.max(3, difficulty - 1);
            if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('arcade', false);
          }
        });
      },
    });
  }

  /* ═════════════════════════════════════════════════════════════════
     ZONE 4 — THE PLAYGROUND (west side)
     Kid NPC asks for help. Player can share Spark or refuse.
     Measures: Social Intelligence, Resource Judgment
     ═════════════════════════════════════════════════════════════════ */
  _registerPlayground(fliq) {
    const pos = new THREE.Vector3(-38, 0, 10);
    const group = new THREE.Group();

    // Swing set frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xDD4444, roughness: 0.5, metalness: 0.4 });
    const leftPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4, 8), frameMat);
    leftPole.position.set(-2, 2, 0);
    group.add(leftPole);
    const rightPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4, 8), frameMat);
    rightPole.position.set(2, 2, 0);
    group.add(rightPole);
    const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.2, 8), frameMat);
    topBar.rotation.z = Math.PI / 2;
    topBar.position.y = 4;
    group.add(topBar);

    // Swing seat
    const seatGeo = new THREE.BoxGeometry(0.8, 0.08, 0.4);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x4444DD });
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.set(0, 1.5, 0);
    group.add(seat);

    // Bench
    const benchSeatGeo = new THREE.BoxGeometry(3, 0.2, 0.8);
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 0.8 });
    const benchSeat = new THREE.Mesh(benchSeatGeo, benchMat);
    benchSeat.position.set(0, 0.6, 3);
    group.add(benchSeat);
    const benchBack = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 0.15), benchMat);
    benchBack.position.set(0, 1.2, 3.3);
    group.add(benchBack);

    // Kid NPC sitting on bench
    const kid = this._createSimpleNPC(0x44AAFF);
    kid.scale.setScalar(0.7);
    kid.position.set(0.5, 0.7, 3);
    group.add(kid);

    group.position.copy(pos);
    group.userData.baseY = 0;
    group.userData.phase = 4.5;

    const dialogues = [
      { text: "Hey! I'm trying to build a sandcastle but I need 3 Spark for the special sand. Can you help?", cost: 3, urgency: 'low' },
      { text: "My little sister lost her favorite toy across town! I need 5 Spark to buy a map to find it!", cost: 5, urgency: 'high' },
      { text: "I'm collecting shells for a friend's birthday gift. Even 2 Spark would help!", cost: 2, urgency: 'low' },
      { text: "There's a hurt bird over there! I need 4 Spark for a healing kit — please hurry!", cost: 4, urgency: 'high' },
      { text: "I really want a sparkly sticker. Got 6 Spark you could give me?", cost: 6, urgency: 'frivolous' },
    ];
    let dialogueIdx = 0, timesHelped = 0, timesRefused = 0, helpedUrgent = 0, helpedFrivolous = 0;

    this.addZone({
      id: 'playground', position: pos, radius: 5,
      label: '🎪 Press E — The Playground',
      zoneName: 'The Playground',
      enterText: 'A colorful playground with swings and a bench. A kid sitting nearby looks like they could use a hand!',
      cooldownMs: 3000, mesh: group,
      onInteract: (player, gs) => {
        // Check for NPC assistance missions first
        const mm = this._missionManager;
        if (mm && !mm.activeMission) {
          const offer = mm.getOfferForZone('playground');
          if (offer) {
            gs.paused = true;
            if (this._behaviorTracker) this._behaviorTracker.startDecisionTimer('playground', 'mission');
            this._showMissionOfferUI(offer, (accepted) => {
              gs.paused = false;
              if (this._behaviorTracker) this._behaviorTracker.endDecisionTimer();
              if (accepted) {
                mm.acceptMission(offer);
                fliq.record('social_intelligence', 0.85, `accepted help mission: ${offer.title}`);
                this._showFloatingText(pos, `Mission accepted: ${offer.title}!`, '#44ff44');
                if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('playground', true);
              } else {
                fliq.record('social_intelligence', 0.3, 'declined help mission');
                this._showFloatingText(pos, 'Maybe another time...', '#aaaaaa');
              }
            });
            return;
          }
        }

        // Normal dialogue interaction
        const d = dialogues[dialogueIdx % dialogues.length];
        dialogueIdx++;
        gs.paused = true;
        if (this._behaviorTracker) this._behaviorTracker.startDecisionTimer('playground', 'help');
        this._showDialogueUI(d.text, d.cost, 'Playground Kid', (helped) => {
          gs.paused = false;
          if (this._behaviorTracker) this._behaviorTracker.endDecisionTimer();
          if (helped && player.spark >= d.cost) {
            player.spark -= d.cost;
            timesHelped++;
            if (d.urgency === 'high') {
              helpedUrgent++;
              fliq.record('social_intelligence', 0.9, `helped urgent request`);
            } else if (d.urgency === 'frivolous') {
              helpedFrivolous++;
              fliq.record('social_intelligence', 0.6, 'helped frivolous request');
              fliq.record('resource_judgment', 0.3, `gave ${d.cost} for frivolous reason`);
            } else {
              fliq.record('social_intelligence', 0.75, `helped (cost ${d.cost})`);
            }
            if (player.spark < 3) {
              fliq.record('resource_judgment', 0.35, 'helped despite very low Spark');
            } else {
              fliq.record('resource_judgment', 0.65, 'helped with comfortable reserves');
            }
            if (timesHelped >= 3) fliq.record('social_intelligence', 0.85, `helped ${timesHelped} times`);
            this._showFloatingText(pos, 'Thanks so much, you\'re awesome!', '#88ff88');
            if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('playground', true);
          } else if (helped) {
            this._showFloatingText(pos, 'Not enough Spark to help...', '#ffaa44');
            fliq.record('social_intelligence', 0.6, 'wanted to help but no Spark');
          } else {
            timesRefused++;
            if (d.urgency === 'frivolous') {
              fliq.record('social_intelligence', 0.5, 'refused frivolous request');
              fliq.record('resource_judgment', 0.75, 'conserved Spark wisely');
            } else if (d.urgency === 'high') {
              fliq.record('social_intelligence', 0.15, 'refused urgent request');
            } else {
              fliq.record('social_intelligence', 0.3, 'refused to help');
            }
            if (timesRefused >= 3 && timesHelped === 0) {
              fliq.record('social_intelligence', 0.1, 'never helped anyone');
            }
            this._showFloatingText(pos, 'Oh... okay, maybe next time.', '#aaaaaa');
            if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('playground', false);
          }
        });
      },
    });
  }

  /* ═════════════════════════════════════════════════════════════════
     ZONE 5 — THE TOY STORE (southeast)
     Impulse purchase test — fun items with no gameplay benefit.
     Measures: Delayed Gratification, Resource Judgment, Risk Awareness
     ═════════════════════════════════════════════════════════════════ */
  _registerToyStore(fliq) {
    const pos = new THREE.Vector3(30, 0, 30);
    const group = new THREE.Group();

    // Store building
    const storeGeo = new THREE.BoxGeometry(5, 4, 4);
    const storeMat = new THREE.MeshStandardMaterial({ color: 0xFF88CC, roughness: 0.6 });
    const store = new THREE.Mesh(storeGeo, storeMat);
    store.position.y = 2;
    store.castShadow = true;
    group.add(store);

    // Colorful awning
    const awningGeo = new THREE.BoxGeometry(6, 0.3, 5);
    const awningMat = new THREE.MeshStandardMaterial({ color: 0xFFDD44, roughness: 0.6 });
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.position.y = 4.2;
    group.add(awning);

    // Window display with toy shapes
    const toyColors = [0xFF4466, 0x44AAFF, 0xFFDD22];
    for (let i = 0; i < 3; i++) {
      const toyGeo = i === 0
        ? new THREE.BoxGeometry(0.4, 0.4, 0.4)
        : i === 1
          ? new THREE.SphereGeometry(0.25, 8, 8)
          : new THREE.ConeGeometry(0.2, 0.5, 6);
      const toyMat = new THREE.MeshStandardMaterial({
        color: toyColors[i], emissive: toyColors[i], emissiveIntensity: 0.2
      });
      const toy = new THREE.Mesh(toyGeo, toyMat);
      toy.position.set(-1 + i * 1, 2, 2.1);
      group.add(toy);
    }

    group.position.copy(pos);
    group.userData.baseY = 0;
    group.userData.phase = 5.5;

    const toys = [
      { name: 'Sparkle Bear', cost: 6, desc: 'A cute bear that glows! (No gameplay effect)' },
      { name: 'Rainbow Spinner', cost: 4, desc: 'A mesmerizing spinning top! (No gameplay effect)' },
      { name: 'Glitter Stickers', cost: 3, desc: 'Shiny stickers for your backpack! (No gameplay effect)' },
    ];
    let timesBought = 0, timesWalkedAway = 0;

    this.addZone({
      id: 'toy_store', position: pos, radius: 5,
      label: '🧸 Press E — The Toy Store',
      zoneName: 'The Toy Store',
      enterText: 'Wow, look at all those cool toys in the window! They look amazing... but do you really need them right now?',
      cooldownMs: 3000, mesh: group,
      onInteract: (player, gs) => {
        gs.paused = true;
        if (this._behaviorTracker) this._behaviorTracker.startDecisionTimer('toy_store', 'purchase');
        const toy = toys[timesBought % toys.length];
        this._showToyStoreUI(toy, (bought) => {
          gs.paused = false;
          if (this._behaviorTracker) this._behaviorTracker.endDecisionTimer();
          if (bought) {
            if (player.spark >= toy.cost) {
              player.spark -= toy.cost;
              timesBought++;
              fliq.record('delayed_gratification', 0.2, `bought ${toy.name} (no benefit)`);
              fliq.record('resource_judgment', 0.25, `spent ${toy.cost} on cosmetic`);
              if (timesBought >= 2) fliq.record('adaptation', 0.2, `keeps buying toys (${timesBought}x)`);
              this._showFloatingText(pos, `Got ${toy.name}! So shiny!`, '#ff88cc');
              if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('toy_store', false);
            } else {
              this._showFloatingText(pos, 'Not enough Spark!', '#ff6666');
            }
          } else {
            timesWalkedAway++;
            fliq.record('delayed_gratification', 0.85, `resisted ${toy.name}`);
            fliq.record('resource_judgment', 0.8, 'chose not to buy cosmetic');
            if (timesWalkedAway >= 2) fliq.record('adaptation', 0.8, 'consistently resists impulse buys');
            this._showFloatingText(pos, 'Good call — save that Spark!', '#88ddff');
            if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('toy_store', true);
          }
        });
      },
    });
  }

  /* ═════════════════════════════════════════════════════════════════
     ZONE 6 — THE RECIPE WORKSHOP (southwest)
     Experiment with ingredients: find the right balance.
     Measures: Risk Awareness, Adaptation, Decision Timing, Pattern Recognition
     ═════════════════════════════════════════════════════════════════ */
  _registerLemonadeStand(fliq) {
    const pos = new THREE.Vector3(-30, 0, 30);
    const group = new THREE.Group();

    // Stand table
    const tableGeo = new THREE.BoxGeometry(3, 0.15, 1.5);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0xFFDD44, roughness: 0.7 });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.y = 1.2;
    group.add(table);

    // Table legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x8B5E3C });
    for (const lx of [-1.2, 1.2]) {
      for (const lz of [-0.5, 0.5]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), legMat);
        leg.position.set(lx, 0.6, lz);
        group.add(leg);
      }
    }

    // Pitcher
    const pitcherGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.6, 8);
    const pitcherMat = new THREE.MeshStandardMaterial({ color: 0xFFFF88, roughness: 0.3, metalness: 0.2 });
    const pitcher = new THREE.Mesh(pitcherGeo, pitcherMat);
    pitcher.position.set(0, 1.6, 0);
    group.add(pitcher);

    // Sign board behind
    const signGeo = new THREE.BoxGeometry(3.5, 1.5, 0.2);
    const signMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.8 });
    const signBoard = new THREE.Mesh(signGeo, signMat);
    signBoard.position.set(0, 3, -0.5);
    group.add(signBoard);

    group.position.copy(pos);
    group.userData.baseY = 0;
    group.userData.phase = 6.0;

    // ── Recipe Book (all 2-ingredient combinations) ──
    const RECIPES = {
      '🍎 Apple+🥦 Broccoli':     { name: 'Green Smoothie',   reward: 12 },
      '🍎 Apple+🥕 Carrot':        { name: 'Sunrise Juice',    reward: 10 },
      '🍎 Apple+🍓 Strawberry':    { name: 'Berry Blast',      reward: 15 },
      '🍎 Apple+🌽 Golden Corn':   { name: 'Harvest Mix',      reward: 14 },
      '🥦 Broccoli+🥕 Carrot':     { name: 'Garden Crunch',    reward: 11 },
      '🥦 Broccoli+🍓 Strawberry': { name: 'Mystery Blend',    reward: 8 },
      '🥦 Broccoli+🌽 Golden Corn': { name: 'Power Bowl',      reward: 18 },
      '🥕 Carrot+🍓 Strawberry':   { name: 'Sweet Root',       reward: 13 },
      '🥕 Carrot+🌽 Golden Corn':  { name: 'Golden Stew',      reward: 16 },
      '🍓 Strawberry+🌽 Golden Corn': { name: 'Festival Treat', reward: 20 },
    };
    const discoveredRecipes = new Set(); // tracks which combos the player has tried
    let totalRecipes = 0, bestReward = 0;

    const getRecipeKey = (a, b) => {
      const sorted = [a, b].sort();
      return sorted.join('+');
    };

    this.addZone({
      id: 'lemonade_stand', position: pos, radius: 5,
      label: '🧪 Press E — Recipe Workshop',
      zoneName: 'Recipe Workshop',
      enterText: 'The Recipe Workshop! Combine 2 ingredients from your garden to create amazing recipes and earn Spark!',
      cooldownMs: 2000, mesh: group,
      onInteract: (player, gs) => {
        // Need at least 2 items in inventory
        if (player.inventory.length < 2) {
          const count = player.inventory.length;
          if (count === 0) {
            this._showFloatingText(pos, 'You need ingredients! Grow some at the Garden! 🌱', '#ffaa44');
          } else {
            this._showFloatingText(pos, `You have ${count} ingredient — need at least 2! Visit the Garden!`, '#ffaa44');
          }
          return;
        }

        gs.paused = true;
        if (this._behaviorTracker) this._behaviorTracker.startDecisionTimer('lemonade_stand', 'recipe');
        this._showRecipeUI(player.inventory, RECIPES, discoveredRecipes, (item1Idx, item2Idx) => {
          gs.paused = false;
          if (this._behaviorTracker) this._behaviorTracker.endDecisionTimer();

          if (item1Idx === -1) {
            this._showFloatingText(pos, 'Maybe later!', '#aaaaaa');
            return;
          }

          // Remove items from inventory (remove higher index first)
          const item1 = player.inventory[item1Idx];
          const item2 = player.inventory[item2Idx];
          if (item2Idx > item1Idx) {
            player.inventory.splice(item2Idx, 1);
            player.inventory.splice(item1Idx, 1);
          } else {
            player.inventory.splice(item1Idx, 1);
            player.inventory.splice(item2Idx, 1);
          }

          // Look up recipe
          const key = getRecipeKey(item1, item2);
          const recipe = RECIPES[key];
          const isNew = !discoveredRecipes.has(key);

          if (recipe) {
            discoveredRecipes.add(key);
            totalRecipes++;
            player.spark += recipe.reward;
            bestReward = Math.max(bestReward, recipe.reward);

            const newTag = isNew ? ' 🆕 New Recipe!' : '';
            this._showFloatingText(pos, `✨ ${recipe.name}! +${recipe.reward} Spark${newTag}`, '#44ff44');

            fliq.record('pattern_recognition', isNew ? 0.7 : 0.85, `recipe: ${recipe.name}${isNew ? ' (new!)' : ' (known)'}`);
            fliq.record('resource_judgment', recipe.reward >= 15 ? 0.9 : 0.65, `recipe reward: ${recipe.reward}`);
            if (totalRecipes >= 3) fliq.record('adaptation', 0.8, `${totalRecipes} recipes made, best: ${bestReward}`);
            if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('lemonade_stand', true);
          } else {
            // No matching recipe — items wasted
            player.spark += 3; // small consolation
            this._showFloatingText(pos, `Hmm, that combo didn't work well... +3 Spark`, '#ffaa44');
            fliq.record('risk_awareness', 0.4, 'tried unknown recipe combo');
            fliq.record('adaptation', 0.5, 'experimenting with recipes');
            if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('lemonade_stand', false);
          }
        });
      },
    });
  }

  /* ═════════════════════════════════════════════════════════════════
     ZONE 7 — THE LOST & FOUND (northwest)
     Found an item: keep it or return it?
     Measures: Social Intelligence, Risk Awareness, Delayed Gratification
     ═════════════════════════════════════════════════════════════════ */
  _registerLostAndFound(fliq) {
    const pos = new THREE.Vector3(-30, 0, -30);
    const group = new THREE.Group();

    // Lost & Found box
    const boxGeo = new THREE.BoxGeometry(2, 1.5, 1.5);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x88AACC, roughness: 0.7 });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.y = 0.75;
    box.castShadow = true;
    group.add(box);

    // Lid (slightly open)
    const lidGeo = new THREE.BoxGeometry(2.1, 0.15, 1.6);
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x7799BB, roughness: 0.7 });
    const lid = new THREE.Mesh(lidGeo, lidMat);
    lid.position.set(0, 1.55, -0.2);
    lid.rotation.x = -0.3;
    group.add(lid);

    // Glowing item peeking out
    const itemGeo = new THREE.OctahedronGeometry(0.3);
    const itemMat = new THREE.MeshStandardMaterial({
      color: 0xFFDD44, emissive: 0xFFAA22, emissiveIntensity: 0.4
    });
    const item = new THREE.Mesh(itemGeo, itemMat);
    item.position.set(0, 1.8, 0);
    group.add(item);

    // Sign post
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x8B5E3C });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(1.5, 1.25, 0);
    group.add(post);

    group.position.copy(pos);
    group.userData.baseY = 0;
    group.userData.phase = 7.0;

    let timesKept = 0, timesReturned = 0;
    const pendingReturns = []; // track returns for delayed reward

    this.addZone({
      id: 'lost_and_found', position: pos, radius: 5,
      label: '📦 Press E — Lost & Found',
      zoneName: 'Lost & Found',
      enterText: 'Someone left a box of lost items here! You could keep what you find... or return it and maybe get a thank-you reward later.',
      cooldownMs: 5000, mesh: group,
      onInteract: (player, gs) => {
        gs.paused = true;
        if (this._behaviorTracker) this._behaviorTracker.startDecisionTimer('lost_and_found', 'honesty');

        // Check if a previous return has matured (reward)
        const now = Date.now();
        const matured = pendingReturns.findIndex(r => now - r > 15000);
        if (matured >= 0) {
          pendingReturns.splice(matured, 1);
          player.spark += 8;
          fliq.record('delayed_gratification', 0.9, 'return reward matured (+8)');
          this._showFloatingText(pos, 'The owner came back! +8 Spark as thanks!', '#88ff88');
          gs.paused = false;
          if (this._behaviorTracker) this._behaviorTracker.endDecisionTimer();
          return;
        }

        this._showLostFoundUI((kept) => {
          gs.paused = false;
          if (this._behaviorTracker) this._behaviorTracker.endDecisionTimer();
          if (kept) {
            timesKept++;
            player.spark += 5;
            fliq.record('social_intelligence', 0.2, 'kept lost item');
            fliq.record('risk_awareness', 0.4, 'chose guaranteed gain');
            fliq.record('delayed_gratification', 0.2, 'took instant reward');
            this._showFloatingText(pos, '+5 Spark... finders keepers?', '#ffaa44');
            if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('lost_and_found', false);
          } else {
            timesReturned++;
            player.spark += 3;
            pendingReturns.push(Date.now());
            fliq.record('social_intelligence', 0.9, 'returned lost item');
            fliq.record('delayed_gratification', 0.75, 'chose smaller now + bigger later');
            fliq.record('risk_awareness', 0.65, 'chose uncertain but ethical path');
            this._showFloatingText(pos, '+3 Spark now. The owner might come back with more!', '#88ddff');
            if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('lost_and_found', true);
            if (timesReturned >= 2) fliq.record('adaptation', 0.8, 'consistently returns items');
          }
        });
      },
    });
  }

  /* ═════════════════════════════════════════════════════════════════
     ZONE 8 — THE COMMUNITY BOARD (northeast)
     Fund community projects with Spark.
     Measures: Social Intelligence, Resource Judgment, Decision Timing
     ═════════════════════════════════════════════════════════════════ */
  _registerCommunityBoard(fliq) {
    const pos = new THREE.Vector3(18, 0, 30);
    const group = new THREE.Group();

    // Board frame
    const frameGeo = new THREE.BoxGeometry(4, 3, 0.3);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 0.8 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = 2.5;
    group.add(frame);

    // Cork board surface
    const corkGeo = new THREE.BoxGeometry(3.6, 2.6, 0.1);
    const corkMat = new THREE.MeshStandardMaterial({ color: 0xDDBB77, roughness: 0.9 });
    const cork = new THREE.Mesh(corkGeo, corkMat);
    cork.position.set(0, 2.5, 0.2);
    group.add(cork);

    // Colored paper notes
    const noteColors = [0xFF8888, 0x88FF88, 0x8888FF, 0xFFFF88];
    for (let i = 0; i < 4; i++) {
      const noteGeo = new THREE.BoxGeometry(0.6, 0.8, 0.05);
      const noteMat = new THREE.MeshStandardMaterial({ color: noteColors[i] });
      const note = new THREE.Mesh(noteGeo, noteMat);
      note.position.set(-1 + i * 0.7, 2.5 + (Math.random() - 0.5) * 0.5, 0.28);
      note.rotation.z = (Math.random() - 0.5) * 0.3;
      group.add(note);
    }

    // Support posts
    const postMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.3 });
    const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 6), postMat);
    leftPost.position.set(-2, 2, 0);
    group.add(leftPost);
    const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4, 6), postMat);
    rightPost.position.set(2, 2, 0);
    group.add(rightPost);

    group.position.copy(pos);
    group.userData.baseY = 0;
    group.userData.phase = 8.0;

    let missionsAccepted = 0;

    this.addZone({
      id: 'community_board', position: pos, radius: 5,
      label: '📋 Press E — Mission Board',
      zoneName: 'Mission Board',
      enterText: 'The neighborhood mission board! Check for available missions — your help makes a real difference!',
      cooldownMs: 2000, mesh: group,
      onInteract: (player, gs) => {
        // Check if mission manager has an offer for this zone
        const mm = this._missionManager;
        if (!mm) {
          this._showFloatingText(pos, 'No missions available right now...', '#aaaaaa');
          return;
        }

        // If already on a mission, show status
        if (mm.activeMission) {
          this._showFloatingText(pos, `Active: ${mm.activeMission.title}`, '#ffdd44');
          return;
        }

        // Try to get an offer — Mission Board can offer ANY mission type
        let offer = mm.getOfferForZone('community_board');
        if (!offer) {
          // Force generate a new offer and check again
          mm._generateOffer();
          offer = mm._pendingOffer;
        }

        if (!offer) {
          this._showFloatingText(pos, 'No new missions posted yet. Check back later!', '#aaaaaa');
          fliq.record('social_intelligence', 0.4, 'checked mission board — nothing available');
          return;
        }

        gs.paused = true;
        if (this._behaviorTracker) this._behaviorTracker.startDecisionTimer('community_board', 'mission');
        this._showMissionOfferUI(offer, (accepted) => {
          gs.paused = false;
          if (this._behaviorTracker) this._behaviorTracker.endDecisionTimer();
          if (accepted) {
            mm.acceptMission(offer);
            missionsAccepted++;
            fliq.record('social_intelligence', 0.8, `accepted mission from board: ${offer.title}`);
            fliq.record('decision_timing', 0.7, 'accepted mission promptly');
            this._showFloatingText(pos, `Mission accepted: ${offer.title}!`, '#44ff44');
            if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('community_board', true);

            // If it's a trail mission, start the trail
            if (offer.type === 'trail' && this._trailManager) {
              this._trailManager.generateRandomTrail(offer.waypointCount || 6, offer.radius || 45, offer.timeLimit);
            }
          } else {
            fliq.record('social_intelligence', 0.3, 'declined mission from board');
            this._showFloatingText(pos, 'Maybe another time...', '#aaaaaa');
            if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('community_board', false);
          }
        });
      },
    });
  }

  /* ═════════════════════════════════════════════════════════════════
     ZONE 9 — THE VENDING MACHINE (south)
     Flashy impulse purchase test — overpriced items.
     Measures: Delayed Gratification, Risk Awareness, Resource Judgment
     ═════════════════════════════════════════════════════════════════ */
  _registerVendingMachine(fliq) {
    const pos = new THREE.Vector3(0, 0, 40);
    const group = new THREE.Group();

    // Machine body
    const machineGeo = new THREE.BoxGeometry(2.5, 4, 1.5);
    const machineMat = new THREE.MeshStandardMaterial({ color: 0x4444DD, roughness: 0.4, metalness: 0.5 });
    const machine = new THREE.Mesh(machineGeo, machineMat);
    machine.position.y = 2;
    machine.castShadow = true;
    group.add(machine);

    // Glass front
    const glassFrontGeo = new THREE.BoxGeometry(2.0, 2.5, 0.1);
    const glassFrontMat = new THREE.MeshStandardMaterial({
      color: 0x88BBFF, transparent: true, opacity: 0.4, roughness: 0.1
    });
    const glassFront = new THREE.Mesh(glassFrontGeo, glassFrontMat);
    glassFront.position.set(0, 2.5, 0.8);
    group.add(glassFront);

    // Flashy lights
    const flashLight = new THREE.PointLight(0xFF44FF, 2, 8);
    flashLight.position.y = 4.5;
    group.add(flashLight);

    // Top sign
    const topGeo = new THREE.BoxGeometry(2.8, 0.6, 1.6);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0xFF44FF, emissive: 0xFF22DD, emissiveIntensity: 0.5
    });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 4.3;
    group.add(top);

    group.position.copy(pos);
    group.userData.baseY = 0;
    group.userData.phase = 9.0;

    const items = [
      { name: 'Sparkle Burst', cost: 10, desc: 'A dazzling explosion of sparkles! (5-second visual effect)' },
      { name: 'Rainbow Trail', cost: 8, desc: 'Leave a rainbow behind you! (10-second visual effect)' },
      { name: 'Glow Aura', cost: 12, desc: 'Surround yourself with a glowing aura! (8-second visual effect)' },
    ];
    let timesBought = 0, timesResisted = 0;

    this.addZone({
      id: 'vending_machine', position: pos, radius: 4,
      label: '✨ Press E — Vending Machine',
      zoneName: 'Vending Machine',
      enterText: 'Ooh, a flashy vending machine with amazing-looking items! They seem expensive though... are they worth it?',
      cooldownMs: 4000, mesh: group,
      onInteract: (player, gs) => {
        gs.paused = true;
        if (this._behaviorTracker) this._behaviorTracker.startDecisionTimer('vending_machine', 'impulse');
        const item = items[Math.floor(Math.random() * items.length)];
        this._showVendingUI(item, (bought) => {
          gs.paused = false;
          if (this._behaviorTracker) this._behaviorTracker.endDecisionTimer();
          if (bought && player.spark >= item.cost) {
            player.spark -= item.cost;
            timesBought++;
            fliq.record('delayed_gratification', 0.1, `bought ${item.name} (${item.cost} Spark wasted)`);
            fliq.record('resource_judgment', 0.15, `spent ${item.cost} on visual effect only`);
            fliq.record('risk_awareness', 0.2, 'fell for flashy marketing');
            if (timesBought >= 2) fliq.record('adaptation', 0.15, `repeat impulse buyer (${timesBought}x)`);
            this._showFloatingText(pos, `${item.name}! So pretty! ...and gone.`, '#ff44ff');
            if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('vending_machine', false);
          } else if (bought) {
            this._showFloatingText(pos, 'Not enough Spark!', '#ff6666');
          } else {
            timesResisted++;
            fliq.record('delayed_gratification', 0.9, `resisted ${item.name}`);
            fliq.record('resource_judgment', 0.85, `saved ${item.cost} Spark`);
            fliq.record('risk_awareness', 0.8, 'recognized overpriced item');
            if (timesResisted >= 2) fliq.record('adaptation', 0.85, 'consistently resists vending machine');
            this._showFloatingText(pos, 'Smart move — your Spark is worth more!', '#88ddff');
            if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('vending_machine', true);
          }
        });
      },
    });
  }

  /* ═════════════════════════════════════════════════════════════════
     ZONE 10 — THE GARDEN (east-southeast)
     Plant fruits & vegetables → wait minutes → harvest → take to Recipe Workshop
     Measures: Delayed Gratification, Pattern Recognition, Adaptation, Resource Judgment
     ═════════════════════════════════════════════════════════════════ */
  _registerGardenPatch(fliq) {
    const pos = new THREE.Vector3(25, 0, -25);
    const group = new THREE.Group();

    // Load garden GLB model (replaces procedural geometry)
    loadGardenModel().then((gardenModel) => {
      if (gardenModel) {
        // Auto-scale the garden to roughly 14 world units wide
        const box = new THREE.Box3().setFromObject(gardenModel);
        const size = box.getSize(new THREE.Vector3());
        const targetWidth = 14;
        const scale = targetWidth / (Math.max(size.x, size.z) || 1);
        gardenModel.scale.setScalar(scale);
        // Center horizontally and place on ground
        const box2 = new THREE.Box3().setFromObject(gardenModel);
        const center = box2.getCenter(new THREE.Vector3());
        gardenModel.position.x -= center.x;
        gardenModel.position.z -= center.z;
        gardenModel.position.y -= box2.min.y;
        group.add(gardenModel);
        console.log('[Garden] GLB model added to scene');
      } else {
        // Fallback: simple brown bed if GLB fails
        const bedGeo = new THREE.BoxGeometry(5, 0.3, 4);
        const bedMat = new THREE.MeshStandardMaterial({ color: 0x5C3A1E, roughness: 1.0 });
        const bed = new THREE.Mesh(bedGeo, bedMat);
        bed.position.y = 0.15;
        group.add(bed);
        console.warn('[Garden] Using fallback procedural geometry');
      }
    });

    // Gardener NPC
    const gardener = this._createSimpleNPC(0x44AA44);
    gardener.position.set(3, 0, -1);
    group.add(gardener);

    // ── Animated crop meshes (5 plot slots) ──
    const cropMeshes = [];
    const cropColors3D = [0xFF4444, 0x44CC44, 0xFF8800, 0xFF4488, 0xFFCC00];
    for (let i = 0; i < 5; i++) {
      const slot = new THREE.Group();
      // Stem
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.01, 4),
        new THREE.MeshStandardMaterial({ color: 0x44AA44 })
      );
      stem.position.y = 0.2;
      slot.add(stem);
      // Fruit/head
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.01, 6, 6),
        new THREE.MeshStandardMaterial({ color: cropColors3D[i], emissive: cropColors3D[i], emissiveIntensity: 0.2 })
      );
      head.position.y = 0.2;
      slot.add(head);
      slot.position.set(-1.6 + i * 0.8, 0.2, 0);
      slot.visible = false;
      slot.userData = { stem, head, slotIdx: i };
      group.add(slot);
      cropMeshes.push(slot);
    }

    group.position.copy(pos);
    // No baseY/phase — garden stays fixed on the ground (no bobbing)

    // ── Crop definitions (5 fruits & vegetables) ──
    const cropTypes = [
      { name: '🍎 Apple',       emoji: '🍎', cost: 2, growTime: 60000,  color: '#ff4444', slotColor: 0xFF4444 },
      { name: '🥦 Broccoli',    emoji: '🥦', cost: 2, growTime: 90000,  color: '#44aa44', slotColor: 0x44CC44 },
      { name: '🥕 Carrot',      emoji: '🥕', cost: 3, growTime: 120000, color: '#ff8800', slotColor: 0xFF8800 },
      { name: '🍓 Strawberry',  emoji: '🍓', cost: 3, growTime: 150000, color: '#ff4488', slotColor: 0xFF4488 },
      { name: '🌽 Golden Corn', emoji: '🌽', cost: 4, growTime: 180000, color: '#ffcc00', slotColor: 0xFFCC00 },
    ];

    const MAX_PLOTS = 5;
    let plantedCrops = []; // { plantTime, cropIdx, harvested, plotSlot }
    let totalHarvests = 0;

    // Notification checker for main.js
    const checkHarvestReady = () => {
      const now = Date.now();
      for (const crop of plantedCrops) {
        if (crop.harvested) continue;
        const def = cropTypes[crop.cropIdx];
        if (now - crop.plantTime >= def.growTime) return def;
      }
      return null;
    };

    this._gardenCheckHarvest = checkHarvestReady;
    this._gardenPlantedCrops = plantedCrops;
    this._gardenCropTypes = cropTypes;

    // ── Animate growing crops every frame (called from world update or zone update) ──
    const animateCrops = () => {
      const now = Date.now();
      for (const crop of plantedCrops) {
        if (crop.harvested) {
          if (crop.plotSlot !== undefined) cropMeshes[crop.plotSlot].visible = false;
          continue;
        }
        const def = cropTypes[crop.cropIdx];
        const progress = Math.min(1, (now - crop.plantTime) / def.growTime);
        const slot = cropMeshes[crop.plotSlot];
        if (!slot) continue;

        slot.visible = true;
        const { stem, head } = slot.userData;

        // Stem grows taller with progress
        const stemH = 0.1 + progress * 0.6;
        stem.scale.set(1, stemH / 0.01, 1);
        stem.position.y = 0.2 + stemH * 0.5;

        // Fruit grows bigger with progress
        const fruitSize = 0.05 + progress * 0.25;
        head.scale.setScalar(fruitSize / 0.01);
        head.position.y = 0.2 + stemH + fruitSize * 0.5;

        // Ready crops pulse/glow
        if (progress >= 1.0) {
          const pulse = 1.0 + Math.sin(Date.now() * 0.005) * 0.15;
          head.scale.setScalar((fruitSize / 0.01) * pulse);
          head.material.emissiveIntensity = 0.3 + Math.sin(Date.now() * 0.004) * 0.2;
        } else {
          head.material.emissiveIntensity = 0.1;
        }
      }
    };

    // Expose animation for the game loop
    this._gardenAnimateCrops = animateCrops;

    this.addZone({
      id: 'garden_patch', position: pos, radius: 6,
      label: '🌱 Press E — The Garden',
      zoneName: 'The Garden',
      enterText: 'A community garden! Plant up to 5 crops at once. Wait for them to grow, then harvest and take them to the Recipe Workshop!',
      cooldownMs: 1000, mesh: group,
      onInteract: (player, gs) => {
        // Check for missions first
        const mm = this._missionManager;
        if (mm && !mm.activeMission) {
          const offer = mm.getOfferForZone('garden_patch');
          if (offer) {
            gs.paused = true;
            this._showMissionOfferUI(offer, (accepted) => {
              gs.paused = false;
              if (accepted) {
                mm.acceptMission(offer);
                fliq.record('delayed_gratification', 0.7, `accepted garden mission: ${offer.title}`);
                this._showFloatingText(pos, `Mission accepted: ${offer.title}!`, '#44ff44');
              } else {
                this._showFloatingText(pos, 'Maybe later!', '#aaaaaa');
              }
            });
            return;
          }
        }

        // Show garden status UI — lets player see all crops, harvest ready ones, and plant new ones
        gs.paused = true;
        this._showGardenStatusUI(plantedCrops, cropTypes, cropMeshes, MAX_PLOTS, player, fliq, totalHarvests, (action) => {
          gs.paused = false;

          if (action.type === 'harvest') {
            const crop = action.crop;
            const def = cropTypes[crop.cropIdx];
            crop.harvested = true;
            totalHarvests++;
            player.inventory.push(def.name);
            if (crop.plotSlot !== undefined) cropMeshes[crop.plotSlot].visible = false;

            fliq.record('delayed_gratification', 0.9, `waited for ${def.name} to grow`);
            fliq.record('resource_judgment', 0.8, `harvested ${def.name}`);
            if (totalHarvests >= 3) fliq.record('pattern_recognition', 0.75, `${totalHarvests} crops harvested`);
            this._showFloatingText(pos, `${def.emoji} Harvested ${def.name}! Take to Recipe Workshop!`, '#44ff44');
            if (this._behaviorTracker) this._behaviorTracker.recordZoneResult('garden_patch', true);

          } else if (action.type === 'plant') {
            const def = cropTypes[action.cropIdx];
            if (player.spark >= def.cost) {
              // Find free plot slot
              const usedSlots = new Set(plantedCrops.filter(c => !c.harvested).map(c => c.plotSlot));
              let freeSlot = -1;
              for (let s = 0; s < MAX_PLOTS; s++) {
                if (!usedSlots.has(s)) { freeSlot = s; break; }
              }
              if (freeSlot === -1) {
                this._showFloatingText(pos, 'All plots are full! Harvest first.', '#ff6666');
                return;
              }
              player.spark -= def.cost;
              plantedCrops.push({ plantTime: Date.now(), cropIdx: action.cropIdx, harvested: false, plotSlot: freeSlot });
              const mins = Math.round(def.growTime / 60000);
              fliq.record('delayed_gratification', 0.65, `planted ${def.name} (${mins} min wait)`);
              fliq.record('resource_judgment', 0.7, `invested ${def.cost} Spark in garden`);
              this._showFloatingText(pos, `${def.emoji} Planted! Ready in ${mins} min!`, '#88ff88');
            } else {
              this._showFloatingText(pos, 'Not enough Spark!', '#ff6666');
            }

          } else {
            // closed
          }
        });
      },
    });
  }

  /* ═════════════════════════════════════════════════════════════════
     HELPER: Simple NPC figure
     ═════════════════════════════════════════════════════════════════ */
  _createSimpleNPC(shirtColor) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.8, 0.4),
      new THREE.MeshStandardMaterial({ color: shirtColor })
    );
    body.position.y = 0.4;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xFFCC88 })
    );
    head.position.y = 1.1;
    g.add(head);
    return g;
  }

  /* ═════════════════════════════════════════════════════════════════
     UI HELPERS
     ═════════════════════════════════════════════════════════════════ */

  _showFloatingText(worldPos, text, color) {
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
    requestAnimationFrame(() => { div.style.top = '30%'; div.style.opacity = '0'; });
    setTimeout(() => div.remove(), 1600);
  }

  _showTradeUI(trade, npcName, callback) {
    const overlay = this._createOverlay();
    overlay.innerHTML = `
      <div style="background:rgba(20,10,40,0.95); border:3px solid #ffaa44;
        border-radius:16px; padding:30px; max-width:420px; text-align:center; color:white;">
        <h2 style="color:#ffaa44; margin:0 0 16px;">🏪 ${npcName}</h2>
        <p style="font-size:16px; margin:0 0 24px; line-height:1.5;">${trade.desc}</p>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button id="_trade_yes" style="${this._btnStyle('#44aa44')}">Accept</button>
          <button id="_trade_no" style="${this._btnStyle('#aa4444')}">Decline</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_trade_yes').onclick = () => { overlay.remove(); callback(true); };
    overlay.querySelector('#_trade_no').onclick = () => { overlay.remove(); callback(false); };
  }

  _showPatternGame(sequence, colors, callback) {
    const colorNames = ['🔴', '🟢', '🔵', '🟡'];
    const hexColors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44'];
    const overlay = this._createOverlay();
    const card = document.createElement('div');
    card.style.cssText = `background:rgba(20,10,40,0.95); border:3px solid #6644cc;
      border-radius:16px; padding:30px; max-width:420px; text-align:center; color:white;`;

    const title = document.createElement('h2');
    title.textContent = '🎮 Arcade — Remember the Pattern!';
    title.style.cssText = 'color:#aa88ff; margin:0 0 20px;';
    card.appendChild(title);

    const display = document.createElement('div');
    display.style.cssText = 'font-size:36px; margin:0 0 24px; letter-spacing:8px;';
    display.textContent = sequence.map(i => colorNames[i]).join(' ');
    card.appendChild(display);

    const info = document.createElement('p');
    info.textContent = 'Now repeat it! Click the colors in order:';
    info.style.cssText = 'margin:0 0 16px; font-size:14px; color:#ccc;';
    card.appendChild(info);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; gap:12px; justify-content:center; flex-wrap:wrap;';

    const playerInput = [];
    for (let i = 0; i < 4; i++) {
      const btn = document.createElement('button');
      btn.textContent = colorNames[i];
      btn.style.cssText = `width:60px; height:60px; font-size:28px; border:3px solid ${hexColors[i]};
        border-radius:12px; background:rgba(255,255,255,0.1); cursor:pointer;`;
      btn.onclick = () => {
        playerInput.push(i);
        btn.style.transform = 'scale(0.9)';
        setTimeout(() => btn.style.transform = '', 150);
        if (playerInput.length === sequence.length) {
          const correct = playerInput.every((v, idx) => v === sequence[idx]);
          overlay.remove();
          callback(correct);
        }
      };
      btnRow.appendChild(btn);
    }

    card.appendChild(btnRow);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    setTimeout(() => { display.textContent = '? '.repeat(sequence.length); display.style.color = '#666'; }, 2000);
  }

  _showDialogueUI(text, cost, npcName, callback) {
    const overlay = this._createOverlay();
    overlay.innerHTML = `
      <div style="background:rgba(20,10,40,0.95); border:3px solid #44aaff;
        border-radius:16px; padding:30px; max-width:420px; text-align:center; color:white;">
        <h2 style="color:#44aaff; margin:0 0 16px;">🎪 ${npcName}</h2>
        <p style="font-size:16px; margin:0 0 24px; line-height:1.5;">"${text}"</p>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button id="_help_yes" style="${this._btnStyle('#44aa44')}">Share ${cost} Spark</button>
          <button id="_help_no" style="${this._btnStyle('#664444')}">Walk Away</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_help_yes').onclick = () => { overlay.remove(); callback(true); };
    overlay.querySelector('#_help_no').onclick = () => { overlay.remove(); callback(false); };
  }

  _showToyStoreUI(toy, callback) {
    const overlay = this._createOverlay();
    overlay.innerHTML = `
      <div style="background:rgba(20,10,40,0.95); border:3px solid #ff88cc;
        border-radius:16px; padding:30px; max-width:420px; text-align:center; color:white;">
        <h2 style="color:#ff88cc; margin:0 0 16px;">🧸 Toy Store</h2>
        <h3 style="color:#ffdd88; margin:0 0 8px;">${toy.name} — ${toy.cost} Spark</h3>
        <p style="font-size:14px; margin:0 0 24px; color:#ccc; line-height:1.5;">${toy.desc}</p>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button id="_buy_yes" style="${this._btnStyle('#dd44aa')}">Buy It!</button>
          <button id="_buy_no" style="${this._btnStyle('#446688')}">No Thanks</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_buy_yes').onclick = () => { overlay.remove(); callback(true); };
    overlay.querySelector('#_buy_no').onclick = () => { overlay.remove(); callback(false); };
  }

  _showLemonadeUI(callback) {
    const overlay = this._createOverlay();
    overlay.innerHTML = `
      <div style="background:rgba(20,10,40,0.95); border:3px solid #ffdd44;
        border-radius:16px; padding:30px; max-width:420px; text-align:center; color:white;">
        <h2 style="color:#ffdd44; margin:0 0 16px;">🧪 Recipe Workshop</h2>
        <p style="font-size:14px; margin:0 0 8px; color:#ccc;">Ingredients cost 2 Spark. Choose your mix!</p>
        <p style="font-size:12px; margin:0 0 20px; color:#999;">Mild = more likely to please. Bold = bigger reward if they like it!</p>
        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
          <button class="_lemon_price" data-price="3" style="${this._btnStyle('#44aa44')}">Mild Mix</button>
          <button class="_lemon_price" data-price="5" style="${this._btnStyle('#ddaa22')}">Balanced</button>
          <button class="_lemon_price" data-price="7" style="${this._btnStyle('#dd6622')}">Spicy Blend</button>
          <button class="_lemon_price" data-price="10" style="${this._btnStyle('#dd2222')}">Extreme!</button>
        </div>
        <button id="_lemon_cancel" style="margin-top:12px; ${this._btnStyle('#444444')}">Never Mind</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('._lemon_price').forEach(btn => {
      btn.onclick = () => { overlay.remove(); callback(parseInt(btn.dataset.price)); };
    });
    overlay.querySelector('#_lemon_cancel').onclick = () => { overlay.remove(); callback(null); };
  }

  _showLostFoundUI(callback) {
    const overlay = this._createOverlay();
    overlay.innerHTML = `
      <div style="background:rgba(20,10,40,0.95); border:3px solid #88aacc;
        border-radius:16px; padding:30px; max-width:420px; text-align:center; color:white;">
        <h2 style="color:#88aacc; margin:0 0 16px;">📦 Lost & Found</h2>
        <p style="font-size:16px; margin:0 0 8px; line-height:1.5;">You found a glowing crystal! It's worth 5 Spark.</p>
        <p style="font-size:13px; margin:0 0 24px; color:#aaa;">You could return it and get 3 Spark now... the owner might come back later with a bigger thank-you!</p>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button id="_lf_keep" style="${this._btnStyle('#dd8822')}">Keep It (5 Spark)</button>
          <button id="_lf_return" style="${this._btnStyle('#4488aa')}">Return It (3 now + ?)</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_lf_keep').onclick = () => { overlay.remove(); callback(true); };
    overlay.querySelector('#_lf_return').onclick = () => { overlay.remove(); callback(false); };
  }

  _showCommunityBoardUI(projects, sparkBalance, callback) {
    const overlay = this._createOverlay();
    let projectsHTML = projects.map((p, i) => `
      <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:12px; margin:8px 0;
        text-align:left; border:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#88ddff;">${p.name}</strong>
          <span style="color:#ffdd44;">${p.cost} Spark</span>
        </div>
        <p style="font-size:12px; color:#aaa; margin:4px 0 8px;">${p.desc}</p>
        <button class="_cb_fund" data-idx="${i}" style="${this._btnStyle('#44aa66')}; padding:8px 16px; font-size:13px;"
          ${sparkBalance < p.cost ? 'disabled style="opacity:0.5;cursor:default;"' : ''}>Fund This</button>
      </div>
    `).join('');

    overlay.innerHTML = `
      <div style="background:rgba(20,10,40,0.95); border:3px solid #88aacc;
        border-radius:16px; padding:30px; max-width:460px; color:white;">
        <h2 style="color:#88aacc; margin:0 0 16px; text-align:center;">📋 Community Projects</h2>
        <p style="font-size:13px; color:#aaa; text-align:center; margin:0 0 16px;">Choose a project to support!</p>
        ${projectsHTML}
        <button id="_cb_skip" style="margin-top:8px; width:100%; ${this._btnStyle('#444444')}">Maybe Later</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('._cb_fund').forEach(btn => {
      btn.onclick = () => { overlay.remove(); callback(parseInt(btn.dataset.idx)); };
    });
    overlay.querySelector('#_cb_skip').onclick = () => { overlay.remove(); callback(-1); };
  }

  _showVendingUI(item, callback) {
    const overlay = this._createOverlay();
    overlay.innerHTML = `
      <div style="background:rgba(20,10,40,0.95); border:3px solid #ff44ff;
        border-radius:16px; padding:30px; max-width:420px; text-align:center; color:white;">
        <h2 style="color:#ff44ff; margin:0 0 16px;">✨ Vending Machine</h2>
        <h3 style="color:#ffdd88; margin:0 0 8px;">${item.name} — ${item.cost} Spark</h3>
        <p style="font-size:14px; margin:0 0 24px; color:#ccc; line-height:1.5;">${item.desc}</p>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button id="_vm_buy" style="${this._btnStyle('#dd44dd')}">Buy! ✨</button>
          <button id="_vm_no" style="${this._btnStyle('#446666')}">Walk Away</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_vm_buy').onclick = () => { overlay.remove(); callback(true); };
    overlay.querySelector('#_vm_no').onclick = () => { overlay.remove(); callback(false); };
  }

  _showGardenStatusUI(plantedCrops, cropTypes, cropMeshes, maxPlots, player, fliq, totalHarvests, callback) {
    const overlay = this._createOverlay();
    const card = document.createElement('div');
    card.style.cssText = `background:rgba(15,8,35,0.95); border:3px solid #66cc44;
      border-radius:16px; padding:24px; max-width:500px; width:92%; color:white;
      max-height:85vh; overflow-y:auto;`;

    const render = () => {
      const now = Date.now();
      const activeCrops = plantedCrops.filter(c => !c.harvested);
      const freePlots = maxPlots - activeCrops.length;

      // Build growing crops section
      let growingHTML = '';
      if (activeCrops.length > 0) {
        growingHTML = '<div style="margin-bottom:16px;">';
        growingHTML += '<h3 style="color:#88ff88; margin:0 0 8px; font-size:14px;">🌱 Growing Crops</h3>';
        for (const crop of activeCrops) {
          const def = cropTypes[crop.cropIdx];
          const elapsed = now - crop.plantTime;
          const progress = Math.min(1, elapsed / def.growTime);
          const pct = Math.round(progress * 100);
          const isReady = progress >= 1;
          const barColor = isReady ? '#44ff44' : def.color;
          const timeText = isReady ? '✅ READY!' : `${Math.ceil((def.growTime - elapsed) / 60000)} min left`;

          growingHTML += `
          <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:10px; margin:6px 0;
            border:1px solid ${isReady ? 'rgba(68,255,68,0.4)' : 'rgba(255,255,255,0.1)'};">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:16px;">${def.emoji} ${def.name}</span>
              <span style="color:${isReady ? '#44ff44' : '#aaa'}; font-size:13px; font-weight:bold;">${pct}% — ${timeText}</span>
            </div>
            <div style="background:rgba(255,255,255,0.1); border-radius:4px; height:8px; margin-top:6px; overflow:hidden;">
              <div style="background:${barColor}; width:${pct}%; height:100%; border-radius:4px;
                ${isReady ? 'animation:pulse 1s infinite alternate;' : ''}"></div>
            </div>
            ${isReady ? `<button class="_gh_harvest" data-crop-time="${crop.plantTime}" style="margin-top:8px; width:100%; ${this._btnStyle('#44aa44')}; padding:8px; font-size:14px;">🌾 Harvest ${def.emoji}</button>` : ''}
          </div>`;
        }
        growingHTML += '</div>';
      }

      // Build plant section
      let plantHTML = '';
      if (freePlots > 0) {
        plantHTML = `<div>
          <h3 style="color:#ffdd44; margin:0 0 8px; font-size:14px;">🌰 Plant New (${freePlots} plot${freePlots > 1 ? 's' : ''} free)</h3>`;
        for (let i = 0; i < cropTypes.length; i++) {
          const c = cropTypes[i];
          const mins = Math.round(c.growTime / 60000);
          const canAfford = player.spark >= c.cost;
          plantHTML += `
          <div style="display:flex; justify-content:space-between; align-items:center;
            background:rgba(255,255,255,0.03); border-radius:8px; padding:8px 10px; margin:4px 0;">
            <span style="font-size:15px;">${c.emoji} ${c.name} <span style="color:#aaa; font-size:11px;">(${mins}min)</span></span>
            <button class="_gh_plant" data-idx="${i}" style="${this._btnStyle(canAfford ? '#44aa44' : '#333')}; padding:6px 14px; font-size:12px;"
              ${canAfford ? '' : 'disabled'}>${c.cost} Spark</button>
          </div>`;
        }
        plantHTML += '</div>';
      } else {
        plantHTML = `<p style="color:#ffaa44; font-size:13px; text-align:center; margin:8px 0;">All 5 plots are planted! Wait for crops to grow or harvest ready ones.</p>`;
      }

      // Inventory preview
      const invHTML = player.inventory.length > 0
        ? `<p style="color:#88ddff; font-size:12px; margin:8px 0 0; text-align:center;">🎒 Inventory: ${player.inventory.join(', ')}</p>` : '';

      card.innerHTML = `
        <style>@keyframes pulse { from { opacity:0.7; } to { opacity:1; } }</style>
        <h2 style="color:#66cc44; margin:0 0 4px; text-align:center;">🌱 The Garden</h2>
        <p style="color:#aaa; font-size:12px; text-align:center; margin:0 0 14px;">Plant crops, watch them grow, harvest when ready!</p>
        ${growingHTML}
        ${plantHTML}
        ${invHTML}
        <button id="_gh_close" style="margin-top:12px; width:100%; ${this._btnStyle('#444444')}">Close</button>
      `;

      // Bind events
      card.querySelectorAll('._gh_harvest').forEach(btn => {
        btn.onclick = () => {
          const plantTime = parseInt(btn.dataset.cropTime);
          const crop = plantedCrops.find(c => c.plantTime === plantTime && !c.harvested);
          if (crop) { overlay.remove(); callback({ type: 'harvest', crop }); }
        };
      });
      card.querySelectorAll('._gh_plant').forEach(btn => {
        if (!btn.disabled) {
          btn.onclick = () => { overlay.remove(); callback({ type: 'plant', cropIdx: parseInt(btn.dataset.idx) }); };
        }
      });
      card.querySelector('#_gh_close').onclick = () => { overlay.remove(); callback({ type: 'close' }); };
    };

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    render();

    // Auto-refresh progress bars every second while open
    const refreshInterval = setInterval(() => {
      if (!document.body.contains(overlay)) { clearInterval(refreshInterval); return; }
      render();
    }, 1000);
  }

  _showRecipeUI(inventory, recipes, discovered, callback) {
    const overlay = this._createOverlay();
    let selected = [];

    const getRecipeKey = (a, b) => [a, b].sort().join('+');

    const renderItems = () => {
      let itemsHTML = inventory.map((item, i) => {
        const isSelected = selected.includes(i);
        const bg = isSelected ? 'rgba(68,255,68,0.2)' : 'rgba(255,255,255,0.05)';
        const border = isSelected ? '2px solid #44ff44' : '1px solid rgba(255,255,255,0.1)';
        return `<button class="_recipe_item" data-idx="${i}" style="
          background:${bg}; border:${border}; border-radius:10px; padding:12px 16px;
          color:white; font-size:16px; cursor:pointer; min-width:120px;
        ">${item}</button>`;
      }).join('');

      let previewHTML = '';
      if (selected.length === 2) {
        const key = getRecipeKey(inventory[selected[0]], inventory[selected[1]]);
        const recipe = recipes[key];
        const isKnown = discovered.has(key);
        if (recipe && isKnown) {
          previewHTML = `<p style="color:#44ff44; font-size:16px; margin:12px 0;">= ${recipe.name} (${recipe.reward} Spark)</p>`;
        } else {
          previewHTML = `<p style="color:#ffdd44; font-size:16px; margin:12px 0;">= ??? (Try it to find out!)</p>`;
        }
      }

      card.innerHTML = `
        <h2 style="color:#ffdd44; margin:0 0 8px; text-align:center;">🧪 Recipe Workshop</h2>
        <p style="font-size:13px; color:#aaa; text-align:center; margin:0 0 16px;">
          Pick 2 ingredients to combine! Tap an item to select it.</p>
        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-bottom:12px;">
          ${itemsHTML}
        </div>
        ${previewHTML}
        <div style="display:flex; gap:10px; margin-top:12px;">
          <button id="_recipe_combine" style="flex:1; ${this._btnStyle(selected.length === 2 ? '#44aa44' : '#333333')}"
            ${selected.length !== 2 ? 'disabled' : ''}>Combine!</button>
          <button id="_recipe_cancel" style="flex:1; ${this._btnStyle('#444444')}">Leave</button>
        </div>
      `;

      // Re-bind clicks
      card.querySelectorAll('._recipe_item').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.idx);
          if (selected.includes(idx)) {
            selected = selected.filter(s => s !== idx);
          } else if (selected.length < 2) {
            selected.push(idx);
          }
          renderItems();
        };
      });
      const combineBtn = card.querySelector('#_recipe_combine');
      if (combineBtn && !combineBtn.disabled) {
        combineBtn.onclick = () => { overlay.remove(); callback(selected[0], selected[1]); };
      }
      card.querySelector('#_recipe_cancel').onclick = () => { overlay.remove(); callback(-1, -1); };
    };

    const card = document.createElement('div');
    card.style.cssText = `background:rgba(15,8,35,0.95); border:3px solid #ffdd44;
      border-radius:16px; padding:30px; max-width:480px; width:90%; color:white;`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    renderItems();
  }

  _showGardenPlantUI(cropTypes, sparkBalance, callback) {
    const overlay = this._createOverlay();
    let cropsHTML = cropTypes.map((c, i) => {
      const mins = Math.round(c.growTime / 60000);
      return `
      <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:12px; margin:8px 0;
        border:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:${c.color}; font-size:18px;">${c.name}</strong>
          <span style="color:#ffdd44;">${c.cost} Spark</span>
        </div>
        <p style="font-size:12px; color:#aaa; margin:4px 0 8px;">⏱ Grows in ${mins} minute${mins > 1 ? 's' : ''}</p>
        <button class="_gp_plant" data-idx="${i}" style="${this._btnStyle('#44aa44')}; padding:8px 16px; font-size:13px;"
          ${sparkBalance < c.cost ? 'disabled style="opacity:0.4;cursor:default;"' : ''}>Plant ${c.emoji}</button>
      </div>`;
    }).join('');

    overlay.innerHTML = `
      <div style="background:rgba(15,8,35,0.95); border:3px solid #66cc44;
        border-radius:16px; padding:30px; max-width:460px; color:white;">
        <h2 style="color:#66cc44; margin:0 0 8px; text-align:center;">🌱 The Garden — Plant a Crop</h2>
        <p style="font-size:12px; color:#aaa; text-align:center; margin:0 0 12px;">Choose what to grow! Come back when it's ready to harvest.</p>
        ${cropsHTML}
        <button id="_gp_skip" style="margin-top:8px; width:100%; ${this._btnStyle('#444444')}">Maybe Later</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('._gp_plant').forEach(btn => {
      if (!btn.disabled) btn.onclick = () => { overlay.remove(); callback(parseInt(btn.dataset.idx)); };
    });
    overlay.querySelector('#_gp_skip').onclick = () => { overlay.remove(); callback(-1); };
  }

  _showMarketUI(crops, callback) {
    const overlay = this._createOverlay();
    // Generate random market prices (some good, some bad)
    const offers = crops.map((crop, i) => {
      const variance = 0.5 + Math.random() * 1.2; // 0.5x to 1.7x base value
      const price = Math.max(1, Math.round(crop.baseValue * variance));
      const quality = variance >= 1.3 ? 'great' : variance >= 0.9 ? 'fair' : 'low';
      return { ...crop, idx: i, price, quality };
    });

    let cropsHTML = offers.map(o => {
      const priceColor = o.quality === 'great' ? '#44ff44' : o.quality === 'fair' ? '#ffdd44' : '#ff6666';
      const tag = o.quality === 'great' ? '🔥 Very Grateful!' : o.quality === 'fair' ? 'Thankful' : '😐 Not Needed';
      return `
      <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:12px; margin:8px 0;
        border:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#88ff88;">${o.name}</strong>
          <span style="color:${priceColor}; font-weight:bold;">${o.price} Spark <span style="font-size:11px;">(${tag})</span></span>
        </div>
        <p style="font-size:11px; color:#aaa; margin:4px 0 8px;">Base value: ~${o.baseValue} Spark</p>
        <button class="_mk_sell" data-idx="${o.idx}" data-price="${o.price}" style="${this._btnStyle('#44aa44')}; padding:8px 16px; font-size:13px;">Share</button>
      </div>`;
    }).join('');

    overlay.innerHTML = `
      <div style="background:rgba(20,10,40,0.95); border:3px solid #FF8844;
        border-radius:16px; padding:30px; max-width:460px; color:white;">
        <h2 style="color:#FF8844; margin:0 0 8px; text-align:center;">🤝 Neighborhood Share Stand</h2>
        <p style="font-size:12px; color:#aaa; text-align:center; margin:0 0 12px;">Neighbors want your harvest! Gratitude varies — share when the timing feels right!</p>
        ${cropsHTML}
        <div style="display:flex; gap:10px; margin-top:10px;">
          <button id="_mk_wait" style="flex:1; ${this._btnStyle('#886644')}">Wait for More Neighbors</button>
          <button id="_mk_skip" style="flex:1; ${this._btnStyle('#444444')}">Leave</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('._mk_sell').forEach(btn => {
      btn.onclick = () => { overlay.remove(); callback({ type: 'sell', idx: parseInt(btn.dataset.idx), price: parseInt(btn.dataset.price) }); };
    });
    overlay.querySelector('#_mk_wait').onclick = () => { overlay.remove(); callback({ type: 'wait' }); };
    overlay.querySelector('#_mk_skip').onclick = () => { overlay.remove(); callback({ type: 'skip' }); };
  }

  _showGardenUI(seedTypes, sparkBalance, callback) {
    const overlay = this._createOverlay();
    let seedsHTML = seedTypes.map((s, i) => `
      <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:12px; margin:8px 0;
        text-align:left; border:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#88ff88;">${s.name}</strong>
          <span style="color:#ffdd44;">${s.cost} Spark</span>
        </div>
        <p style="font-size:11px; color:#aaa; margin:4px 0 8px;">Full harvest: ${s.fullReward} Spark (takes ${Math.round(s.growTime/1000)}s)</p>
        <button class="_gd_plant" data-idx="${i}" style="${this._btnStyle('#44aa44')}; padding:8px 16px; font-size:13px;"
          ${sparkBalance < s.cost ? 'disabled style="opacity:0.5;cursor:default;"' : ''}>Plant</button>
      </div>
    `).join('');

    overlay.innerHTML = `
      <div style="background:rgba(20,10,40,0.95); border:3px solid #66cc44;
        border-radius:16px; padding:30px; max-width:460px; color:white;">
        <h2 style="color:#66cc44; margin:0 0 16px; text-align:center;">🌱 Garden Patch — Choose a Seed</h2>
        <p style="font-size:12px; color:#aaa; text-align:center; margin:0 0 12px;">Plant seeds and harvest later. Wait longer for bigger rewards!</p>
        ${seedsHTML}
        <button id="_gd_skip" style="margin-top:8px; width:100%; ${this._btnStyle('#444444')}">Maybe Later</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('._gd_plant').forEach(btn => {
      btn.onclick = () => { overlay.remove(); callback(parseInt(btn.dataset.idx)); };
    });
    overlay.querySelector('#_gd_skip').onclick = () => { overlay.remove(); callback(-1); };
  }

  /* ─── Shared UI utilities ─── */

  _showMissionOfferUI(missionDef, callback) {
    const overlay = this._createOverlay();
    const typeLabel = missionDef.type === 'delivery' ? '📦 Delivery Mission'
      : missionDef.type === 'npc_assist' ? '🤝 Help Mission'
      : missionDef.type === 'trail' ? '✨ Trail Hunt' : '📋 Mission';

    const timeText = missionDef.timeLimit
      ? `<p style="font-size:12px; color:#ffaa44; margin:0 0 16px;">⏱ Time limit: ${missionDef.timeLimit}s</p>` : '';

    overlay.innerHTML = `
      <div style="background:rgba(15,8,35,0.95); border:3px solid #ffdd44;
        border-radius:16px; padding:30px; max-width:440px; text-align:center; color:white;">
        <h2 style="color:#ffdd44; margin:0 0 6px;">${typeLabel}</h2>
        <h3 style="color:#88ddff; margin:0 0 12px; font-size:18px;">${missionDef.title}</h3>
        <p style="font-size:15px; margin:0 0 12px; line-height:1.5; color:#ccc;">${missionDef.desc}</p>
        ${timeText}
        <p style="font-size:13px; color:#88ff88; margin:0 0 20px;">Reward: ${missionDef.reward} Spark</p>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button id="_mission_accept" style="${this._btnStyle('#44aa44')}">Accept Mission</button>
          <button id="_mission_decline" style="${this._btnStyle('#664444')}">Not Now</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_mission_accept').onclick = () => { overlay.remove(); callback(true); };
    overlay.querySelector('#_mission_decline').onclick = () => { overlay.remove(); callback(false); };
  }

  _createOverlay() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed; top:0; left:0; width:100vw; height:100vh;
      background:rgba(0,0,0,0.6); display:flex; align-items:center;
      justify-content:center; z-index:200; font-family:'Segoe UI',Arial,sans-serif;`;
    return overlay;
  }

  _btnStyle(bgColor) {
    return `padding:12px 28px; background:${bgColor}; border:none;
      border-radius:8px; color:white; font-size:16px; font-weight:bold; cursor:pointer;`;
  }

  _createNameSprite(text, position, zoneId) {
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    canvas.width  = 512;
    canvas.height = 128;

    // Color meaning system — zone-specific accent colors
    const colorKey = ZONE_COLORS[zoneId] || 'gold';
    const colorData = COLOR_MEANINGS[colorKey] || COLOR_MEANINGS.gold;
    const hexStr = '#' + colorData.color.toString(16).padStart(6, '0');
    const emHexStr = '#' + colorData.emissive.toString(16).padStart(6, '0');

    ctx.fillStyle = 'rgba(15, 8, 35, 0.75)';
    const r = 20;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(canvas.width - r, 0);
    ctx.quadraticCurveTo(canvas.width, 0, canvas.width, r);
    ctx.lineTo(canvas.width, canvas.height - r);
    ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - r, canvas.height);
    ctx.lineTo(r, canvas.height);
    ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = hexStr;
    ctx.lineWidth   = 4;
    ctx.stroke();

    ctx.fillStyle    = hexStr;
    ctx.font         = 'bold 42px Segoe UI, Arial, sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = emHexStr;
    ctx.shadowBlur   = 12;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(position.x, 6, position.z);
    sprite.scale.set(6, 1.5, 1);
    return sprite;
  }

  _showEnterText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.cssText = `
      position:fixed; top:18%; left:50%; transform:translate(-50%,-50%);
      color:#aa88ff; font-size:18px; font-weight:bold; max-width:500px;
      text-align:center; line-height:1.5;
      font-family:'Segoe UI',Arial,sans-serif;
      text-shadow:0 2px 8px rgba(0,0,0,0.7);
      background:rgba(15,8,35,0.8); padding:14px 24px; border-radius:12px;
      border:2px solid rgba(170,136,255,0.4);
      pointer-events:none; z-index:100;
      opacity:1; transition:opacity 2s ease 2s;
    `;
    document.body.appendChild(div);
    requestAnimationFrame(() => { div.style.opacity = '0'; });
    setTimeout(() => div.remove(), 4000);
  }
}
