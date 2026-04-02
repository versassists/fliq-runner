import * as THREE from 'three';

export class ThirdPersonCamera {
  constructor(camera) {
    this.camera   = camera;
    this.yaw      = 0;
    this.pitch    = 0.35;
    this.distance = 14;

    // Zoom
    this.zoomLevel = 1;
    this.minZoom   = 0.5;
    this.maxZoom   = 2.5;

    // Vertical limits
    this.minPitch = 0.05;
    this.maxPitch = Math.PI / 2 - 0.05;

    // State
    this._isLocked   = false;
    this._currentPos = new THREE.Vector3();

    this._setupControls();
  }

  zoom(delta) {
    this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta));
  }

  _setupControls() {
    // ── Pointer Lock (click canvas → lock cursor → mouse = camera) ──
    document.addEventListener('pointerlockchange', () => {
      this._isLocked = document.pointerLockElement !== null;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this._isLocked) return;
      this.yaw   -= e.movementX * 0.002;
      this.pitch -= e.movementY * 0.002;
      this.pitch  = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
    });

    // ── Mouse-wheel zoom ──
    window.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom(Math.sign(e.deltaY) * 0.15);
    }, { passive: false });

    // ── Touch: pinch-zoom + right-side camera drag ──
    let touchStartDist = 0;
    let isPinching = false;
    let cameraTouchId = null;
    let lastTouchX = 0;
    let lastTouchY = 0;

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        isPinching = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.sqrt(dx * dx + dy * dy);
      } else if (e.touches.length === 1 && cameraTouchId === null) {
        // Right 55% of screen = camera drag
        if (e.touches[0].clientX > window.innerWidth * 0.45) {
          cameraTouchId = e.touches[0].identifier;
          lastTouchX = e.touches[0].clientX;
          lastTouchY = e.touches[0].clientY;
        }
      }
    });

    document.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && isPinching) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const cur = Math.sqrt(dx * dx + dy * dy);
        this.zoom((touchStartDist - cur) * 0.002);
        touchStartDist = cur;
      } else if (cameraTouchId !== null) {
        for (const touch of e.changedTouches) {
          if (touch.identifier === cameraTouchId) {
            const dx = touch.clientX - lastTouchX;
            const dy = touch.clientY - lastTouchY;
            this.yaw   -= dx * 0.004;
            this.pitch  = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch - dy * 0.004));
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
            e.preventDefault();
          }
        }
      }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) isPinching = false;
      for (const touch of e.changedTouches) {
        if (touch.identifier === cameraTouchId) {
          cameraTouchId = null;
        }
      }
    });
  }

  requestPointerLock(canvas) {
    canvas.requestPointerLock();
  }

  update(targetPos) {
    const dist = this.distance * this.zoomLevel;

    const offsetX = dist * Math.sin(this.yaw) * Math.cos(this.pitch);
    const offsetY = dist * Math.sin(this.pitch);
    const offsetZ = dist * Math.cos(this.yaw) * Math.cos(this.pitch);

    const desiredPos = new THREE.Vector3(
      targetPos.x + offsetX,
      targetPos.y + offsetY + 2,
      targetPos.z + offsetZ
    );

    // Smooth follow
    this._currentPos.lerp(desiredPos, 0.12);
    this.camera.position.copy(this._currentPos);
    this.camera.lookAt(targetPos.x, targetPos.y + 1.5, targetPos.z);
  }
}
