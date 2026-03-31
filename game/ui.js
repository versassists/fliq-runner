export class UIManager {
  constructor() {
    this._score         = document.getElementById('score');
    this._coins         = document.getElementById('fliq-coins');
    this._hearts        = document.getElementById('hearts');
    this._levelName     = document.getElementById('level-name');
    this._powerup       = document.getElementById('powerup-indicator');
    this._flash         = document.getElementById('screen-flash');

    this._startScreen   = document.getElementById('start-screen');
    this._gameOver      = document.getElementById('game-over-screen');
    this._lvlComplete   = document.getElementById('level-complete-screen');
    this._victory       = document.getElementById('victory-screen');

    this._finalScore    = document.getElementById('final-score');
    this._completeScore = document.getElementById('complete-score');
    this._victoryScore  = document.getElementById('victory-score');

    this._powerupTimer  = null;
  }

  // ── HUD ──────────────────────────────────────────────────────
  updateScore(score, coins) {
    if (this._score) this._score.textContent = `Score: ${score.toLocaleString()}`;
    if (this._coins) this._coins.textContent = `🪙 ${coins} FLIQ`;
  }

  updateHearts(hearts) {
    const h = Math.max(0, Math.min(3, hearts));
    if (this._hearts)
      this._hearts.textContent = '❤️'.repeat(h) + '🖤'.repeat(3 - h);
  }

  setLevelName(name) {
    if (this._levelName) this._levelName.textContent = name;
  }

  showPowerup(type) {
    const labels = {
      shield: '🛡️ Emergency Shield!',
      rocket: '🚀 Liquidity Rush!',
      magnet: '🧲 Bull Run Magnet!',
    };
    if (!this._powerup) return;
    this._powerup.textContent = labels[type] ?? '✨ Power-Up!';
    this._powerup.classList.remove('hidden');
    clearTimeout(this._powerupTimer);
    this._powerupTimer = setTimeout(() => this._powerup.classList.add('hidden'), 3200);
  }

  flashScreen(color) {
    if (!this._flash) return;
    this._flash.style.backgroundColor = color;
    this._flash.style.opacity          = '0.45';
    // The CSS transition handles the fade-out automatically
    setTimeout(() => { this._flash.style.opacity = '0'; }, 50);
  }

  // ── Overlay screens ───────────────────────────────────────────
  showStartScreen()   { this._show(this._startScreen); }
  hideStartScreen()   { this._hide(this._startScreen); }

  showGameOver(score) {
    if (this._finalScore) this._finalScore.textContent = `Score: ${score.toLocaleString()}`;
    this._show(this._gameOver);
  }
  hideGameOver()      { this._hide(this._gameOver); }

  showLevelComplete(score) {
    if (this._completeScore) this._completeScore.textContent = `Score: ${score.toLocaleString()}`;
    this._show(this._lvlComplete);
  }
  hideLevelComplete() { this._hide(this._lvlComplete); }

  showVictory(score) {
    if (this._victoryScore) this._victoryScore.textContent = `Final Score: ${score.toLocaleString()}`;
    this._show(this._victory);
  }
  hideVictory()       { this._hide(this._victory); }

  // ── Helpers ───────────────────────────────────────────────────
  _show(el) { if (el) el.classList.remove('hidden'); }
  _hide(el) { if (el) el.classList.add('hidden'); }
}
