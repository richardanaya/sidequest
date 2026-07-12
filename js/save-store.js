/**
 * Multi-slot localStorage save system.
 */
export class SaveStore {
  constructor({
    storage = globalThis.localStorage,
    prefix = "adventure.save.",
    metaKey = "adventure.save.meta",
  } = {}) {
    this.storage = storage;
    this.prefix = prefix;
    this.metaKey = metaKey;
  }

  listSlots(count = 5) {
    const meta = this._meta();
    const slots = [];
    for (let i = 1; i <= count; i++) {
      const id = String(i);
      const raw = this.storage?.getItem(this.prefix + id);
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      slots.push({
        id,
        empty: !data,
        savedAt: data?.savedAt || meta[id]?.savedAt || null,
        roomId: data?.roomId || null,
        score: data?.score ?? null,
        playtime: data?.playtime ?? null,
        label: data
          ? `${data.roomId || "?"} · ${data.score ?? 0} pts`
          : `Slot ${id} — empty`,
      });
    }
    // auto
    const autoRaw = this.storage?.getItem(this.prefix + "auto");
    let auto = null;
    try {
      auto = autoRaw ? JSON.parse(autoRaw) : null;
    } catch {
      auto = null;
    }
    return {
      auto: auto
        ? {
            id: "auto",
            empty: false,
            savedAt: auto.savedAt,
            roomId: auto.roomId,
            score: auto.score,
            playtime: auto.playtime,
            label: `Autosave · ${auto.roomId || "?"} · ${auto.score ?? 0} pts`,
          }
        : { id: "auto", empty: true, label: "Autosave — empty" },
      slots,
    };
  }

  save(slot, state) {
    const data = {
      ...state,
      version: state.version || 2,
      savedAt: Date.now(),
    };
    this.storage?.setItem(this.prefix + slot, JSON.stringify(data));
    const meta = this._meta();
    meta[slot] = { savedAt: data.savedAt, roomId: data.roomId, score: data.score };
    this.storage?.setItem(this.metaKey, JSON.stringify(meta));
    return data;
  }

  load(slot) {
    const raw = this.storage?.getItem(this.prefix + slot);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== 1 && data.version !== 2) {
      throw new Error(`Unsupported save version: ${data.version}`);
    }
    return data;
  }

  remove(slot) {
    this.storage?.removeItem(this.prefix + slot);
    const meta = this._meta();
    delete meta[slot];
    this.storage?.setItem(this.metaKey, JSON.stringify(meta));
  }

  _meta() {
    try {
      return JSON.parse(this.storage?.getItem(this.metaKey) || "{}");
    } catch {
      return {};
    }
  }
}
