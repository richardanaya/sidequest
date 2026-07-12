# GEN_ROOM — Building high-quality adventure rooms

Practical pipeline and quality bar for point-and-click rooms in this project. Derived from what actually worked (and failed) across **Sealed**, **Path of the Blade**, and **The Crown & Cup**: **one fixed-camera plate as authority, empty architecture first, horizontal walk band, man-as-ruler scale, state-variant backdrops for gated doors, props as separate green-screen sprites, browser visual QA.**

**Pack layout:** each room is a folder pack under `{contentRoot}/rooms/<roomId>/` (e.g. `game_tavern/rooms/common_room/`) with `room.json` + assets. See [`CONTENT.md`](./CONTENT.md) for the multi-game contract. This file is *how to author* a good room pack.

---

## Goals

- One **fixed camera** room that reads as a designed space (not stickers on a wallpaper).
- A **clear left→right walk path** — this engine only walks horizontally on a floor band.
- Props that sit on a shared floor line or hang on real wall panels (**never baked into the backdrop**).
- Scale that matches the **player character** as the unit of measure.
- Gated doorways that **look** sealed until the flag flips (art variants, not JS door drawings).
- A repeatable way to **catch bad placement** before shipping (agent-browser screenshots).

Avoid early on: multi-panel side-scroll corridors, freehand world coordinates, mid-floor furniture, items painted into the plate, and “place everything then hope.”

---

## End-to-end pipeline

```
1. Art direction lock   → same style as the whole game (VGA pixel, painted Sierra, art-deco…)
2. EMPTY backdrop       → architecture only; no pickups, no inventory items, no NPCs
3. Walk-path check      → lower third clear left→right; furniture on back wall / sides only
4. Read the image       → floor line, doors, hang bands, keep-outs
5. Slot plan            → floor vs wall; which props vs noSprite architecture
6. Props on green       → generate AFTER backdrop is locked; key + crop
7. room.json slots      → draw rects, hitboxes, walkX; manH_scene as ruler
8. Gated doors?         → crop→edit→paste sealed/open plates (never full-room regen)
9. script.json          → puzzles, flags, objectives that point to the next step
10. Live browser QA     → every room: clean + ?debug=1; fix scale/placement; re-screenshot
```

Ship only when **every room** has been visually sanity-checked in the live game (not just JSON existence).

---

## 0. Multi-game content roots

Each game is its own folder. Engine never hard-codes a single content tree.

```text
game_sealed/     # Rapture-style
game_samurai/    # Path of the Blade
game_tavern/     # The Crown & Cup (King's Quest / VGA)
js/              # engine only
index.html       # ?content=game_tavern | game_samurai | game_sealed
```

Paths in `content.json` and pack manifests are relative to **that game’s root**.

---

## 1. Horizontal walk path (engine hard constraint)

**The player only moves on X.** Feet stay on `floorY_scene`. There is no free 2D pathfinding around furniture.

### Do

- Keep the **lower third / foreground strip completely clear** left→right.
- Put furniture, wells, barrels, tables, crates against the **back wall or far sides**.
- Stage like classic Sierra: character walks *in front of* mid-ground architecture.
- Design doors on the **far left and far right** of the walk band.

### Don’t

- Mid-room tables, wells, or counters blocking the floor strip (e.g. tavern common room with trestle tables in the aisle — **failed**).
- Props whose draw bottoms sit on the walk plane if they should read as mid-ground (depth via higher `sceneDrawY` is OK; blocking the front aisle is not).
- Assume the player can walk “around” something — they can’t.

### Walk-path checklist (before generating props)

- [ ] Can you draw a horizontal line for feet from left exit to right exit with no furniture crossing it?
- [ ] Important interactables are reachable by `walkX` on that band?
- [ ] Courtyard wells / crate stacks sit **back** against a fence or wall?

Document this in the game’s `VISION.md` when the style is locked.

---

## 2. Empty backdrop first (no baked items)

### Rule

| Backdrop may include | Backdrop must NOT include |
|----------------------|---------------------------|
| Architecture (walls, floor, beams) | Inventory pickups (keys, tankards, letters) |
| Built-in furniture shells (empty bar, empty shelves) | Food, bottles, flowers meant to be taken |
| Painted doorways / stairs | NPCs that are also prop sprites |
| Ambient décor that is never taken | Readable puzzle props the player should pick up |

**Generate backdrops with nothing takeable on them.** Then add props as green-screen sprites.

### Why

- Baked pickups can’t hide when taken, scale independently, or share inventory icons cleanly.
- Full-room re-gens to “remove the mug” break prop coordinates.
- Empty plates are reusable when puzzle layout changes.

### Style

Match the game’s locked art direction:

| Direction | Notes |
|-----------|--------|
| **VGA / Sierra pixel** | Chunky pixels, limited palette; post-process (downscale → quantize → nearest upscale) if gens are too smooth |
| **Painted Sierra** | Brushy, theatrical stage, not modern CGI |
| **Art-deco / Rapture** | Semi-realistic illustration, muted values |

Photoreal CGI against pixel heroes (or vice versa) fails visual QA every time. Lock style on the **first empty room**, then match all rooms to it.

---

## 3. Backdrop composition

### Do

- Generate **one** room image (e.g. 1280×720 or 16:9).
- Prefer a clear **side-view stage**: readable floor, back wall, left/right exits.
- Match the art direction of the game (not a one-off style experiment).

### Don’t

- Build three rooms before one empty plate is approved.
- Rely on painted-in furniture for *every* hotspot unless hitboxes are painted carefully — **separate prop sprites** are easier to resize and debug.

### Read the backdrop before placing anything

| Zone | What to mark |
|------|----------------|
| Floor contact line | Y where feet meet tiles (`floorY_image` / `floorY_scene`) |
| Walk band | Horizontal strip — must stay clear |
| Wall hang bands | Mid-wall for notices, keys on mantels, portraits |
| Architecture | Doorways already in the art → **hitbox only**, no second door sprite |
| Keep-out | Windows, hearths, heavy ornament — don’t cover them |

**Important:** A painted *open* doorway (black void / stairs visible) will always *look* open. If the door is gameplay-gated (needs key), you need a **sealed backdrop variant** (section 4). Do not fix that with engine-side door art in JS.

---

## 4. State-variant backdrops (sealed / open doors)

Some rooms need the **same camera and layout**, but a doorway changes when a flag flips (airlock, cellar door, hatch).

### Rule

| Do | Don’t |
|----|--------|
| Keep one **authority plate** (usually the open doorway) as pixel base | Full-frame re-generate the whole room for “closed door” |
| Change **only** the doorway region for sealed/open | Let the model reseal the wrong hole or shift walls |
| Store variants as separate JPGs under the room pack | Hand-draw door frames in `js/ui.js` |
| Drive swaps from `room.json` + flags | Freehand new prop coords after a full regen |
| Paste strip **wide enough** to cover open door leaf + opening | Leave a ghost open door next to a “closed” arch |

### Crop → edit → paste (required method)

Full-room Imagine edits routinely change the wrong region and shift walls enough to **break all prop slots**.

1. Start from the **open** plate (empty / open doorway on the correct side).
2. **Crop only** the doorway strip (include the open door leaf if it swings into the room).
3. Prompt the crop explicitly: *“This is ONLY the side doorway. Close the door. Do not invent other architecture.”*
4. Paste the sealed crop back onto a **copy of the open plate** (optional soft feather on the seam).
5. Verify with pixel stats: **mean abs diff outside the strip ≈ 0**; door strip differs.

### Files

```text
{contentRoot}/rooms/<roomId>/
  backdrop_open.jpg      # authority plate (open doorway)
  backdrop_sealed.jpg    # open + sealed door crop pasted in place
  backdrop.jpg           # optional alias of the default start plate
```

### `room.json` contract

```json
"backdrop": "backdrop_sealed.jpg",
"backdrops": [
  { "when": { "flag": "cellarOpen" }, "src": "backdrop_open.jpg" },
  { "src": "backdrop_sealed.jpg" }
]
```

- First matching `when` wins (same idea as script objectives).
- Default/start state is usually **sealed** (door closed until the player solves something).
- Engine loads all listed plates and calls `syncBackdrop()` when flags change — no doorway art in JS.

### Examples

| Game / room | Sealed | Open | Flag |
|-------------|--------|------|------|
| `game_sealed` / `maintenance_hall` | `backdrop_sealed.jpg` | `backdrop_open.jpg` | `airlockOpen` |
| `game_sealed` / `pump_gallery` | `backdrop_sealed.jpg` | `backdrop_open.jpg` | `powerOn` |
| `game_tavern` / `common_room` | `backdrop_sealed.jpg` | `backdrop_open.jpg` | `cellarOpen` |

### Doorway hotspots

- Slot: `noSprite: true` — click target only; **never** draw a door sprite over the plate.
- Wire exits + `when: { flag: "…" }` + clear blocked dialogue that matches the **art**.
- **Walk to** an open exit should leave the room (not stop at the threshold).
- If copy says “locked,” the plate must show a **closed** door.

### QA for variants

- agent-browser: boot sealed → `qa/verify_sealed.png`; set flag → `qa/verify_open.png`.
- Diff outside the door strip should be ~0.

---

## 5. Slot plan (before props)

List slots with type and intent:

| Slot id | Kind | Prop | Notes |
|---------|------|------|--------|
| `cellar_door` | wall | none (backdrop) | Hitbox; sealed/open plates |
| `notice` | wall | `notice.png` | Eye level on wall, not under dialogue bar |
| `mantel` | wall | `key.png` | Key resting on shelf surface |
| `tankard_prop` | floor/wall | `tankard.png` | Bottom sits **on** bar top, not floating |
| `oven` | wall | none | Hitbox on painted hearth |
| `flour_prop` | floor | `flour.png` | At crate base, mid-ground |

Only create slots you will fill. Fewer well-placed objects beat a crowded room.

---

## 6. Props: green screen → transparent PNG

### Generate **after** the empty backdrop is approved

- Full object, centered.
- **Solid pure green `#00FF00`** only (no floor, no contact shadow on the green).
- Style: **same world as the backdrop** (VGA chunk if rooms are VGA; painted if rooms are painted).
- Side or ¾ view that matches the room camera.

### Process

1. Chroma-key pure green (high G, low R/B, green dominance — protect teal).
2. Despill green fringe.
3. **Crop to opaque bounds** (+ small pad).
4. Save as `{contentRoot}/rooms/<roomId>/props/{id}.png` (and inventory twins under `items/` if needed).

### Inventory icons

Same art pipeline: green plate → key → crop → `{contentRoot}/items/{id}.png`, referenced from `items.json` with `"icon": "items/foo.png"`.

---

## 7. Scale: man is the ruler

Do **not** size props by “looks fine alone.” Size them as **fractions of `manH_scene`**.

Suggested starting ratios (drawn sprite height vs man):

| Prop | ≈ % of man height | Intent |
|------|-------------------|--------|
| Key on mantel | 12–18% | Small, readable |
| Tankard / mug | 14–20% | Fits on a bar; not a bucket |
| Notice / scroll | 20–28% | Wall paper, not a tapestry |
| Flour sack | 25–35% | Heavy bag at crate height |
| Sitting cat | 18–24% | Shin / low knee |
| Writing desk | 65–75% | Top near waist |

Use each PNG’s **natural aspect ratio**; set height from the ratio, derive width.

Typical `manH_scene`: **140–148** scene px. Match door height: player should feel human next to a doorway, not a giant or a mouse.

---

## 8. Placement rules

### Floor / counter props

- Bottom of sprite on the **contact surface** (floor line, bar top, mantel shelf) — not floating with a gap, not sunk into the face of the furniture.
- Iterate with live screenshots: “tad higher / lower” is normal; trust eyes over first-guess Y.
- Soft contact shadow under feet (engine ellipse), not baked into the green plate.

### Takeable props must hide when taken

Engine draws props only when visible. On take/use that gives an item, content should:

```json
"setObject": "tankard_prop.taken"
```

and/or:

```json
"hideWhen": { "flag": "tookTankard" }
```

`setObject: "<slotId>.taken"` (or `.hidden`) removes the sprite **and** click target. Without this, the mug/key stays in the room after it’s in inventory.

### Placed / revealed props (show after a flag)

When the player **puts** an item somewhere (ale on the bar, loaf on the table), use a separate slot that is **hidden until** a flag:

```json
"placed_ale": {
  "showWhen": { "flag": "servedAle" },
  "look": [{ "say": "Frothy royal ale, set for His Majesty." }]
}
```

```json
// room.json slot with prop sprite
"placed_ale": {
  "prop": "props/placed_ale.png",
  "sceneDrawX": 600, "sceneDrawY": 210, "sceneDrawW": 28, "sceneDrawH": 30
}
```

On serve: `"setFlag": "servedAle", "remove": "royal_ale"` — inventory clears and the bar sprite appears.

### Wall props

- Eye-level for notices (not under the dialogue banner, not in the rafters).
- Keys rest **on** mantel tops; tankards **on** counter tops.
- Don’t cover windows, torches, or critical architecture.

### Architecture

- Painted door / hatch → **hitbox only** (`noSprite: true`).
- Gated open black openings → sealed/open plates (section 4).
- `noSprite` hotspots: no floating gold outline.

### Z-order

- Draw by depth / feet Y so props don’t paint over the player incorrectly.

---

## 9. `room.json` contract (essentials)

```json
{
  "id": "common_room",
  "backdrop": "backdrop_sealed.jpg",
  "backdrops": [
    { "when": { "flag": "cellarOpen" }, "src": "backdrop_open.jpg" },
    { "src": "backdrop_sealed.jpg" }
  ],
  "walkBounds": { "min": 80, "max": 880 },
  "imageSize": [1280, 720],
  "sceneSize": [960, 428],
  "floorY_scene": 378,
  "manH_scene": 140,
  "slots": {
    "tankard_prop": {
      "kind": "floor",
      "noSprite": false,
      "sceneDrawX": 655,
      "sceneDrawY": 216,
      "sceneDrawW": 22,
      "sceneDrawH": 24,
      "walkX": 665,
      "hx": 638, "hy": 212, "hw": 55, "hh": 48,
      "prop": "props/tankard.png"
    }
  }
}
```

| Field | Meaning |
|-------|---------|
| `kind` | `floor` \| `wall` |
| `noSprite` | true = backdrop hitbox only (door) |
| `sceneDraw*` | Where the sprite is drawn |
| `walkX` | X the player walks to before interacting |
| `hx,hy,hw,hh` | Click hitbox (usually inset draw rect) |
| `manH_scene` | Player height — **scale ruler for all props** |
| `walkBounds` | Min/max X on the horizontal band |

---

## 10. Hitboxes vs draw boxes

| Box | Purpose |
|-----|---------|
| **Draw rect** | Visual sprite placement |
| **Hitbox** | Click / hover (usually inset) |

### In-game debug

| URL | Effect |
|-----|--------|
| `?debug=1` | Show draw + hit boxes, labels |
| `?objects=plant,cat` | Isolate listed ids |
| `?hidebg=1` | Dim backdrop |
| `?hideplayer=1` | Hide character |
| `?content=game_tavern` | Select content root |

Runtime: **B** toggles boxes.

---

## 11. Live visual QA (required — every room)

Do **not** ship a room that only “works in JSON.” Use agent-browser (or manual) screenshots.

### Per room

1. Hard-refresh with cache bust (`?v=…`).
2. Clean screenshot: `qa/sanity_clean.png` or `qa/sanity_final.png`.
3. Debug screenshot: `?debug=1` → `qa/sanity_debug.png`.
4. If gated door: `qa/verify_sealed.png` + `qa/verify_open.png`.
5. Walk left↔right: clear path, feet on floor line, no skating into furniture art.

### Visual checklist (live)

- [ ] Clear horizontal walk band  
- [ ] Player scale vs doors / bar / well looks human  
- [ ] Props sit on surfaces (no float, no sink)  
- [ ] Prop sizes sensible vs man (% of manH)  
- [ ] Notice / wall items at readable height  
- [ ] Locked door **looks** locked; open door **looks** open  
- [ ] Hitboxes hug the object (`?debug=1`)  
- [ ] Goal / dialogue text match what the eye sees  
- [ ] Style matches other rooms in the same game  

### Prop nudge loop

Placement is iterative. Common fixes:

| Symptom | Adjust |
|---------|--------|
| Tankard floats above bar | Raise drawY carefully until bottom meets counter top (often *higher* on screen = smaller Y) |
| Key floats above mantel | Nudge drawY down onto shelf |
| Notice in the rafters | Lower drawY to eye level beside shelves |
| Mug huge vs hero | Shrink drawW/H (~14–20% manH) |

Re-screenshot after every nudge. Don’t stop at “probably fine.”

---

## 12. Scripts & player clarity

- Objectives should always name the **next sensible action**.
- Locked door copy must match sealed art.
- Prefer multi-step puzzles that stay intuitive (notice → key → door → fill tankard → bake → serve).
- `remove` may be a string or array of item ids when clearing multiple inventory pieces.

---

## 13. Pack file layout

```
{contentRoot}/                 # e.g. game_tavern/
  content.json
  items.json
  items/{id}.png
  ui/title.jpg
  VISION.md                    # art + puzzle spine
  characters/<characterId>/
  rooms/<roomId>/
    room.json
    script.json
    backdrop.jpg               # default start plate
    backdrop_open.jpg          # if gated door
    backdrop_sealed.jpg
    props/{slot}.png
    qa/
      backdrop_empty_vga.jpg   # optional: locked empty plate
      sanity_clean.png
      sanity_debug.png
      verify_sealed.png
      verify_open.png
```

---

## 14. Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|--------------|--------------|------------|
| Mid-floor tables / well on walk band | Horizontal walker can’t go around | Furniture to back wall / sides |
| Pickups baked into backdrop | Can’t take/hide/scale | Empty plate + prop sprites |
| Photoreal room + pixel hero | Tone clash | Lock one art direction |
| Full-room regen for “close door” | Wrong hole sealed; slots break | Crop → edit → paste |
| Open black doorway, no sealed plate | “Locked” feels broken | Sealed plate until flag |
| JS-drawn doors in engine | Fights pack art | Backdrop variants |
| Size props in isolation | Wrong vs man | % of `manH_scene` |
| Ship without browser screenshots | Floats and scale bugs ship | QA every room live |
| Prop float “close enough” | Looks amateur | Nudge until contact reads true |
| Skip walk-path check | Player clips furniture | Clear aisle before props |

---

## 15. Definition of done

A room is ready when:

1. Empty (or correctly sealed) backdrop has a **clear left→right walk band**.  
2. `room.json` has `manH_scene`, floor line, per-slot draw + hit + walkX.  
3. Props are separate keyed PNGs; nothing takeable is baked into the plate.  
4. Live clean + debug screenshots exist under `qa/`.  
5. Player scale and prop contact surfaces look intentional.  
6. **If a doorway is gameplay-gated:** sealed + open plates, `backdrops` wired to the flag, verify screenshots.  
7. Walk-to / use exit works when open; blocked copy matches sealed art.  
8. Objectives point to the next clear action.

---

## 16. Suggested authoring flow

```bash
# Serve
python3 -m http.server 8000

# Play a content root
# http://127.0.0.1:8000/?content=game_tavern&v=60
# http://127.0.0.1:8000/?content=game_tavern&debug=1

# Sealed doorway (concept)
# 1) save backdrop_open.jpg
# 2) crop doorway strip (wide enough for open leaf)
# 3) edit crop closed → paste onto copy of open → backdrop_sealed.jpg
# 4) verify pixel diff outside strip ≈ 0
```

Browser automation screenshots are valid QA artifacts — keep them under `{contentRoot}/rooms/<roomId>/qa/`.

---

## Summary

**Empty architecture plate → clear horizontal walk band → lock style → props on green after backdrop → man-relative scale → live browser nudge loop → sealed/open plates via crop-edit-paste if gated.**

Quality is not “assets exist.” Quality is **shared floor, open aisle, man-relative scale, tight boxes, state art that matches flags, and visual proofs for every room.**
