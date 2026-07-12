export class EffectsSystem {
  constructor({ reduceMotion = () => false } = {}) {
    this.reduceMotion = reduceMotion;
    this.effects = new Map();
  }

  start(id, definition = {}) {
    const effect = { id, ...definition, age: 0, particles: [] };
    if (!this.reduceMotion()) effect.particles = this.spawn(definition);
    this.effects.set(id, effect);
    return effect;
  }

  stop(id) {
    this.effects.delete(id);
  }

  clear() {
    this.effects.clear();
  }

  spawn(definition) {
    const count = Math.min(200, Math.max(0, definition.count || 30));
    return Array.from({ length: count }, (_, index) => ({
      x: (index * 73) % (definition.width || 960),
      y: (index * 47) % (definition.height || 428),
      vx: definition.vx || 0,
      vy: definition.vy || 25,
      life: definition.life || 4,
    }));
  }

  update(dt) {
    for (const effect of this.effects.values()) {
      effect.age += dt;
      for (const p of effect.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      effect.particles = effect.particles.filter((p) => p.life > 0);
    }
  }

  draw(ctx) {
    for (const effect of this.effects.values()) {
      ctx.fillStyle = effect.color || "rgba(255,255,255,0.65)";
      for (const p of effect.particles) ctx.fillRect(p.x, p.y, effect.size || 2, effect.size || 2);
    }
  }
}
