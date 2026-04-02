import * as THREE from 'three';

export class ThirdPersonCamera {
  constructor(camera) {
    this.camera   = camera;
    this.yaw      = 0;
    this.pitch    = 0.35;
    this.distance = 14;

    this.zoomLevel = 1;
    this.minZoom   = 0.5;
    this.maxZoom   = 2.5;
    this.minPitch  = 0.05;
    this.maxPitch  = Math.PI / 2 - 0.05;

    this._currentPos = new THREE.Vector3();
    this._isDragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._cameraTouchId = null;

    this._setupControls();
  }

  zoom(delta) {
    this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta));
  }

  _setupControls() {
    // ═══ DESKTOP: Right-click hold + drag = rotate camera ═══
    document.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        this._isDragging = true;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this._isDragging) return;
      this.yaw   -= (e.clientX - this._lastX) * 0.004;
      this.pitch -= (e.clientY - this._lastY) * 0.004;
      this.pitch  = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 2) this._isDragging = false;
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Scroll zoom
    window.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom(Math.sign(e.deltaY) * 0.15);
    }, { passive: false });

    // ═══ MOBILE: Right side touch drag = rotate camera ═══
    document.addEventListener('touchstart', (e) => {
      // Pinch zoom
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this._pinchDist = Math.sqrt(dx * dx + dy * dy);
        return;
      }

      // Single touch on right side (above buttons area) = camera
      if (e.touches.length === 1 && this._cameraTouchId === null) {
        const t = e.touches[0];
        const rightSide = t.clientX > window.innerWidth * 0.45;
        const aboveButtons = t.clientY < window.innerHeight * 0.55;
        if (rightSide && aboveButtons) {
          this._cameraTouchId = t.identifier;
          this._lastX = t.clientX;
          this._lastY = t.clientY;
        }
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      // Pinch
      if (e.touches.length === 2 && this._pinchDist) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const cur = Math.sqrt(dx * dx + dy * dy);
        this.zoom((this._pinchDist - cur) * 0.002);
        this._pinchDist = cur;
        e.preventDefault();
        return;
      }

      // Camera drag
      if (this._cameraTouchId !== null) {
        for (const t of e.changedTouches) {
          if (t.identifier === this._cameraTouchId) {
            this.yaw   -= (t.clientX - this._lastX) * 0.004;
            this.pitch -= (t.clientY - this._lastY) * 0.004;
            this.pitch  = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
            this._lastX = t.clientX;
            this._lastY = t.clientY;
          }
        }
      }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
      this._pinchDist = null;
      for (const t of e.changedTouches) {
        if (t.identifier === this._cameraTouchId) {
          this._cameraTouchId = null;
        }
      }
    });
  }

  update(targetPos) {
    const dist = this.distance * this.zoomLevel;
    const desiredPos = new THREE.Vector3(
      targetPos.x + dist * Math.sin(this.yaw) * Math.cos(this.pitch),
      targetPos.y + dist * Math.sin(this.pitch) + 2,
      targetPos.z + dist * Math.cos(this.yaw) * Math.cos(this.pitch)
    );

    this._currentPos.lerp(desiredPos, 0.12);
    this.camera.position.copy(this._currentPos);
    this.camera.lookAt(targetPos.x, targetPos.y + 1.5, targetPos.z);
  }
}
