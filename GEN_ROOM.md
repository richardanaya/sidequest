# GEN_ROOM — Building high-quality adventure rooms

Practical pipeline and quality bar for point-and-click rooms in this project (Rapture / art-deco style). Derived from what actually worked in production: **one fixed-camera plate as authority, segmentation-driven placement, man-as-ruler scale, state-variant backdrops for doors/hatches, composite + browser visual QA.**

**Pack layout:** each room is a folder pack under `game_data/rooms/<roomId>/` with `room.json` + assets. See [`CONTENT.md`](./CONTENT.md) for the contract. This file is *how to author* a good room pack.

---

## Goals

- One **fixed camera** room that reads as a designed space (not stickers on a wallpaper).
- Props that sit on a shared floor line or hang on real wall panels.
- Scale that matches the **player character** as the unit of measure.
- A repeatable way to **catch bad placement** before shipping.

Avoid early on: multi-panel side-scroll corridors, freehand world coordinates, and “place everything then hope.”

---

## End-to-end pipeline

```
1. Backdrop          → single room image (no stitching until one room is perfect)
2. Read the image    → name walkable floor, wall panels, built-in architecture
3. Slot plan         → which props belong where (floor vs wall)
4. RGB segmentation  → solid color masks for each slot on black/dark base
5. Centroids         → feet / hang centers from each color region
6. placements.json   → draw rects + hitboxes in scene space
7. Props             → generate on pure green, chroma-key, tight crop to PNG
8. Composite render  → full room + props + man silhouette
9. Visual QA         → fix scales/anchors; re-export JSON
10. In-game check    → browser screenshot; ?debug=1 boxes; isolate objects
```

Ship only when **composite** and **live game** both look right.

---

## 1. Backdrop first

### Do

- Generate **one** room image (e.g. 1280×720 or 16:9).
- Prefer a clear **side-view hall**: readable floor tiles, wall panels, door/opening, negative space for walking.
- Match the art direction of the game (here: somber art deco / Rapture, not cartoon slapstick).

### Don’t

- Build three panels and place props across a long scroller before one room is solid.
- Rely on painted-in furniture for *every* hotspot unless hitboxes are painted carefully—**separate prop sprites** are easier to resize and debug.

### Read the backdrop before placing anything

Note explicitly:

| Zone | What to mark |
|------|----------------|
| Floor contact line | Y where feet/props meet tiles (shared `FLOOR_Y`) |
| Walk band | Horizontal strip the player can cross |
| Wall hang bands | Mid-wall panels for portraits, safes |
| Architecture | Doorways already in the art → **hitbox only**, no second door sprite |
| Keep-out | Portholes, lamps, heavy ornament—don’t cover them |

**Important:** A painted *open* doorway (black void) will always *look* open. If the door is gameplay-gated (needs key / power), you need a **sealed backdrop variant** (see below). Do not fix that with engine-side drawing of door plates in JS.

---

## 1b. State-variant backdrops (sealed / open doors)

Some rooms need the **same camera and layout**, but a doorway or hatch changes when a flag flips (hall airlock, pump east hatch, etc.).

### Rule

| Do | Don’t |
|----|--------|
| Keep one **authority plate** (usually the open / empty doorway) as pixel base | Full-frame re-generate the whole room for “closed door” |
| Change **only** the doorway region for sealed/open | Let the model reseal the porthole / whale / pipes / fuse box |
| Store variants as separate JPGs under the room pack | Hand-draw door frames in `js/ui.js` |
| Drive swaps from `room.json` + flags | Freehand new prop coords after a full regen |

### Crop → edit → paste (required method)

Full-room Imagine edits routinely “close” the wrong hole (e.g. the **whale porthole** instead of the Maintenance Access door). That also shifts walls enough to **break all prop slots**.

1. Start from the **open** plate (empty doorway on the correct side).
2. **Crop only** the far doorway strip — e.g. right hatch at `x ≥ ~1175` on a 1280-wide plate, so the center porthole is never in the crop.
3. Prompt the crop explicitly: *“This is ONLY the side doorway. Do not invent portholes, whales, pipes, or fuse cabinets.”*
4. Paste the sealed crop back onto a **copy of the open plate**.
5. Verify with pixel stats (or a side-by-side strip): **mean abs diff left of the door ≈ 0**; door strip differs; whale/center region ≈ 0.

### Files

```text
game_data/rooms/<roomId>/
  backdrop_open.jpg      # authority plate (empty doorway / open hatch)
  backdrop_sealed.jpg    # open + sealed door crop pasted in place
  backdrop.jpg           # optional alias of the default start plate
```

### `room.json` contract

```json
"backdrop": "backdrop_sealed.jpg",
"backdrops": [
  { "when": { "flag": "airlockOpen" }, "src": "backdrop_open.jpg" },
  { "src": "backdrop_sealed.jpg" }
]
```

- First matching `when` wins (same idea as script objectives).
- Default/start state is usually **sealed** (door closed until the player solves something).
- Engine loads all listed plates and calls `syncBackdrop()` when flags change — no doorway art in JS.

### Examples in this game (*Sealed*)

| Room | Sealed plate | Open plate | Flag |
|------|--------------|------------|------|
| `maintenance_hall` | `backdrop_sealed.jpg` | `backdrop_open.jpg` | `airlockOpen` |
| `pump_gallery` | `backdrop_sealed.jpg` | `backdrop_open.jpg` | `powerOn` |
| `bathysphere_dock` | single plate OK | — | Sphere already reads closed; optional later |

### Doorway hotspots

- Slot: `noSprite: true` — click target only; **never** draw a door sprite or hover outline that floats over the plate.
- Wire exits: `exits.east.hotspot: "door"` (or `"hatch_east"`) + `when: { flag: "…" }` + clear `blockedSay`.
- **Walk to** an open exit hotspot should leave the room (not stop at the threshold).
- Blocked line should match the art: e.g. *“The airlock is sealed. Find a key…”* not a vague *“You can’t go that way.”*

### QA for variants

- agent-browser (or manual): boot room sealed → screenshot; set flag → `syncBackdrop` → screenshot open.
- Save under `game_data/rooms/<roomId>/qa/verify_sealed.png` and `verify_open.png`.
- Compare right strip only if unsure; full-room diffs should be near zero outside the door crop.

---

## 2. Slot plan (before any mask)

List slots with type and intent, e.g.:

| Slot id | Kind | Prop | Notes |
|---------|------|------|--------|
| `door` | wall / arch | none (backdrop) | Hitbox on painted door |
| `portrait` | wall | `portrait.png` | Center on panel between sconces |
| `plant` | floor | `plant.png` | Feet on floor line |
| `cat` | floor | `cat.png` | Small vs man |
| `desk` | floor | `desk.png` | Surface near waist height |
| `safe` | wall | `safe.png` | Above / beside desk, not floating mid-void |

Only create slots you will fill. Fewer well-placed objects beat a crowded room.

---

## 3. RGB segmentation mask

### Method

Edit a **copy of the backdrop** (or black plate) so each slot is a **flat pure RGB region**:

- No gradients, textures, outlines, or labels on the mask.
- Regions **separated**, medium size, not covering critical architecture (e.g. porthole glass).
- Background black or near-black.

### Example legend (use exact colors)

| Color | Hex | Slot |
|-------|-----|------|
| Red | `#FF0000` | door |
| Blue | `#0000FF` | portrait |
| Yellow | `#FFFF00` | plant |
| Magenta | `#FF00FF` | cat |
| Orange | `#FF8000` | desk |
| Teal-green | `#00FF80` | safe |

Prompt models explicitly: *“solid filled shapes, pure RGB, hard edges, black background.”* AI greens often drift—use tolerance when extracting.

### Extract centroids

For each color region:

- **Floor props:**  
  - `feetX` = mean X of mask  
  - `feetY` = **bottom** of mask (or global `FLOOR_Y` if more consistent)  
- **Wall props:**  
  - `cx, cy` = mean X/Y (hang center)  
- Also store bounding box for initial size hints.

Write results into `placements.json` (image space + **scene space** scaled to the game canvas scene rect).

---

## 4. Props: green screen → transparent PNG

### Generate

- Full object, centered.
- **Solid pure green `#00FF00`** only (no floor, no contact shadow on the green).
- Style: **same seriousness as the backdrop** (refined art deco, not chibi / rubber-hose).
- Side or ¾ view that matches the room camera.

### Process

1. Chroma-key pure green (protect teal clothing/leaves: require high G **and** low R/B **and** green dominance).
2. Soft edge optional; despill green fringe.
3. **Crop to opaque bounds** (+ small pad).
4. Save as `game_data/rooms/<roomId>/props/{id}.png`.

### Verify

- File name matches content (swapped plant/portrait will pass code and fail eyes).
- Crop isn’t a hairline thin strip unless the art is truly profile-thin.
- Spot-check a walk frame the same way if using video sprites.

---

## 5. placements.json contract

Minimum useful fields per slot (scene = on-canvas adventure area, not full window):

```json
{
  "imageSize": [1280, 720],
  "sceneSize": [960, 428],
  "floorY_image": 628,
  "floorY_scene": 373.3,
  "manH_scene": 148,
  "slots": {
    "desk": {
      "kind": "floor",
      "noSprite": false,
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

| Field | Meaning |
|-------|---------|
| `kind` | `floor` \| `wall` |
| `noSprite` | true = backdrop hitbox only (door) |
| `sceneDraw*` | Where the sprite is drawn |
| `walkX` | X the player walks to before interacting |
| `hx,hy,hw,hh` | Click hitbox (usually inset draw rect) |
| `manH_scene` | Player height in scene px—**scale ruler for all props** |

Game should prefer **authoring-time draw rects** over recomputing from masks every load.

---

## 6. Scale: man is the ruler

Do **not** size props by “looks fine alone.” Size them as **fractions of `manH_scene`**.

Suggested starting ratios (height of **drawn sprite** vs man):

| Prop | ≈ % of man height | Intent |
|------|-------------------|--------|
| Sitting cat | 18–24% | Shin / low knee |
| Floor planter | 32–40% | Knee–thigh urn |
| Writing desk (+ lamp) | 65–75% | Wooden **top** near **waist** (~48–52% of man); lamp may stick higher |
| Wall portrait | 45–55% | Large head-and-shoulders frame |
| Wall safe | 30–38% | Strongbox, usually above desk |

Use each PNG’s **natural aspect ratio**; set height from the ratio, derive width.

**Character height** should come from `manH_scene` in JSON so props and player stay locked.

### Desk special case

Desk art often includes a lamp. The **desktop surface** should align near the man’s waist line on the composite (draw a temporary waist guide at `floorY - 0.48 * manH`). If the surface is mid-thigh, raise the whole desk sprite.

---

## 7. Placement rules

### Floor props

- Bottom of sprite on **shared** `FLOOR_Y` / `floorY_scene`.
- Center X from segmentation feet (or deliberate composition tweak).
- Soft contact shadow under feet (ellipse), not baked into green plate.

### Wall props

- Center on wall panel; don’t cover sconces/portholes.
- Safe/portrait bottoms should not float in empty sky—use wall mass as anchor.
- Safe above desk: gap of a few px above desk top, biased toward the door wall if needed.

### Architecture

- Painted door / hatch → **hitbox only** (`noSprite: true`). Never stack a second door prop on a painted door.
- If the plate shows an **empty black opening** but gameplay requires sealed until a flag, author **backdrop_sealed / backdrop_open** (section 1b). Do not invent a floating door in engine code.
- `noSprite` hotspots: no gold hover outline in the shell (outline reads as a phantom prop).

### Z-order

- Sort draw by feet Y (floor) / logical depth; walls before or with consistent painter’s algorithm so cat isn’t under the floor.

---

## 8. Hitboxes vs draw boxes

| Box | Purpose |
|-----|---------|
| **Draw rect** | Visual sprite placement |
| **Hitbox** | Click / hover (usually inset ~8% X, ~5% Y) |

Debug both. A pretty sprite with a wrong hitbox feels “broken.”

### In-game debug (this project)

| URL | Effect |
|-----|--------|
| `?debug=1` | Show draw + hit boxes, labels, legend |
| `?objects=all` | All hotspots |
| `?objects=plant,cat` | Isolate listed ids |
| `?only=desk` | Single object |
| `?hidebg=1` | Dim backdrop for clearer boxes |
| `?hideplayer=1` | Hide character |
| `?labels=0` | Boxes without text |

Runtime: **B** toggles boxes.

**Sanity:** hitboxes should hug the readable object, not huge empty transparent padding, and not miss the sprite.

---

## 9. Composite sanity check (required)

After every placement pass, render a **full composite** offline:

1. Backdrop scaled to `sceneSize`.
2. All props at `sceneDraw*` from JSON.
3. Player silhouette at `manH_scene` on the floor line.
4. Optional: waist line, % labels (`desk 104 (70%)`).

Save e.g. `game_data/rooms/<roomId>/qa/composite_check.jpg`.

### Visual checklist (composite)

- [ ] One clear floor contact line for man + floor props  
- [ ] No prop covering porthole / critical art  
- [ ] Desk surface ≈ waist; cat clearly smaller than man  
- [ ] Plant not character-height; portrait on a panel  
- [ ] Safe attached to wall mass, not floating  
- [ ] Door hitbox on the painted opening  
- [ ] Style cohesion (no one “goofy cartoon” prop in a serious room)  
- [ ] No swapped files (open PNGs if anything feels wrong)

If the composite fails, **do not** tune only in the live game—fix JSON/assets and re-composite.

---

## 10. Live game sanity check

1. Hard-refresh with cache bust (`?v=…` on assets).
2. Screenshot full frame (e.g. agent-browser).
3. `?debug=1` — inspect all boxes.
4. `?debug=1&only=plant&hidebg=1&hideplayer=1` — isolate problem props.
5. Walk across the floor: feet should share the same ground as props; no skating if walk anim is used.
6. Hover/click each hotspot: sentence line names the right object.

### Visual checklist (live)

- [ ] Matches composite layout (no reintroduced freehand offsets)  
- [ ] Inventory / UI not covering critical hotspots  
- [ ] Click targets match what the eye thinks is clickable  
- [ ] Player scale still matches `manH_scene`  

---

## 11. Art direction notes (quality of *look*, not only layout)

From this project’s direction passes:

- **Art deco is fine; goofy is not.** Prefer serious proportions, restrained motion, muted adventure humor in copy if needed.
- Props and character should feel like the **same world** as the backdrop (value range, detail density, “museum Rapture” vs “Saturday cartoon”).
- Character: adult proportions, side view, clean green plate; walk cycle **measured**, low bob, loop-friendly—if motion is wrong, fix anim *and* stop/blend in code (no double-drawn idle under walk).

---

## 12. Pack file layout

```
game_data/
  content.json                 # registry of packs + branding
  rooms/<roomId>/
    room.json                  # authority: slots, floor, manH, exits, backdrops
    script.json                # optional: puzzles, flags, transitions
    backdrop_open.jpg          # authority plate (often empty doorway)
    backdrop_sealed.jpg        # open + sealed door crop (if gated doorway)
    backdrop.jpg               # optional alias of default start plate
    seg_mask.jpg               # optional RGB slots (authoring)
    props/
      {slotId}.png             # keyed + cropped
    qa/
      composite_check.jpg
      verify_sealed.png        # live: door/hatch closed
      verify_open.png          # live: after flag
  characters/<characterId>/
    character.json
    idle.png
    walk.mp4
```

Game loads packs by id (`?room=…`). Paths in JSON are relative to the room pack under `game_data/`. Masks are authoring artifacts; `room.json` is runtime authority.

---

## 13. Anti-patterns (seen in this project)

| Anti-pattern | Why it fails | Do instead |
|--------------|--------------|------------|
| Freehand x/y on a long scroller | Props float; no shared floor | One room + `FLOOR_Y` |
| Multi-backdrop before one is good | Split attention, inconsistent slots | Perfect one plate first |
| **Full-room regen for “close the door”** | Model seals wrong hole (whale porthole), shifts walls, **breaks all slots** | Crop doorway only → edit → paste onto open plate |
| **JS-drawn sealed doors in the engine** | Looks wrong, fights pack art, not content-driven | `backdrop_sealed` / `backdrop_open` + `backdrops` in `room.json` |
| Open black doorway, no sealed plate | Player thinks they can leave; gated exit feels broken | Sealed plate as default until flag |
| Size props in isolation | Desk/cat wrong vs man | `% of manH_scene` |
| Skip composite | “Looks fine in code” lies | Always render composite |
| Draw rect = full green plate | Huge empty hitboxes | Crop + inset hitbox |
| Door prop on painted door | Double door | Hitbox only (`noSprite`) |
| Hover outline on `noSprite` doorways | Floating gold box with no prop | No hover stroke for noSprite |
| Walk-to open door only stops at threshold | “Door open but I can’t leave” | Exit hotspot → `goToRoom` when flag allows |
| Idle under walk at α=1 | Double character | Single sprite or true crossfade |
| Trust AI mask colors as exact | Drifted greens/oranges | Tolerance + visual read of mask |

---

## 14. Quick “definition of done”

A room is ready when:

1. `room.json` has `manH_scene`, floor line, per-slot draw + hit + walkX.  
2. `composite_check.jpg` looks intentional next to the man.  
3. Live game matches composite.  
4. `?debug=1` hitboxes are tight and labeled correctly.  
5. Isolation mode proves each prop alone.  
6. Art style is cohesive and not accidentally comedic.  
7. **If a doorway is gameplay-gated:** sealed + open plates exist, `backdrops` is wired to the flag, and `qa/verify_sealed.png` + `qa/verify_open.png` agree with the art (door/hatch only changed).  
8. **Walk to / edge exit** works when open; `blockedSay` is clear when sealed.

---

## 15. Suggested authoring commands (this repo)

```bash
# After editing placements / props — regenerate composite (maintain a small script or notebook)
python3 tools/compose_room.py   # if present; else ad-hoc PIL as used in session

# Sealed doorway from open plate (concept — adjust crop box per room)
# 1) crop right doorway from backdrop_open.jpg
# 2) Imagine-edit that crop only (closed door; no portholes/whales)
# 3) paste onto copy of open → backdrop_sealed.jpg

# Play
python3 -m http.server 8000
# Open http://127.0.0.1:8000/?debug=1
# Open http://127.0.0.1:8000/?skiptitle=1&room=pump_gallery
# Open http://127.0.0.1:8000/?debug=1&only=desk&hidebg=1&hideplayer=1
```

Browser automation screenshots (agent-browser or similar) are valid QA artifacts—keep them under `game_data/rooms/<roomId>/qa/` when debugging a pass (`verify_sealed.png`, `verify_open.png`, etc.).

---

## Summary

**Backdrop (authority plate) → understand → RGB slots → centroids → JSON → keyed props → composite with man → fix scale → debug boxes in game → sealed/open doorway plates via crop-edit-paste if gated.**

Quality is not “assets exist.” Quality is **shared floor, man-relative scale, tight boxes, state art that matches flags, and visual proofs (composite + live sealed/open) that agree.**
