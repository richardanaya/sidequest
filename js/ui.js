/**
 * Adventure shell UI: verbs, inventory strip/expand, top bar, debug overlays.
 * Item names/icons come from the loaded content catalog (not hard-coded games).
 */
import { C, BOX_COLORS, VERBS } from "./palette.js";

export class UIShell {
  constructor({
    W = 960,
    H = 540,
    UI_TOP = 428,
    TOP_BAR = 30,
    itemsCatalog = null,
  } = {}) {
    this.W = W;
    this.H = H;
    this.UI_TOP = UI_TOP;
    this.TOP_BAR = TOP_BAR;
    this.SCENE_H = UI_TOP;
    /** @type {Record<string, { name?: string, desc?: string, iconImg?: CanvasImageSource }>} */
    this.itemsCatalog = itemsCatalog || {};

    this.verb = "Walk to";
    this.hoverName = "";
    this.sentence = "Walk to";
    this.showHitbox = false;
    this.showLabels = true;
    this.hideBg = false;
    this.hidePlayer = false;
    this.objectFilter = null;

    this.verbBtns = VERBS.map((v, i) => ({
      verb: v,
      x: 20 + (i % 3) * 128,
      y: UI_TOP + 14 + Math.floor(i / 3) * 36,
      w: 118,
      h: 30,
    }));
    this.verbBtns[4].x = 20 + 2 * 128;
    this.verbBtns[4].y = UI_TOP + 14 + 36;
  }

  setVerb(v, inventory) {
    this.verb = v;
    if (inventory) inventory.selected = null;
    this.updateSentence(undefined, inventory);
  }

  itemName(id) {
    return (
      this.itemsCatalog?.[id]?.name ||
      String(id || "item").replace(/[_-]+/g, " ")
    );
  }

  updateSentence(over, inventory) {
    if (over !== undefined) this.hoverName = over || "";
    const selected = inventory?.selected;
    if (selected && this.verb === "Use") {
      const selectedName = this.itemName(selected);
      this.sentence = this.hoverName
        ? `Use ${selectedName} with ${this.hoverName}`
        : `Use ${selectedName} with…`;
    } else if (this.hoverName) this.sentence = `${this.verb} ${this.hoverName}`;
    else this.sentence = this.verb;
  }

  objectVisible(id) {
    if (!this.objectFilter) return true;
    return this.objectFilter.has(id);
  }

  decoFrame(ctx, x, y, w, h, active) {
    ctx.fillStyle = active ? "#1a2830" : C.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = active ? C.goldLite : C.goldDim;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.strokeStyle = active ? "#2a7a88" : "#1a3040";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
    ctx.fillStyle = active ? C.gold : C.brass;
    const s = 5;
    ctx.fillRect(x, y, s, 2);
    ctx.fillRect(x, y, 2, s);
    ctx.fillRect(x + w - s, y, s, 2);
    ctx.fillRect(x + w - 2, y, 2, s);
    ctx.fillRect(x, y + h - 2, s, 2);
    ctx.fillRect(x, y + h - s, 2, s);
    ctx.fillRect(x + w - s, y + h - 2, s, 2);
    ctx.fillRect(x + w - 2, y + h - s, 2, s);
  }

  drawItemIcon(ctx, id, x, y, size) {
    if (!id) return;
    const def = this.itemsCatalog?.[id] || {};
    const s = size;
    const cx = x + s / 2;
    const cy = y + s / 2;
    // Content may supply iconImg (loaded from items.json "icon" path)
    if (def.iconImg) {
      const img = def.iconImg;
      const iw = img.naturalWidth || img.width || s;
      const ih = img.naturalHeight || img.height || s;
      const scale = Math.min((s - 8) / iw, (s - 8) / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      return;
    }
    // Generic content-driven tile: label from catalog name
    const name = def.name || String(id).replace(/[_-]+/g, " ");
    const tint = def.color || "#2a3540";
    ctx.fillStyle = tint;
    ctx.fillRect(x + 6, y + 6, s - 12, s - 12);
    ctx.strokeStyle = C.goldDim;
    ctx.strokeRect(x + 6.5, y + 6.5, s - 13, s - 13);
    ctx.fillStyle = C.creamDim;
    ctx.font = `${Math.max(9, Math.round(s * 0.22))}px Cinzel, Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.slice(0, 4).toUpperCase(), cx, cy);
  }

  wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text.split(" ");
    let line = "";
    let ly = y;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxW) {
        ctx.fillText(line, x, ly);
        line = word;
        ly += lineH;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, ly);
  }

  drawRoom(ctx, roomImg) {
    if (!roomImg) {
      ctx.fillStyle = "#1a3040";
      ctx.fillRect(0, 0, this.W, this.SCENE_H);
      return;
    }
    if (this.hideBg) {
      ctx.fillStyle = "#0a1218";
      ctx.fillRect(0, 0, this.W, this.SCENE_H);
      ctx.globalAlpha = 0.22;
      ctx.drawImage(roomImg, 0, 0, this.W, this.SCENE_H);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(roomImg, 0, 0, this.W, this.SCENE_H);
    }
  }

  drawDebugBox(ctx, hs) {
    if (!this.showHitbox || !this.objectVisible(hs.id)) return;
    const col = BOX_COLORS[hs.id] || "#ffffff";
    ctx.save();
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(hs.drawX + 0.5, hs.drawY + 0.5, hs.drawW - 1, hs.drawH - 1);
    ctx.setLineDash([]);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.12;
    ctx.fillRect(hs.hx, hs.hy, hs.hw, hs.hh);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.strokeRect(hs.hx + 0.5, hs.hy + 0.5, hs.hw - 1, hs.hh - 1);
    const t = 6;
    ctx.beginPath();
    ctx.moveTo(hs.hx, hs.hy + t);
    ctx.lineTo(hs.hx, hs.hy);
    ctx.lineTo(hs.hx + t, hs.hy);
    ctx.moveTo(hs.hx + hs.hw - t, hs.hy);
    ctx.lineTo(hs.hx + hs.hw, hs.hy);
    ctx.lineTo(hs.hx + hs.hw, hs.hy + t);
    ctx.moveTo(hs.hx, hs.hy + hs.hh - t);
    ctx.lineTo(hs.hx, hs.hy + hs.hh);
    ctx.lineTo(hs.hx + t, hs.hy + hs.hh);
    ctx.moveTo(hs.hx + hs.hw - t, hs.hy + hs.hh);
    ctx.lineTo(hs.hx + hs.hw, hs.hy + hs.hh);
    ctx.lineTo(hs.hx + hs.hw, hs.hy + hs.hh - t);
    ctx.stroke();
    if (this.showLabels) {
      const label = `${hs.id}  hit ${Math.round(hs.hw)}×${Math.round(hs.hh)}`;
      ctx.font = "11px ui-monospace, Menlo, monospace";
      const tw = ctx.measureText(label).width;
      const lx = hs.hx;
      const ly = Math.max(this.TOP_BAR + 4, hs.hy - 16);
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(lx, ly, tw + 8, 14);
      ctx.fillStyle = col;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(label, lx + 4, ly + 1);
    }
    ctx.restore();
  }

  drawDebugLegend(ctx, hotspots) {
    if (!this.showHitbox) return;
    const rows = hotspots.filter((h) => this.objectVisible(h.id));
    const pad = 8;
    const lineH = 14;
    const boxW = 168;
    const boxH = pad * 2 + lineH * (rows.length + 2);
    const x = this.W - boxW - 10;
    const y = this.TOP_BAR + 8;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = C.goldDim;
    ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, boxH - 1);
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = C.goldLite;
    ctx.fillText("DEBUG BOXES  (B toggle)", x + pad, y + pad);
    ctx.fillStyle = "#888";
    ctx.fillText(
      this.objectFilter ? `filter: ${[...this.objectFilter].join(",")}` : "filter: all",
      x + pad,
      y + pad + lineH
    );
    rows.forEach((hs, i) => {
      const col = BOX_COLORS[hs.id] || "#fff";
      const ly = y + pad + lineH * (i + 2);
      ctx.fillStyle = col;
      ctx.fillRect(x + pad, ly + 2, 10, 10);
      ctx.fillStyle = "#ddd";
      ctx.fillText(hs.id, x + pad + 16, ly);
    });
  }

  drawDeveloperState(ctx, { roomId, player, flags, actionPending, fps }) {
    if (!this.showHitbox) return;
    const lines = [
      `room ${roomId}`,
      `player ${Math.round(player.x)},${Math.round(player.y)} ${player.animationState}`,
      `action ${actionPending ? "pending" : "idle"}  fps ${Math.round(fps)}`,
      ...Object.entries(flags || {}).map(([key, value]) => `${key}=${value}`),
    ];
    const x = 10;
    const y = this.TOP_BAR + 8;
    const width = 210;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(x, y, width, 12 + lines.length * 13);
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    lines.forEach((line, index) => {
      ctx.fillStyle = index === 0 ? C.goldLite : "#ddd";
      ctx.fillText(line, x + 7, y + 6 + index * 13);
    });
  }

  drawProps(ctx, room) {
    const sorted = [...room.hotspots]
      .filter((h) => this.objectVisible(h.id))
      .sort((a, b) => a.drawY + a.drawH - (b.drawY + b.drawH));

    for (const hs of sorted) {
      this.drawProp(ctx, room, hs);
    }
  }

  drawProp(ctx, room, hs) {
      // noSprite = hitbox only (e.g. doorway). Art lives in backdrop variants, never drawn here.
      if (hs.noSprite) {
        this.drawDebugBox(ctx, hs);
        return;
      }
      const img = room.propImgs[hs.id];
      if (!img) {
        this.drawDebugBox(ctx, hs);
        return;
      }
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(
        hs.drawX + hs.drawW / 2,
        hs.drawY + hs.drawH - 2,
        hs.drawW * 0.28,
        5,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.drawImage(img, hs.drawX, hs.drawY, hs.drawW, hs.drawH);
      if (hs.id === "safe" && (room.story?.safeOpen || room.interactions?.safe?.flags?.open)) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(
          hs.drawX + hs.drawW * 0.28,
          hs.drawY + hs.drawH * 0.3,
          hs.drawW * 0.44,
          hs.drawH * 0.4
        );
      }
      this.drawDebugBox(ctx, hs);
  }

  drawSceneEntities(ctx, room, player) {
    const visible = room.hotspots.filter((h) => this.objectVisible(h.id));
    for (const hs of visible.filter((h) => h.kind === "wall")) this.drawProp(ctx, room, hs);
    const entities = visible
      .filter((h) => h.kind !== "wall")
      .map((hotspot) => ({ type: "prop", depth: hotspot.depthY, hotspot }));
    entities.push({ type: "player", depth: player.y });
    entities.sort((a, b) => a.depth - b.depth);
    for (const entity of entities) {
      if (entity.type === "player") this.drawCharacter(ctx, player);
      else this.drawProp(ctx, room, entity.hotspot);
    }
  }

  drawCharacter(ctx, player) {
    if (this.hidePlayer) return;
    if (this.objectFilter && !this.objectFilter.has("player")) return;

    const walkSprite = player.captureWalkFrame();
    const walkRect = player.getWalkDrawRect?.() || null;
    const h = player.height;
    const idleAspect =
      player.idleCanvas && player.idleCanvas.height
        ? player.idleCanvas.width / player.idleCanvas.height
        : 0.28;
    const w = Math.round(h * idleAspect);
    player.w = w;
    player.h = h;
    const idleX = player.x - w / 2;
    const idleY = player.y - h;

    const shadowA = 0.22 + player.walkBlend * 0.08;
    ctx.fillStyle = `rgba(0,0,0,${shadowA})`;
    ctx.beginPath();
    ctx.ellipse(
      player.x,
      player.y - 2,
      w * (0.34 + player.walkBlend * 0.06),
      5,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    const drawSprite = (sprite, dx, dy, dw, dh, alpha) => {
      if (!sprite || alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      if (player.facing < 0) {
        // Flip around foot/center X so feet stay planted
        ctx.translate(player.x, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, dx - player.x, 0, dw, dh);
      } else {
        ctx.drawImage(sprite, dx, dy, dw, dh);
      }
      ctx.restore();
    };

    const blend = player.walkBlend;
    if (blend >= 0.5 && walkSprite && walkRect) {
      // Full walk frame, scaled from first-frame content height — no crop, no squash
      drawSprite(walkSprite, walkRect.dx, walkRect.dy, walkRect.dw, walkRect.dh, 1);
    } else {
      drawSprite(player.idleCanvas, idleX, idleY, w, h, 1);
    }

    if (this.showHitbox) {
      const col = BOX_COLORS.player;
      const drawX = idleX;
      const drawY = idleY;
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(drawX + 0.5, drawY + 0.5, w - 1, h - 1);
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX + 0.5, drawY + 0.5, w - 1, h - 1);
      if (this.showLabels) {
        const label = `player  ${Math.round(w)}×${Math.round(h)}  b${blend.toFixed(2)}`;
        ctx.font = "11px ui-monospace, Menlo, monospace";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(0,0,0,0.72)";
        ctx.fillRect(drawX, drawY - 16, tw + 8, 14);
        ctx.fillStyle = col;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(label, drawX + 4, drawY - 15);
      }
      ctx.restore();
    }
  }

  drawHover(ctx, hs) {
    if (!hs || hs.noSprite) return; // doorways: no floating outline (backdrop owns the art)
    ctx.strokeStyle = "rgba(201,168,76,0.75)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(hs.hx - 2, hs.hy - 2, hs.hw + 4, hs.hh + 4);
    ctx.setLineDash([]);
  }

  drawTop(ctx, { dialogueText, dialogue, objective }) {
    ctx.fillStyle = "rgba(8,14,20,0.92)";
    ctx.fillRect(0, 0, this.W, this.TOP_BAR);
    ctx.fillStyle = C.goldDim;
    ctx.fillRect(0, this.TOP_BAR - 2, this.W, 2);
    ctx.fillStyle = C.gold;
    for (let x = 20; x < this.W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, this.TOP_BAR - 2);
      ctx.lineTo(x + 6, this.TOP_BAR - 8);
      ctx.lineTo(x + 12, this.TOP_BAR - 2);
      ctx.fill();
    }
    ctx.fillStyle = C.cream;
    ctx.font = "13px Cinzel, Georgia, serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(this.sentence, 18, this.TOP_BAR / 2 - 1);
    ctx.fillStyle = C.goldDim;
    ctx.font = "11px Cinzel, Georgia, serif";
    ctx.textAlign = "right";
    ctx.fillText(objective || "", this.W - 18, this.TOP_BAR / 2 - 1);

    if (dialogueText) {
      const pad = 14;
      const boxY = this.TOP_BAR + 10;
      const choices = dialogue?.choices || [];
      const boxH = 62 + choices.length * 22;
      ctx.fillStyle = "rgba(8,14,20,0.94)";
      ctx.fillRect(pad, boxY, this.W - pad * 2, boxH);
      ctx.strokeStyle = C.goldDim;
      ctx.lineWidth = 2;
      ctx.strokeRect(pad + 1, boxY + 1, this.W - pad * 2 - 2, boxH - 2);
      ctx.fillStyle = C.cream;
      ctx.font = "14px 'Libre Baskerville', Georgia, serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      this.wrapText(ctx, dialogueText, pad + 16, boxY + 12, this.W - pad * 2 - 32, 18);
      choices.forEach((choice, index) => {
        const cy = boxY + 60 + index * 22;
        ctx.fillStyle = "rgba(201,168,76,0.12)";
        ctx.fillRect(pad + 12, cy, this.W - pad * 2 - 24, 19);
        ctx.fillStyle = C.goldLite;
        ctx.fillText(`${index + 1}. ${choice.text}`, pad + 20, cy + 2);
      });
    }
  }

  dialogueChoiceAt(x, y, dialogue) {
    const choices = dialogue?.choices || [];
    const startY = this.TOP_BAR + 70;
    if (x < 26 || x > this.W - 26) return null;
    for (let index = 0; index < choices.length; index++) {
      const cy = startY + index * 22;
      if (y >= cy && y <= cy + 19) return index;
    }
    return null;
  }

  drawBottom(ctx, inventory) {
    const inv = inventory;
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, this.UI_TOP, this.W, this.H - this.UI_TOP);
    ctx.fillStyle = C.goldDim;
    ctx.fillRect(0, this.UI_TOP, this.W, 3);
    ctx.fillStyle = C.teal;
    ctx.fillRect(0, this.UI_TOP + 3, this.W, 2);

    for (const b of this.verbBtns) {
      const active = this.verb === b.verb && !inv.selected;
      this.decoFrame(ctx, b.x, b.y, b.w, b.h, active);
      ctx.fillStyle = active ? C.goldLite : C.creamDim;
      ctx.font = "12px Cinzel, Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.verb.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2 + 1);
    }

    ctx.fillStyle = C.goldLite;
    ctx.font = "14px Cinzel, Georgia, serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("◆  INVENTORY  ◆", inv.INV_X, inv.INV_LABEL_Y);
    ctx.fillStyle = C.goldDim;
    ctx.font = "10px Cinzel, Georgia, serif";
    const countLabel =
      inv.length === 0
        ? "empty · click to expand"
        : `${inv.length} item${inv.length === 1 ? "" : "s"} · I / click to expand`;
    ctx.fillText(countLabel, inv.INV_X + 148, inv.INV_LABEL_Y + 3);

    const arrows = inv.arrowRects();
    const maxScroll = Math.max(0, inv.length - inv.INV_VISIBLE);
    const canLeft = inv.scroll > 0;
    const canRight = inv.scroll < maxScroll;

    const drawArrow = (rect, enabled, dir) => {
      ctx.fillStyle = enabled ? "#1a2830" : "#12161c";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = enabled ? C.goldDim : "#2a3038";
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      ctx.fillStyle = enabled ? C.goldLite : "#3a4450";
      ctx.beginPath();
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      if (dir < 0) {
        ctx.moveTo(cx + 4, cy - 8);
        ctx.lineTo(cx - 5, cy);
        ctx.lineTo(cx + 4, cy + 8);
      } else {
        ctx.moveTo(cx - 4, cy - 8);
        ctx.lineTo(cx + 5, cy);
        ctx.lineTo(cx - 4, cy + 8);
      }
      ctx.closePath();
      ctx.fill();
    };
    drawArrow(arrows.left, canLeft, -1);
    drawArrow(arrows.right, canRight, 1);

    for (let v = 0; v < inv.INV_VISIBLE; v++) {
      const r = inv.stripSlot(v);
      const index = inv.scroll + v;
      const id = inv.items[index] || null;
      const sel = id && inv.selected === id;
      this.decoFrame(ctx, r.x, r.y, r.w, r.h, sel);
      if (id) this.drawItemIcon(ctx, id, r.x, r.y, r.w);
    }

    if (maxScroll > 0) {
      const dots = maxScroll + 1;
      const dotY = inv.INV_Y + inv.INV_SLOT + 6;
      const totalW = dots * 8;
      let dx =
        inv.INV_STRIP_X +
        (inv.INV_VISIBLE * (inv.INV_SLOT + inv.INV_GAP) - inv.INV_GAP - totalW) / 2;
      for (let d = 0; d < dots; d++) {
        ctx.beginPath();
        ctx.fillStyle = d === inv.scroll ? C.goldLite : C.goldDim;
        ctx.arc(dx + 3, dotY, d === inv.scroll ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
        dx += 8;
      }
    }
  }

  drawExpandedInventory(ctx, inventory) {
    if (!inventory.expanded) return;
    const inv = inventory;
    const L = inv.expandedLayout(this.W, this.UI_TOP, this.TOP_BAR);

    ctx.fillStyle = "rgba(4, 8, 12, 0.72)";
    ctx.fillRect(0, this.TOP_BAR, this.W, this.UI_TOP - this.TOP_BAR);

    ctx.fillStyle = "rgba(10, 16, 22, 0.96)";
    ctx.fillRect(L.boxX, L.boxY, L.boxW, L.boxH);
    ctx.strokeStyle = C.goldDim;
    ctx.lineWidth = 2;
    ctx.strokeRect(L.boxX + 1, L.boxY + 1, L.boxW - 2, L.boxH - 2);
    ctx.strokeStyle = C.teal;
    ctx.lineWidth = 1;
    ctx.strokeRect(L.boxX + 5, L.boxY + 5, L.boxW - 10, L.boxH - 10);

    ctx.fillStyle = C.goldLite;
    ctx.font = "16px Cinzel, Georgia, serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `◆  INVENTORY  ·  ${inv.length} item${inv.length === 1 ? "" : "s"}`,
      L.boxX + L.pad,
      L.boxY + 22
    );
    ctx.fillStyle = C.goldDim;
    ctx.font = "11px Cinzel, Georgia, serif";
    ctx.fillText("I or Esc to close", L.boxX + L.pad, L.boxY + L.headH + 2);

    const closeX = L.boxX + L.boxW - 36;
    const closeY = L.boxY + 10;
    this.decoFrame(ctx, closeX, closeY, 26, 22, false);
    ctx.fillStyle = C.goldLite;
    ctx.font = "14px Cinzel, Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✕", closeX + 13, closeY + 12);

    const total = L.cols * L.rows;
    for (let i = 0; i < total; i++) {
      const r = inv.expandedSlotRect(i, L);
      const id = inv.items[L.start + i] || null;
      const sel = id && inv.selected === id;
      this.decoFrame(ctx, r.x, r.y, r.w, r.h, sel);
      if (id) this.drawItemIcon(ctx, id, r.x, r.y, r.w);
    }
  }

  drawWin(ctx, room) {
    if (!room.gameWon) return;
    // Title/message come from content (room.winTitle / winMessage) — never hard-code a game
    const title = room.winTitle || "COMPLETE";
    const message = room.winMessage || "";
    ctx.fillStyle = `rgba(8,20,28,${Math.min(0.5, 0.2 + room.winFlash * 0.12)})`;
    ctx.fillRect(0, this.TOP_BAR, this.W, this.UI_TOP - this.TOP_BAR);
    ctx.fillStyle = C.goldLite;
    ctx.font = "22px Cinzel, Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(title).toUpperCase().slice(0, 48), this.W / 2, this.UI_TOP / 2 - 8);
    if (message) {
      ctx.fillStyle = C.creamDim;
      ctx.font = "13px 'Libre Baskerville', Georgia, serif";
      const short =
        message.length > 90 ? `${message.slice(0, 87).trim()}…` : message;
      ctx.fillText(short, this.W / 2, this.UI_TOP / 2 + 24);
    }
  }

  /** Hit-test UI (verbs, inventory, expanded panel). */
  uiAt(mx, my, inventory) {
    const inv = inventory;
    if (inv.expanded) {
      const L = inv.expandedLayout(this.W, this.UI_TOP, this.TOP_BAR);
      const close = { x: L.boxX + L.boxW - 36, y: L.boxY + 10, w: 26, h: 22 };
      if (mx >= close.x && mx <= close.x + close.w && my >= close.y && my <= close.y + close.h)
        return { type: "inv-close" };
      const totalSlots = L.cols * L.rows;
      for (let i = 0; i < totalSlots; i++) {
        const r = inv.expandedSlotRect(i, L);
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h)
          return { type: "inv", id: inv.items[L.start + i] || null, index: L.start + i };
      }
      if (mx >= L.boxX && mx <= L.boxX + L.boxW && my >= L.boxY && my <= L.boxY + L.boxH)
        return { type: "inv-panel" };
      return { type: "inv-dismiss" };
    }

    if (my < this.UI_TOP) return null;

    for (const b of this.verbBtns) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h)
        return { type: "verb", verb: b.verb };
    }

    const expandBtn = inv.expandButtonRect();
    if (
      mx >= expandBtn.x &&
      mx <= expandBtn.x + expandBtn.w &&
      my >= expandBtn.y &&
      my <= expandBtn.y + expandBtn.h
    )
      return { type: "inv-expand" };

    const arrows = inv.arrowRects();
    const maxScroll = Math.max(0, inv.length - inv.INV_VISIBLE);
    if (
      inv.scroll > 0 &&
      mx >= arrows.left.x &&
      mx <= arrows.left.x + arrows.left.w &&
      my >= arrows.left.y &&
      my <= arrows.left.y + arrows.left.h
    )
      return { type: "inv-scroll", dir: -1 };
    if (
      maxScroll > 0 &&
      inv.scroll < maxScroll &&
      mx >= arrows.right.x &&
      mx <= arrows.right.x + arrows.right.w &&
      my >= arrows.right.y &&
      my <= arrows.right.y + arrows.right.h
    )
      return { type: "inv-scroll", dir: 1 };

    for (let v = 0; v < inv.INV_VISIBLE; v++) {
      const r = inv.stripSlot(v);
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        const index = inv.scroll + v;
        return { type: "inv", id: inv.items[index] || null, index };
      }
    }
    return { type: "panel" };
  }
}
