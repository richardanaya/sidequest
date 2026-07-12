export class SpellSystem {
  constructor({ state, runtime, inventory }) {
    this.state = state;
    this.runtime = runtime;
    this.inventory = inventory;
    this.catalog = {};
  }

  load(catalog = {}) {
    this.catalog = catalog;
  }

  learn(id) {
    this.state.spells ||= [];
    if (!this.state.spells.includes(id)) this.state.spells.push(id);
  }

  async cast(id, target = null) {
    const spell = this.catalog[id];
    if (!spell || !this.state.spells?.includes(id)) return { ok: false, reason: "unknown" };
    if (spell.when && !this.runtime.test(spell.when)) return { ok: false, reason: "conditions" };
    if (spell.targets?.length && !spell.targets.includes(target)) return { ok: false, reason: "target" };
    for (const item of spell.components || []) {
      if (!this.inventory.has(item)) return { ok: false, reason: "components" };
    }
    await this.runtime.run(spell.effects || [], { target });
    return { ok: true };
  }
}
