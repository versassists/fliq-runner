// ── Level 2: Savings Summit ───────────────────────────────────────
// A cool teal mountain environment — teaching delayed gratification and saving habits.
// TODO: Full layout coming in Phase 4 (generate with tools/generate_level.py --level 2)

export const LEVEL2 = {
  name: 'Level 2: Savings Summit',
  skyColor:    0x6EC6CA,  // teal sky
  groundColor: 0x7FB069,  // green hill
  fogColor:    0xC8EFE0,
  fogDensity:  0.015,

  platforms: [
    // Starter
    [0,    0,   0, 18, 1, 18, 0x7FDBFF],
    [14,   2,   0,  8, 1,  8, 0xFFDC00],
    [24,   3.5, 0, 10, 1,  6, 0x2ECC40],
    [36,   5,   0,  6, 1,  6, 0x7FDBFF],
    [44,   6.5, 3,  6, 1,  6, 0xFFDC00],
    [52,   6,   0,  6, 1,  6, 0x01FF70],
    [62,   7,   0, 12, 1,  8, 0x7FDBFF],
    [76,   9,   0,  6, 1,  6, 0x2ECC40],
    [84,  11,  -4,  5, 1,  5, 0xFFDC00],
    [84,  11,   4,  5, 1,  5, 0x01FF70],
    [92,  12,   0, 10, 1,  8, 0x7FDBFF],
    [106, 12,   0,  5, 1,  5, 0xFFDC00],
    [114, 13,   0,  5, 1,  5, 0x2ECC40],
    [122, 13,   0,  8, 1,  8, 0x7FDBFF],
    [132, 14,   0, 12, 1, 12, 0xFFDC00],  // Goal platform
  ],

  coins: [
    [0,  1.8,  0], [3,  1.8,  0], [-3, 1.8,  0],
    [14, 3.8,  0],
    [21, 5.2,  0], [24, 5.2,  0], [27, 5.2,  0],
    [36, 6.8,  0], [44, 8.3,  3], [52, 7.8,  0],
    [59, 8.8,  0], [62, 8.8,  0], [65, 8.8,  0],
    [76, 10.8, 0], [84, 12.8,-4], [84, 12.8, 4],
    [89, 13.8, 0], [92, 13.8, 0], [95, 13.8, 0],
    [106,13.8, 0], [114,14.8, 0],
    [119,14.8, 0], [122,14.8, 0], [125,14.8, 0],
    [132,15.8, 0], [135,15.8, 0], [132,15.8, 3], [132,15.8,-3],
  ],

  obstacles: [
    { type: 'falling_receipt', x: 24, y: 15, z: 0, interval: 2100 },
    { type: 'debt_block',      x: 62, y: 8,  z: 0, patrolRange: 5  },
    { type: 'slime',           x: 92, y: 13, z: 3 },
    { type: 'debt_block',      x: 122,y: 14, z: 0, patrolRange: 3  },
  ],

  quizTriggers: [
    { x:  14, y: 0, z: 0, radius: 3.5 },
    { x:  62, y: 0, z: 0, radius: 4   },
    { x: 114, y: 0, z: 0, radius: 3.5 },
  ],

  powerups: [
    { type: 'shield', x: 44, y: 8.3, z: 3 },
    { type: 'rocket', x: 92, y: 14,  z: 3 },
    { type: 'magnet', x: 132,y: 15.5,z: 0 },
  ],

  decorations: [
    { type: 'tree', x: -5,  y: -0.5, z: -6 },
    { type: 'tree', x: -8,  y: -0.5, z:  5 },
    { type: 'tree', x:  5,  y: -0.5, z: -8 },
  ],

  goalPosition:  { x: 132, y: 15.5, z: 0 },
  goalRadius:    3.5,
  spawnPosition: { x: 0, y: 3, z: 0 },

  enemies: [
    { type: 'collector', x: 62, y: 8, z: 0 },
  ],
};
