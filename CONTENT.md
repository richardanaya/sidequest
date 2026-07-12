# Content packs — characters & rooms

Every **character** and **room** is a self-contained **asset pack**: one folder, one JSON manifest, all binaries beside it. The game loads packs by **id**, not by scavenging a flat `assets/` tree.

Craft guides (how to *make* good content):

- [`GEN_CHARACTER.md`](./GEN_CHARACTER.md)
- [`GEN_ROOM.md`](./GEN_ROOM.md)

This file is the **layout contract** for shipping multiple characters and rooms.

---

## Top-level layout

```text
/
├── game_data/                   # ALL game assets + definitions (not engine)
│   ├── content.json             # registry, branding, defaults
│   ├── ui/                      # engine chrome art (title splash, etc.)
│   │   └── title.jpg
│   ├── characters/
│   │   └── <characterId>/       # one pack per character
│   │       ├── character.json   # REQUIRED manifest
│   │       ├── idle.png         # REQUIRED runtime idle
│   │       ├── walk.mp4         # REQUIRED walk cycle (PC)
│   │       ├── idle.jpg         # optional green-screen source plate
│   │       └── …optional anims
│   └── rooms/
│       └── <roomId>/            # one pack per room
│           ├── room.json        # REQUIRED manifest
│           ├── script.json      # optional data-driven puzzle/script
│           ├── backdrop.jpg     # REQUIRED single camera plate
│           ├── props/           # REQUIRED if slots use sprites
│           │   └── <slotId>.png
│           ├── seg_mask.jpg     # optional authoring mask
│           └── qa/              # optional proofs
│               └── composite_check.jpg
├── index.html                   # thin shell; boots AdventureEngine
├── js/                          # engine only
│   ├── adventure-engine.js
│   ├── content-loader.js        # loads packs under game_data/
│   └── …
├── GEN_CHARACTER.md
├── GEN_ROOM.md
└── CONTENT.md                   # this file
```

**Split:** `game_data/` = content. `js/` + `index.html` = engine shell.

**IDs:** `snake_case`, stable forever once shipped  
Examples: `protagonist`, `maintenance_hall`

Paths **inside** `content.json` and pack manifests are relative to **`game_data/`** (not the repo root).  
Example: `"path": "rooms/maintenance_hall"` → `game_data/rooms/maintenance_hall/`.

---

## Pack principle

| Rule | Meaning |
|------|---------|
| **Under game_data** | Everything that is not engine code lives in `game_data/` |
| **Self-contained** | Opening `game_data/characters/foo/` or `game_data/rooms/bar/` is enough to understand that pack |
| **Relative paths** | Paths in pack JSON are relative to **that pack’s root**; registry paths are relative to **game_data/** |
| **Refs by id** | Rooms reference characters by **id** (`"character": "protagonist"`), never by deep file paths |
| **One manifest name** | Always `character.json` / `room.json` |
| **Version field** | Bump `version` when binary or layout contracts change |

There is no shared flat `assets/` tree. All game art lives inside `game_data/`.

---

## Character pack — `game_data/characters/<characterId>/`

### Minimum viable pack

```text
game_data/characters/protagonist/
  character.json
  idle.png
  walk.mp4
```

### `character.json` (required fields)

```json
{
  "id": "protagonist",
  "name": "Display Name",
  "version": 1,
  "description": "One-line who this is",
  "art": {
    "idle": "idle.png",
    "walk": "walk.mp4",
    "facing": "right",
    "chromaKey": "#00FF00"
  },
  "scale": {
    "defaultHeightScene": 148
  },
  "motion": {
    "maxSpeed": 118,
    "accel": 520,
    "decel": 780,
    "stopEpsilon": 2.5,
    "playbackRate": 0.72,
    "blendIn": 11.0,
    "blendOut": 9.0,
    "walkSpeedThreshold": 12
  },
  "rules": [
    "Authoring constraints for generators and humans."
  ]
}
```

| Block | Role |
|-------|------|
| `art` | Filenames inside this pack |
| `scale.defaultHeightScene` | Fallback height if a room omits `manH_scene` |
| `motion` | Walk feel; room should not override unless special |
| `rules` | Pack-local reminders (green plate, no double-draw, etc.) |

Optional `art` keys later: `jump`, `attack`, `idleSource`.

### Character pack rules

Documented fully in `GEN_CHARACTER.md`. Pack must satisfy:

1. Idle on pure green; walk **from** that idle plate.  
2. Keyed `idle.png` cropped to content.  
3. Walk keys cleanly; loopable in-place cycle.  
4. Motion constants produce one body, soft stop.  
5. Composite QA inside at least one room before calling it done.

---

## Room pack — `game_data/rooms/<roomId>/`

### Minimum viable pack

```text
game_data/rooms/maintenance_hall/
  room.json
  backdrop.jpg
  props/
    plant.png
    desk.png
    …
```

### `room.json` (required fields)

```json
{
  "id": "maintenance_hall",
  "name": "Maintenance Hall",
  "version": 1,
  "description": "…",
  "character": "protagonist",
  "backdrop": "backdrop.jpg",
  "imageSize": [1280, 720],
  "sceneSize": [960, 428],
  "floorY_image": 628,
  "floorY_scene": 373.3,
  "manH_scene": 148,
  "spawn": { "xFactor": 0.32, "facing": 1 },
  "hotspotMeta": {
    "desk": { "name": "desk" },
    "door": { "name": "airlock door", "noSprite": true }
  },
  "slots": {
    "desk": {
      "id": "desk",
      "kind": "floor",
      "noSprite": false,
      "prop": "props/desk.png",
      "sceneDrawX": 0,
      "sceneDrawY": 0,
      "sceneDrawW": 0,
      "sceneDrawH": 0,
      "walkX": 0,
      "hx": 0, "hy": 0, "hw": 0, "hh": 0
    }
  }
}
```

| Block | Role |
|-------|------|
| `character` | Character pack id to load |
| `backdrop` | Plate relative to room root |
| `floorY_*` / `manH_scene` | Shared ground + scale ruler |
| `spawn` | Player start (`xFactor` × scene width) |
| `hotspotMeta` | Display names / flags without bloating slots |
| `slots` | Placement + hit + walk targets + prop path |

Optional: `segmentation`, `qa.composite`, `scaleNote`, `items` (inventory defs for this room).

### Slot contract

| Field | Required | Meaning |
|-------|----------|---------|
| `kind` | yes | `floor` \| `wall` |
| `noSprite` | yes | `true` = backdrop hitbox only |
| `prop` | yes | `props/<id>.png` or `null` |
| `sceneDrawX/Y/W/H` | yes if sprite | Draw rect in **scene** pixels |
| `walkX` | yes | Approach X for interactions |
| `hx,hy,hw,hh` | yes | Click hitbox (inset of draw) |

Prop files live **in the room pack** (`props/`), not in a global prop dump. Reuse across rooms by **copying** or later introducing a shared library pack—for now **duplicate into the room** so each room stays playable alone.

### Room pack rules

See `GEN_ROOM.md`. Pack must satisfy:

1. Single backdrop, fixed camera.  
2. Placement from mask/centroids or equivalent; not random freehand.  
3. Props scaled as **% of `manH_scene`**.  
4. `qa/composite_check.jpg` with man + props.  
5. Live `?debug=1` hitboxes pass.

---

## Registry — `game_data/content.json`

```json
{
  "version": 1,
  "title": "Sealed",
  "subtitle": "A Point-and-Click Adventure",
  "tagline": "…",
  "defaults": {
    "room": "maintenance_hall",
    "character": null,
    "titleBackground": "ui/title.jpg"
  },
  "characters": {
    "protagonist": {
      "path": "characters/protagonist",
      "name": "Protagonist"
    }
  },
  "rooms": {
    "maintenance_hall": {
      "path": "rooms/maintenance_hall",
      "name": "Maintenance Hall",
      "character": "protagonist"
    }
  }
}
```

- Paths in the registry are relative to **`game_data/`**
- `defaults.room` — boot room if URL omits `?room=`  
- `defaults.character` — `null` means use room’s `character` field  
- `defaults.titleBackground` — landing splash (e.g. `ui/title.jpg`)  
- Registry is the menu of packs; each pack folder remains authoritative for its files  

---

## Loader resolution

```text
root         = game_data/
roomId       = ?room=… || content.defaults.room
roomManifest = game_data/rooms/{roomId}/room.json
charId       = ?character=… || roomManifest.character || content.defaults.character
charManifest = game_data/characters/{charId}/character.json

backdrop     = game_data/rooms/{roomId}/{roomManifest.backdrop}
idle         = game_data/characters/{charId}/{charManifest.art.idle}
walk         = game_data/characters/{charId}/{charManifest.art.walk}
prop(slot)   = game_data/rooms/{roomId}/{slot.prop}
titleBg      = game_data/{content.defaults.titleBackground}
```

Height:

```text
TARGET_H = room.manH_scene || character.scale.defaultHeightScene
```

Motion:

```text
from character.motion.*  (maxSpeed, accel, decel, playbackRate, …)
```

---

## URL / debug (shell)

| Param | Effect |
|-------|--------|
| `?room=maintenance_hall` | Select room pack |
| `?character=protagonist` | Override character pack |
| `?debug=1` | Bounding boxes |
| `?objects=plant,desk` | Isolate hotspots |
| `?only=cat` | Single hotspot |
| `?hidebg=1` / `?hideplayer=1` | QA isolation |
| `?testinv=1` | Seed many inventory stubs |

---

## Adding packs (checklist)

### New character

1. `mkdir -p game_data/characters/<id>`  
2. Author idle + walk (`GEN_CHARACTER.md`)  
3. Write `character.json`  
4. Register in `game_data/content.json`  
5. Drop into a room (`"character": "<id>"`) and composite  

### New room

1. `mkdir -p game_data/rooms/<id>/props game_data/rooms/<id>/qa`  
2. Author backdrop + props + placement (`GEN_ROOM.md`)  
3. Write `room.json` pointing at a character id  
4. Register in `game_data/content.json`  
5. Open `?room=<id>`  

---

## What may stay in the shell (`index.html`)

| In shell | In packs |
|----------|----------|
| Verb bar, inventory UI chrome | Art, placement, motion numbers |
| Global puzzle *engine* | Room-specific scripts (later `script.json`) |
| Debug URL parsing | Pack ids and paths |

Prefer moving dialogue/puzzle tables into the room pack as they stabilize (`room.json` or `script.json`).

## Runtime extensions

Rooms may declare `script`, `walkBounds`, named `spawns`, optional `audio`, and
explicit prop `depthY`. Scripts contain room flags, object verb branches,
conditions (`flag`, `hasItem`, `object`, `all`, `any`, `not`), and effects
(`say`, `setFlag`, `setFlags`, `setObject`, `give`, `remove`, `win`,
`transition`). The engine never evaluates JavaScript from a content pack.

Character packs may declare named `animations`, interaction reach/foot anchor,
and dialogue portrait/voice metadata. Unsupported animation states fall back
through the authored `fallback` state.

Game saves are versioned snapshots containing stable room, character, item,
flag, and object IDs. Call `adventure.save(slot)`, `adventure.load(slot)`, or
`adventure.changeRoom(roomId, { spawnId })`. Room transitions autosave to the
`auto` slot and ignore stale asynchronous loads.

For horizontal adventure games, room `exits` may define `west` and `east`
destinations with `room`, `spawn`, `walkX`, `when`, and `blockedSay`. Scripts
may define inventory `recipes`, a `maximumScore`, and effects for one-time
score awards (`{"score":{"id":"unique_id","points":5}}`), checkpoints,
animations, deaths, cutscenes, and transitions. Room NPC definitions support
conditional `look`, `talk`, item-specific `useWith`, and horizontal `patrol`
ranges.

At runtime, `adventure.diagnostics()` returns authoring geometry and state,
while `adventure.teleport(x)` previews positions and exits without editing a
save. `?debug=1` overlays geometry, flags, active animation, score, and FPS.

## Cinematic adventure features

Room scripts may additionally define:

- `conversations`: validated node graphs with conditional, one-time choices,
  learned lines, effects, and next-node links.
- `recipes`: ordered or unordered item combinations with conditions and effects.
- `responses`: text, rotating pools, or escalating failure jokes.
- `spells`: learned abilities with target, component, condition, and effect rules.
- `sceneObjects`: named visual/hitbox states persisted with the room.
- `effects`: reduced-motion-aware foreground or background particle layers.
- animation `events`: timed script or sound markers.
- cutscene `parallel` branches and `final` effects applied when skipped.

Voice playback uses the dialogue audio channel and ducks music and ambience.
Dialogue choices are available by pointer or number keys. Public authoring APIs
include `startConversation`, `castSpell`, `setPropState`, and
`inspectDependencies`.

## Social adventure systems

The persistent state also provides an integer wallet, game-time timers, a
seeded random stream, minigame records, appearance slots and grooming tags,
per-NPC relationships, and named reputation tracks. Script conditions include
`moneyGte`, `timerLte`, `appearance`, and `relationshipGte`. Effects include
`credit`, `debit`, atomic `purchase`, `startTimer`, `pauseTimer`, `cancelTimer`,
`minigame`, `equip`, `groom`, `relationship`, and `reputation`.

Minigame outcome chances are increasing cumulative values from zero through
one. The RNG seed is saved, making outcomes reproducible in tests and after a
restore. Timers advance only during active gameplay, so menus, loading, and
pauses cannot consume deadlines.

---

## Definition of done

**Character pack:** valid `character.json`, `idle.png`, `walk.mp4`, registered, passes character QA in at least one room.

**Room pack:** valid `room.json`, `backdrop.jpg`, every `slot.prop` present, `manH_scene` + floor line, composite QA, registered, loads via `?room=<id>`.

**Multi-pack game:** `content.json` lists all packs; switching `?room=` does not require code edits—only new folders + registry entries.
