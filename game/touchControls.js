/**
 * touchControls.js — Virtual joystick + action buttons for mobile.
 * Only renders when touch is available. Writes to player.keys so
 * the existing movement system works unchanged.
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

    // ── Joystick (left side) ──
    this._createJoystick();

    // ── Action buttons (right side) ──
    this._createButtons();

    // Track touches
    this._joystickTouchId = null;
    this._joystickCenter = { x: 0, y: 0 };
    this._joystickDelta  = { x: 0, y: 0 };

    document.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    document.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    document.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });
    document.addEventListener('touchcancel', (e) => this._onTouchEnd(e), { passive: false });
  }

  get isActive() { return this._active; }

  _createJoystick() {
    // Outer ring
    this._joyOuter = document.createElement('div');
    this._joyOuter.style.cssText = `
      position:fixed; bottom:80px; left:40px;
      width:120px; height:120px; border-radius:50%;
      background:rgba(255,255,255,0.08);
      border:2px solid rgba(170,136,255,0.3);
      pointer-events:auto; touch-action:none;
    `;
    this._container.appendChild(this._joyOuter);

    // Inner knob
    this._joyInner = document.createElement('div');
    this._joyInner.style.cssText = `
      position:absolute; top:50%; left:50%;
      width:50px; height:50px; border-radius:50%;
      background:rgba(136,221,255,0.4);
      border:2px solid rgba(136,221,255,0.6);
      transform:translate(-50%,-50%);
      pointer-events:none;
    `;
    this._joyOuter.appendChild(this._joyInner);
  }

  _createButtons() {
    const btnStyle = (bottom, right, label, color) => {
      const btn = document.createElement('div');
      btn.textContent = label;
      btn.style.cssText = `
        position:fixed; bottom:${bottom}px; right:${right}px;
        width:60px; height:60px; border-radius:50%;
        background:rgba(${color},0.15);
        border:2px solid rgba(${color},0.4);
        color:rgba(255,255,255,0.7); font-size:11px; font-weight:bold;
        display:flex; align-items:center; justify-content:center;
        pointer-events:auto; touch-action:none;
        user-select:none; -webkit-user-select:none;
      `;
      this._container.appendChild(btn);
      return btn;
    };

    this._btnJump    = btnStyle(80, 40, 'JUMP', '136,221,255');
    this._btnSprint  = btnStyle(155, 40, 'RUN', '255,170,68');
    this._btnInteract = btnStyle(80, 115, 'E', '170,136,255');

    // Button touch handlers
    this._setupButtonTouch(this._btnJump, 'space');
    this._setupButtonTouch(this._btnSprint, 'shift');
    this._setupButtonTouch(this._btnInteract, 'e');
  }

  _setupButtonTouch(btn, keyName) {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.style.opacity = '0.8';
      if (keyName === 'e') {
        // Simulate E keypress for interaction system
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
      } else {
        this.keys[keyName] = true;
      }
    }, { passive: false });

    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      btn.style.opacity = '1';
      if (keyName === 'e') {
        document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true }));
      } else {
        this.keys[keyName] = false;
      }
    }, { passive: false });
  }

  _onTouchStart(e) {
    for (const touch of e.changedTouches) {
      // Only capture joystick touches on left 45% of screen
      if (touch.clientX < window.innerWidth * 0.45 && this._joystickTouchId === null) {
        // Check if touch is near the joystick area (bottom-left)
        if (touch.clientY > window.innerHeight * 0.4) {
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
        this._joystickDelta.x = 0;
        this._joystickDelta.y = 0;
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
    const maxDist = 50;
    const clampDist = Math.min(dist, maxDist);
    const angle = Math.atan2(dy, dx);

    const nx = Math.cos(angle) * clampDist;
    const ny = Math.sin(angle) * clampDist;

    // Move knob
    this._joyInner.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;

    // Normalize to -1..1
    const normX = nx / maxDist;
    const normY = ny / maxDist;

    // Map to WASD with deadzone
    const deadzone = 0.2;
    this.keys.w = normY < -deadzone;
    this.keys.s = normY > deadzone;
    this.keys.a = normX < -deadzone;
    this.keys.d = normX > deadzone;
  }
}
