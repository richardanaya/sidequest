/**
 * Full-screen fade / dissolve transitions.
 */
export class Transition {
  constructor() {
    this.alpha = 0;
    this.mode = "none"; // none | fadeOut | fadeIn | hold
    this.speed = 2.2;
    this.color = "#05080c";
    this._resolve = null;
  }

  get active() {
    return this.mode !== "none";
  }

  async fadeOut(speed = this.speed) {
    this.speed = speed;
    this.mode = "fadeOut";
    return new Promise((res) => {
      this._resolve = res;
    });
  }

  async fadeIn(speed = this.speed) {
    this.speed = speed;
    this.mode = "fadeIn";
    this.alpha = 1;
    return new Promise((res) => {
      this._resolve = res;
    });
  }

  async flash(color = "#ffffff", duration = 0.12) {
    this.color = color;
    this.alpha = 0.85;
    this.mode = "hold";
    await new Promise((r) => setTimeout(r, duration * 1000));
    this.mode = "fadeIn";
    this.speed = 4;
    return new Promise((res) => {
      this._resolve = res;
    });
  }

  update(dt) {
    if (this.mode === "fadeOut") {
      this.alpha = Math.min(1, this.alpha + this.speed * dt);
      if (this.alpha >= 1) {
        this.mode = "hold";
        const r = this._resolve;
        this._resolve = null;
        if (r) r();
      }
    } else if (this.mode === "fadeIn") {
      this.alpha = Math.max(0, this.alpha - this.speed * dt);
      if (this.alpha <= 0) {
        this.mode = "none";
        this.color = "#05080c";
        const r = this._resolve;
        this._resolve = null;
        if (r) r();
      }
    }
  }

  draw(ctx, W, H) {
    if (this.alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
