import * as THREE from 'three';

export class ThirdPersonCamera {
  constructor(camera) {
    this.camera   = camera;
    this.yaw      = 0;     // horizontal rotation (radians)
    this.pitch    = 0.35;  // vertical angle — Roblox-like (slightly above shoulder)
    this.distance = 14;    // Roblox-like camera distance

    // ── Zoom ──
    this.zoomLevel    = 1;
    this.minZoom      = 0.5;
    this.maxZoom      = 2.5;

    // ── Vertical angle limits ──
    this.minPitch = 0.1;
    this.maxPitch = Math.PI / 2 - 0.1;

    // ── Drag state (right-click / touch) ──
    this._isDragging = false;
    this._lastMouseX = 0;
    this._lastMouseY = 0;

    // ── First-person toggle ──
    this.isFirstPerson = false;

    this._currentPos = new THREE.Vector3();
    this._isLocked   = false;

    this._setupControls();
  }

  /* ─────────── Zoom helpers ─────────── */
  zoom(delta) {
    this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta));
  }

  toggleViewMode() { this.isFirstPerson = !this.isFirstPerson; }

  /* ─────────── Input Setup ─────────── */
  _setupControls() {
    // ── Pointer lock (legacy – still works for FPS-style rotation) ──
    document.addEventListener('pointerlockchange', () => {
      this._isLocked = document.pointerLockElement !== null;
    });

    // ── Free mouse camera (Roblox-style — move mouse to rotate, no click needed) ──
    this._lastMouseX = window.innerWidth / 2;
    this._lastMouseY = window.innerHeight / 2;
    this._mouseActive = false;

    document.addEventListener('mousemove', (e) => {
      // Pointer-lock rotation
      if (this._isLocked) {
        this.yaw   -= e.movementX * 0.003;
        this.pitch -= e.movementY * 0.003;
        this.pitch  = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
        return;
      }

      // Free camera: mouse movement rotates camera (no click needed)
      if (this._mouseActive) {
        const dx = e.clientX - this._lastMouseX;
        const dy = e.clientY - this._lastMouseY;
        this.yaw   -= dx * 0.003;
        this.pitch  = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch - dy * 0.003));
      }
      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;
    });

    // Activate free camera after first click on canvas
    document.addEventListener('click', (e) => {
      if (e.target.tagName === 'CANVAS') {
        this._mouseActive = true;
      }
    });

    // Deactivate when clicking UI elements
    document.addEventListener('mousedown', (e) => {
      if (e.target.tagName !== 'CANVAS') {
        this._mouseActive = false;
      }
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // ── Mouse-wheel zoom ──
    window.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom(Math.sign(e.deltaY) * 0.15);
    }, { passive: false });

    // ── Keyboard zoom & view toggle ──
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Equal'  || e.code === 'NumpadAdd')      this.zoom(-0.2);
      if (e.code === 'Minus'  || e.code === 'NumpadSubtract') this.zoom(0.2);
      if (e.code === 'KeyV') this.toggleViewMode();
    });

    // ── Touch: pinch-zoom & single-finger camera drag ──
    let touchStartDist = 0;
    let isPinching     = false;

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        isPinching = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.sqrt(dx * dx + dy * dy);
      } else if (e.touches.length === 1 && e.touches[0].clientX > window.innerWidth * 0.6) {
        // Right-side touch → camera drag
        this._isDragging = true;
        this._lastMouseX = e.touches[0].clientX;
        this._lastMouseY = e.touches[0].clientY;
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
      } else if (this._isDragging && e.touches.length === 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - this._lastMouseX;
        const dy = e.touches[0].clientY - this._lastMouseY;
        this.yaw   -= dx * 0.005;
        this.pitch  = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch - dy * 0.005));
        this._lastMouseX = e.touches[0].clientX;
        this._lastMouseY = e.touches[0].clientY;
      }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) isPinching = false;
      this._isDragging = false;
    });
  }

  requestPointerLock(canvas) {
    canvas.requestPointerLock();
  }

  /* ─────────── Per-frame camera update ─────────── */
  update(targetPosition) {
    if (this.isFirstPerson) {
      // ── First-person view ──
      const eyeHeight = 1.5;
      const target    = new THREE.Vector3(targetPosition.x, targetPosition.y + eyeHeight, targetPosition.z);
      this._currentPos.lerp(target, 0.15);
      this.camera.position.copy(this._currentPos);

      const lookDist = 5;
      this.camera.lookAt(
        targetPosition.x + Math.sin(this.yaw) * lookDist,
        targetPosition.y + eyeHeight,
        targetPosition.z + Math.cos(this.yaw) * lookDist
      );

      // Widen FOV for first person
      this.camera.fov += (75 - this.camera.fov) * 0.1;
    } else {
      // ── Third-person orbit camera ──
      const dist = this.distance * this.zoomLevel;

      const cosP = Math.cos(this.pitch);
      const sinP = Math.sin(this.pitch);

      const offsetX = Math.sin(this.yaw) * dist * cosP;
      const offsetY = sinP * dist;
      const offsetZ = Math.cos(this.yaw) * dist * cosP;

      const idealPos = new THREE.Vector3(
        targetPosition.x + offsetX,
        targetPosition.y + offsetY,
        targetPosition.z + offsetZ
      );

      // Smooth lerp
      this._currentPos.lerp(idealPos, 0.1);
      this.camera.position.copy(this._currentPos);

      // Look at player with slight vertical offset
      const lookY = targetPosition.y + 1 + (2 * this.zoomLevel * 0.1);
      this.camera.lookAt(targetPosition.x, lookY, targetPosition.z);

      // Adjust FOV based on zoom
      const targetFOV = 60 - (this.zoomLevel - 1) * 10;
      this.camera.fov += (targetFOV - this.camera.fov) * 0.1;
    }

    this.camera.updateProjectionMatrix();
  }
}
