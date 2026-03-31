// All sounds are generated procedurally via Web Audio API — no external files needed.

export class AudioManager {
  constructor() {
    this._ctx          = null;
    this._bgLoopHandle = null;
    this._bgStarted    = false;
    this._bgGain       = null;
  }

  _ctx_get() {
    if (!this._ctx) {
      try {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null; // Audio not available — game continues silently
      }
    }
    return this._ctx;
  }

  // ── Coin "ChaChing" ──────────────────────────────────────────
  playCoin() {
    const ctx = this._ctx_get();
    if (!ctx) return;
    const t   = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.28, t);
    master.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    master.connect(ctx.destination);

    // High glide
    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.setValueAtTime(880, t);
    o1.frequency.linearRampToValueAtTime(1320, t + 0.09);
    o1.connect(master);
    o1.start(t); o1.stop(t + 0.32);

    // Harmonic base
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.12, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    g2.connect(ctx.destination);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 440;
    o2.connect(g2);
    o2.start(t); o2.stop(t + 0.22);
  }

  // ── Hurt ──────────────────────────────────────────────────────
  playHurt() {
    const ctx  = this._ctx_get();
    if (!ctx) return;
    const t    = ctx.currentTime;
    const size = Math.floor(ctx.sampleRate * 0.18);
    const buf  = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filt = ctx.createBiquadFilter();
    filt.type            = 'bandpass';
    filt.frequency.value = 350;
    filt.Q.value         = 2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    src.connect(filt); filt.connect(g); g.connect(ctx.destination);
    src.start(t);
  }

  // ── Level Complete ─────────────────────────────────────────────
  playLevelComplete() {
    const ctx   = this._ctx_get();
    if (!ctx) return;
    const t     = ctx.currentTime;
    // C major arpeggio: C E G C (ascend)
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + i * 0.13);
      g.gain.linearRampToValueAtTime(0.22, t + i * 0.13 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.13 + 0.45);
      g.connect(ctx.destination);

      const o = ctx.createOscillator();
      o.type            = 'square';
      o.frequency.value = freq;
      o.connect(g);
      o.start(t + i * 0.13);
      o.stop(t  + i * 0.13 + 0.5);
    });
  }

  // ── Power-up jingle ───────────────────────────────────────────
  playPowerup() {
    const ctx = this._ctx_get();
    if (!ctx) return;
    const t   = ctx.currentTime;
    [440, 550, 660, 880].forEach((freq, i) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.25);
      g.connect(ctx.destination);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t + i * 0.07);
      o.frequency.linearRampToValueAtTime(freq * 1.25, t + i * 0.07 + 0.12);
      o.connect(g);
      o.start(t + i * 0.07);
      o.stop( t + i * 0.07 + 0.3);
    });
  }

  // ── Background Music (looping melody) ────────────────────────
  startBgMusic() {
    if (this._bgStarted) return;
    this._bgStarted = true;

    const ctx    = this._ctx_get();
    if (!ctx) return;
    this._bgGain = ctx.createGain();
    this._bgGain.gain.value = 0.07;
    this._bgGain.connect(ctx.destination);

    this._playBgLoop();
  }

  _playBgLoop() {
    const ctx    = this._ctx_get();
    if (!ctx || !this._bgGain) return;
    const master = this._bgGain;
    const tempo  = 0.32; // seconds per beat

    // Cheerful 8-note melody (C major pentatonic-ish)
    const melody = [
      [523, 0], [659, 1], [784, 2], [659, 3],
      [880, 4], [784, 5], [659, 6], [523, 7],
    ];

    // Bass notes (octave lower)
    const bass = [
      [262, 0], [262, 2], [294, 4], [294, 6],
    ];

    const startT = ctx.currentTime + 0.05;

    melody.forEach(([freq, beat]) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.8, startT + beat * tempo);
      g.gain.exponentialRampToValueAtTime(0.001, startT + beat * tempo + tempo * 0.85);
      g.connect(master);
      const o = ctx.createOscillator();
      o.type            = 'square';
      o.frequency.value = freq;
      o.connect(g);
      o.start(startT + beat * tempo);
      o.stop( startT + beat * tempo + tempo * 0.9);
    });

    bass.forEach(([freq, beat]) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.6, startT + beat * tempo);
      g.gain.exponentialRampToValueAtTime(0.001, startT + beat * tempo + tempo * 1.9);
      g.connect(master);
      const o = ctx.createOscillator();
      o.type            = 'triangle';
      o.frequency.value = freq;
      o.connect(g);
      o.start(startT + beat * tempo);
      o.stop( startT + beat * tempo + tempo * 2);
    });

    const loopMs = melody.length * tempo * 1000;
    this._bgLoopHandle = setTimeout(() => this._playBgLoop(), loopMs);
  }

  stopBgMusic() {
    if (this._bgLoopHandle) clearTimeout(this._bgLoopHandle);
    this._bgStarted = false;
  }
}
