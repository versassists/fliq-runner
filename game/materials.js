/**
 * materials.js — Shared material pool.
 * Instead of creating new MeshStandardMaterial per object,
 * the entire game imports from here. Cuts GPU state switches dramatically.
 */
import * as THREE from 'three';

// ── Device detection (used by other modules too) ──
export const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ── Ground & Landscape ──
export const grassMat = new THREE.MeshStandardMaterial({ color: 0x7CCD7C, roughness: 0.9 });
export const grassOuterMat = new THREE.MeshStandardMaterial({ color: 0x66BB66, roughness: 0.9 });

// ── Paths ──
export const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xDDCCBB, roughness: 0.9 });

// ── Colorful street tiles (neon glow blocks) ──
export const tileMats = [
  new THREE.MeshStandardMaterial({ color: 0x00EEFF, emissive: 0x00BBCC, emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.1 }),
  new THREE.MeshStandardMaterial({ color: 0xFF66CC, emissive: 0xCC4499, emissiveIntensity: 0.3, roughness: 0.2, metalness: 0.1 }),
  new THREE.MeshStandardMaterial({ color: 0xBB77FF, emissive: 0x8844CC, emissiveIntensity: 0.3, roughness: 0.2, metalness: 0.1 }),
  new THREE.MeshStandardMaterial({ color: 0x66FF99, emissive: 0x33CC66, emissiveIntensity: 0.3, roughness: 0.2, metalness: 0.1 }),
  new THREE.MeshStandardMaterial({ color: 0xFFDD44, emissive: 0xCCAA22, emissiveIntensity: 0.25, roughness: 0.2, metalness: 0.1 }),
  new THREE.MeshStandardMaterial({ color: 0xFF8844, emissive: 0xCC5522, emissiveIntensity: 0.25, roughness: 0.2, metalness: 0.1 }),
];
export const tileBaseMat = new THREE.MeshStandardMaterial({ color: 0x2A2A3A, roughness: 0.8 });
export const tileGapMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.9 });

// ── Plain blue ground (open areas) ──
export const bluePlainMat = new THREE.MeshStandardMaterial({ color: 0x6699CC, roughness: 0.7 });
// ── Mountain / hill grass ──
export const hillGrassMat = new THREE.MeshStandardMaterial({ color: 0x5AAA5A, roughness: 0.9 });
export const hillDarkMat  = new THREE.MeshStandardMaterial({ color: 0x4A8A3A, roughness: 0.9 });
export const hillSnowMat  = new THREE.MeshStandardMaterial({ color: 0xEEEEFF, roughness: 0.6 });

// ── Wood (doors, benches, tables, legs, flower bed rims) ──
export const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 0.8 });
export const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x5C3A1E, roughness: 1.0 });

// ── Metal (street lamps, bench legs, trampoline legs) ──
export const metalMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.5 });
export const metalLightMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.4 });

// ── Stone (stepping stones, garden borders) ──
export const stoneMat = new THREE.MeshStandardMaterial({ color: 0xBBAAAA, roughness: 0.8 });
export const stoneGrayMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
export const stoneBasinMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.6, metalness: 0.3 });

// ── Trees ──
export const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 0.9 });
export const canopyMats = [
  new THREE.MeshStandardMaterial({ color: 0x44AA44, roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: 0x55BB55, roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: 0x66CC66, roughness: 0.9 }),
];

// ── Bushes ──
export const bushMats = [
  new THREE.MeshStandardMaterial({ color: 0x44CC44, roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: 0x55DD55, roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: 0x66EE66, roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: 0x33BB33, roughness: 0.9 }),
];

// ── Clouds ──
export const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });

// ── Lamp glow ──
export const lampGlowMat = new THREE.MeshStandardMaterial({
  color: 0xFFEECC, emissive: 0xFFDD88, emissiveIntensity: 0.3
});

// ── Windows ──
export const windowMat = new THREE.MeshStandardMaterial({
  color: 0x88DDFF, emissive: 0x44AADD, emissiveIntensity: 0.2, roughness: 0.2
});

// ── Chimney ──
export const chimneyMat = new THREE.MeshStandardMaterial({ color: 0xCC6644, roughness: 0.8 });

// ── Door ──
export const doorMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 });

// ── Awning colors (vibrant storefronts) ──
export const awningMats = [
  new THREE.MeshStandardMaterial({ color: 0xFF6688, roughness: 0.5 }),
  new THREE.MeshStandardMaterial({ color: 0x66BBFF, roughness: 0.5 }),
  new THREE.MeshStandardMaterial({ color: 0xFFCC44, roughness: 0.5 }),
  new THREE.MeshStandardMaterial({ color: 0x66DD88, roughness: 0.5 }),
  new THREE.MeshStandardMaterial({ color: 0xDD88FF, roughness: 0.5 }),
  new THREE.MeshStandardMaterial({ color: 0xFF8844, roughness: 0.5 }),
];

// ── Rooftop accent ──
export const roofAccentMat = new THREE.MeshStandardMaterial({
  color: 0xFFDD55, roughness: 0.4, emissive: 0xFFCC22, emissiveIntensity: 0.1
});

// ── Trampoline ──
export const trampolineFrameMat = new THREE.MeshStandardMaterial({ color: 0x4444DD, roughness: 0.5, metalness: 0.4 });
export const trampolinePadMat = new THREE.MeshStandardMaterial({
  color: 0xFF4488, roughness: 0.3, emissive: 0xFF2266, emissiveIntensity: 0.1
});

// ── Spark Ring Trail ──
export const sparkRingMat = new THREE.MeshStandardMaterial({
  color: 0x88DDFF, emissive: 0x44AAFF, emissiveIntensity: 0.4,
  transparent: true, opacity: 0.6, side: THREE.DoubleSide,
});

// ── Highlight stone (stepping stone endpoint) ──
export const highlightStoneMat = new THREE.MeshStandardMaterial({
  color: 0xFFDD44, roughness: 0.5, emissive: 0xFFAA22, emissiveIntensity: 0.15
});

// ── Flowers ──
export const flowerStemMat = new THREE.MeshStandardMaterial({ color: 0x44AA44 });
export const flowerPetalMats = [
  new THREE.MeshStandardMaterial({ color: 0xFF6699 }),
  new THREE.MeshStandardMaterial({ color: 0xFFAA33 }),
  new THREE.MeshStandardMaterial({ color: 0xFF4466 }),
  new THREE.MeshStandardMaterial({ color: 0xFFDD44 }),
  new THREE.MeshStandardMaterial({ color: 0xAA66FF }),
  new THREE.MeshStandardMaterial({ color: 0xFF88CC }),
];

// ── Spark orbs ──
export const sparkCoreMat = new THREE.MeshBasicMaterial({
  color: 0x88ddff, transparent: true, opacity: 0.9,
});
export const sparkGlowMat = new THREE.MeshBasicMaterial({
  color: 0xaaeeff, transparent: true, opacity: 0.3,
});
export const sparkParticleMat = new THREE.MeshBasicMaterial({
  color: 0x88ddff, transparent: true, opacity: 1,
});

// ── Player / NPC ──
export const skinMat = new THREE.MeshStandardMaterial({ color: 0xFFCC88, roughness: 0.5 });
export const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
export const smileMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
export const hairMat = new THREE.MeshStandardMaterial({ color: 0x3a2511, roughness: 0.9 });
export const shirtMat = new THREE.MeshStandardMaterial({ color: 0x4FC3F7, roughness: 0.6 });
export const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2255AA, roughness: 0.6 });
export const shoeMat = new THREE.MeshStandardMaterial({ color: 0xFF5533, roughness: 0.5 });
export const soleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
export const backpackMat = new THREE.MeshStandardMaterial({ color: 0xFFAA33, roughness: 0.7 });

// ── Interaction zone helpers ──
export const waterMat = new THREE.MeshStandardMaterial({
  color: 0x44AADD, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.7
});
export const pillarMat = new THREE.MeshStandardMaterial({ color: 0xAAAAAA, roughness: 0.5 });
export const orbGlowMat = new THREE.MeshBasicMaterial({ color: 0x88ddff, transparent: true, opacity: 0.7 });
