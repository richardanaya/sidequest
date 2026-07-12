/**
 * Loads {contentRoot}/content.json registry + character/room packs.
 *
 * Each game is a folder of packs (e.g. game_sealed/, game_samurai/).
 * Engine code lives under `js/`. Paths in content.json are relative to that content root.
 */
import { ContentValidator } from "./content-validator.js";
import { ChromaKey } from "./chroma.js";

export class ContentLoader {
  constructor({ cacheBust = "", root = "game_sealed" } = {}) {
    this.cacheBust = cacheBust;
    /** Root folder for this game's content (registry, packs, ui, items). */
    this.root = String(root || "game_sealed").replace(/\/+$/, "") || "game_sealed";
    this.registry = null;
    this.validator = new ContentValidator();
    this.cache = new Map();
    this.chroma = new ChromaKey();
  }

  /**
   * Resolve a path relative to the content root (or leave absolute / external URLs alone).
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
   * Key green-screen stills for inventory icons (same chroma path as walk frames).
   * Pre-keyed PNGs with alpha pass through mostly unchanged.
   */
  keyIconImage(img) {
    if (!img) return null;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return img;
    const keyed = this.chroma.keyAndCrop(img, w, h);
    return keyed || img;
  }

  /**
   * Load game-wide item catalog from content root.
   * defaults.items → items.json with optional "icon": "items/foo.png" (green plate or keyed PNG).
   */
  async loadItemsCatalog() {
    await this.loadRegistry();
    const rel =
      this.registry?.defaults?.items ||
      this.registry?.items ||
      "items.json";
    try {
      const data = await this.fetchJson(rel);
      const raw =
        data?.items && typeof data.items === "object" && !Array.isArray(data.items)
          ? data.items
          : data;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

      const catalog = {};
      await Promise.all(
        Object.entries(raw).map(async ([id, def]) => {
          if (!def || typeof def !== "object") {
            catalog[id] = { name: String(id) };
            return;
          }
          const entry = {
            name: def.name || String(id).replace(/[_-]+/g, " "),
            desc: def.desc || def.description || "",
            icon: def.icon || null,
            color: def.color || null,
          };
          if (entry.icon) {
            try {
              const img = await this.loadImage(entry.icon);
              entry.iconImg = this.keyIconImage(img) || img;
            } catch (err) {
              console.warn(`Item icon failed: ${id} → ${entry.icon}`, err);
            }
          }
          catalog[id] = entry;
        })
      );
      return catalog;
    } catch (err) {
      console.warn("items catalog missing or invalid:", rel, err);
      return {};
    }
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
    // Room-local items file is rare; game catalog comes from loadItemsCatalog()
    const items = roomPack.items
      ? await this.fetchJson(`${roomPath}/${roomPack.items}`)
      : {};

    const backdropRel = roomPack.backdrop || "backdrop.jpg";
    const idleRel = characterPack.art?.idle || "idle.png";
    const walkRel = characterPack.art?.walk || "walk.mp4";

    const walkUrl = this.packUrl(`${characterPath}/${walkRel}`);

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
   * Pack folder path relative to content root (e.g. rooms/maintenance_hall).
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
