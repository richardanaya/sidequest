/**
 * Persistent adventure state: flags, rooms, inventory, score, log, settings.
 */
export class GameState {
  constructor(initial = {}) {
    this.version = 2;
    this.roomId = initial.roomId || null;
    this.characterId = initial.characterId || null;
    this.spawnId = initial.spawnId || null;
    this.flags = { ...(initial.flags || {}) };
    this.rooms = structuredClone(initial.rooms || {});
    this.inventory = [...(initial.inventory || [])];
    this.playtime = Number(initial.playtime) || 0;
    this.score = Number(initial.score) || 0;
    this.maxScore = Number(initial.maxScore) || 0;
    this.scoreAwards = { ...(initial.scoreAwards || {}) };
    this.deaths = Number(initial.deaths) || 0;
    this.won = !!initial.won;
    this.dead = !!initial.dead;
    this.deathMessage = initial.deathMessage || null;
    this.log = [...(initial.log || [])]; // text history
    this.visitedRooms = [...(initial.visitedRooms || [])];
    this.conversations = { ...(initial.conversations || {}) };
    this.learnedLines = [...(initial.learnedLines || [])];
    this.spells = [...(initial.spells || [])];
    this.responseCounts = { ...(initial.responseCounts || {}) };
    this.wallet = structuredClone(initial.wallet || { cash: 0, transactions: [] });
    this.timers = structuredClone(initial.timers || {});
    this.randomSeed = Number.isInteger(initial.randomSeed) ? initial.randomSeed : 0x12345678;
    this.minigames = structuredClone(initial.minigames || {});
    this.appearance = structuredClone(initial.appearance || { slots: {}, grooming: {}, tags: [] });
    this.relationships = { ...(initial.relationships || {}) };
    this.reputation = { ...(initial.reputation || {}) };
    this.settings = {
      textSpeed: 1,
      musicVolume: 0.7,
      sfxVolume: 0.85,
      alwaysShowText: true,
      reduceMotion: false,
      ...(initial.settings || {}),
    };
  }

  room(id = this.roomId) {
    if (!id) return { flags: {}, objects: {}, won: false };
    return (this.rooms[id] ||= { flags: {}, objects: {}, won: false, visited: false });
  }

  visitRoom(id) {
    this.room(id).visited = true;
    if (id && !this.visitedRooms.includes(id)) this.visitedRooms.push(id);
  }

  getFlag(key) {
    return !!this.flags[key];
  }

  setFlag(key, value = true) {
    this.flags[key] = value;
  }

  get(path, fallback) {
    const value = path.split(".").reduce((at, key) => at?.[key], this);
    return value === undefined ? fallback : value;
  }

  set(path, value) {
    const keys = path.split(".");
    let at = this;
    for (const key of keys.slice(0, -1)) at = at[key] ||= {};
    at[keys.at(-1)] = value;
    return value;
  }

  addScore(n, reason = null) {
    const v = Number(n) || 0;
    if (v === 0) return this.score;
    this.score = Math.max(0, this.score + v);
    if (this.score > this.maxScore) this.maxScore = this.score;
    if (reason) this.pushLog(`+${v} — ${reason}`);
    return this.score;
  }

  awardScore(id, points, reason = null) {
    if (!id || this.scoreAwards[id]) return false;
    this.scoreAwards[id] = true;
    this.addScore(points, reason);
    return true;
  }

  pushLog(text, speaker = null) {
    this.log.push({ text: String(text), speaker, t: this.playtime });
    if (this.log.length > 200) this.log.shift();
  }

  markDead(message) {
    this.dead = true;
    this.deathMessage = message || "You have died.";
    this.deaths += 1;
  }

  clearDead() {
    this.dead = false;
    this.deathMessage = null;
  }

  snapshot() {
    return structuredClone({
      version: this.version,
      roomId: this.roomId,
      characterId: this.characterId,
      spawnId: this.spawnId,
      flags: this.flags,
      rooms: this.rooms,
      inventory: this.inventory,
      playtime: this.playtime,
      score: this.score,
      maxScore: this.maxScore,
      scoreAwards: this.scoreAwards,
      deaths: this.deaths,
      won: this.won,
      dead: this.dead,
      deathMessage: this.deathMessage,
      log: this.log,
      visitedRooms: this.visitedRooms,
      conversations: this.conversations,
      learnedLines: this.learnedLines,
      spells: this.spells,
      responseCounts: this.responseCounts,
      wallet: this.wallet,
      timers: this.timers,
      randomSeed: this.randomSeed,
      minigames: this.minigames,
      appearance: this.appearance,
      relationships: this.relationships,
      reputation: this.reputation,
      settings: this.settings,
    });
  }

  restore(data) {
    const restored = new GameState(data);
    Object.assign(this, restored);
    // migrate v1 saves
    if ((data?.version || 1) < 2) {
      this.version = 2;
      this.score = this.score || 0;
      this.log = this.log || [];
      this.visitedRooms = this.visitedRooms || [];
      this.settings = this.settings || new GameState().settings;
    }
  }
}
