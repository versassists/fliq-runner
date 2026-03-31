// ── Level 1: Spending Street ─────────────────────────────────────
// A colorful suburban shopping district — introduction to needs vs wants.
// Orange, pink, sky-blue, and mint platforms rising from a mint-green ground.

export const LEVEL1 = {
  name: 'Level 1: Spending Street',
  skyColor:   0x87CEEB,   // classic sky blue
  groundColor: 0x98FB98,  // mint green
  fogColor:   0xD4F1FF,
  fogDensity: 0.015,

  // ── Platforms ─────────────────────────────────────────────────
  // Schema: [x, y, z, width, height, depth, colorHex]
  // x/z are center, y is top surface center, w/h/d in world units
  platforms: [
    // Starting plaza — large, flat, citrus orange
    [0,    0,  0, 22, 1, 22, 0xFF9F45],

    // First hop (pink)
    [17,   1.5, 0,  8, 1,  8, 0xFF6B9D],

    // Sky-blue bridge
    [27,   2,   0, 14, 1,  7, 0x4FC3F7],

    // Mint stepping stones
    [38,   3,   0,  5, 1,  5, 0xA8E6CF],
    [44,   4,   3,  5, 1,  5, 0xFFD93D],
    [50,   3.5, 0,  5, 1,  5, 0xFF9F45],

    // Mall roof — wide pink platform
    [62,   4,   0, 16, 1, 10, 0xFF6B9D],

    // High climb — small stepping platforms
    [75,   6,   0,  6, 1,  6, 0x4FC3F7],
    [83,   8,  -4,  6, 1,  6, 0xA8E6CF],
    [83,   8,   4,  6, 1,  6, 0xFFD93D],

    // Mid bridge — orange
    [93,   9,   0, 14, 1,  8, 0xFF9F45],

    // Gap challenge
    [110,  9,   0,  6, 1,  6, 0xFF6B9D],
    [120, 10,   0,  6, 1,  6, 0x4FC3F7],

    // Final approach — mint
    [130, 10,   0,  8, 1,  8, 0xA8E6CF],
    [140, 11,   0,  6, 1,  6, 0xFFD93D],

    // Goal platform — bright orange, large
    [152, 12,   0, 14, 1, 14, 0xFF9F45],

    // Optional side path (bonus coins)
    [44,   4,  -8,  5, 1,  5, 0xFF6B9D],
    [50,   5,  -8,  5, 1,  5, 0xA8E6CF],
    [56,   5.5,-5,  5, 1,  5, 0x4FC3F7],
  ],

  // ── FLIQ Coins ────────────────────────────────────────────────
  // [x, y, z] — y is automatically placed 1.5 units above the platform
  coins: [
    // Starting plaza row
    [-3, 1.8,  0], [0,  1.8,  0], [3,  1.8,  0],
    // First hop
    [17, 3.2,  0],
    // Bridge
    [24, 3.8,  0], [27, 3.8,  0], [30, 3.8,  0],
    // Stepping stones
    [38, 4.8,  0], [44, 5.8,  3], [50, 5.3,  0],
    // Mall roof
    [59, 5.8,  0], [62, 5.8,  0], [65, 5.8,  0],
    [62, 5.8,  3], [62, 5.8, -3],
    // High climb
    [75, 7.8,  0], [83, 9.8, -4], [83, 9.8,  4],
    // Mid bridge
    [90, 10.8, 0], [93, 10.8, 0], [96, 10.8, 0],
    // Gap challenge
    [110,10.8, 0], [120,11.8, 0],
    // Final approach
    [127,11.8, 0], [130,11.8, 0], [133,11.8, 0],
    [140,12.8, 0],
    // Goal area cluster
    [149,13.8, 0], [152,13.8, 0], [155,13.8, 0],
    [152,13.8, 3], [152,13.8,-3],
    // Side path bonus
    [44,  5.8,-8], [50,  6.8,-8], [53,  7.2,-6],
  ],

  // ── Obstacles ─────────────────────────────────────────────────
  obstacles: [
    { type: 'falling_receipt', x: 27,  y: 14,  z:  0, interval: 2200 },
    { type: 'debt_block',      x: 62,  y: 5.5, z:  0, patrolRange: 6  },
    { type: 'falling_receipt', x: 93,  y: 18,  z:  0, interval: 1900 },
    { type: 'debt_block',      x: 130, y: 11.5,z:  0, patrolRange: 3.5},
  ],

  // ── Quiz Trigger Zones ────────────────────────────────────────
  // Quiz fires when player enters radius (XZ distance from trigger center)
  quizTriggers: [
    { x:  17, y: 0, z: 0, radius: 3.5 },  // on first hop
    { x:  62, y: 0, z: 0, radius: 4   },  // on mall roof
    { x: 120, y: 0, z: 0, radius: 3.5 },  // gap challenge
  ],

  // ── Power-Ups ─────────────────────────────────────────────────
  powerups: [
    { type: 'shield', x:  44, y: 5.8, z:  3  },  // on stepping stone
    { type: 'rocket', x:  93, y: 11,  z:  3  },  // on mid bridge
    { type: 'magnet', x: 140, y: 13,  z:  0  },  // near goal
  ],

  // ── Decorations ───────────────────────────────────────────────
  decorations: [
    { type: 'tree', x: -6,  y: -0.5, z: -7 },
    { type: 'tree', x: -9,  y: -0.5, z:  6 },
    { type: 'tree', x: -12, y: -0.5, z: -2 },
    { type: 'tree', x:  6,  y: -0.5, z: -9 },
    { type: 'building', x: 70, y: -0.5, z: 14, w: 6, h: 8, d: 6, color: 0xFFB347 },
    { type: 'building', x: 35, y: -0.5, z:-12, w: 5, h: 6, d: 5, color: 0x87CEEB },
  ],

  // ── Level Bounds ──────────────────────────────────────────────
  goalPosition: { x: 152, y: 14, z: 0 },
  goalRadius:   3.5,
  spawnPosition: { x: 0, y: 3, z: 0 },

  // ── Villain ───────────────────────────────────────────────────
  enemies: [
    { type: 'collector', x: 62, y: 5.5, z: 0 },
  ],
};
