// ── Spendtopia Color Palette ──────────────────────────────────────
export const COLORS = {
  // Candy-bright Spendtopia palette from the design brief
  CITRUS_ORANGE:  0xFF9F45,
  PLAYFUL_PINK:   0xFF6B9D,
  SKY_BLUE:       0x4FC3F7,
  MINT_GREEN:     0xA8E6CF,
  GOLDEN:         0xFFD93D,
  LIME:           0x6BCB77,

  // Player
  PLAYER_BODY:    0xFF6B9D,   // playful pink body
  PLAYER_HEAD:    0xFFB347,   // warm orange head
  PLAYER_EYES:    0x2C3E50,
  BACKPACK:       0xFF8DC7,   // light pink piggy backpack

  // Collectibles
  COIN:           0xFFD700,
  COIN_SHINE:     0xFFF8DC,

  // Obstacles
  DEBT_BLOCK:     0x7B2D8B,   // dark purple
  RECEIPT:        0xFFFFF0,   // ivory

  // World
  GROUND:         0x98FB98,   // mint green grass
  SKY_TOP:        0x87CEEB,

  // Power-ups
  SHIELD_COLOR:   0x4FC3F7,
  ROCKET_COLOR:   0xFFD93D,
  MAGNET_COLOR:   0xFF6B9D,

  // Platform palette (randomly chosen per platform)
  PLATFORM_PALETTE: [0xFF9F45, 0xFF6B9D, 0x4FC3F7, 0xA8E6CF, 0xFFD93D, 0x6BCB77],

  // Goal portal
  GOAL_RING:      0xFFD700,
  GOAL_STAR:      0xFFFFFF,
};

// ── Physics Constants ────────────────────────────────────────────
export const PHYSICS = {
  GRAVITY:          -40,    // Roblox uses ~196.2 studs/s² ≈ heavier gravity for snappy jumps
  WALK_SPEED:        55,
  SPRINT_SPEED:      72,
  JUMP_IMPULSE:      14,    // Higher impulse + heavier gravity = fast snappy jump
  DOUBLE_JUMP_IMPULSE: 12,
  CLIMB_SPEED:       4,
  LINEAR_DAMPING:    0,
  ANGULAR_DAMPING:   1.0,
  SPRINT_SPARK_COST: 1,     // Spark per 3 seconds of sprinting
};

// ── Game Settings ────────────────────────────────────────────────
export const GAME = {
  MAX_HEARTS:           3,
  COIN_VALUE:           10,
  ENEMY_KILL_BONUS:     100,
  QUIZ_CORRECT_BONUS:   50,
  QUIZ_CORRECT_COINS:   5,
  INVINCIBILITY_FRAMES: 90,   // ~1.5 seconds at 60fps
  FALL_DEATH_Y:        -15,   // Y below which player dies and respawns
};
