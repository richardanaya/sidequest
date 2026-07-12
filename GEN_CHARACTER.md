# GEN_CHARACTER — Building a high-quality adventure character

Practical pipeline and quality bar for the player character in this project: **idle plate, walk cycle, green-screen extraction, scale vs room, movement feel, and visual QA.** Drawn from what worked (and failed) in session: goofy Maniac-Mansion cartoony passes vs serious art-deco Rapture, broken/double walk layers, hard stops, and size mismatches with props.

**Pack layout:** each character is a folder pack under `game_data/characters/<characterId>/` with `character.json` + art. See [`CONTENT.md`](./CONTENT.md). This file is *how to author* a good character pack.

---

## Goals

- One **readable side-view** character that belongs in the room’s art direction.
- **Idle** and **walk** that share identity (same outfit, proportions, rendering).
- Scale locked to the room via **`manH_scene`** (see `GEN_ROOM.md`).
- Walk that **starts, loops, and stops** without skating, popping, or double silhouettes.

Avoid: pure freehand “draw a guy,” mismatched idle/walk styles, stacking idle under walk at full opacity, and hard velocity cuts mid-stride.

---

## End-to-end pipeline

```
1. Art direction lock     → serious vs goofy; match backdrop mood
2. Idle base image        → side view, full body, pure green #00FF00
3. Visual read of idle    → proportions, crop, green plate quality
4. Chroma + tight crop    → character.png (opaque bounds)
5. Walk from idle plate   → image-to-video (or edited pose → video)
6. Walk QA                → extract frames; check gait, loop, green
7. Scale vs room          → manH_scene; composite with props
8. In-game motion         → accel/decel, playback rate, single-sprite draw
9. Live screenshot QA     → idle, mid-walk, stop
```

Ship when **composite with room** and **live walk/stop** both look intentional.

---

## 1. Art direction

### What failed here

- Chunky “1990s Maniac Mansion” exaggeration next to a refined Rapture hall → read as **goofy**, even when funny on its own.
- Bright cartoon props + cartoony hero → world felt inconsistent.

### What worked

- **Adult proportions** (not chibi, not giant head).
- **Restrained art deco / Bioshock-citizen** look: tailored coat, calm face, muted teal/brass/black.
- Semi-realistic illustration or high-control pixel-adjacent rendering that matches the **backdrop’s seriousness**.
- Copy and animation equally restrained (no bouncy slapstick walk).

### Direction checklist

- [ ] Same value range / detail density as `room.jpg`
- [ ] Side view facing **right** (flip in engine for left)
- [ ] Full body, feet visible, silhouette readable at ~140–160 px height
- [ ] Not comedy-first unless the whole game is

**Art deco is fine. Goofy is optional—and costly if the room is somber.**

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

Prompt anchors that helped: *adult proportions, restrained, serious, pure green background, no floor, no shadow, full body.*

### After generate — read the image

- Coat/skin not eaten by green (teal coats need careful key later).
- Feet clear of plate edge.
- Silhouette: too thin a profile is OK for side-view art, but crop shouldn’t delete volume.

---

## 3. Green screen → `character.png`

### Keying rules

- Key **pure screen green**: high G, low R/B, strong green dominance.
- **Protect** teal clothing and cool shadows: do **not** key “any greenish pixel.”
- Despill residual green on edges.
- Soft edge optional; hard key + small pad is fine for adventure scale.

### Crop

- Crop to opaque alpha bounds (+ 1–2 px pad).
- Save `game_data/characters/<id>/idle.png`.
- Record aspect `width/height` for stable on-screen width.

### Verify

```text
opaque bounds exist
center sample is coat/skin, not green
aspect looks like a person, not a 1px needle (unless art is pure profile)
```

If the crop is absurdly thin, re-check key thresholds or regenerate with slightly more body volume—not arbitrary horizontal stretch in-game (distorts the art).

---

## 4. Walk cycle generation

### Source

Always start from the **same idle plate** (or a carefully edited variant of it) so identity holds:

- `image_to_video(idle)` preferred over a new full-body gen for walk.

### Motion brief (what to ask for)

- Side view, facing right, **in-place** walk (treadmill).
- **Adult gait**: measured stride, small arm swing, **minimal vertical bob**.
- Feet plant cleanly; not rubber-hose, not bouncy, not cartoon.
- Camera **locked**; green background **unchanged**; character **centered**.
- Duration: 6s (or tool minimum); loop-friendly.

### What failed

- Over-animated “game sprite” bounce.
- Cycle too fast for on-screen move speed → foot skating.
- Idle under walk at α=1 → **double character**.
- Hard stop + `currentTime = 0` → mid-stride pop to idle.

### Frame QA (offline)

Extract frames (e.g. every Nth frame):

- [ ] Same outfit/colors as idle  
- [ ] Green plate still keyable  
- [ ] Stride looks adult, not sliding  
- [ ] Loop doesn’t teleport feet/torso  
- [ ] Cropped content aspect roughly stable across frames  

---

## 5. Scale vs the room

Character height is the **scale ruler** for the whole room (`GEN_ROOM.md`).

| Concept | Practice |
|---------|----------|
| `manH_scene` | Authoritative height in scene pixels (e.g. 148) |
| On-screen height | `TARGET_H = manH_scene` from `placements.json` |
| Width | `round(TARGET_H * (spriteWidth / spriteHeight))` from **idle** aspect for stability |
| Feet | `drawY = groundY - TARGET_H` with shared `floorY_scene` |

### Composite check (required)

Render room + props + character on the floor line:

- Man taller than desk surface; desk top near **waist**.
- Cat clearly smaller (≈18–24% of man height).
- Plant not man-height.
- Character not a speck and not a giant.

Do not ship character size that only looks good in isolation on green.

---

## 6. In-game animation architecture

### States

| State | Visual | Motion |
|-------|--------|--------|
| Idle | `character.png` (keyed) | `vx ≈ 0`, not moving to a target |
| Walk | Chroma’d frame from `walk.mp4` | Accelerating / cruising toward `targetX` |
| Settle | Blend or hard cut back to idle | Decelerating / arrived |

### Critical draw rule

**Never draw full-opacity idle under full walk frames.**

That produced “multiple layers of character walking.”

Correct approaches:

1. **Hard cut** (simplest, clean):  
   `if walkBlend >= 0.5 → walk else idle`  
2. **True crossfade**: idle α = `1 - blend`, walk α = `blend` (sum ≈ 1).  
3. Do **not**: idle α = 1 always, walk α = blend on top.

### Stable silhouette width

Walk crops are often **wider** than idle (legs/arms).

- Prefer **idle aspect** for the logical body width / shadow / hitbox.
- Draw walk frame fitted to **same height**, centered on feet X.
- Avoid width “pop” on start/stop.

### Video playback

| Setting | Guidance |
|---------|----------|
| `loop` | true for in-place cycle |
| `muted` / `playsInline` | required for autoplay policies |
| `playbackRate` | start ~0.7–0.85; scale lightly with `vx` so feet don’t skate |
| Unlock | `play()` on first user click; keep `walkReady` even if autoplay blocked |
| Stop | **Pause in place**; avoid hard seek to 0 every stop (causes pop). Seek reset optional after blend finishes |

### Movement feel

Constant speed + instant zero velocity feels like a cutscene glitch.

Better:

- **Accelerate** up to `WALK_MAX_SPEED`.
- **Decelerate** using stopping distance before `targetX`.
- Only treat as “walking” for anim when `vx` (or remaining distance) is above a small threshold.
- On arrival: zero velocity, soft anim settle, then fire `arriveAction` (look/use/talk).

Point-and-click: click ground or walk-to hotspot sets `targetX` + facing; don’t restart the whole clip from 0 on every tiny redirect unless necessary—restart is OK when beginning a new walk from idle.

---

## 7. Facing

- Art faces **right**.
- For left: `scale(-1, 1)` around the sprite center / left edge after translate.
- Flip draw only; keep logic position as feet X on the floor line.

---

## 8. Hitbox / debug

Player debug box (with room debug):

- Draw rect ≈ on-screen idle bounds.
- Optional label: size + `walkBlend`.

URL helpers (project):

- `?debug=1` — boxes on  
- `?hideplayer=1` — room-only QA  
- `?debug=1` without hideplayer — compare man box to props  

Player should share the **same ground line** as floor props in debug view.

---

## 9. Pack files

```
game_data/characters/<characterId>/
  character.json          # art paths, motion, rules, default height
  idle.png                # keyed + cropped (runtime)
  idle.jpg                # optional raw green plate
  walk.mp4                # walk cycle, green plate, loopable
```

Runtime loads via pack id (room’s `"character"` or `?character=`).

- Idle: image  
- Walk: video frames → chroma → crop each frame (or preprocessed sheet if you graduate off video)

Cache-bust query params when replacing binaries (`?v=N`).

---

## 10. Visual QA checklist

### Idle

- [ ] Reads as the same person/world as the room  
- [ ] No green halo / holes in coat  
- [ ] Feet on shared floor line in composite  
- [ ] Scale sensible vs desk / door / cat  

### Walk

- [ ] Mid-stride frames look adult and intentional  
- [ ] Only **one** body visible (no ghost double)  
- [ ] Playback speed matches move speed (no moonwalk/skate)  
- [ ] Loop doesn’t hitch every 6s in a jarring way  
- [ ] Redirect mid-walk doesn’t explode state  

### Stop

- [ ] Decelerates instead of teleport-stop  
- [ ] No snap to a random walk frame then idle  
- [ ] No width pop  
- [ ] Arrive actions fire after motion has effectively ended  

### Live captures

Screenshot at least:

1. Idle in room  
2. Mid-walk  
3. Just after stop  

Use browser automation if useful; eyes on the actual pixels beat guessing from code.

---

## 11. Anti-patterns

| Anti-pattern | Symptom | Fix |
|--------------|---------|-----|
| Goofy hero in serious room | Tone clash | Regenerate direction, not just “bigger pixels” |
| Stretch X to fatten thin crop | Distorted coat | Re-key or re-gen; fix crop |
| Idle α=1 under walk | Double character | Single sprite or true crossfade |
| `currentTime = 0` every stop | Pop / glitch | Pause; blend; optional delayed reset |
| Constant max speed | Skating + hard plant | Accel/decel + playbackRate |
| Size only on green | Giant or tiny in room | Composite with `manH_scene` |
| New walk gen without idle ref | Outfit drift | Always condition on idle plate |
| Hitbox = full video frame | Clicks miss/fat | Crop; stable idle width |

---

## 12. Definition of done

Character is ready when:

1. `character.png` is cleanly keyed and cropped.  
2. `walk.mp4` matches idle identity and keys cleanly.  
3. `manH_scene` drives in-game height; composite with room looks correct.  
4. Live walk shows **one** figure, plausible gait, soft stop.  
5. Idle / mid-walk / stop screenshots all pass the checklist.  
6. Art direction matches the room (serious art deco in this game’s default).

---

## 13. Relation to `GEN_ROOM.md`

| Concern | Document |
|---------|----------|
| Floor line, prop %, door hitboxes, RGB slots | `GEN_ROOM.md` |
| Idle/walk art, chroma, motion, stop, double-draw | **This file** |

Room and character share **`floorY_scene`** and **`manH_scene`**. Change one → re-check the other.

---

## 14. Suggested constants (starting point)

Tune per game feel; these matched a calmer Rapture room:

```text
manH_scene / TARGET_H   ≈ 148 px (scene)
WALK_MAX_SPEED          ≈ 110–130 px/s
WALK_ACCEL              ≈ 500–600
WALK_DECEL              ≈ 750–900
WALK_PLAYBACK           ≈ 0.7–0.85
walkBlend threshold     ≥ 0.5 → show walk only (hard cut)
```

---

## Summary

**Serious idle on pure green → careful key/crop → walk from that plate → size to manH in the room → one sprite on screen → accel/decel and soft stop → screenshot proof.**

A great character is not only a good still. It’s **identity + scale + motion + stop**, verified in the room they inhabit.
