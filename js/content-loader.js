/**
 * Loads game_data/content.json registry + character/room packs (see CONTENT.md).
 *
 * All game assets and definitions live under `game_data/`.
 * Engine code lives under `js/`. Paths in content.json are relative to game_data/.
 */
import { ContentValidator } from "./content-validator.js";

export class ContentLoader {
  constructor({ cacheBust = "", root = "game_data" } = {}) {
    this.cacheBust = cacheBust;
    /** Root folder for all non-engine content (registry, packs, ui). */
    this.root = String(root || "game_data").replace(/\/+$/, "") || "game_data";
    this.registry = null;
    this.validator = new ContentValidator();
    this.cache = new Map();
  }

  /**
   * Resolve a path relative to game_data (or leave absolute / external URLs alone).
   * @param {string} path
   */
  resolve(path) {
    if (!path) return path;
    if (
      path.startsWith("http://") ||
      path.startsWith("https://") ||
      path.startsWith("data:") ||
      path.startsWith("blob:") ||
      path.startsWith("/")
    ) {
      return path;
    }
    // Already under root
    if (path === this.root || path.startsWith(`${this.root}/`)) return path;
    return `${this.root}/${path}`;
  }

  packUrl(path) {
    if (!path) return path;
    const full = this.resolve(path);
    return full.includes("?") ? full : full + this.cacheBust;
  }

  loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error(src));
      img.src = this.packUrl(src);
    });
  }

  async fetchJson(src) {
    const key = this.resolve(src);
    if (this.cache.has(key)) return structuredClone(this.cache.get(key));
    const r = await fetch(this.packUrl(src));
    if (!r.ok) throw new Error(`HTTP ${r.status} ${this.packUrl(src)}`);
    const data = await r.json();
    this.cache.set(key, data);
    return structuredClone(data);
  }

  async loadRegistry() {
    try {
      this.registry = this.validator.validateRegistry(
        await this.fetchJson("content.json")
      );
    } catch {
      this.registry = null;
    }
    return this.registry;
  }

  /**
   * @param {{ roomId?: string, characterId?: string }} opts
   */
  async loadGame(opts = {}) {
    await this.loadRegistry();

    let roomId =
      opts.roomId ||
      this.registry?.defaults?.room ||
      "maintenance_hall";

    const roomPath = this.resolvePackPath("rooms", roomId);
    const roomPack = this.validator.validateRoom(
      await this.fetchJson(`${roomPath}/room.json`),
      roomId
    );

    let characterId =
      opts.characterId ||
      roomPack.character ||
      this.registry?.defaults?.character ||
      "protagonist";

    const characterPath = this.resolvePackPath("characters", characterId);
    const characterPack = this.validator.validateCharacter(
      await this.fetchJson(`${characterPath}/character.json`),
      characterId
    );
    const script = roomPack.script
      ? this.validator.validateScript(
          await this.fetchJson(`${roomPath}/${roomPack.script}`)
        )
      : null;
    const items = roomPack.items
      ? await this.fetchJson(`${roomPath}/${roomPack.items}`)
      : {};

    const backdropRel = roomPack.backdrop || "backdrop.jpg";
    const idleRel = characterPack.art?.idle || "idle.png";
    const walkRel = characterPack.art?.walk || "walk.mp4";

    const walkUrl = this.packUrl(`${characterPath}/${walkRel}`);

    // Collect unique backdrop files: default + state variants (game_data paths relative to pack)
    const backdropFiles = new Set([backdropRel]);
    for (const variant of roomPack.backdrops || []) {
      if (variant?.src) backdropFiles.add(variant.src);
    }

    const [idleImg, ...backdropLoaded] = await Promise.all([
      this.loadImage(`${characterPath}/${idleRel}`),
      ...[...backdropFiles].map(async (rel) => {
        const img = await this.loadImage(`${roomPath}/${rel}`);
        return [rel, img];
      }),
    ]);

    const backdropImgs = Object.fromEntries(backdropLoaded);
    const backdropImg = backdropImgs[backdropRel] || Object.values(backdropImgs)[0];

    const propImgs = {};
    const propLoads = [];
    for (const [id, slot] of Object.entries(roomPack.slots || {})) {
      if (slot.noSprite || !slot.prop) continue;
      propLoads.push(
        this.loadImage(`${roomPath}/${slot.prop}`).then((img) => {
          propImgs[id] = img;
        })
      );
    }
    await Promise.all(propLoads);

    return {
      roomId,
      characterId,
      roomPack,
      characterPack,
      backdropImg,
      backdropImgs,
      idleImg,
      walkUrl,
      propImgs,
      script,
      items,
      roomPath,
    };
  }

  /**
   * Pack folder path relative to game_data (e.g. rooms/maintenance_hall).
   * Registry entry.path may already include type/id.
   */
  resolvePackPath(type, id) {
    if (!/^[a-z0-9_-]+$/i.test(id || "")) {
      throw new Error(`Invalid ${type.slice(0, -1)} id: ${id}`);
    }
    const entry = this.registry?.[type]?.[id];
    if (this.registry && !entry) {
      throw new Error(`Unknown ${type.slice(0, -1)} id: ${id}`);
    }
    return entry?.path || `${type}/${id}`;
  }
}
