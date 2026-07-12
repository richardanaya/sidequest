# GEN_CHARACTER — Building a high-quality adventure character

Practical pipeline and quality bar for the player character: **idle plate, walk cycle, green-screen extraction, scale vs room, movement feel, and visual QA.** Drawn from what worked (and failed) across games: tone clashes (goofy vs serious rooms), double walk layers, hard stops, squashed/cropped walk frames, and size mismatches with props.

**Pack layout:** each character is a folder pack under `{contentRoot}/characters/<characterId>/` (e.g. `game_tavern/characters/tavernkeep/`) with `character.json` + art. See [`CONTENT.md`](./CONTENT.md). This file is *how to author* a good character pack.

---

## Goals

- One **readable side-view** character that belongs in the room’s art direction.
- **Idle** and **walk** that share identity (same outfit, proportions, rendering).
- Scale locked to the room via **`manH_scene`** (see `GEN_ROOM.md`).
- Walk that **starts, loops, and stops** without skating, popping, double silhouettes, or **cropped limbs**.
- Motion that matches the game’s tone (calm Rapture stride vs casual tavern amble).

Avoid: freehand “draw a guy,” mismatched idle/walk styles, stacking idle under walk at full opacity, hard velocity cuts mid-stride, and per-frame tight crops that cut off arms/legs.

---

## End-to-end pipeline

```
1. Art direction lock     → match backdrop style (VGA pixel, painted, art-deco…)
2. Age / silhouette pass  → iterate until face/body read right (young vs mature)
3. Idle base image        → side view, full body, pure green #00FF00
4. Visual read of idle    → proportions, crop, green plate quality
5. Chroma + tight crop    → idle.png (opaque bounds) for idle draw only
6. Walk from idle plate   → image-to-video (subtle, in-place, loopable)
7. Walk QA                → extract frames; check gait, loop, green, full body
8. Scale vs room          → manH_scene; composite with props / doors
9. In-game motion         → accel/decel, playback rate, single-sprite draw
10. Live screenshot QA    → idle, mid-walk, stop in a real room
```

Ship when **composite with room** and **live walk/stop** both look intentional.

---

## 1. Art direction

### Match the rooms

| Room style | Character should be |
|------------|---------------------|
| VGA / Sierra pixel (e.g. *Crown & Cup*) | Chunk pixels, limited palette, hard edges — not smooth 3D |
| Painted Sierra | Brushy illustration, same color world |
| Art-deco / Rapture (*Sealed*) | Semi-realistic, restrained, muted teal/brass |

Photoreal hero in a pixel tavern (or pixel hero in a CGI hall) fails. Lock style with the **first room plate**, then generate the character to match.

### Tone

- **Adult proportions** unless the whole game is comedy-chibi.
- Comedy lives in **copy and puzzles** more safely than in a goofy body next to serious architecture.
- Age: specify clearly in prompts (“about 25–28,” “not a child,” “not middle-aged”) and **visually reject** misses. Echoes of classic heroes (e.g. young King Graham) work if the face still reads as your protagonist.

### Direction checklist

- [ ] Same value range / detail density as room backdrops  
- [ ] Side view facing **right** (engine flips for left)  
- [ ] Full body, feet visible, silhouette readable at ~140–160 px height  
- [ ] Age and mood approved before walk generation  

---

## 2. Idle base image

### Generate

| Requirement | Detail |
|-------------|--------|
| Pose | Neutral standing, weight planted, arms relaxed |
| View | Strict **side view**, facing right |
| Framing | Full body, centered, no crop through skull/feet |
| Background | **Solid pure green `#00FF00` only** — no floor, no baked ground shadow |
| Style | Match final game look (see §1) |
| Aspect | Square gen is OK; content will be tall after crop |

Prompt anchors: *side view facing right, full body, pure green background, no floor, no shadow, adult proportions, [style keywords], [age].*

### After generate — read the image

- Coat/skin not eaten by green (teal needs careful key later).
- Feet clear of plate edge.
- Face age matches intent (regenerate; don’t “fix it in post”).
- Silhouette has enough body volume for side-view readability.

---

## 3. Green screen → `idle.png`

### Keying rules

- Key **pure screen green**: high G, low R/B, strong green dominance.
- **Protect** teal clothing and cool shadows: do **not** key “any greenish pixel.”
- Despill residual green on edges.

### Crop

- Crop to opaque alpha bounds (+ 1–2 px pad).
- Save `{contentRoot}/characters/<id>/idle.png`.
- Keep `idle.jpg` (or source plate) for walk regeneration and re-key.

### Verify

```text
opaque bounds exist
center sample is coat/skin, not green
aspect looks like a person, not a 1px needle
```

If the crop is absurdly thin, re-key or re-gen — don’t stretch X in-game.

---

## 4. Walk cycle generation

### Source

Always start from the **same idle plate** so identity holds:

- `image_to_video(idle)` preferred over a new full-body gen.

### Motion brief (what to ask for)

- Side view, facing right, **in-place** walk (treadmill) — **not** traveling across the frame (engine only moves on X).
- **Subtle / casual** by default for adventure: small steps, soft arm swing, minimal vertical bob.
- Avoid exaggerated march, rubber-hose bounce, or athletic sprint unless the game wants that.
- Green background **unchanged**; character **centered**; camera locked.
- Duration: 6s (or tool minimum); loop-friendly.

### Playback rate

Start conservative so gait matches on-screen speed:

```text
playbackRate ≈ 0.7–0.85
maxSpeed     ≈ 85–110 px/s for a calm stroll
```

Faster video than movement → moonwalk/skate. Prefer slightly slow video over skating feet.

### What failed

| Failure | Symptom | Fix |
|---------|---------|-----|
| Over-animated bounce | Cartoon slapstick | Re-gen subtle walk; lower playbackRate |
| Per-frame **tight content crop** | Limbs cut off; aspect jumps; “squashed” walk | **Never crop walk frames** for draw — see §5 |
| Idle under walk at α=1 | Double character | Hard cut or true crossfade only |
| Hard stop + seek 0 | Mid-stride pop | Pause in place; blend out |
| Walk gen without idle ref | Outfit drift | Always condition on idle plate |

### Frame QA (offline)

Extract sample frames (ffmpeg `fps=2` or similar):

- [ ] Same outfit/colors as idle  
- [ ] Green plate still keyable  
- [ ] Full body visible (no side cut-off in the **video**)  
- [ ] Gait subtle enough for the game  
- [ ] Loop doesn’t teleport feet/torso  

---

## 5. Drawing walk frames (engine contract)

### Full frame key — no tight crop for display

Walk video frames must be **chroma-keyed at full frame size**. Do **not** tight-crop each frame to content bounds for drawing — that:

- Cuts limbs when the pose extends past the idle silhouette  
- Changes aspect every frame (horizontal squash / jitter)  
- Fights a stable foot anchor  

### First-frame calibration (required)

On the first good walk frame after key:

1. Measure **content bounding box** once (`bx, by, bw, bh` in video space).  
2. Store `walkCalib` with frame size `fw, fh`.  
3. Scale: `scale = player.height / bh` (content height → `manH_scene`).  
4. Draw the **full keyed frame** at that scale.  
5. Align so content **feet** land on `player.y` (foot center X on `player.x`).

Subsequent frames reuse the same calib — no per-frame re-measure, no per-frame crop.

### Idle vs walk

| State | Source | Size |
|-------|--------|------|
| Idle | `idle.png` (pre-cropped) | Height = `manH_scene`; width from idle aspect |
| Walk | Full keyed video frame | Scale from first-frame content height; full frame drawn |

### Critical draw rule

**Never draw full-opacity idle under full walk frames.**

1. **Hard cut** (simplest): `if walkBlend >= 0.5 → walk else idle`  
2. **True crossfade**: idle α = `1 - blend`, walk α = `blend`  
3. **Do not**: idle α = 1 always with walk on top  

---

## 6. Scale vs the room

Character height is the **scale ruler** for the whole room (`GEN_ROOM.md`).

| Concept | Practice |
|---------|----------|
| `manH_scene` | Authoritative height in scene pixels (e.g. 140–148) |
| Feet | On shared `floorY_scene` with floor props |
| Doors | Player should look human next to doorways |

### Composite check (required)

Render room + props + character:

- Man taller than bar top / desk surface as appropriate.  
- Props at documented % of man height.  
- Character not a speck and not a giant.  

Do not ship size that only looks good on green.

---

## 7. In-game motion architecture

### States

| State | Visual | Motion |
|-------|--------|--------|
| Idle | `idle.png` | `vx ≈ 0` |
| Walk | Full keyed frame from `walk.mp4` | Moving toward `targetX` |
| Settle | Blend back to idle | Decelerating / arrived |

### Video playback

| Setting | Guidance |
|---------|----------|
| `loop` | true for in-place cycle |
| `muted` / `playsInline` | required for autoplay policies |
| `playbackRate` | ~0.7–0.85; slight scale with `vx` |
| Unlock | `play()` on first user click |
| Stop | **Pause in place**; avoid hard seek to 0 every stop |

### Movement feel

- **Accelerate** up to `maxSpeed`.  
- **Decelerate** before `targetX`.  
- Only treat as “walking” when `vx` (or remaining distance) exceeds a small threshold.  
- On arrival: soft anim settle, then `arriveAction`.

Point-and-click: click ground or walk-to hotspot sets `targetX` + facing. Horizontal only — art and rooms must assume a single floor band (`GEN_ROOM.md` walk path).

---

## 8. Facing

- Art faces **right**.  
- For left: `scale(-1, 1)` around the sprite.  
- Flip draw only; logic position stays feet X on the floor line.

---

## 9. Pack files

```
{contentRoot}/characters/<characterId>/
  character.json          # art paths, motion, default height
  idle.png                # keyed + cropped (idle draw)
  idle.jpg                # raw green plate (regen / walk source)
  walk.mp4                # walk cycle, green plate, loopable
  qa/                     # optional frame dumps, composites
    walk_01.png
```

Example `character.json` motion (calm tavern stroll):

```json
"motion": {
  "maxSpeed": 88,
  "accel": 480,
  "decel": 800,
  "stopEpsilon": 2.5,
  "playbackRate": 0.72,
  "blendIn": 14.0,
  "blendOut": 12.0,
  "walkSpeedThreshold": 10
}
```

Cache-bust when replacing binaries (`?v=N` on the content shell).

---

## 10. Visual QA checklist

### Idle

- [ ] Same world as the room style  
- [ ] Age/face approved  
- [ ] No green halo / holes in clothing  
- [ ] Feet on shared floor line  
- [ ] Scale sensible vs doors / bar / props  

### Walk

- [ ] Full body — no limb cut-off  
- [ ] No horizontal squash / aspect pop frame-to-frame  
- [ ] Only **one** body visible  
- [ ] Gait subtle enough; playback matches move speed  
- [ ] Loop doesn’t hitch badly  

### Stop

- [ ] Decelerates instead of teleport-stop  
- [ ] No snap to random walk frame  
- [ ] Arrive actions fire after motion settles  

### Live captures (required)

Screenshot at least:

1. Idle in room  
2. Mid-walk across the clear aisle  
3. Just after stop  

Use agent-browser; eyes on pixels beat guessing from code.

---

## 11. Anti-patterns

| Anti-pattern | Symptom | Fix |
|--------------|---------|-----|
| Style mismatch vs rooms | “Looks pasted in” | Regen to match backdrop direction |
| Wrong age | Player rejects character | Regen idle with clearer age; re-walk from new idle |
| Per-frame content crop | Cut-off limbs, jitter | Full-frame key + first-frame calib |
| Idle α=1 under walk | Double character | Single sprite or true crossfade |
| `currentTime = 0` every stop | Pop / glitch | Pause; blend; optional delayed reset |
| Constant max speed | Skating + hard plant | Accel/decel + playbackRate |
| Exaggerated walk for calm game | Feels wrong | Subtle walk brief + lower rate |
| Size only on green | Giant or tiny in room | Composite with `manH_scene` |
| New walk without idle ref | Outfit drift | Always condition on idle plate |
| Hitbox = full video frame | Clicks miss/fat | Stable idle-based logic width |

---

## 12. Definition of done

Character is ready when:

1. `idle.png` is cleanly keyed and cropped.  
2. `walk.mp4` matches idle identity, keys cleanly, and is drawn **full-frame** with first-frame calib.  
3. `manH_scene` drives in-game height; composite with room looks correct.  
4. Live walk shows **one** full figure, plausible gait, soft stop, no crop/squash.  
5. Idle / mid-walk / stop screenshots all pass the checklist.  
6. Art direction matches the rooms in that content root.

---

## 13. Relation to `GEN_ROOM.md`

| Concern | Document |
|---------|----------|
| Empty plates, horizontal walk band, prop %, door variants, browser room QA | `GEN_ROOM.md` |
| Idle/walk art, chroma, full-frame walk draw, motion, stop, double-draw | **This file** |

Room and character share **`floorY_scene`** and **`manH_scene`**. Change one → re-check the other. Character cannot fix a room whose mid-floor tables block the walk aisle.

---

## 14. Suggested constants

| Feel | maxSpeed | playbackRate | manH_scene |
|------|----------|--------------|------------|
| Calm tavern / KQ stroll | ~85–95 | ~0.7–0.75 | 140 |
| Default adventure | ~100–120 | ~0.75–0.85 | 148 |
| Brisk | ~120–140 | ~0.85–0.95 | 148 |

Tune with eyes on mid-walk screenshots.

---

## Summary

**Style-matched idle on pure green → careful key/crop → subtle in-place walk from that plate → full-frame key + first-frame height calib (never per-frame crop) → size to manH in the room → one sprite on screen → accel/decel and soft stop → screenshot proof in a real room.**

A great character is not only a good still. It’s **identity + scale + motion + stop**, verified on the horizontal stage they actually walk.
