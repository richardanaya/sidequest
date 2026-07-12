/**
 * Room pack: backdrop, prop sprites, hotspots, room-specific story actions.
 */
export class Room {
  constructor({ say, inventory, itemsCatalog, state = null, runtime = null }) {
    this.say = say;
    this.inventory = inventory;
    this.itemsCatalog = itemsCatalog;
    this.state = state;
    this.runtime = runtime;
    this.script = null;

    this.pack = null;
    this.backdrop = null;
    /** @type {Record<string, HTMLImageElement>} src path → image */
    this.backdropImgs = {};
    this.propImgs = {};
    this.hotspots = [];
    this.resetState();
  }

  resetState() {
    this.story = {
      knowCode: false,
      readNote: false,
      hasKey: false,
      escaped: false,
    };
    this.gameWon = false;
    this.winFlash = 0;
  }

  load({
    pack,
    backdropImg,
    backdropImgs = null,
    propImgs,
    script = null,
    preserveState = false,
  }) {
    if (!preserveState) this.resetState();
    this.pack = pack;
    this.backdropImgs = backdropImgs || {};
    const defaultSrc = pack?.backdrop || "backdrop.jpg";
    if (backdropImg && !this.backdropImgs[defaultSrc]) {
      this.backdropImgs[defaultSrc] = backdropImg;
    }
    this.propImgs = propImgs || {};
    this.script = script;
    if (script) this.restoreScriptState();
    this.buildHotspots();
    this.syncBackdrop();
  }

  restoreScriptState() {
    const saved = this.state?.room(this.pack.id);
    this.story = { ...(this.script.flags || {}), ...(saved?.flags || {}) };
    this.gameWon = !!saved?.won;
  }

  persistScriptState() {
    if (!this.state || !this.pack) return;
    this.state.room(this.pack.id).flags = { ...this.story };
    this.state.room(this.pack.id).won = this.gameWon;
  }

  /**
   * Pick backdrop from room.pack.backdrops (first matching when), else pack.backdrop.
   * Content authors ship alternate plates — engine only swaps images by flag.
   */
  syncBackdrop() {
    const pack = this.pack;
    if (!pack) return;
    const defaultSrc = pack.backdrop || "backdrop.jpg";
    let chosen = defaultSrc;
    const variants = pack.backdrops;
    if (Array.isArray(variants) && variants.length && this.runtime) {
      for (const variant of variants) {
        if (!variant?.src) continue;
        if (variant.when && !this.runtime.test(variant.when)) continue;
        chosen = variant.src;
        break;
      }
    }
    this.backdrop =
      this.backdropImgs[chosen] ||
      this.backdropImgs[defaultSrc] ||
      this.backdrop ||
      null;
    this.backdropSrc = chosen;
  }

  get id() {
    return this.pack?.id;
  }

  get name() {
    return this.pack?.name || "Room";
  }

  get floorY() {
    return this.pack?.floorY_scene ?? 373;
  }

  get manH() {
    return this.pack?.manH_scene ?? 148;
  }

  get spawn() {
    return this.pack?.spawn || { xFactor: 0.32, facing: 1 };
  }

  get slots() {
    return this.pack?.slots || {};
  }

  get walkBounds() {
    const width = this.pack?.sceneSize?.[0] || 960;
    return this.pack?.walkBounds || { min: 70, max: width - 70 };
  }

  /** Room-specific interaction handlers (maintenance_hall puzzle). */
  makeInteractions() {
    if (this.script?.objects && this.runtime) return this.makeScriptInteractions();
    const room = this;
    const inv = this.inventory;
    const say = (t, d) => this.say(t, d);

    return {
      door: {
        name: "airlock door",
        noSprite: true,
        flags: { locked: true },
        look: () =>
          room.interactions.door.flags.locked
            ? "Maintenance airlock. Sealed from this side. The only exit."
            : "The airlock stands open.",
        talk: "No answer.",
        take: "Fixed to the bulkhead.",
        use: () => room.tryDoor(),
        useWith: (item) => {
          if (item === "key") {
            room.tryDoor();
            return true;
          }
          if (item === "note") {
            say("The note isn't a key. It only pointed you to the planter.");
            return true;
          }
          return false;
        },
      },
      portrait: {
        name: "wall portrait",
        look: "A stern face in a gilt frame. The brass plaque is fouled with grime — numbers underneath.",
        talk: "Silence.",
        take: "Bolted to the wall.",
        use: () => {
          room.story.knowCode = true;
          say("You clear the plaque. 1-9-5-9. A combination — likely for the wall safe.");
        },
      },
      plant: {
        name: "wilted planter",
        look: () =>
          room.story.hasKey
            ? "Disturbed soil. Nothing else remains."
            : room.story.readNote
              ? "The soil is loose. The note said the key is here."
              : "Brass urn, dead leaves. The soil looks recently turned.",
        talk: "…",
        take: () => room.digPlant(),
        use: () => room.digPlant(),
        useWith: (item) => {
          if (item === "note") {
            room.story.readNote = true;
            say('You compare the note to the planter. "KEY IN THE PLANTER."');
            return true;
          }
          return false;
        },
      },
      cat: {
        name: "stray cat",
        look: "A thin orange cat. It watches the room without interest.",
        talk: () => {
          if (room.story.escaped) say("The cat ignores you.");
          else if (!room.story.knowCode)
            say("It glances toward the portrait, then looks away.");
          else if (!room.story.readNote)
            say("Its attention drifts to the wall safe.");
          else if (!room.story.hasKey)
            say("It sits by the planter as if waiting.");
          else say("It looks toward the airlock.");
        },
        take: "It slips out of reach.",
        use: () => say("It allows a brief touch, then steps aside."),
      },
      desk: {
        name: "desk",
        flags: { looted: false },
        look: () =>
          room.interactions.desk.flags.looted
            ? "Dust and empty drawers."
            : "A writing desk. A brass coin lies on the blotter.",
        talk: "…",
        take: () => room.takeCoin(),
        use: () => room.takeCoin(),
      },
      safe: {
        name: "wall safe",
        flags: { open: false },
        look: () => {
          if (room.interactions.safe.flags.open) return "The safe is open and empty.";
          if (room.story.knowCode)
            return "Combination lock. You have the numbers: 1-9-5-9.";
          return "A wall safe. Combination unknown.";
        },
        talk: "…",
        take: "Mounted into the wall.",
        use: () => room.trySafe(),
        useWith: (item) => {
          if (item === "note") {
            say("The note was inside the safe.");
            return true;
          }
          return false;
        },
      },
    };
  }

  makeScriptInteractions() {
    const interactions = {};
    const run = (branches, fallback) => {
      const branch = this.runtime.select(branches || []);
      if (branch) this.runtime.run(branch.steps || [branch]).then(() => this.persistScriptState());
      else if (fallback) this.say(fallback);
    };
    for (const [id, spec] of Object.entries(this.script.objects)) {
      const roomState = this.state?.room(this.id);
      const inter = {
        name: spec.name || id,
        flags: roomState ? (roomState.objects[id] ||= {}) : {},
      };
      for (const [verb, key] of [["look", "look"], ["talk", "talk"], ["take", "take"], ["use", "use"]]) {
        inter[verb] = () => run(spec[key], spec.fallback);
      }
      inter.useWith = (item) => {
        const branches = spec.useWith?.[item];
        if (!branches) return false;
        run(branches);
        return true;
      };
      interactions[id] = inter;
    }
    return interactions;
  }

  takeCoin() {
    const desk = this.interactions.desk;
    if (desk.flags.looted) {
      this.say("Nothing left on the table.");
      return;
    }
    desk.flags.looted = true;
    this.inventory.give("coin");
    this.say("You take the brass coin.");
  }

  trySafe() {
    const safe = this.interactions.safe;
    if (safe.flags.open) {
      if (!this.inventory.has("note")) {
        this.inventory.give("note");
        this.story.readNote = true;
        this.say('Still a note in there. You take it: "KEY IN THE PLANTER."');
      } else this.say("Empty.");
      return;
    }
    if (!this.story.knowCode) {
      this.say("The dial won't give without the combination.");
      return;
    }
    safe.flags.open = true;
    this.inventory.give("note");
    this.story.readNote = true;
    this.say('1-9-5-9. The lock yields. Inside: a note. "KEY IN THE PLANTER — —R."');
  }

  digPlant() {
    if (this.story.hasKey) {
      this.say("Nothing more in the soil.");
      return;
    }
    if (!this.story.readNote) {
      this.say("You leave the soil alone. No reason to dig yet.");
      return;
    }
    this.story.hasKey = true;
    this.inventory.give("key");
    this.say("Buried in the soil: a brass key.");
  }

  tryDoor() {
    const door = this.interactions.door;
    if (this.story.escaped || !door.flags.locked) {
      this.say("The airlock is already open.");
      return;
    }
    if (!this.inventory.has("key")) {
      this.say("Locked.");
      return;
    }
    door.flags.locked = false;
    this.story.escaped = true;
    this.gameWon = true;
    this.winFlash = 2.5;
    this.inventory.remove("key");
    this.say("The key turns. The airlock opens.");
  }

  objectiveText() {
    if (this.script?.objectives && this.runtime) {
      return this.runtime.select(this.script.objectives)?.text || "";
    }
    if (this.story.escaped) return "Escaped.";
    if (this.story.hasKey) return "Goal: unlock the door";
    if (this.story.readNote) return "Goal: dig in the planter";
    if (this.story.knowCode) return "Goal: open the wall safe";
    return "Goal: find a way out";
  }

  buildHotspots() {
    this.interactions = this.makeInteractions();
    // apply hotspotMeta names
    const metaAll = this.pack?.hotspotMeta || {};
    for (const [id, meta] of Object.entries(metaAll)) {
      if (this.interactions[id] && meta.name) {
        this.interactions[id].name = meta.name;
      }
    }

    this.hotspots = [];
    for (const [id, slot] of Object.entries(this.slots)) {
      const meta = metaAll[id] || {};
      const inter = this.interactions[id] || {
        name: meta.name || id,
        look: `It's ${meta.name || id}.`,
        talk: "…",
        take: "You leave it.",
        use: () => this.say("Nothing happens."),
      };

      const kind = slot.kind || "floor";
      const noSprite = !!(slot.noSprite || inter.noSprite || meta.noSprite);

      let drawX = slot.sceneDrawX;
      let drawY = slot.sceneDrawY;
      let drawW = slot.sceneDrawW;
      let drawH = slot.sceneDrawH;
      let walkX = slot.walkX != null ? slot.walkX : slot.sceneCx;

      if (drawX == null || drawW == null) {
        drawX = slot.sceneX0 || 0;
        drawY = slot.sceneY0 || 0;
        drawW = slot.sceneW || 80;
        drawH = slot.sceneH || 80;
      }

      let hx = slot.hx != null ? slot.hx : drawX + Math.max(2, drawW * 0.08);
      let hy = slot.hy != null ? slot.hy : drawY + Math.max(2, drawH * 0.05);
      let hw = slot.hw != null ? slot.hw : Math.max(8, drawW * 0.84);
      let hh = slot.hh != null ? slot.hh : Math.max(8, drawH * 0.9);
      if (noSprite) {
        hx = drawX;
        hy = drawY;
        hw = drawW;
        hh = drawH;
      }

      const W = this.pack?.sceneSize?.[0] || 960;
      walkX = Math.max(60, Math.min(W - 60, walkX || drawX + drawW / 2));

      this.hotspots.push({
        id,
        name: inter.name,
        noSprite,
        drawX,
        drawY,
        drawW,
        drawH,
        hx,
        hy,
        hw,
        hh,
        walkX,
        kind,
        depthY: slot.depthY ?? drawY + drawH,
        z: kind === "wall" ? 1 : 2,
        inter,
      });
    }
  }

  hotspotAt(mx, my, objectVisible = () => true) {
    const sorted = [...this.hotspots]
      .filter((h) => objectVisible(h.id))
      .sort((a, b) => b.z - a.z);
    for (const h of sorted) {
      if (mx >= h.hx && mx <= h.hx + h.hw && my >= h.hy && my <= h.hy + h.hh) {
        return h;
      }
    }
    return null;
  }

  resolveAction(hs, { verb, selectedItem, clearSelected, setVerbUse }) {
    const inter = hs.inter;
    const items = this.itemsCatalog;

    if (selectedItem && verb === "Use") {
      if (inter.useWith && inter.useWith(selectedItem)) {
        clearSelected();
        return;
      }
      this.say(
        `Can't use ${items[selectedItem]?.name || selectedItem} with ${inter.name}.`
      );
      clearSelected();
      return;
    }

    switch (verb) {
      case "Walk to":
        break;
      case "Look at": {
        const t = typeof inter.look === "function" ? inter.look() : inter.look;
        this.say(t || inter.name);
        break;
      }
      case "Talk to":
        if (typeof inter.talk === "function") inter.talk();
        else this.say(inter.talk || "…");
        break;
      case "Take":
        if (typeof inter.take === "function") inter.take();
        else this.say(inter.take || "Can't take that.");
        break;
      case "Use":
        if (typeof inter.use === "function") inter.use();
        else this.say("Nothing happens.");
        break;
    }
  }

  update(dt) {
    if (this.winFlash > 0) this.winFlash = Math.max(0, this.winFlash - dt);
  }
}
