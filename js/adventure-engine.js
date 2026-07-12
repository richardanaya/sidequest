/**
 * AdventureEngine — full point-and-click adventure platform.
 *
 * Features: content packs, multi-room travel, GameState + save/load,
 * data-driven scripts, walk mesh, audio, menus (title/death/pause),
 * cutscenes, transitions, score, text log, triggers, NPCs, debug tools.
 */
import { ChromaKey } from "./chroma.js";
import { ContentLoader } from "./content-loader.js";
import { Dialogue } from "./dialogue.js";
import { Inventory } from "./inventory.js";
import { Player } from "./player.js";
import { Room } from "./room.js";
import { UIShell } from "./ui.js";
import { ITEMS, TEST_INV_IDS } from "./items.js";
import { C } from "./palette.js";
import { ActionQueue } from "./action-queue.js";
import { AudioBus } from "./audio-bus.js";
import { GameState } from "./game-state.js";
import { SaveStore } from "./save-store.js";
import { ScriptRuntime } from "./script-runtime.js";
import { WalkMesh } from "./walk-mesh.js";
import { Transition } from "./transition.js";
import { CutscenePlayer } from "./cutscene.js";
import { MenuSystem, MenuMode } from "./menu-system.js";
import { Npc } from "./npc.js";
import { ConversationSystem } from "./conversation.js";
import { EffectsSystem } from "./effects-system.js";
import { PuzzleAnalyzer } from "./puzzle-analyzer.js";
import { ResponseSystem } from "./response-system.js";
import { SpellSystem } from "./spell-system.js";
import { CursorController } from "./cursor-controller.js";
import { SceneObjectManager } from "./scene-object.js";
import {
  AppearanceSystem,
  EconomySystem,
  GameTimerSystem,
  MinigameSystem,
  RelationshipSystem,
} from "./lifestyle-systems.js";

export class AdventureEngine {
  constructor({
    canvas,
    walkVideo,
    statusEl = null,
    titleEl = null,
    cacheBust = `?v=${Date.now()}`,
    contentRoot = "game_data",
    room = null,
    character = null,
    showTitle = true,
  }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.walkVideo = walkVideo;
    this.statusEl = statusEl;
    this.titleEl = titleEl;
    this.showTitle = showTitle;

    this.W = canvas.width;
    this.H = canvas.height;
    this.UI_TOP = 428;
    this.TOP_BAR = 30;
    this.FLOOR_TOP = 300;

    this.urlParams = new URLSearchParams(location.search);
    this.roomId = room || this.urlParams.get("room") || null;
    this.characterId = character || this.urlParams.get("character") || null;

    this.loader = new ContentLoader({ cacheBust, root: contentRoot });
    this.chroma = new ChromaKey();
    this.dialogue = new Dialogue();
    this.state = new GameState();
    this.saves = new SaveStore();
    this.actions = new ActionQueue();
    this.audio = new AudioBus();
    this.transition = new Transition();
    this.cutscenes = new CutscenePlayer(this);
    this.menus = new MenuSystem(this);
    this.walkMesh = new WalkMesh();
    this.npcs = [];
    this.triggers = [];
    this.disabledHotspots = new Set();
    this.path = [];
    this.pathIndex = 0;

    this.inventory = new Inventory({
      labelX: 420,
      labelY: this.UI_TOP + 16,
      stripX: 420 + 22 + 4,
      stripY: this.UI_TOP + 40,
    });
    this.player = new Player({ chroma: this.chroma, walkVideo: this.walkVideo });

    this.runtime = new ScriptRuntime(this._runtimeServices());
    this.conversations = new ConversationSystem({ state: this.state, runtime: this.runtime, dialogue: this.dialogue });
    this.responses = new ResponseSystem(this.state);
    this.spells = new SpellSystem({ state: this.state, runtime: this.runtime, inventory: this.inventory });
    this.effects = new EffectsSystem({ reduceMotion: () => this.state.settings.reduceMotion });
    this.analyzer = new PuzzleAnalyzer();
    this.cursor = new CursorController();
    this.sceneObjects = new SceneObjectManager(this.state);
    this._bindLifestyleSystems();
    this.room = new Room({
      say: (t, d, o) => {
        this.dialogue.say(t, d, o);
        this.state.pushLog(t, o?.speaker);
      },
      inventory: this.inventory,
      itemsCatalog: ITEMS,
      state: this.state,
      runtime: this.runtime,
    });
    this.ui = new UIShell({
      W: this.W,
      H: this.H,
      UI_TOP: this.UI_TOP,
      TOP_BAR: this.TOP_BAR,
    });

    this._applyDebugParams();
    this.hoverHotspot = null;
    this.lastT = 0;
    this.assetsReady = false;
    this._raf = 0;
    this._bound = false;
    this._running = false;
    this._gameplay = false;
    this._loadGeneration = 0;
    this.fps = 0;
    this.roomPath = null;
    this.titleBg = null;
    this.branding = {
      title: "Sealed",
      subtitle: "A Point-and-Click Adventure",
      tagline: "",
    };
  }

  /** Load registry branding + landing splash (content.json title / titleBackground). */
  async loadTitleBackground() {
    await this.loader.loadRegistry();
    const reg = this.loader.registry || {};
    this.branding = {
      title: reg.title || "Sealed",
      subtitle: reg.subtitle || "A Point-and-Click Adventure",
      tagline: reg.tagline || "",
    };
    this.applyBrandingChrome();

    const path =
      reg.defaults?.titleBackground ||
      this.urlParams.get("titlebg") ||
      null;
    if (!path) {
      this.titleBg = null;
      return null;
    }
    try {
      this.titleBg = await this.loader.loadImage(path);
    } catch (err) {
      console.warn("Title background failed to load:", path, err);
      this.titleBg = null;
    }
    return this.titleBg;
  }

  /** Browser tab title only (no outer page heading). */
  applyBrandingChrome(roomName = null) {
    const name = this.branding?.title || "Sealed";
    if (roomName) document.title = `${roomName} — ${name}`;
    else document.title = `${name}${this.branding?.subtitle ? ` — ${this.branding.subtitle}` : ""}`;
  }

  _runtimeServices() {
    return {
      inventory: this.inventory,
      say: (text, duration, opts) => {
        const speed = this.state.settings.textSpeed || 1;
        const d = duration != null ? duration / speed : undefined;
        this.dialogue.say(text, d, opts);
        this.state.pushLog(text, opts?.speaker);
      },
      log: (text, speaker) => this.state.pushLog(text, speaker),
      getFlag: (key) => {
        if (this.room?.story && key in this.room.story) return !!this.room.story[key];
        return this.state.getFlag(key);
      },
      setFlag: (key, value) => {
        if (this.room?.story) this.room.story[key] = value;
        this.state.setFlag(key, value);
        this.room?.persistScriptState?.();
        this.room?.syncBackdrop?.();
      },
      getGlobalFlag: (key) => this.state.getFlag(key),
      setGlobalFlag: (key, value) => {
        this.state.setFlag(key, value);
        this.room?.syncBackdrop?.();
      },
      getObject: (path) =>
        this.state.get(`rooms.${this.roomId}.objects.${path}`),
      setObject: (path, value) =>
        this.state.set(`rooms.${this.roomId}.objects.${path}`, value),
      setPropState: (id, value) => this.setPropState(id, value),
      getScore: () => this.state.score,
      addScore: (n, reason) => this.state.addScore(n, reason),
      awardScore: (id, points, reason) => this.state.awardScore(id, points, reason),
      hasVisited: (id) => this.state.visitedRooms.includes(id),
      win: (message) => {
        this.room.gameWon = true;
        this.room.winFlash = 2.5;
        this.state.won = true;
        if (this.roomId) this.state.room(this.roomId).won = true;
        if (message) this.dialogue.say(message);
        this.autosave();
      },
      die: (message) => this.die(message),
      transition: (spec) =>
        this.goToRoom(spec.room || spec, { spawnId: spec.spawn || null }),
      wait: (sec) => new Promise((r) => setTimeout(r, (sec || 0) * 1000)),
      fadeOut: (speed) => this.transition.fadeOut(speed),
      fadeIn: (speed) => this.transition.fadeIn(speed),
      flash: (color, dur) => this.transition.flash(color, dur),
      cutscene: (steps) => this.cutscenes.play(steps),
      animate: (name, duration) => this.player.playAnimation(name, duration),
      sfx: (src) => this.audio.sfx(this._resolveAudio(src)),
      music: (src, opts) => this.audio.music(this._resolveAudio(src), opts),
      stopMusic: () => this.audio.stop("music"),
      voice: (src) => this.audio.voice(this._resolveAudio(src)),
      startEffect: (id, definition) => this.effects.start(id, definition),
      stopEffect: (id) => this.effects.stop(id),
      learnLine: (id) => this.conversations.learn(id),
      getMoney: () => this.economy.balance(),
      credit: (amount, reason) => this.economy.credit(amount, reason),
      debit: (amount, reason) => this.economy.debit(amount, reason),
      purchase: (purchase) => {
        if (!this.economy.debit(purchase.price, purchase.reason || `purchase:${purchase.item}`)) return false;
        if (purchase.item) this.inventory.give(purchase.item);
        return true;
      },
      startTimer: (id, seconds, definition) => this.timers.start(id, seconds, definition),
      pauseTimer: (id) => this.timers.pause(id),
      cancelTimer: (id) => this.timers.cancel(id),
      getTimer: (id) => this.state.timers[id],
      hasAppearance: (tag) => this.appearance.has(tag),
      equip: (slot, id, tags) => this.appearance.equip(slot, id, tags),
      groom: (kind, value) => this.appearance.groom(kind, value),
      getRelationship: (id) => this.relationships.get(id),
      relationship: (id, delta) => this.relationships.change(id, delta),
      reputation: (track, delta) => this.relationships.changeReputation(track, delta),
      playMinigame: (id, definition, stake) => this.minigames.play(id, definition, stake),
      enableHotspot: (id) => this.disabledHotspots.delete(id),
      disableHotspot: (id) => this.disabledHotspots.add(id),
      checkpoint: () => this.save("checkpoint"),
    };
  }

  _resolveAudio(src) {
    if (!src) return src;
    if (src.startsWith("http") || src.startsWith("data:") || src.startsWith("blob:"))
      return src;
    // Absolute under game_data or pack-relative paths
    if (
      src.startsWith("rooms/") ||
      src.startsWith("characters/") ||
      src.startsWith("ui/") ||
      src.startsWith("game_data/")
    ) {
      return this.loader.packUrl(src);
    }
    if (this.roomPath) return this.loader.packUrl(`${this.roomPath}/${src}`);
    return this.loader.packUrl(src);
  }

  _truthyParam(key) {
    if (!this.urlParams.has(key)) return false;
    const v = this.urlParams.get(key);
    return v === null || v === "" || v === "1" || v === "true" || v === "yes";
  }

  _applyDebugParams() {
    const p = this.urlParams;
    this.ui.showHitbox =
      this._truthyParam("debug") ||
      this._truthyParam("boxes") ||
      this._truthyParam("bbox");
    this.ui.hidePlayer =
      p.get("hideplayer") === "1" || p.get("hideplayer") === "true";
    this.ui.hideBg = p.get("hidebg") === "1" || p.get("hidebg") === "true";
    this.ui.showLabels = p.get("labels") !== "0" && p.get("labels") !== "false";
    this.skipTitle = this._truthyParam("skiptitle") || this._truthyParam("play");

    const only = p.get("only");
    const raw = only || p.get("objects") || p.get("object") || "all";
    if (!raw || raw === "all" || raw === "*") this.ui.objectFilter = null;
    else {
      const ids = raw
        .split(/[,+\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      this.ui.objectFilter = ids.length ? new Set(ids) : null;
    }
    if (this._truthyParam("testinv")) this.inventory.seed(TEST_INV_IDS);
  }

  setStatus(text, cls = "") {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    this.statusEl.className = cls;
  }

  maybeReady() {
    if (this.assetsReady && this.player.walkReady) this.setStatus("Ready", "ready");
    else if (this.assetsReady)
      this.setStatus("Ready (click to enable walk)", "ready");
  }

  async start() {
    if (this._running) return;
    this._running = true;
    this.bindEvents();
    this.audio.setVolumes({
      music: this.state.settings.musicVolume,
      sfx: this.state.settings.sfxVolume,
    });

    // Title splash before gameplay so the landing menu isn't a flat void
    await this.loadTitleBackground();

    if (this.showTitle && !this.skipTitle) {
      this.menus.show(MenuMode.TITLE);
      this.lastT = performance.now();
      this._raf = requestAnimationFrame((t) => this.frame(t));
      return;
    }
    this.lastT = performance.now();
    this._raf = requestAnimationFrame((t) => this.frame(t));
    await this.newGame();
  }

  stop() {
    this._running = false;
    this._gameplay = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    this.player.pauseWalkSoft();
    this.audio.stopAll();
  }

  stopGameplay() {
    this._gameplay = false;
    this.player.pauseWalkSoft();
    this.audio.stopAll();
    this.assetsReady = false;
  }

  async newGame() {
    this.state = new GameState({
      settings: { ...this.state.settings },
    });
    // rebind runtime to new state
    this.runtime = new ScriptRuntime(this._runtimeServices());
    this.room.state = this.state;
    this.room.runtime = this.runtime;
    this._rebindFeatureSystems();
    this.inventory.items = [];
    this.inventory.selected = null;
    this.disabledHotspots.clear();
    this.state.won = false;
    this.state.clearDead();

    const roomId =
      this.roomId ||
      this.loader.registry?.defaults?.room ||
      this.urlParams.get("room") ||
      "maintenance_hall";

    await this.goToRoom(roomId, { isNew: true });
    this._gameplay = true;
    this.menus.mode = MenuMode.NONE;

    // Optional intro cutscene from script
    if (this.room.script?.introCutscene) {
      await this.cutscenes.play(this.room.script.introCutscene);
    }
  }

  async goToRoom(roomId, { spawnId = null, isNew = false } = {}) {
    const generation = ++this._loadGeneration;
    this.actions.cancel();
    this.player.arriveAction = null;
    this.path = [];

    if (!this.state.settings.reduceMotion) await this.transition.fadeOut(2.5);
    else this.transition.alpha = 1;

    this.setStatus("Loading…");
    const loaded = await this.loader.loadGame({
      roomId,
      characterId: this.characterId || undefined,
    });
    if (generation !== this._loadGeneration) return false;

    this.applyLoadedGame(loaded, { spawnId, preserveState: !isNew });
    this.state.visitRoom(roomId);
    this._gameplay = true;

    const entry =
      loaded.script?.entry?.text ||
      (isNew ? null : `You enter ${loaded.roomPack.name}.`);
    if (entry) this.dialogue.say(entry);

    if (loaded.script?.onEnter) {
      await this.runtime.run(loaded.script.onEnter);
    }

    await this.transition.fadeIn(2.5);
    this.autosave();
    return true;
  }

  /** Alias used by older code */
  changeRoom(roomId, opts) {
    return this.goToRoom(roomId, opts);
  }

  applyLoadedGame(loaded, { spawnId = null, preserveState = false } = {}) {
    this.roomId = loaded.roomId;
    this.characterId = loaded.characterId;
    this.roomPath = loaded.roomPath;
    this.state.roomId = loaded.roomId;
    this.state.characterId = loaded.characterId;
    this.state.spawnId = spawnId;

    this.room.load({
      pack: loaded.roomPack,
      backdropImg: loaded.backdropImg,
      backdropImgs: loaded.backdropImgs,
      propImgs: loaded.propImgs,
      script: loaded.script,
      preserveState,
    });
    this.sceneObjects.state = this.state;
    this.sceneObjects.load(loaded.roomId, loaded.roomPack.sceneObjects || {});
    this.conversations.load(loaded.script?.conversations || {});
    this.spells.load(loaded.script?.spells || {});
    this.effects.clear();
    for (const [id, definition] of Object.entries(loaded.roomPack.effects || {})) this.effects.start(id, definition);
    this.state.maxScore = Math.max(this.state.maxScore, loaded.script?.maximumScore || 0);

    // Walk mesh
    this.walkMesh = WalkMesh.fromRoomPack(loaded.roomPack);

    // NPCs
    this.npcs = [];
    for (const def of loaded.roomPack.npcs || []) {
      const npc = new Npc(def);
      if (def.prop && loaded.propImgs[def.id]) {
        npc.img = loaded.propImgs[def.id];
      } else if (def.prop) {
        // try load from room path later; placeholder ok
      }
      npc.syncHitbox();
      this.npcs.push(npc);
    }

    // Triggers from pack
    this.triggers = (loaded.roomPack.triggers || []).map((t) => ({
      ...t,
      fired: false,
    }));

    // Disabled hotspots from state
    this.disabledHotspots = new Set(
      this.state.room(this.roomId).disabledHotspots || []
    );

    this.player.setMotion(loaded.characterPack.motion || {});
    this.player.setAnimations(loaded.characterPack.animations || {});
    this.player.onAnimationEvent = (event) => {
      if (event.steps) this.runtime.run(event.steps);
      if (event.sfx) this.audio.sfx(this._resolveAudio(event.sfx));
    };
    this.player.setIdleImage(loaded.idleImg);
    this.player.setHeight(
      loaded.roomPack.manH_scene ??
        loaded.characterPack.scale?.defaultHeightScene ??
        148
    );
    this.player.setGroundY(this.room.floorY);

    const spawn =
      (spawnId && loaded.roomPack.spawns?.[spawnId]) ||
      loaded.roomPack.spawn ||
      this.room.spawn;
    const y = spawn.y ?? this.room.floorY;
    let x =
      spawn.x ??
      this.W * (spawn.xFactor ?? 0.32);
    // clamp to walk mesh
    const clamped = this.walkMesh.clamp(x, y);
    this.player.setSpawn({
      x: clamped.x,
      facing: spawn.facing ?? 1,
    });
    this.player.y = clamped.y;

    this.walkVideo.src = loaded.walkUrl;

    this.applyBrandingChrome(this.room.name);

    this.assetsReady = true;
    this.maybeReady();
    this.player.unlockWalkVideo();
    this.walkVideo.load();

    this.audio.stop("ambience");
    if (loaded.roomPack.audio?.ambience) {
      this.audio.ambience(
        this._resolveAudio(loaded.roomPack.audio.ambience)
      );
    }
    if (loaded.roomPack.audio?.music) {
      this.audio.music(this._resolveAudio(loaded.roomPack.audio.music));
    }
  }

  async restartRoom() {
    if (!this.roomId) return;
    // clear room-local state
    delete this.state.rooms[this.roomId];
    this.state.clearDead();
    await this.goToRoom(this.roomId, { isNew: true });
  }

  die(message) {
    this.save("checkpoint");
    this.state.markDead(message || "You have died.");
    this.player.moving = false;
    this.player.vx = 0;
    this.player.pauseWalkSoft();
    this.actions.cancel();
    this.dialogue.say(this.state.deathMessage);
    this.menus.show(MenuMode.DEATH);
    this.autosave(); // still keep last autosave as restore point
  }

  save(slot = "auto") {
    this.state.inventory = [...this.inventory.items];
    this.room.persistScriptState?.();
    this.state.room(this.roomId).disabledHotspots = [...this.disabledHotspots];
    return this.saves.save(slot, this.state.snapshot());
  }

  async load(slot = "auto") {
    const data = this.saves.load(slot);
    if (!data) return false;
    this.state.restore(data);
    this.runtime = new ScriptRuntime(this._runtimeServices());
    this.room.state = this.state;
    this.room.runtime = this.runtime;
    this._rebindFeatureSystems();
    this.inventory.items = [...this.state.inventory];
    this.inventory.selected = null;
    this.state.clearDead();
    this.audio.setVolumes({
      music: this.state.settings.musicVolume,
      sfx: this.state.settings.sfxVolume,
    });
    await this.goToRoom(this.state.roomId || "maintenance_hall", {
      spawnId: this.state.spawnId,
    });
    this._gameplay = true;
    return true;
  }

  autosave() {
    try {
      this.save("auto");
    } catch (e) {
      console.warn("Autosave failed", e);
    }
  }

  _rebindFeatureSystems() {
    this.conversations = new ConversationSystem({ state: this.state, runtime: this.runtime, dialogue: this.dialogue });
    this.responses = new ResponseSystem(this.state);
    this.spells = new SpellSystem({ state: this.state, runtime: this.runtime, inventory: this.inventory });
    this._bindLifestyleSystems();
  }

  _bindLifestyleSystems() {
    this.economy = new EconomySystem(this.state);
    this.timers = new GameTimerSystem(this.state, (steps, context) => this.runtime.run(steps, context));
    this.minigames = new MinigameSystem({ state: this.state, economy: this.economy });
    this.appearance = new AppearanceSystem(this.state);
    this.relationships = new RelationshipSystem(this.state);
  }

  /** Walk using mesh pathfinding when available. */
  walkPlayerTo(x, y, onArrive) {
    const startY = this.player.y;
    const goalY = y ?? this.room.floorY;
    const path = this.walkMesh.findPath(this.player.x, startY, x, goalY);
    this.path = path;
    this.pathIndex = 0;
    const follow = () => {
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        this.path = [];
        if (onArrive) onArrive();
        return;
      }
      const n = this.path[this.pathIndex];
      this.player.walkTo(n.x, follow, this.room.walkBounds);
      // allow slight y drift on mesh
      if (Math.abs(n.y - this.player.y) > 1) this.player.y = n.y;
    };
    if (path.length <= 1) {
      this.player.walkTo(x, onArrive, this.room.walkBounds);
      return;
    }
    const n = path[0];
    // skip start
    this.pathIndex = 0;
    follow();
  }

  checkExits() {
    const exits = this.room.pack?.exits || {};
    const edge = 36;
    const x = this.player.x;
    const W = this.W;
    if (!this.player.moving && this.player.vx < 1) {
      // edge proximity while idle after walk
    }
    // While near edge after movement
    for (const [dir, spec] of Object.entries(exits)) {
      if (!spec?.room) continue;
      const when = spec.when;
      if (when && !this.runtime.test(when)) continue;
      let hit = false;
      if (dir === "east" || dir === "right") hit = x >= W - edge;
      if (dir === "west" || dir === "left") hit = x <= edge;
      if (dir === "north" || dir === "up") hit = this.player.y < this.room.floorY - 40;
      if (dir === "south" || dir === "down") hit = false;
      // Also hotspot-style exits handled in scripts
      if (hit && !this.player.moving) {
        // only auto-transition if player walked to edge intentionally
      }
    }
  }

  checkEdgeTravel() {
    if (this.player.moving || this.cutscenes.blocking || this.menus.blocking) return;
    const exits = this.room.pack?.exits;
    if (!exits) return;
    const x = this.player.x;
    const tryExit = async (spec) => {
      if (!spec?.room) return;
      if (spec.when && !this.runtime.test(spec.when)) {
        if (spec.blockedSay) this.dialogue.say(spec.blockedSay);
        return;
      }
      await this.goToRoom(spec.room, { spawnId: spec.spawn || null });
    };
    // Called when walk finishes near edge — use walk targets at edges
  }

  /** Find exit spec linked to a hotspot (exits.*.hotspot or door/hatch id heuristics). */
  exitForHotspot(hs) {
    if (!hs) return null;
    const exits = this.room.pack?.exits || {};
    for (const [dir, spec] of Object.entries(exits)) {
      if (!spec?.room) continue;
      if (spec.hotspot === hs.id) return { dir, ...spec };
    }
    // Common doorway ids → direction
    if (hs.id === "door" || hs.id === "hatch_east" || hs.id === "door_east") {
      if (exits.east) return { dir: "east", ...exits.east };
    }
    if (hs.id === "hatch_west" || hs.id === "door_west") {
      if (exits.west) return { dir: "west", ...exits.west };
    }
    return null;
  }

  /** Walk to an exit (hotspot or edge). Honors when/blockedSay. */
  takeExit(spec, walkX) {
    if (!spec?.room) return false;
    if (spec.when && !this.runtime.test(spec.when)) {
      this.dialogue.say(spec.blockedSay || "You can't go that way yet.");
      return true; // handled (blocked)
    }
    const x =
      walkX ??
      spec.walkX ??
      (spec.dir === "west" || spec.dir === "left" ? 50 : this.W - 50);
    this.actions.cancel();
    this.walkPlayerTo(x, this.room.floorY, () => {
      this.goToRoom(spec.room, { spawnId: spec.spawn || null });
    });
    return true;
  }

  /** Register edge walk targets as invisible hotspots? Better: click near edge. */
  tryEdgeClick(x, y) {
    const exits = this.room.pack?.exits;
    if (!exits) return false;
    // Generous east margin so clicks on the airlock frame count as leaving
    const eastMargin = 90;
    const westMargin = 56;
    let spec = null;
    let dir = null;
    if (x >= this.W - eastMargin && exits.east) {
      spec = exits.east;
      dir = "east";
    } else if (x <= westMargin && exits.west) {
      spec = exits.west;
      dir = "west";
    } else if (y < this.FLOOR_TOP + 40 && exits.north) {
      spec = exits.north;
      dir = "north";
    }
    if (!spec) return false;
    return this.takeExit({ dir, ...spec }, spec.walkX);
  }

  checkTriggers() {
    for (const t of this.triggers) {
      if (t.once && t.fired) continue;
      if (t.when && !this.runtime.test(t.when)) continue;
      const r = t.rect;
      if (!r) continue;
      const px = this.player.x;
      const py = this.player.y;
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        t.fired = true;
        if (t.steps) this.runtime.run(t.steps);
        if (t.cutscene) this.cutscenes.play(t.cutscene);
      }
    }
  }

  canvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
    };
  }

  hotspotAt(x, y) {
    // NPCs first
    for (const npc of this.npcs) {
      if (npc.visibleWhen && !this.runtime.test(npc.visibleWhen)) continue;
      if (npc.contains(x, y)) {
        return {
          id: npc.id,
          name: npc.name,
          walkX: npc.walkX,
          kind: "npc",
          npc,
          inter: {
            name: npc.name,
            look: () => {
              const b = this.runtime.select(npc.look);
              if (b) this.runtime.run(b.steps || [b]);
              else this.dialogue.say(`It's ${npc.name}.`);
            },
            talk: () => {
              const b = this.runtime.select(npc.talk);
              if (b) this.runtime.run(b.steps || [b]);
              else this.dialogue.say("…");
            },
            take: () => this.dialogue.say("That would be unwise."),
            use: () => this.dialogue.say("…"),
            useWith: (item) => {
              const branch = this.runtime.select(npc.useWith?.[item] || []);
              if (!branch) return false;
              this.runtime.run(branch.steps || [branch]);
              return true;
            },
          },
        };
      }
    }
    return this.room.hotspotAt(x, y, (id) => {
      if (this.disabledHotspots.has(id)) return false;
      return this.ui.objectVisible(id);
    });
  }

  handleInvAction(ui) {
    const inv = this.inventory;
    if (!ui) return false;
    if (ui.type === "inv-expand") {
      inv.expanded = true;
      return true;
    }
    if (ui.type === "inv-close" || ui.type === "inv-dismiss") {
      inv.expanded = false;
      return true;
    }
    if (ui.type === "inv-panel") return true;
    if (ui.type === "inv-scroll") {
      inv.scrollBy(ui.dir);
      return true;
    }
    if (ui.type === "inv" && ui.id) {
      if (this.ui.verb === "Look at") {
        this.dialogue.say(ITEMS[ui.id]?.desc || `It's ${this.itemName(ui.id)}.`);
        return true;
      }
      if (this.ui.verb === "Use" || this.ui.verb === "Walk to" || inv.expanded) {
        if (this.ui.verb === "Use" && inv.selected && inv.selected !== ui.id) {
          const first = inv.selected;
          this.combineItems(first, ui.id).then((combined) => {
            if (!combined) this.dialogue.say(this.responses.pick(
              `combine:${first}:${ui.id}`,
              this.room.script?.responses?.combinations?.[`${first}+${ui.id}`],
              `Can't combine ${this.itemName(first)} with ${this.itemName(ui.id)}.`
            ));
          });
          inv.selected = null;
          this.ui.updateSentence(undefined, inv);
          if (inv.expanded) inv.expanded = false;
          return true;
        }
        inv.selected = ui.id;
        this.ui.verb = "Use";
        this.ui.updateSentence(undefined, inv);
        if (inv.expanded) inv.expanded = false;
        return true;
      }
      if (this.ui.verb === "Take") {
        this.dialogue.say("Already carried.");
        return true;
      }
    }
    return ui.type === "inv";
  }

  bindEvents() {
    if (this._bound) return;
    this._bound = true;
    const canvas = this.canvas;
    canvas.style.touchAction = "none";

    canvas.addEventListener("pointermove", (e) => {
      const { x, y } = this.canvasPos(e);
      if (this.menus.blocking) {
        canvas.style.cursor = this.menus.onPointerMove(x, y);
        return;
      }
      const inv = this.inventory;
      const ui = this.ui;
      const choice = ui.dialogueChoiceAt?.(x, y, this.dialogue.current);
      if (choice != null && this.conversations.current) {
        this.conversations.choose(choice);
        return;
      }

      if (inv.expanded) {
        this.hoverHotspot = null;
        const hit = ui.uiAt(x, y, inv);
        if (hit?.type === "inv" && hit.id) {
          ui.updateSentence(this.itemName(hit.id), inv);
          canvas.style.cursor = "pointer";
        } else {
          ui.updateSentence(
            inv.selected ? `Use ${this.itemName(inv.selected)} with…` : "Inventory",
            inv
          );
          canvas.style.cursor = "pointer";
        }
        return;
      }

      if (y >= this.UI_TOP || y < this.TOP_BAR) {
        this.hoverHotspot = null;
        if (y >= this.UI_TOP) {
          const hit = ui.uiAt(x, y, inv);
          if (hit?.type === "inv" && hit.id)
            ui.updateSentence(this.itemName(hit.id), inv);
          else if (hit?.type === "inv-expand")
            ui.updateSentence("Open full inventory", inv);
          else ui.updateSentence("", inv);
          canvas.style.cursor =
            hit &&
            (hit.type === "verb" ||
              hit.type === "inv" ||
              hit.type === "inv-expand" ||
              hit.type === "inv-scroll")
              ? "pointer"
              : "default";
        }
        return;
      }

      const hs = this.hotspotAt(x, y);
      this.hoverHotspot = hs;
      if (hs) {
        ui.updateSentence(hs.name, inv);
        canvas.style.cursor = "pointer";
      } else {
        ui.updateSentence("", inv);
        canvas.style.cursor = "crosshair";
      }
    });

    canvas.addEventListener(
      "wheel",
      (e) => {
        if (this.menus.blocking) return;
        const { x, y } = this.canvasPos(e);
        if (!this.inventory.expanded && y >= this.UI_TOP && x >= this.inventory.INV_X) {
          e.preventDefault();
          this.inventory.scrollBy(e.deltaY > 0 ? 1 : -1);
        }
        if (this.inventory.expanded) e.preventDefault();
      },
      { passive: false }
    );

    canvas.addEventListener("pointerup", async (e) => {
      this.player.unlockWalkVideo();
      this.audio.unlock();
      const { x, y } = this.canvasPos(e);
      if (this.menus.blocking) {
        await this.menus.onPointerUp(x, y);
        return;
      }
      if (this.cutscenes.blocking) {
        this.cutscenes.skip();
        return;
      }
      const inv = this.inventory;
      const ui = this.ui;

      if (inv.expanded) {
        this.handleInvAction(ui.uiAt(x, y, inv));
        return;
      }
      if (y >= this.UI_TOP) {
        const hit = ui.uiAt(x, y, inv);
        if (hit?.type === "verb") {
          ui.setVerb(hit.verb, inv);
          return;
        }
        if (this.handleInvAction(hit)) return;
        return;
      }
      if (y < this.TOP_BAR) return;

      // Hotspots before edge travel — otherwise the right-edge exit steals door clicks
      // and "Use key on door" never runs.
      const hs = this.hotspotAt(x, y);
      if (hs) {
        if (ui.verb === "Walk to" && !inv.selected) {
          const linked = this.exitForHotspot(hs);
          if (linked) {
            const open = !linked.when || this.runtime.test(linked.when);
            if (open) {
              // Open doorway: Walk to = leave
              this.takeExit(linked, hs.walkX);
              return;
            }
            // Closed exit: walk up and Use (unlock with key in inventory, etc.)
            this.actions.replace(() =>
              this.room.resolveAction(hs, {
                verb: "Use",
                selectedItem: null,
                clearSelected: () => {
                  inv.selected = null;
                  ui.updateSentence(undefined, inv);
                },
              })
            );
            this.walkPlayerTo(hs.walkX, this.room.floorY, () => this.actions.flush());
            return;
          }
          this.actions.cancel();
          this.walkPlayerTo(hs.walkX, this.room.floorY, null);
        } else {
          this.actions.replace(() =>
            this.room.resolveAction(hs, {
              verb: ui.verb,
              selectedItem: inv.selected,
              clearSelected: () => {
                inv.selected = null;
                ui.updateSentence(undefined, inv);
              },
            })
          );
          this.walkPlayerTo(hs.walkX, this.room.floorY, () => this.actions.flush());
        }
        return;
      }

      // Empty edge of the scene (not on a door hotspot)
      if (this.tryEdgeClick(x, y)) return;

      if (y > this.FLOOR_TOP && y < this.UI_TOP) {
        this.actions.cancel();
        const c = this.walkMesh.clamp(x, this.room.floorY);
        this.walkPlayerTo(c.x, c.y, null);
      }
    });

    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (this.menus.blocking) return;
      this.ui.setVerb(this.cursor.cycle(), this.inventory);
    });

    window.addEventListener("keydown", async (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;

      if (this.menus.blocking) {
        await this.menus.onKey(e);
        return;
      }

      const map = { 1: "Walk to", 2: "Look at", 3: "Use", 4: "Talk to", 5: "Take" };
      if (map[e.key]) this.ui.setVerb(map[e.key], this.inventory);

      if (e.key === "Escape") {
        if (this.inventory.expanded) {
          this.inventory.expanded = false;
          return;
        }
        if (this._gameplay && this.assetsReady) {
          this.menus.show(MenuMode.PAUSE);
          return;
        }
      }
      if (e.key === " " && this.dialogue.current) {
        e.preventDefault();
        this.dialogue.advance();
      }
      if (/^[1-9]$/.test(e.key) && this.conversations.current) {
        this.conversations.choose(Number(e.key) - 1);
      }
      if (e.key === "i" || e.key === "I") this.inventory.toggleExpanded();
      if (e.key === "m" || e.key === "M") this.menus.show(MenuMode.MAP);
      if (e.key === "F5") {
        e.preventDefault();
        this.save("1");
        this.dialogue.say("Game saved.");
      }
      if (e.key === "F9") {
        e.preventDefault();
        await this.load("1");
      }
      if (e.key === "[") this.inventory.scrollBy(-1);
      if (e.key === "]") this.inventory.scrollBy(1);
      if (e.key === "b" || e.key === "B") {
        this.ui.showHitbox = !this.ui.showHitbox;
        const u = new URL(location.href);
        if (this.ui.showHitbox) u.searchParams.set("debug", "1");
        else u.searchParams.delete("debug");
        history.replaceState(null, "", u.pathname + u.search);
      }
    });

    this.walkVideo.addEventListener("loadeddata", () => {
      this.player.walkReady = true;
      this.player.unlockWalkVideo();
      this.maybeReady();
    });
    this.walkVideo.addEventListener("canplay", () => {
      this.player.walkReady = true;
      this.maybeReady();
    });
    this.walkVideo.addEventListener("error", () => {
      console.error("walk video error", this.walkVideo.error);
      this.setStatus("walk.mp4 failed", "error");
    });
  }

  update(dt) {
    if (this.menus.blocking && this.menus.mode !== MenuMode.NONE) {
      this.transition.update(dt);
      return;
    }
    if (!this._gameplay || !this.assetsReady) {
      this.transition.update(dt);
      return;
    }
    if (this.cutscenes.blocking) {
      this.dialogue.update(dt);
      this.player.update(dt);
      this.transition.update(dt);
      return;
    }

    this.state.playtime += dt;
    this.player.update(dt);
    this.dialogue.update(dt);
    this.room.update(dt);
    this.timers.update(dt);
    this.effects.update(dt);
    for (const npc of this.npcs) npc.update?.(dt);
    this.checkTriggers();
    this.transition.update(dt);
  }

  draw() {
    const ctx = this.ctx;
    const ui = this.ui;

    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, this.W, this.H);

    if (this._gameplay && this.assetsReady) {
      ui.drawRoom(ctx, this.room.backdrop);
      this.effects.draw(ctx);
      if (this.ui.showHitbox) this.walkMesh.drawDebug(ctx);

      // depth-sorted props + player + npcs
      const entities = [];
      for (const hs of this.room.hotspots) {
        if (!ui.objectVisible(hs.id)) continue;
        if (this.disabledHotspots.has(hs.id)) continue;
        entities.push({
          type: "prop",
          depth: hs.depthY ?? hs.drawY + hs.drawH,
          hs,
        });
      }
      for (const npc of this.npcs) {
        if (npc.visibleWhen && !this.runtime.test(npc.visibleWhen)) continue;
        entities.push({ type: "npc", depth: npc.depthY, npc });
      }
      entities.push({ type: "player", depth: this.player.y });
      entities.sort((a, b) => a.depth - b.depth);

      // walls first
      for (const e of entities) {
        if (e.type === "prop" && e.hs.kind === "wall") ui.drawProp?.(ctx, this.room, e.hs) || this._drawProp(ctx, e.hs);
      }
      for (const e of entities) {
        if (e.type === "prop" && e.hs.kind !== "wall")
          ui.drawProp?.(ctx, this.room, e.hs) || this._drawProp(ctx, e.hs);
        else if (e.type === "npc") e.npc.draw(ctx);
        else if (e.type === "player") ui.drawCharacter(ctx, this.player);
      }

      if (this.hoverHotspot) ui.drawHover(ctx, this.hoverHotspot);
      ui.drawDebugLegend(ctx, this.room.hotspots);
      ui.drawDeveloperState?.(ctx, {
        roomId: this.roomId,
        player: this.player,
        flags: { ...this.state.flags, ...this.room.story },
        actionPending: !!this.actions.pending,
        fps: this.fps,
        score: this.state.score,
      });
      ui.drawWin(ctx, this.room);
      ui.drawTop(ctx, {
        dialogueText: this.dialogue.text,
        dialogue: this.dialogue.current,
        objective: this.room.objectiveText(),
        score: this.state.score,
      });
      ui.drawBottom(ctx, this.inventory);
      ui.drawExpandedInventory(ctx, this.inventory);
    }

    this.transition.draw(ctx, this.W, this.H);
    this.menus.draw(ctx, this.W, this.H);
  }

  _drawProp(ctx, hs) {
    // fallback if ui.drawProp missing — never invent doorway art in JS
    if (hs.noSprite) {
      this.ui.drawDebugBox(ctx, hs);
      return;
    }
    const img = this.room.propImgs[hs.id];
    if (!img) return;
    ctx.drawImage(img, hs.drawX, hs.drawY, hs.drawW, hs.drawH);
    this.ui.drawDebugBox(ctx, hs);
  }

  frame(now) {
    if (!this._running) return;
    const dt = Math.min(0.05, (now - this.lastT) / 1000 || 0.016);
    this.fps += (1 / Math.max(dt, 0.001) - this.fps) * 0.08;
    this.lastT = now;
    this.update(dt);
    this.draw();
    this._raf = requestAnimationFrame((t) => this.frame(t));
  }

  itemName(id) {
    return ITEMS[id]?.name || String(id || "item").replace(/[_-]+/g, " ");
  }

  async combineItems(first, second) {
    const recipes = this.room.script?.recipes || [];
    const recipe = recipes.find((candidate) => {
      const items = candidate.items || [];
      if (items.length !== 2) return false;
      return candidate.ordered
        ? items[0] === first && items[1] === second
        : items.includes(first) && items.includes(second);
    });
    if (!recipe || (recipe.when && !this.runtime.test(recipe.when))) return false;
    await this.runtime.run(recipe.effects || recipe.steps || []);
    return true;
  }

  diagnostics() {
    return {
      room: this.roomId,
      character: this.characterId,
      player: { x: this.player.x, y: this.player.y, animation: this.player.animationState },
      flags: { ...this.state.flags, ...this.room.story },
      inventory: [...this.inventory.items],
      score: { current: this.state.score, maximum: this.state.maxScore },
      money: this.economy.balance(),
      timers: structuredClone(this.state.timers),
      appearance: structuredClone(this.state.appearance),
      relationships: structuredClone(this.state.relationships),
      hotspots: this.room.hotspots.map(({ id, walkX, hx, hy, hw, hh }) => ({ id, walkX, hx, hy, hw, hh })),
      exits: structuredClone(this.room.pack?.exits || {}),
      npcs: this.npcs.map(({ id, x, y, state }) => ({ id, x, y, state })),
    };
  }

  startConversation(id, nodeId) {
    return this.conversations.start(id, nodeId);
  }

  castSpell(id, target) {
    return this.spells.cast(id, target);
  }

  setPropState(id, state) {
    const object = this.sceneObjects.setState(id, state);
    const hotspot = this.room.hotspots.find((candidate) => candidate.id === id);
    if (hotspot) Object.assign(hotspot, object.visual);
    return object;
  }

  inspectDependencies(content = {}) {
    return this.analyzer.analyze({ registry: this.loader.registry, ...content });
  }

  playMinigame(id, definition, stake) {
    return this.minigames.play(id, definition, stake);
  }

  teleport(x, y = this.room.floorY) {
    const point = this.walkMesh.clamp(x, y);
    this.player.setSpawn({ x: point.x, facing: this.player.facing });
    this.player.y = point.y;
    return point;
  }
}

export {
  ChromaKey,
  ContentLoader,
  Dialogue,
  Inventory,
  Player,
  Room,
  UIShell,
  ITEMS,
  ActionQueue,
  AudioBus,
  GameState,
  SaveStore,
  ScriptRuntime,
  WalkMesh,
  Transition,
  CutscenePlayer,
  MenuSystem,
  MenuMode,
  Npc,
  ConversationSystem,
  EffectsSystem,
  PuzzleAnalyzer,
  ResponseSystem,
  SpellSystem,
  CursorController,
  SceneObjectManager,
  AppearanceSystem,
  EconomySystem,
  GameTimerSystem,
  MinigameSystem,
  RelationshipSystem,
};
