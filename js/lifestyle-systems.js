export class EconomySystem {
  constructor(state) {
    this.state = state;
    this.state.wallet ||= { cash: 0, transactions: [] };
  }

  balance() {
    return this.state.wallet.cash;
  }

  canAfford(amount) {
    return this.balance() >= Math.max(0, Number(amount) || 0);
  }

  credit(amount, reason = "credit") {
    return this.transact(Math.max(0, Number(amount) || 0), reason);
  }

  debit(amount, reason = "purchase") {
    amount = Math.max(0, Number(amount) || 0);
    if (!this.canAfford(amount)) return false;
    this.transact(-amount, reason);
    return true;
  }

  transact(delta, reason) {
    this.state.wallet.cash = Math.max(0, this.state.wallet.cash + delta);
    this.state.wallet.transactions.push({ delta, reason, t: this.state.playtime });
    if (this.state.wallet.transactions.length > 100) this.state.wallet.transactions.shift();
    return this.balance();
  }
}

export class GameTimerSystem {
  constructor(state, onExpire = async () => {}) {
    this.state = state;
    this.onExpire = onExpire;
    this.state.timers ||= {};
  }

  start(id, seconds, definition = {}) {
    this.state.timers[id] = {
      remaining: Math.max(0, Number(seconds) || 0),
      running: true,
      fired: false,
      warnings: [...(definition.warnings || [])].sort((a, b) => b.at - a.at),
      warned: [],
      expire: definition.expire || [],
    };
    return this.state.timers[id];
  }

  pause(id) {
    if (this.state.timers[id]) this.state.timers[id].running = false;
  }

  resume(id) {
    if (this.state.timers[id] && !this.state.timers[id].fired) this.state.timers[id].running = true;
  }

  cancel(id) {
    delete this.state.timers[id];
  }

  async update(dt) {
    for (const [id, timer] of Object.entries(this.state.timers)) {
      if (!timer.running || timer.fired) continue;
      const before = timer.remaining;
      timer.remaining = Math.max(0, before - dt);
      for (const warning of timer.warnings) {
        if (before > warning.at && timer.remaining <= warning.at && !timer.warned.includes(warning.at)) {
          timer.warned.push(warning.at);
          await this.onExpire(warning.steps || [{ say: warning.say }], { id, warning: true });
        }
      }
      if (timer.remaining <= 0) {
        timer.running = false;
        timer.fired = true;
        await this.onExpire(timer.expire, { id, warning: false });
      }
    }
  }
}

export class SeededRandom {
  constructor(state) {
    this.state = state;
    if (!Number.isInteger(this.state.randomSeed)) this.state.randomSeed = 0x12345678;
  }

  next() {
    this.state.randomSeed = (1664525 * this.state.randomSeed + 1013904223) >>> 0;
    return this.state.randomSeed / 0x100000000;
  }
}

export class MinigameSystem {
  constructor({ state, economy }) {
    this.state = state;
    this.economy = economy;
    this.random = new SeededRandom(state);
    this.state.minigames ||= {};
  }

  play(id, definition, stake = definition.stake || 0) {
    if (!this.economy.debit(stake, `${id}:stake`)) return { ok: false, reason: "funds" };
    const roll = this.random.next();
    const outcome = (definition.outcomes || [])
      .reduce((at, candidate) => at || (roll < candidate.chance ? candidate : null), null) ||
      { id: "lose", multiplier: 0 };
    const payout = Math.floor(stake * (outcome.multiplier || 0));
    if (payout) this.economy.credit(payout, `${id}:${outcome.id}`);
    const record = this.state.minigames[id] ||= { plays: 0, wins: 0, net: 0, last: null };
    record.plays++;
    if (payout > stake) record.wins++;
    record.net += payout - stake;
    record.last = outcome.id;
    return { ok: true, outcome: outcome.id, payout, roll };
  }
}

export class AppearanceSystem {
  constructor(state) {
    this.state = state;
    this.state.appearance ||= { slots: {}, grooming: {}, tags: [] };
  }

  equip(slot, id, tags = []) {
    this.state.appearance.slots[slot] = id;
    this.rebuildTags(tags);
  }

  groom(kind, value = true) {
    this.state.appearance.grooming[kind] = value;
  }

  has(tag) {
    return this.state.appearance.tags.includes(tag) ||
      Object.values(this.state.appearance.slots).includes(tag) ||
      !!this.state.appearance.grooming[tag];
  }

  rebuildTags(extra = []) {
    this.state.appearance.tags = [...new Set([...this.state.appearance.tags, ...extra])];
  }
}

export class RelationshipSystem {
  constructor(state) {
    this.state = state;
    this.state.relationships ||= {};
    this.state.reputation ||= {};
  }

  get(id) {
    return this.state.relationships[id] || 0;
  }

  change(id, delta) {
    this.state.relationships[id] = Math.max(-100, Math.min(100, this.get(id) + Number(delta || 0)));
    return this.state.relationships[id];
  }

  changeReputation(track, delta) {
    const current = this.state.reputation[track] || 0;
    this.state.reputation[track] = Math.max(-100, Math.min(100, current + Number(delta || 0)));
    return this.state.reputation[track];
  }
}
