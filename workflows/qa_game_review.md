# QA & Game Development Review — Roblox-Quality Standards

## Purpose
This workflow defines the quality assurance and game development standards for FLIQ Runner. The goal is to make the game feel like a polished Roblox experience — responsive, visually consistent, and fun to explore.

## When to Run
- After any major code change (new zone, asset swap, movement tweak)
- Before pushing to GitHub / deploying live
- When Dr. Mike or team requests a quality check
- Weekly as a routine health check

---

## CHECKLIST: Roblox-Quality Standards

### 1. MOVEMENT & CONTROLS (Target: Roblox Feel)
- [ ] **Walk/Run speed feels natural** — not too slow, not sliding
- [ ] **Character responds instantly** to input (no input lag)
- [ ] **Sprint activates immediately** on Shift/button press
- [ ] **No acceleration on jump** — character doesn't launch forward
- [ ] **Camera follows smoothly** — no jitter, no clipping through objects
- [ ] **Camera zoom** works with scroll/pinch
- [ ] **Mobile joystick** is responsive and properly positioned
- [ ] **Character animation matches state** — idle when still, run when moving
- [ ] **No floating/sinking** — character stays grounded on terrain
- [ ] **Rotation is smooth** — character faces movement direction without snapping

### 2. VISUAL QUALITY (Target: Stylized Toy-World)
- [ ] **All assets match the same art style** — no mixing realistic with cartoon
- [ ] **No z-fighting** (flickering surfaces overlapping)
- [ ] **No floating objects** — everything sits on the ground properly
- [ ] **No black patches** — ground covers entire play area
- [ ] **Consistent lighting** — no overly dark or blown-out areas
- [ ] **Trees/bushes/rocks scaled appropriately** relative to character
- [ ] **Buildings proportional** — not too big or too small for the world
- [ ] **Colors follow the system**: Gold=reward, Blue=explore, Green=growth, Purple=mystery, Orange=missions
- [ ] **Zone labels readable** and positioned correctly (not overlapping)
- [ ] **No texture stretching** on any model

### 3. PERFORMANCE (Target: 30+ FPS on Mobile)
- [ ] **Desktop FPS**: 60 FPS stable
- [ ] **Mobile FPS**: 30+ FPS (check with stats panel)
- [ ] **No frame drops** when loading new areas
- [ ] **WebGL context survives** — game doesn't crash/disappear on mobile
- [ ] **Loading screen shows** before game appears
- [ ] **Total page weight** under 30MB (compressed assets)
- [ ] **No console errors** in browser dev tools
- [ ] **Memory usage stable** — no leaks over 10+ minute session

### 4. INTERACTION ZONES (Target: All 10 Functional)
- [ ] **Wishing Fountain** — deposit/withdraw works, Spark updates
- [ ] **Discovery Exchange** — trade UI appears, signals recorded
- [ ] **Arcade** — pattern game plays correctly, scoring works
- [ ] **Playground** — NPC help interaction works
- [ ] **Toy Store** — impulse buy decision presented
- [ ] **Lemonade Stand** — pricing strategy works
- [ ] **Lost & Found** — honesty choice functions
- [ ] **Community Board** — mission board displays, acceptance works
- [ ] **Vending Machine** — temptation mechanic works
- [ ] **Garden Patch** — planting, growth timer, harvesting all work
- [ ] **Press E prompt** appears within correct radius
- [ ] **Zone entry text** shows when approaching
- [ ] **Cooldown prevents spam** re-interaction
- [ ] **All zones emit FLIQ signals** correctly

### 5. BEHAVIORAL TRACKING (Phase 3)
- [ ] **All 7 FLIQ domains** receiving signals
- [ ] **Passive signals emit** every 15 seconds
- [ ] **Decision timing recorded** on UI open/close
- [ ] **Explorer's Chronicle** opens with C key and shows data
- [ ] **Trend detection works** — improving/declining/stable shown
- [ ] **Signal count increases** as player interacts
- [ ] **No domain stuck at 0** after 5+ minutes of play

### 6. MISSIONS & TRAILS
- [ ] **Mission offers appear** at zones
- [ ] **Mission HUD shows** title, hint, timer
- [ ] **Delivery missions track** from/to zone correctly
- [ ] **Trail waypoints appear** and can be collected
- [ ] **Mission completion awards** correct Spark amount
- [ ] **Opportunity spawns** periodically (every ~25s)

### 7. MOBILE COMPATIBILITY
- [ ] **Landscape lock message** shown in portrait mode
- [ ] **Touch controls visible** and functional
- [ ] **Joystick positioned** correctly (not overlapping HUD)
- [ ] **All buttons reachable** with thumbs
- [ ] **Game doesn't crash** after 2+ minutes on phone
- [ ] **Start screen works** on mobile browsers
- [ ] **UI text readable** on small screens

### 8. WORLD DESIGN (Phase 4 / 8-Phase Plan)
- [ ] **Paths feel organic** — no rigid grid intersections
- [ ] **World feels open** — not enclosed or boxed
- [ ] **Buildings scattered naturally** — not in rows
- [ ] **Terrain has variation** — some elevation changes, not all flat
- [ ] **Background has depth** — distant buildings, hills, mountains visible
- [ ] **Sparkle particles present** across grass areas
- [ ] **Clouds drift** in the sky
- [ ] **Lamps glow** with subtle flicker
- [ ] **No overt financial imagery** — no piggy banks, no money symbols

---

## SCORING RUBRIC (Rate 1-10)

| Category | Weight | Score |
|----------|--------|-------|
| Movement & Controls | 20% | /10 |
| Visual Quality | 20% | /10 |
| Performance | 15% | /10 |
| Interaction Zones | 15% | /10 |
| Behavioral Tracking | 10% | /10 |
| Missions & Trails | 10% | /10 |
| Mobile Compatibility | 5% | /10 |
| World Design | 5% | /10 |
| **Weighted Total** | **100%** | **/10** |

---

## HOW TO RUN THIS REVIEW

### Quick Review (5 min):
1. Open the game link
2. Walk around for 2 minutes — check movement feel
3. Interact with 3 zones — check UI and signals
4. Open Chronicle (C key) — verify data
5. Check console for errors

### Full Review (15 min):
1. Run Quick Review
2. Visit all 10 zones and interact with each
3. Complete 1 mission
4. Check all 7 FLIQ domains have signals
5. Test on mobile device
6. Run performance check (F12 → Performance tab)
7. Score each category

### Automated Check (ask Claude):
```
Read the game files and run a QA review against workflows/qa_game_review.md.
Score each category 1-10 and list specific issues found.
```

---

## ROBLOX COMPARISON TARGETS

| Feature | Roblox Standard | Our Target |
|---------|----------------|------------|
| Movement speed | 16 studs/sec walk, 24 run | 45 walk, 55 sprint |
| Jump height | ~7.2 studs | Proportional |
| Camera style | Third-person orbit | Third-person orbit |
| World loading | Streaming/chunked | Single load + loading screen |
| Character | Humanoid R15 | Custom GLB biped |
| Terrain | Smooth terrain tool | Procedural hills + grass |
| Lighting | Future/ShadowMap | Three.js PCFSoft (desktop only) |
| UI style | CoreGui / Billboard | HTML overlay + 3D sprites |
| FPS target | 60 desktop, 30 mobile | Same |

---

## KNOWN ISSUES TO TRACK
- Mobile: game may lose WebGL context on low-end phones (recovery handler added)
- Preview GLBs from Meshy lack textures (need refine step for production quality)
- Character model uses merged animation file — individual clips may not name-match perfectly
- Sprint VFX (aura/particles) may impact mobile performance
