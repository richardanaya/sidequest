/**
 * Title / pause / death / save-load / settings / map / log menus.
 */
import { C } from "./palette.js";

export const MenuMode = {
  NONE: "none",
  TITLE: "title",
  PAUSE: "pause",
  DEATH: "death",
  SAVE: "save",
  LOAD: "load",
  SETTINGS: "settings",
  MAP: "map",
  LOG: "log",
};

export class MenuSystem {
  constructor(engine) {
    this.engine = engine;
    this.mode = MenuMode.TITLE;
    this.selected = 0;
    this.message = null;
    this.slots = [];
    /** @type {{ id: string, item: object, x: number, y: number, w: number, h: number, disabled?: boolean }[]} */
    this.itemHits = [];
  }

  get open() {
    return this.mode !== MenuMode.NONE;
  }

  get blocking() {
    return this.open;
  }

  show(mode) {
    this.mode = mode;
    this.selected = 0;
    this.message = null;
    if (mode === MenuMode.SAVE || mode === MenuMode.LOAD) {
      this.slots = this.engine.saves.listSlots(5);
    }
  }

  hide() {
    if (this.mode === MenuMode.TITLE || this.mode === MenuMode.DEATH) return;
    this.mode = MenuMode.NONE;
  }

  items() {
    const e = this.engine;
    switch (this.mode) {
      case MenuMode.TITLE:
        return [
          { id: "new", label: "New Game" },
          { id: "continue", label: "Continue", disabled: this.slotsEmpty() },
          { id: "load", label: "Load Game" },
          { id: "settings", label: "Settings" },
        ];
      case MenuMode.PAUSE:
        return [
          { id: "resume", label: "Resume" },
          { id: "save", label: "Save Game" },
          { id: "load", label: "Load Game" },
          { id: "map", label: "Map" },
          { id: "log", label: "Text Log" },
          { id: "settings", label: "Settings" },
          { id: "title", label: "Quit to Title" },
        ];
      case MenuMode.DEATH:
        return [
          { id: "restore", label: "Restore Autosave" },
          { id: "load", label: "Load Game" },
          { id: "restart", label: "Restart Room" },
          { id: "title", label: "Quit to Title" },
        ];
      case MenuMode.SAVE: {
        const list = e.saves.listSlots(5);
        return [
          { id: "back", label: "← Back" },
          ...list.slots.map((s) => ({
            id: `save:${s.id}`,
            label: s.label,
            slot: s.id,
          })),
        ];
      }
      case MenuMode.LOAD: {
        const list = e.saves.listSlots(5);
        const items = [{ id: "back", label: "← Back" }];
        if (!list.auto.empty)
          items.push({ id: "load:auto", label: list.auto.label, slot: "auto" });
        for (const s of list.slots) {
          items.push({
            id: `load:${s.id}`,
            label: s.label,
            slot: s.id,
            disabled: s.empty,
          });
        }
        return items;
      }
      case MenuMode.SETTINGS: {
        const s = e.state.settings;
        return [
          { id: "back", label: "← Back" },
          {
            id: "textSpeed",
            label: `Text speed: ${s.textSpeed.toFixed(1)}x`,
          },
          {
            id: "music",
            label: `Music: ${Math.round(s.musicVolume * 100)}%`,
          },
          {
            id: "sfx",
            label: `SFX: ${Math.round(s.sfxVolume * 100)}%`,
          },
          {
            id: "motion",
            label: `Reduce motion: ${s.reduceMotion ? "On" : "Off"}`,
          },
        ];
      }
      case MenuMode.MAP: {
        const rooms = Object.keys(e.loader.registry?.rooms || {});
        return [
          { id: "back", label: "← Back" },
          ...rooms.map((id) => ({
            id: `map:${id}`,
            label: `${e.state.visitedRooms.includes(id) ? "●" : "○"} ${
              e.loader.registry.rooms[id].name || id
            }${id === e.roomId ? "  (here)" : ""}`,
            roomId: id,
            disabled: !e.state.visitedRooms.includes(id) && id !== e.roomId,
          })),
        ];
      }
      case MenuMode.LOG: {
        const lines = e.state.log.slice(-12).reverse();
        return [
          { id: "back", label: "← Back" },
          ...lines.map((l, i) => ({
            id: `log:${i}`,
            label: (l.speaker ? `${l.speaker}: ` : "") + l.text.slice(0, 60),
            disabled: true,
          })),
        ];
      }
      default:
        return [];
    }
  }

  slotsEmpty() {
    const list = this.engine.saves.listSlots(5);
    return list.auto.empty && list.slots.every((s) => s.empty);
  }

  move(dir) {
    const items = this.items().filter((i) => !i.disabled);
    if (!items.length) return;
    this.selected = (this.selected + dir + items.length) % items.length;
  }

  async activate() {
    const items = this.items().filter((i) => !i.disabled);
    const item = items[this.selected] || items[0];
    if (!item) return;
    await this.activateId(item.id, item);
  }

  async activateId(id, item = {}) {
    const e = this.engine;
    if (id === "new") {
      await e.newGame();
      this.mode = MenuMode.NONE;
      return;
    }
    if (id === "continue") {
      if (await e.load("auto")) this.mode = MenuMode.NONE;
      else this.message = "No autosave found.";
      return;
    }
    if (id === "resume") {
      this.mode = MenuMode.NONE;
      return;
    }
    if (id === "save") {
      this.show(MenuMode.SAVE);
      return;
    }
    if (id === "load") {
      this.show(MenuMode.LOAD);
      return;
    }
    if (id === "settings") {
      this.show(MenuMode.SETTINGS);
      return;
    }
    if (id === "map") {
      this.show(MenuMode.MAP);
      return;
    }
    if (id === "log") {
      this.show(MenuMode.LOG);
      return;
    }
    if (id === "title") {
      e.stopGameplay();
      e.applyBrandingChrome?.();
      this.show(MenuMode.TITLE);
      return;
    }
    if (id === "restore") {
      if (await e.load("auto")) this.mode = MenuMode.NONE;
      else this.message = "No autosave.";
      return;
    }
    if (id === "restart") {
      await e.restartRoom();
      this.mode = MenuMode.NONE;
      return;
    }
    if (id === "back") {
      if (this.mode === MenuMode.TITLE) return;
      if (e.state.dead) this.show(MenuMode.DEATH);
      else if (!e.assetsReady) this.show(MenuMode.TITLE);
      else this.show(MenuMode.PAUSE);
      return;
    }
    if (id.startsWith("save:")) {
      e.save(item.slot || id.split(":")[1]);
      this.message = `Saved to slot ${item.slot}.`;
      this.show(MenuMode.SAVE);
      return;
    }
    if (id.startsWith("load:")) {
      const slot = item.slot || id.split(":")[1];
      if (await e.load(slot)) this.mode = MenuMode.NONE;
      else this.message = "Empty slot.";
      return;
    }
    if (id === "textSpeed") {
      const s = e.state.settings;
      s.textSpeed = s.textSpeed >= 2 ? 0.5 : Math.round((s.textSpeed + 0.5) * 10) / 10;
      return;
    }
    if (id === "music") {
      const s = e.state.settings;
      s.musicVolume = (s.musicVolume + 0.1) % 1.05;
      if (s.musicVolume > 1) s.musicVolume = 0;
      e.audio.setVolumes({ music: s.musicVolume, sfx: s.sfxVolume });
      return;
    }
    if (id === "sfx") {
      const s = e.state.settings;
      s.sfxVolume = (s.sfxVolume + 0.1) % 1.05;
      if (s.sfxVolume > 1) s.sfxVolume = 0;
      e.audio.setVolumes({ music: s.musicVolume, sfx: s.sfxVolume });
      return;
    }
    if (id === "motion") {
      e.state.settings.reduceMotion = !e.state.settings.reduceMotion;
      return;
    }
    if (id.startsWith("map:")) {
      // Map is informational unless debug travel
      if (e.ui?.showHitbox && item.roomId) {
        await e.goToRoom(item.roomId);
        this.mode = MenuMode.NONE;
      } else {
        this.message = "Travel only after visiting (debug: B then select).";
      }
    }
  }

  /** Cover-fit image into the canvas (title splash / full-bleed art). */
  drawCoverImage(ctx, img, W, H) {
    if (!img) return;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const scale = Math.max(W / iw, H / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  drawTitleBackdrop(ctx, W, H) {
    const img = this.engine.titleBg;
    if (img) {
      this.drawCoverImage(ctx, img, W, H);
      // Dim + vignette so title type + menu stay readable
      const g = ctx.createRadialGradient(
        W * 0.5,
        H * 0.38,
        Math.min(W, H) * 0.12,
        W * 0.5,
        H * 0.5,
        Math.max(W, H) * 0.75
      );
      g.addColorStop(0, "rgba(5, 10, 16, 0.22)");
      g.addColorStop(0.5, "rgba(5, 10, 16, 0.5)");
      g.addColorStop(1, "rgba(3, 6, 10, 0.9)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(10, 40, 55, 0.16)";
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = "rgba(4, 8, 14, 0.92)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** Large logo wordmark + subtitle for the landing screen (not baked into art). */
  drawLandingBranding(ctx, W, H) {
    const brand = this.engine.branding || {};
    const title = (brand.title || "Sealed").toUpperCase();
    const subtitle = brand.subtitle || "";
    const tagline = brand.tagline || "";
    const cx = W / 2;
    let y = 72;

    // Decorative gold rule
    ctx.strokeStyle = "rgba(201, 168, 76, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 160, y);
    ctx.lineTo(cx - 28, y);
    ctx.moveTo(cx + 28, y);
    ctx.lineTo(cx + 160, y);
    ctx.stroke();
    ctx.fillStyle = C.gold;
    ctx.font = "12px Cinzel, Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("◆", cx, y);

    y += 42;
    // Soft glow behind title
    ctx.save();
    ctx.shadowColor = "rgba(201, 168, 76, 0.55)";
    ctx.shadowBlur = 28;
    ctx.fillStyle = C.goldLite;
    ctx.font = "bold 52px Cinzel, Georgia, serif";
    ctx.fillText(title, cx, y);
    ctx.restore();

    // Second crisp pass for legibility
    ctx.fillStyle = C.goldLite;
    ctx.font = "bold 52px Cinzel, Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, cx, y);

    y += 36;
    if (subtitle) {
      ctx.fillStyle = C.creamDim;
      ctx.font = "14px Libre Baskerville, Georgia, serif";
      ctx.fillText(subtitle, cx, y);
      y += 22;
    }
    if (tagline) {
      ctx.fillStyle = "rgba(184, 168, 136, 0.85)";
      ctx.font = "italic 12px Libre Baskerville, Georgia, serif";
      // wrap tagline if long
      const maxW = 520;
      const words = tagline.split(" ");
      let line = "";
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line, cx, y);
          y += 16;
          line = word;
        } else line = test;
      }
      if (line) {
        ctx.fillText(line, cx, y);
        y += 16;
      }
    }

    // Bottom rule under branding
    y += 10;
    ctx.strokeStyle = "rgba(201, 168, 76, 0.4)";
    ctx.beginPath();
    ctx.moveTo(cx - 100, y);
    ctx.lineTo(cx + 100, y);
    ctx.stroke();

    return y + 18;
  }

  drawMenuPanel(ctx, W, H, { x, y, boxW, boxH, items, header, subheader, useSplash }) {
    ctx.fillStyle = useSplash ? "rgba(8, 14, 22, 0.9)" : "rgba(12, 18, 26, 0.96)";
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = C.goldDim;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, boxW - 2, boxH - 2);
    if (useSplash) {
      ctx.strokeStyle = "rgba(201, 168, 76, 0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 6, y + 6, boxW - 12, boxH - 12);
    }

    let contentTop = y + 22;
    if (header) {
      ctx.fillStyle = C.goldLite;
      ctx.font = "18px Cinzel, Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(header, x + boxW / 2, y + 28);
      contentTop = y + 52;
    }
    if (subheader) {
      ctx.fillStyle = C.creamDim;
      ctx.font = "12px Libre Baskerville, Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText(subheader, x + boxW / 2, contentTop);
      contentTop += 22;
    }

    const lineH = 28;
    const rowH = 24;
    const startY = contentTop + 8;
    const enabled = items.filter((i) => !i.disabled);
    this.itemHits = [];
    items.forEach((item, i) => {
      const enabledIndex = enabled.indexOf(item);
      const sel = enabledIndex === this.selected && !item.disabled;
      const iy = startY + i * lineH;
      const hit = {
        id: item.id,
        item,
        x: x + 16,
        y: iy - 12,
        w: boxW - 32,
        h: rowH,
        disabled: !!item.disabled,
      };
      this.itemHits.push(hit);
      if (sel) {
        ctx.fillStyle = "rgba(201,168,76,0.15)";
        ctx.fillRect(hit.x, hit.y, hit.w, hit.h);
      }
      ctx.fillStyle = item.disabled ? "#556" : sel ? C.goldLite : C.cream;
      ctx.font = "15px Cinzel, Georgia, serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${sel ? "▸ " : "  "}${item.label}`, x + 28, iy);
    });

    if (this.message) {
      ctx.fillStyle = C.gold;
      ctx.font = "12px Libre Baskerville, Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText(this.message, x + boxW / 2, y + boxH - 28);
    }

    ctx.fillStyle = "#667";
    ctx.font = "11px Cinzel, Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("Click · ↑↓ · Enter · Esc", x + boxW / 2, y + boxH - 12);
  }

  /** Hit-test menu rows (canvas coords). */
  hitTest(mx, my) {
    for (const hit of this.itemHits) {
      if (
        mx >= hit.x &&
        mx <= hit.x + hit.w &&
        my >= hit.y &&
        my <= hit.y + hit.h
      ) {
        return hit;
      }
    }
    return null;
  }

  /** Hover: highlight row under cursor. Returns CSS cursor. */
  onPointerMove(mx, my) {
    if (!this.open) return "default";
    const hit = this.hitTest(mx, my);
    if (hit && !hit.disabled) {
      const enabled = this.items().filter((i) => !i.disabled);
      const idx = enabled.findIndex((i) => i.id === hit.id);
      if (idx >= 0) this.selected = idx;
      return "pointer";
    }
    return "default";
  }

  /** Click: activate row under cursor. */
  async onPointerUp(mx, my) {
    if (!this.open) return false;
    const hit = this.hitTest(mx, my);
    if (!hit || hit.disabled) return true; // consume click while menu is open
    const enabled = this.items().filter((i) => !i.disabled);
    const idx = enabled.findIndex((i) => i.id === hit.id);
    if (idx >= 0) this.selected = idx;
    await this.activateId(hit.id, hit.item);
    return true;
  }

  draw(ctx, W, H) {
    if (!this.open) return;
    const items = this.items();
    const isTitle = this.mode === MenuMode.TITLE;
    const useSplash = isTitle || (!this.engine._gameplay && !!this.engine.titleBg);
    ctx.save();

    if (useSplash) this.drawTitleBackdrop(ctx, W, H);
    else {
      ctx.fillStyle = "rgba(4, 8, 14, 0.82)";
      ctx.fillRect(0, 0, W, H);
    }

    const headers = {
      [MenuMode.TITLE]: null, // branding drawn above panel
      [MenuMode.PAUSE]: "Paused",
      [MenuMode.DEATH]: "You Died",
      [MenuMode.SAVE]: "Save Game",
      [MenuMode.LOAD]: "Load Game",
      [MenuMode.SETTINGS]: "Settings",
      [MenuMode.MAP]: "Map",
      [MenuMode.LOG]: "Text Log",
    };

    let subheader = null;
    if (this.mode === MenuMode.DEATH && this.engine.state.deathMessage) {
      subheader = this.engine.state.deathMessage;
    } else if (this.mode === MenuMode.PAUSE) {
      subheader = `Score ${this.engine.state.score} · Deaths ${this.engine.state.deaths}`;
    } else if (isTitle && (this.engine.state.score > 0 || this.engine.state.deaths > 0)) {
      subheader = `Score ${this.engine.state.score} · Deaths ${this.engine.state.deaths}`;
    }

    const boxW = 400;
    const lineH = 28;
    const headerH = headers[this.mode] ? 40 : 16;
    const subH = subheader ? 24 : 0;
    const footerH = this.message ? 44 : 32;
    const boxH = headerH + subH + 16 + items.length * lineH + footerH;
    const x = (W - boxW) / 2;

    let brandBottom = 0;
    if (isTitle) brandBottom = this.drawLandingBranding(ctx, W, H);

    // Title: menu sits under branding; other menus centered
    let y;
    if (isTitle) {
      y = Math.min(H - boxH - 24, Math.max(brandBottom + 8, H * 0.52));
    } else {
      y = (H - boxH) / 2;
    }

    this.drawMenuPanel(ctx, W, H, {
      x,
      y,
      boxW,
      boxH,
      items,
      header: headers[this.mode],
      subheader,
      useSplash,
    });

    ctx.restore();
  }

  async onKey(e) {
    if (!this.open) return false;
    if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      this.move(1);
      return true;
    }
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      this.move(-1);
      return true;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      await this.activate();
      return true;
    }
    if (e.key === "Escape") {
      if (this.mode === MenuMode.TITLE) return true;
      if (this.mode === MenuMode.DEATH) return true;
      if (this.mode === MenuMode.PAUSE) this.mode = MenuMode.NONE;
      else if (this.engine.state.dead) this.show(MenuMode.DEATH);
      else this.show(MenuMode.PAUSE);
      return true;
    }
    return true;
  }
}
