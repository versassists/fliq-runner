/**
 * touchControls.js — Roblox-style mobile controls.
 * Left side: Virtual joystick for movement
 * Right side: Drag to rotate camera + Jump button + Interact button
 * Pinch: Zoom camera
 */

export class TouchControls {
  constructor(playerKeys) {
    this.keys = playerKeys;
    this._active = false;

    if (!('ontouchstart' in window)) return;
    this._active = true;

    // ── Container ──
    this._container = document.createElement('div');
    this._container.id = 'touch-controls';
    this._container.style.cssText = `
      position:fixed; top:0; left:0; width:100vw; height:100vh;
      pointer-events:none; z-index:50;
    `;
    document.body.appendChild(this._container);

    this._createJoystick();
    this._createButtons();

    // Touch tracking
    this._joystickTouchId = null;
    this._joystickCenter = { x: 0, y: 0 };

    document.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    document.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    document.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });
    document.addEventListener('touchcancel', (e) => this._onTouchEnd(e), { passive: false });
  }

  get isActive() { return this._active; }

  _createJoystick() {
    // Outer ring — larger for easier thumb control
    this._joyOuter = document.createElement('div');
    this._joyOuter.style.cssText = `
      position:fixed; bottom:30px; left:20px;
      width:140px; height:140px; border-radius:50%;
      background:rgba(0,0,0,0.15);
      border:3px solid rgba(255,255,255,0.2);
      pointer-events:auto; touch-action:none;
    `;
    this._container.appendChild(this._joyOuter);

    // Inner knob — bigger for visibility
    this._joyInner = document.createElement('div');
    this._joyInner.style.cssText = `
      position:absolute; top:50%; left:50%;
      width:60px; height:60px; border-radius:50%;
      background:rgba(255,255,255,0.3);
      border:3px solid rgba(255,255,255,0.5);
      transform:translate(-50%,-50%);
      pointer-events:none;
    `;
    this._joyOuter.appendChild(this._joyInner);
  }

  _createButtons() {
    // ── JUMP button (large, bottom-right — Roblox style) ──
    this._btnJump = document.createElement('div');
    this._btnJump.innerHTML = '&#9650;'; // up arrow
    this._btnJump.style.cssText = `
      position:fixed; bottom:30px; right:20px;
      width:80px; height:80px; border-radius:50%;
      background:rgba(68,221,255,0.2);
      border:3px solid rgba(68,221,255,0.5);
      color:rgba(255,255,255,0.8); font-size:24px; font-weight:bold;
      display:flex; align-items:center; justify-content:center;
      pointer-events:auto; touch-action:none;
      user-select:none; -webkit-user-select:none;
    `;
    this._container.appendChild(this._btnJump);

    // ── INTERACT button (E — above jump) ──
    this._btnInteract = document.createElement('div');
    this._btnInteract.textContent = 'E';
    this._btnInteract.style.cssText = `
      position:fixed; bottom:125px; right:25px;
      width:60px; height:60px; border-radius:50%;
      background:rgba(170,136,255,0.2);
      border:3px solid rgba(170,136,255,0.5);
      color:rgba(255,255,255,0.8); font-size:18px; font-weight:bold;
      display:flex; align-items:center; justify-content:center;
      pointer-events:auto; touch-action:none;
      user-select:none; -webkit-user-select:none;
    `;
    this._container.appendChild(this._btnInteract);

    // ── SPRINT button (small, above joystick) ──
    this._btnSprint = document.createElement('div');
    this._btnSprint.textContent = 'RUN';
    this._btnSprint.style.cssText = `
      position:fixed; bottom:185px; left:55px;
      width:50px; height:50px; border-radius:50%;
      background:rgba(255,170,68,0.15);
      border:2px solid rgba(255,170,68,0.4);
      color:rgba(255,255,255,0.7); font-size:10px; font-weight:bold;
      display:flex; align-items:center; justify-content:center;
      pointer-events:auto; touch-action:none;
      user-select:none; -webkit-user-select:none;
    `;
    this._container.appendChild(this._btnSprint);

    // Button handlers
    this._setupButtonTouch(this._btnJump, 'space');
    this._setupButtonTouch(this._btnSprint, 'shift');
    this._setupButtonTouch(this._btnInteract, 'e');
  }

  _setupButtonTouch(btn, keyName) {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.style.background = btn.style.background.replace('0.2', '0.5').replace('0.15', '0.4');
      if (keyName === 'e') {
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
      } else {
        this.keys[keyName] = true;
      }
    }, { passive: false });

    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.style.background = btn.style.background.replace('0.5', '0.2').replace('0.4', '0.15');
      if (keyName === 'e') {
        document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true }));
      } else {
        this.keys[keyName] = false;
      }
    }, { passive: false });
  }

  _onTouchStart(e) {
    for (const touch of e.changedTouches) {
      // Left 40% of screen = joystick area
      if (touch.clientX < window.innerWidth * 0.4 && this._joystickTouchId === null) {
        if (touch.clientY > window.innerHeight * 0.3) {
          this._joystickTouchId = touch.identifier;
          const rect = this._joyOuter.getBoundingClientRect();
          this._joystickCenter.x = rect.left + rect.width / 2;
          this._joystickCenter.y = rect.top + rect.height / 2;
          this._updateJoystick(touch.clientX, touch.clientY);
          e.preventDefault();
        }
      }
    }
  }

  _onTouchMove(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === this._joystickTouchId) {
        this._updateJoystick(touch.clientX, touch.clientY);
        e.preventDefault();
      }
    }
  }

  _onTouchEnd(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === this._joystickTouchId) {
        this._joystickTouchId = null;
        this._joyInner.style.transform = 'translate(-50%,-50%)';
        this.keys.w = false;
        this.keys.a = false;
        this.keys.s = false;
        this.keys.d = false;
      }
    }
  }

  _updateJoystick(touchX, touchY) {
    const dx = touchX - this._joystickCenter.x;
    const dy = touchY - this._joystickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = 55;
    const clampDist = Math.min(dist, maxDist);
    const angle = Math.atan2(dy, dx);

    const nx = Math.cos(angle) * clampDist;
    const ny = Math.sin(angle) * clampDist;

    this._joyInner.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;

    const normX = nx / maxDist;
    const normY = ny / maxDist;

    const deadzone = 0.2;
    this.keys.w = normY < -deadzone;
    this.keys.s = normY > deadzone;
    this.keys.a = normX < -deadzone;
    this.keys.d = normX > deadzone;
  }
}
