/**
 * Player position, facing, walk/idle blend, video-driven walk frames.
 */
export class Player {
  constructor({ chroma, walkVideo }) {
    this.chroma = chroma;
    this.walkVideo = walkVideo;

    this.x = 0;
    this.y = 0;
    this.w = 50;
    this.h = 148;
    this.facing = 1;
    this.targetX = 0;
    this.vx = 0;
    this.moving = false;
    this.walking = false;
    this.arriveAction = null;
    this.walkBlend = 0;

    this.height = 148;
    this.idleCanvas = null;
    this.walkFrameCanvas = null;
    this.walkReady = false;
    this.animations = {};
    this.requestedAnimation = null;
    /**
     * First walk-frame content bounds (video space). Fixed scale/align for the cycle.
     * { bx, by, bw, bh, fw, fh }
     */
    this.walkCalib = null;

    this.motion = {
      maxSpeed: 118,
      accel: 520,
      decel: 780,
      stopEpsilon: 2.5,
      playbackRate: 0.72,
      blendIn: 11.0,
      blendOut: 9.0,
      walkSpeedThreshold: 12,
    };
  }

  setIdleImage(img) {
    this.idleCanvas = document.createElement("canvas");
    this.idleCanvas.width = img.naturalWidth;
    this.idleCanvas.height = img.naturalHeight;
    this.idleCanvas.getContext("2d").drawImage(img, 0, 0);
    this._syncSize();
  }

  /** Call when walk video source changes (new character / room load). */
  resetWalkCalibration() {
    this.walkCalib = null;
    this.walkFrameCanvas = null;
  }

  setHeight(h) {
    this.height = h;
    this.h = h;
    this._syncSize();
  }

  setMotion(motion = {}) {
    Object.assign(this.motion, motion);
  }

  setAnimations(animations = {}) {
    this.animations = animations;
  }

  async playAnimation(name, duration = null) {
    const definition = this.animations[name];
    const resolved = definition || this.animations[definition?.fallback] || this.animations.idle;
    this.requestedAnimation = definition ? name : resolved ? "idle" : null;
    const events = [...(definition?.events || [])].sort((a, b) => a.at - b.at);
    const total = duration ?? definition?.duration ?? 0.6;
    let elapsed = 0;
    for (const event of events) {
      const wait = Math.max(0, event.at - elapsed);
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      elapsed = event.at;
      this.onAnimationEvent?.(event);
    }
    if (total > elapsed) await new Promise((resolve) => setTimeout(resolve, (total - elapsed) * 1000));
    this.requestedAnimation = null;
  }

  setGroundY(y) {
    this.y = y;
  }

  setSpawn({ x, facing = 1 }) {
    this.x = x;
    this.targetX = x;
    this.facing = facing;
  }

  _syncSize() {
    if (!this.idleCanvas) return;
    const aspect = this.idleCanvas.width / this.idleCanvas.height;
    this.w = Math.round(this.height * aspect);
    this.h = this.height;
  }

  walkTo(x, onArrive, bounds = { min: 70, max: 890 }) {
    this.arriveAction = null;
    const clamped = Math.max(bounds.min, Math.min(bounds.max, x));
    const dist = clamped - this.x;
    const m = this.motion;
    if (Math.abs(dist) <= m.stopEpsilon) {
      this.targetX = this.x;
      this.moving = false;
      if (onArrive) onArrive();
      return;
    }
    this.targetX = clamped;
    this.facing = dist >= 0 ? 1 : -1;
    this.moving = true;
    this.arriveAction = onArrive || null;
    this.ensureWalkPlaying();
  }

  get animationState() {
    if (this.requestedAnimation) return this.requestedAnimation;
    if (this.moving || this.walkBlend >= 0.5) return "walk";
    if (this.walkBlend > 0) return "settle";
    return "idle";
  }

  finishArrival() {
    this.moving = false;
    this.vx = 0;
    this.x = this.targetX;
    this.pauseWalkSoft();
    const fn = this.arriveAction;
    this.arriveAction = null;
    if (fn) fn();
  }

  unlockWalkVideo() {
    const v = this.walkVideo;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.playbackRate = this.motion.playbackRate;
    const p = v.play();
    if (p && p.then) {
      p.then(() => {
        this.walkReady = true;
        if (this.walkBlend < 0.15 && !this.moving) v.pause();
      }).catch(() => {
        this.walkReady = v.readyState >= 2;
      });
    } else if (v.readyState >= 2) {
      this.walkReady = true;
    }
  }

  ensureWalkPlaying() {
    const v = this.walkVideo;
    if (!v) return;
    v.muted = true;
    v.loop = true;
    v.playbackRate = this.motion.playbackRate;
    if (v.paused) {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    }
    this.walkReady = v.readyState >= 2 || this.walkReady;
  }

  pauseWalkSoft() {
    if (this.walkVideo && !this.walkVideo.paused) this.walkVideo.pause();
  }

  update(dt) {
    const m = this.motion;
    const dx = this.targetX - this.x;
    const dist = Math.abs(dx);
    const dir = Math.sign(dx) || this.facing;

    if (this.moving) {
      const brakeDist = (this.vx * this.vx) / (2 * m.decel) + 4;
      if (dist <= m.stopEpsilon) {
        this.finishArrival();
      } else {
        this.facing = dir;
        if (dist < brakeDist || dist < 28) {
          const want = Math.min(
            m.maxSpeed,
            Math.sqrt(Math.max(0, 2 * m.decel * dist))
          );
          if (this.vx > want) {
            this.vx = Math.max(want, this.vx - m.decel * dt);
          } else {
            this.vx = Math.min(want, this.vx + m.accel * dt);
          }
        } else {
          this.vx = Math.min(m.maxSpeed, this.vx + m.accel * dt);
          this.ensureWalkPlaying();
        }
        const step = this.vx * dt;
        if (step >= dist) this.finishArrival();
        else this.x += dir * step;
      }
    } else {
      this.vx = Math.max(0, this.vx - m.decel * dt);
      if (this.vx < 8) this.vx = 0;
    }

    this.walking = this.vx > m.walkSpeedThreshold || (this.moving && dist > 10);

    const wantBlend = this.walking ? 1 : 0;
    if (this.walkBlend < wantBlend) {
      this.walkBlend = Math.min(1, this.walkBlend + m.blendIn * dt);
      if (this.walkBlend > 0.2) this.ensureWalkPlaying();
    } else if (this.walkBlend > wantBlend) {
      this.walkBlend = Math.max(0, this.walkBlend - m.blendOut * dt);
      if (this.walkBlend < 0.35) this.pauseWalkSoft();
    }

    if (this.walkVideo && !this.walkVideo.paused && this.vx > 1) {
      const speedT = Math.min(1, this.vx / m.maxSpeed);
      this.walkVideo.playbackRate =
        m.playbackRate * (0.55 + 0.55 * speedT);
    }
  }

  /**
   * Capture a full keyed walk frame (no content crop — limbs stay intact).
   * First frame: measure content bbox to calibrate scale + foot anchor.
   */
  captureWalkFrame() {
    if (this.walkBlend <= 0.02 || !this.walkVideo || this.walkVideo.readyState < 2) {
      return this.walkFrameCanvas;
    }
    const vid = this.walkVideo;
    const sw = vid.videoWidth || 544;
    const sh = vid.videoHeight || 544;
    // Full frame key only — never tight-crop (that cuts limbs and changes aspect)
    this.chroma.apply(vid, this.chroma.work, this.chroma.workCtx, sw, sh);
    const src = this.chroma.work;

    if (
      !this.walkFrameCanvas ||
      this.walkFrameCanvas.width !== sw ||
      this.walkFrameCanvas.height !== sh
    ) {
      this.walkFrameCanvas = document.createElement("canvas");
      this.walkFrameCanvas.width = sw;
      this.walkFrameCanvas.height = sh;
    }
    const c = this.walkFrameCanvas.getContext("2d");
    c.clearRect(0, 0, sw, sh);
    c.drawImage(src, 0, 0);

    // Calibrate once from first good frame's content bounds
    if (!this.walkCalib) {
      const img = this.chroma.workCtx.getImageData(0, 0, sw, sh);
      const b = this.chroma.contentBounds(img);
      if (b && b.h > 8 && b.w > 4) {
        this.walkCalib = {
          bx: b.x,
          by: b.y,
          bw: b.w,
          bh: b.h,
          fw: sw,
          fh: sh,
        };
      }
    }
    return this.walkFrameCanvas;
  }

  /**
   * On-screen rect for the full walk frame (facing right).
   * Scale from first-frame content height → player.height; feet on player.y.
   */
  getWalkDrawRect() {
    const cal = this.walkCalib;
    if (!cal || !cal.bh) return null;
    const scale = this.height / cal.bh;
    const dw = cal.fw * scale;
    const dh = cal.fh * scale;
    // Content foot center in frame space → player feet
    const footX = (cal.bx + cal.bw * 0.5) * scale;
    const footY = (cal.by + cal.bh) * scale;
    return {
      dx: this.x - footX,
      dy: this.y - footY,
      dw,
      dh,
      scale,
    };
  }
}
