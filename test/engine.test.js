import test from "node:test";
import assert from "node:assert/strict";
import { GameState } from "../js/game-state.js";
import { SaveStore } from "../js/save-store.js";
import { ScriptRuntime } from "../js/script-runtime.js";
import { ContentValidator } from "../js/content-validator.js";
import { Dialogue } from "../js/dialogue.js";
import { ConversationSystem } from "../js/conversation.js";
import { EffectsSystem } from "../js/effects-system.js";
import { PuzzleAnalyzer } from "../js/puzzle-analyzer.js";
import { ResponseSystem } from "../js/response-system.js";
import { SpellSystem } from "../js/spell-system.js";
import { CursorController } from "../js/cursor-controller.js";
import { SceneObjectManager } from "../js/scene-object.js";
import {
  AppearanceSystem,
  EconomySystem,
  GameTimerSystem,
  MinigameSystem,
  RelationshipSystem,
} from "../js/lifestyle-systems.js";

test("game state snapshots do not share mutable data", () => {
  const state = new GameState({ roomId: "hall", inventory: ["key"] });
  state.room().flags.open = true;
  const snapshot = state.snapshot();
  snapshot.rooms.hall.flags.open = false;
  assert.equal(state.room().flags.open, true);
});

test("save store round trips versioned state", () => {
  const values = new Map();
  const storage = {
    setItem: (key, value) => values.set(key, value),
    getItem: (key) => values.get(key) || null,
    removeItem: (key) => values.delete(key),
  };
  const saves = new SaveStore({ storage });
  saves.save("one", { version: 1, roomId: "hall" });
  assert.equal(saves.load("one").roomId, "hall");
});

test("script runtime evaluates conditions and applies effects in order", async () => {
  const flags = {};
  const items = [];
  const inventory = {
    has: (id) => items.includes(id),
    give: (id) => items.push(id),
    remove: (id) => items.splice(items.indexOf(id), 1),
  };
  const runtime = new ScriptRuntime({
    inventory,
    getFlag: (key) => flags[key],
    setFlag: (key, value) => { flags[key] = value; },
    getObject: () => undefined,
    setObject: () => {},
    say: () => {},
    win: () => {},
    transition: () => {},
  });
  await runtime.run([{ setFlag: "found" }, { give: "key", when: { flag: "found" } }]);
  assert.deepEqual(items, ["key"]);
});

test("validator rejects mismatched pack ids", () => {
  const validator = new ContentValidator();
  assert.throws(
    () => validator.validateRoom({ id: "other", backdrop: "x", sceneSize: [1, 1], slots: {} }, "hall"),
    /Invalid room id/
  );
});

test("dialogue accepts empty text and explicit zero duration", () => {
  const dialogue = new Dialogue();
  dialogue.say(null, 0);
  assert.equal(dialogue.current.text, "");
  assert.equal(dialogue.current.duration, 0);
});

test("score awards can only be collected once", () => {
  const state = new GameState();
  assert.equal(state.awardScore("found_well", 5), true);
  assert.equal(state.awardScore("found_well", 5), false);
  assert.equal(state.score, 5);
  assert.equal(state.snapshot().scoreAwards.found_well, true);
});

test("script runtime supports one-time score, animation, and checkpoints", async () => {
  const calls = [];
  const runtime = new ScriptRuntime({
    inventory: { has: () => false, give: () => {}, remove: () => {} },
    getFlag: () => false,
    setFlag: () => {},
    awardScore: (...args) => calls.push(["score", ...args]),
    animate: (...args) => calls.push(["animate", ...args]),
    checkpoint: () => calls.push(["checkpoint"]),
  });
  await runtime.run([
    { score: { id: "puzzle", points: 3, reason: "Solved" } },
    { animate: "pickup", duration: 0.2 },
    { checkpoint: true },
  ]);
  assert.deepEqual(calls, [
    ["score", "puzzle", 3, "Solved"],
    ["animate", "pickup", 0.2],
    ["checkpoint"],
  ]);
});

test("validator checks exits and inventory recipes", () => {
  const validator = new ContentValidator();
  assert.throws(
    () => validator.validateRoom({
      id: "hall",
      backdrop: "x",
      sceneSize: [960, 428],
      slots: {},
      exits: { east: { room: "../bad" } },
    }, "hall"),
    /exits.east.room/
  );
  assert.throws(
    () => validator.validateScript({ version: 1, recipes: [{ items: ["one"] }] }),
    /at least two/
  );
});

test("conversation choices persist and teach dialogue lines", async () => {
  const state = new GameState();
  const dialogue = new Dialogue();
  const conversation = new ConversationSystem({
    state,
    dialogue,
    runtime: { run: async () => {}, test: () => true },
  });
  conversation.load({
    pirate: {
      start: "hello",
      nodes: {
        hello: { text: "Choose.", choices: [{ id: "insult", text: "Fight!", learn: "foul_fiend", once: true, next: "end" }] },
        end: { text: "Later." },
      },
    },
  });
  await conversation.start("pirate");
  await conversation.choose(0);
  assert.equal(conversation.knows("foul_fiend"), true);
  assert.equal(state.conversations["pirate.insult"], true);
});

test("responses escalate deterministically", () => {
  const state = new GameState();
  const responses = new ResponseSystem(state);
  const definition = { escalating: ["No.", "Still no."] };
  assert.equal(responses.pick("door", definition), "No.");
  assert.equal(responses.pick("door", definition), "Still no.");
  assert.equal(responses.pick("door", definition), "Still no.");
});

test("spells validate knowledge, targets, and components", async () => {
  const state = new GameState({ inventory: ["wand"] });
  const applied = [];
  const spells = new SpellSystem({
    state,
    inventory: { has: (id) => state.inventory.includes(id) },
    runtime: { test: () => true, run: async (steps) => applied.push(...steps) },
  });
  spells.load({ light: { targets: ["cave"], components: ["wand"], effects: [{ setFlag: "lit" }] } });
  spells.learn("light");
  assert.equal((await spells.cast("light", "door")).ok, false);
  assert.equal((await spells.cast("light", "cave")).ok, true);
  assert.equal(applied.length, 1);
});

test("reduced motion effects retain state without particles", () => {
  const effects = new EffectsSystem({ reduceMotion: () => true });
  const snow = effects.start("snow", { count: 100 });
  assert.equal(snow.particles.length, 0);
  assert.equal(effects.effects.has("snow"), true);
});

test("puzzle analyzer reports missing exits and dialogue nodes", () => {
  const report = new PuzzleAnalyzer().analyze({
    registry: { defaults: { room: "start" }, rooms: { start: {}, end: {} } },
    rooms: { start: { exits: { east: { room: "missing" } } }, end: {} },
    scripts: { start: { conversations: { npc: { start: "hello", nodes: {} } } } },
  });
  assert.equal(report.valid, false);
  assert.match(report.errors.join(" "), /unknown room/);
  assert.match(report.errors.join(" "), /missing start node/);
});

test("cursor controller builds direct and indirect sentences", () => {
  const cursor = new CursorController();
  cursor.selectVerb("Talk to");
  assert.equal(cursor.sentence("pirate"), "Talk to pirate");
  cursor.selectItem("rubber_chicken");
  assert.equal(cursor.sentence("cable", () => "rubber chicken"), "Use rubber chicken with cable");
});

test("scene object visual states persist", () => {
  const state = new GameState({ roomId: "dock" });
  const objects = new SceneObjectManager(state);
  objects.load("dock", { door: { initialState: "closed", states: { closed: { hw: 20 }, open: { hw: 40 } } } });
  objects.setState("door", "open");
  assert.equal(objects.objects.get("door").visual.hw, 40);
  assert.equal(state.room("dock").sceneObjects.door.state, "open");
});

test("economy rejects unaffordable debits and records transactions", () => {
  const state = new GameState({ wallet: { cash: 500, transactions: [] } });
  const economy = new EconomySystem(state);
  assert.equal(economy.debit(600, "suit"), false);
  assert.equal(economy.debit(200, "drink"), true);
  assert.equal(economy.balance(), 300);
  assert.equal(state.wallet.transactions[0].reason, "drink");
});

test("game timers warn and expire exactly once", async () => {
  const state = new GameState();
  const events = [];
  const timers = new GameTimerSystem(state, async (steps, context) => events.push(context));
  timers.start("taxi", 10, { warnings: [{ at: 5, say: "Hurry" }], expire: [{ setFlag: "left" }] });
  await timers.update(6);
  await timers.update(5);
  await timers.update(5);
  assert.deepEqual(events.map((event) => event.warning), [true, false]);
});

test("minigames replay deterministically from saved random state", () => {
  const initial = new GameState({ wallet: { cash: 1000, transactions: [] }, randomSeed: 42 });
  const definition = { stake: 100, outcomes: [{ id: "win", chance: 0.5, multiplier: 2 }, { id: "lose", chance: 1, multiplier: 0 }] };
  const first = new MinigameSystem({ state: initial, economy: new EconomySystem(initial) }).play("slots", definition);
  const replayState = new GameState({ wallet: { cash: 1000, transactions: [] }, randomSeed: 42 });
  const replay = new MinigameSystem({ state: replayState, economy: new EconomySystem(replayState) }).play("slots", definition);
  assert.deepEqual({ outcome: first.outcome, roll: first.roll }, { outcome: replay.outcome, roll: replay.roll });
});

test("appearance and relationships provide condition-ready state", () => {
  const state = new GameState();
  const appearance = new AppearanceSystem(state);
  const relationships = new RelationshipSystem(state);
  appearance.equip("body", "white_suit", ["formal"]);
  appearance.groom("fresh_breath");
  assert.equal(appearance.has("formal"), true);
  assert.equal(appearance.has("fresh_breath"), true);
  assert.equal(relationships.change("bartender", 25), 25);
  assert.equal(relationships.change("bartender", 100), 100);
  assert.equal(relationships.changeReputation("nightlife", -10), -10);
});
