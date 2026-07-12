/**
 * Simple NPC: sprite or placeholder, optional walk/idle, talk branches.
 */
export class Npc {
  constructor(def = {}) {
    this.id = def.id || "npc";
    this.name = def.name || this.id;
    this.x = def.x ?? 400;
    this.y = def.y ?? 373;
    this.w = def.w ?? 40;
    this.h = def.h ?? 100;
    this.facing = def.facing ?? 1;
    this.img = null;
    this.prop = def.prop || null;
    this.depthY = def.depthY ?? this.y;
    this.walkX = def.walkX ?? this.x;
    this.hx = def.hx ?? this.x - this.w / 2;
    this.hy = def.hy ?? this.y - this.h;
    this.hw = def.hw ?? this.w;
    this.hh = def.hh ?? this.h;
    this.talk = def.talk || [{ say: "…" }];
    this.look = def.look || [{ say: `It's ${this.name}.` }];
    this.useWith = def.useWith || {};
    this.visibleWhen = def.visibleWhen || null;
    this.solid = !!def.solid;
    this.state = def.initialState || (def.patrol ? "patrol" : "idle");
    this.patrol = def.patrol || null;
    this.speed = def.speed || def.patrol?.speed || 20;
  }

  syncHitbox() {
    this.hx = this.x - this.w / 2;
    this.hy = this.y - this.h;
    this.hw = this.w;
    this.hh = this.h;
    this.depthY = this.y;
  }

  contains(mx, my) {
    return mx >= this.hx && mx <= this.hx + this.hw && my >= this.hy && my <= this.hy + this.hh;
  }

  update(dt) {
    if (this.state !== "patrol" || !this.patrol) return;
    this.x += this.facing * this.speed * dt;
    if (this.x <= this.patrol.min || this.x >= this.patrol.max) {
      this.x = Math.max(this.patrol.min, Math.min(this.patrol.max, this.x));
      this.facing *= -1;
    }
    this.walkX = this.x;
    this.syncHitbox();
  }

  draw(ctx) {
    if (this.img) {
      ctx.drawImage(this.img, this.x - this.w / 2, this.y - this.h, this.w, this.h);
    } else {
      ctx.fillStyle = "rgba(180,160,120,0.85)";
      ctx.fillRect(this.x - this.w / 2, this.y - this.h, this.w, this.h);
      ctx.fillStyle = "#1a1010";
      ctx.font = "10px Cinzel, Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText(this.name.slice(0, 8), this.x, this.y - this.h - 4);
    }
  }
}
