# SEALED — Complete Vision (3 rooms)

**Working title:** *Sealed*  
**Form:** Short classic point-and-click (≈20–40 minutes first play)  
**Scope:** One playable character · three rooms · one linear-but-curious puzzle chain  
**Tone:** Sober art-deco undersea city. Brass, teal, salt, and restraint. Not cartoon. Not horror slapstick. Quiet dread + competence.

This document is the **content bible** for `game_data/`. The engine already supports multi-room travel, scripts, inventory, flags, score, and exits. Vision here is *what to build*, not how the engine works (see repo `CONTENT.md`, `GEN_ROOM.md`, `GEN_CHARACTER.md`).

---

## 1. One-sentence pitch

You are sealed inside a failed maintenance sector of an undersea city. Escape through three connected spaces—**hall → pumps → dock**—by reading the room, combining a few brass objects, and restoring just enough power for one last bathysphere ride.

---

## 2. What we already have (anchor)

| Asset | Status | Role in the full game |
|-------|--------|------------------------|
| Title: *Sealed* + splash `ui/title.jpg` | Done | Landing / brand |
| Character: `protagonist` (teal coat, walk video) | Done | Sole PC |
| Room 1: `maintenance_hall` | Playable | Act I — open the airlock |
| Puzzle: portrait → code → safe → note → plant → key → door | Done | Becomes **gateway**, not win |
| Items: coin, note, key (+ stubs in catalog) | Partial | Coin + key carried into later rooms |
| Cat, desk, safe, plant, portrait | Done | Hall cast; cat can “migrate” later if desired |

**Critical rewrite of current win condition:**  
Opening the airlock must **not** call `win`. It sets `escaped` / `airlockOpen`, enables the exit, and transitions into room 2. The true win is **boarding the bathysphere** in room 3.

---

## 3. Setting & story

### World (light, diegetic)

An undersea art-deco city—think private clubs, brass fan motifs, gilt plaques, portholes onto black water. We never name a franchise city. Plaques, notes, and architecture carry the place.

**Sector 7B — Maintenance** has been under emergency seal. Someone left in a hurry (your entry line already says so). Systems are half-dead. A single citizen (you) is left to improvise a way to the **emergency bathysphere dock**.

### Protagonist

- Same pack: `characters/protagonist`
- Display name can stay “Protagonist” or become **“R.”** (the note’s signature: *KEY IN THE PLANTER — —R.*)
- No backstory dump. Identity emerges from what you touch and take.

### Through-line

1. **Hall:** Understand you are trapped; find the airlock key.  
2. **Pumps:** Sector power is down; restore it with a fuse and a wrench.  
3. **Dock:** Clearance ticket + powered hatch → bathysphere → surface light → **win**.

Mood: competence under pressure. The city is beautiful and indifferent. You leave with dirt on your hands and a brass coin you may or may not have spent.

---

## 4. The three rooms

### Room map

```text
  [1] maintenance_hall  ──east airlock──►  [2] pump_gallery  ──east hatch──►  [3] bathysphere_dock
         (start)              key              powerOn              ticket
              ◄── west ──                      ◄── west ──
```

- Travel only when the linking door/hatch is unlocked (flags).  
- West returns always allowed after first entry (no soft-lock).  
- No fourth room. No map maze.

---

### Room 1 — `maintenance_hall` (exists)

**Camera:** Fixed side hall, porthole with whale silhouette, Maintenance Access door (airlock).  
**Purpose:** Tutorial density + first inventory loop. Teach look / use / take / item-on-object.

| Hotspot | Role |
|---------|------|
| **portrait** | Clear plaque → code **1-9-5-9** (`knowCode`) |
| **safe** | Combo → open → **note** (+ optional: first score) |
| **plant** | After note → dig → **brass key** |
| **desk** | **Brass coin** (needed in room 2) |
| **cat** | Living compass: look/talk lines that nudge next goal by flag |
| **door** (airlock) | Locked until key; use key → open → **exit east** (not win) |

**Entry (keep / lightly revise):**  
*“The airlock is sealed. Someone left this room in a hurry.”*

**Exit east** (`exits.east`):  
- `when: { flag: "airlockOpen" }` (or `escaped`)  
- `room: "pump_gallery"`, `spawn: "from_west"`  
- `blockedSay: "Locked."` while sealed  

**Script change from current build:**  
- `win` on door → remove.  
- On success: `setFlag: "airlockOpen"`, remove key (or keep key on ring—prefer **consume key** so inventory stays tight), say *“The key turns. The airlock sighs open.”*, optional short cutscene, then player walks / clicks east.

**Objectives (progressive):**  
find a way out → open the safe → dig the planter → unlock the airlock → **enter the pumps**

---

### Room 2 — `pump_gallery` (new)

**Name:** Pump Gallery  
**Feel:** Same city language, more industrial: ribbed brass pipes, pressure gauges, a fat main valve, a wall fuse cabinet, a glass “authorized spares” case, a service hatch to the dock. Floor wet at the edges. Sconces dim until power returns.

**Purpose:** Second-layer inventory + *use tool on world* + *pay/coin* + multi-step power restore. Still one screen.

| Hotspot | Kind | Role |
|---------|------|------|
| **hatch_west** | wall / noSprite | Return to maintenance hall (always once arrived) |
| **hatch_east** | wall / noSprite | To dock — blocked until `powerOn` |
| **valve** | floor/wall | Stuck; needs **wrench** |
| **toolbox** | floor | Open/take → **wrench** |
| **fuse_box** | wall | Dead until **fuse** inserted |
| **spare_case** | wall | Glass case with fuse; needs **coin** (honor payment / token slot) |
| **gauge** | wall | Look-only / flavor that updates after valve or power |
| **speaker** | wall | Optional: crackling PA flavor lines by flag |
| **cat** *(optional)* | floor | If moved here after airlock: same hint AI, new lines |

**Puzzle chain (room 2):**

1. **Look** around: fuse box dead; east hatch dead; spare case has a fuse behind glass with a coin slot.  
2. **Toolbox** → take **wrench**.  
3. **Coin** (from desk) on **spare_case** → pay token → **fuse**.  
4. **Wrench** on **valve** → valve turns (`valveOpen`) — pressure equalizes; optional score; gauge text changes.  
   - *Design note:* valve is required so power restore feels mechanical, not just “put fuse in box.” If valve is closed, fuse box may spark and refuse (`when: not valveOpen`).  
5. **Fuse** on **fuse_box** → `powerOn` — lights warm up (prop state / effect), east hatch unseals.  
6. Exit **east** to `bathysphere_dock`.

**Entry text:**  
*“The pump gallery still hums, barely. Somewhere ahead, a dock.”*

**Items gained here:** wrench, fuse (coin spent).  
**Items that may remain:** note (flavor), empty hands after fuse used.

**Objectives:** restore power · open the dock hatch

---

### Room 3 — `bathysphere_dock` (new)

**Name:** Bathysphere Dock  
**Feel:** Small embarkation lobby. One brass control pedestal, a ticket / clearance reader, a round bathysphere hatch with porthole glow, life-ring and riveted bulkhead. Dark water beyond. This is the **resolution room**—fewer fiddly props, stronger destination energy.

| Hotspot | Role |
|---------|------|
| **hatch_west** | Back to pump gallery |
| **pedestal** | Control console; look reveals missing clearance |
| **scanner** | Needs **ticket** (bathysphere stub) |
| **ticket_slot** / tray | Where ticket is found once power is on *or* ticket sits on pedestal after lights |
| **hatch** (bathysphere) | Final exit; locked until `clearanceGranted` |
| **porthole** | Look: black water, distant city lights when free |
| **life_ring** | Flavor; refuse take with dry line |

**Where the ticket comes from (pick one; recommended A):**

| Option | Design |
|--------|--------|
| **A (recommended)** | Ticket is **on the pedestal** in room 3 but only **visible/takeable after `powerOn`** (you already fixed power in room 2 before arrival). Simple: no backtrack. |
| B | Ticket hidden in room 2 toolbox *after* power—requires noticing a second look. |
| C | Ticket was in room 1 safe with the note—extend safe loot. Slightly piles room 1. |

**Recommended flow (A):**

1. Enter dock (only if `powerOn`).  
2. **Look pedestal** → “A bathysphere stub rests under the glass. The reader waits.”  
3. **Take ticket** from pedestal / tray.  
4. **Use ticket on scanner** → `clearanceGranted`, ticket consumed or stamped.  
5. **Use hatch** (or Walk to + Use) → short lines → **win**.

**Win line (example):**  
*“The hatch dogs open. The sphere takes you. Above the dark, a line of light.”*

**Optional score cap:** Award points once each for: first code, safe, key, airlock, wrench, fuse pay, valve, power, ticket, escape.

---

## 5. Item bible (ship set)

Only items that matter. Stubs in `js/items.js` can stay for debug; **ship inventory** is small.

| id | Name | Source | Sink |
|----|------|--------|------|
| `coin` | brass coin | Desk (room 1) | Spare case (room 2) |
| `note` | crumpled note | Safe (room 1) | Optional use-with plant (already); else keep as memento |
| `key` | brass key | Plant (room 1) | Airlock (consumed) |
| `wrench` | pipe wrench | Toolbox (room 2) | Valve (may keep after use) |
| `fuse` | spare fuse | Spare case after coin (room 2) | Fuse box (consumed) |
| `ticket` | bathysphere stub | Pedestal tray (room 3) | Scanner (consumed) |

No red herrings that require a guide. Optional **false uses** with good refusal lines (“That doesn’t fit the dial.”).

---

## 6. Flag bible (global / room)

Prefer **global flags** on `GameState` for cross-room gates; room-local for pure local props.

| Flag | Set when | Used for |
|------|----------|----------|
| `knowCode` | Clear portrait | Safe dialogue |
| `safeOpen` / `readNote` | Open safe | Plant dig gate |
| `hasKey` | Dig plant | (inventory also tracks) |
| `airlockOpen` | Unlock airlock | Exit hall → pumps; was `escaped` |
| `haveWrench` | Take wrench | Optional; inventory enough |
| `valveOpen` | Wrench on valve | Fuse box accepts fuse |
| `powerOn` | Fuse in box | Exit pumps → dock; dock lights / ticket visible |
| `clearanceGranted` | Ticket on scanner | Bathysphere hatch |
| `escaped` / `won` | Board sphere | True ending |

Objectives in each `script.json` select first matching `when` branch (same pattern as hall).

---

## 7. Puzzle graph (dependency order)

```text
portrait.use
    → knowCode
safe.use (needs knowCode)
    → note, readNote, safeOpen
plant.take/use (needs readNote)
    → key
desk.take
    → coin
door + key
    → airlockOpen  ──travel──►  pump_gallery

toolbox.take
    → wrench
spare_case + coin
    → fuse
valve + wrench
    → valveOpen
fuse_box + fuse (needs valveOpen)
    → powerOn  ──travel──►  bathysphere_dock

pedestal/tray.take (needs powerOn — always true on entry if gate is correct)
    → ticket
scanner + ticket
    → clearanceGranted
hatch.use
    → WIN
```

**Soft skill ceiling:** Every step is cued by look text or the cat/PA. No pixel-hunt under 8×8.

---

## 8. Character & voice

| Who | On screen? | Function |
|-----|------------|----------|
| **You (R.)** | Yes | Silent PC; verbs speak for you |
| **Cat** | Hall (optional pumps) | Hint fountain; never a puzzle gate |
| **PA / speaker** | Voice only in pumps/dock | Flavor + one nudge if stuck |
| **No human NPC required for v1** | — | Conversations system reserved for later |

Dialogue register: short, dry, specific. Prefer *“The dial yields.”* over *“You cleverly solve the puzzle!”*

---

## 9. Art direction (all three rooms)

Shared language already established in hall:

- Teal plaster, cracked paint, **brass** fans / Greek-key moldings  
- Warm sconce pools, cool water light from portholes  
- Single fixed camera per room, 16:9 plate → scene crop  
- Props keyed, scaled to **`manH_scene` (~148)**  
- Serious silhouette PC; no goofy squash

| Room | Distinct beat |
|------|----------------|
| Hall | Domestic maintenance: desk, plant, portrait, cat |
| Pumps | Pipes, valve, gauges, fuse hardware, wet floor edge |
| Dock | Hatch, pedestal, ticket reader, “departure” negative space |

Title splash already matches hall language—keep `ui/title.jpg` as brand unless a dock porthole composition is authored later.

---

## 10. Audio (optional pass)

| Channel | Hall | Pumps | Dock |
|---------|------|-------|------|
| Ambience | Soft hum + distant water | Louder pumps, valve hiss after open | Hollow dock, sphere metal tick |
| Music | Sparse, low strings / brass pad | Slightly more tension | Resolve on win |
| SFX | Safe click, dig, key turn | Coin drop, wrench, fuse snap, power-up | Ticket stamp, hatch dogs, win swell |

Can ship silent; wire paths in `room.json` → `audio` when assets exist.

---

## 11. UI / meta

- Title screen branding from `content.json` (already).  
- Score: optional awards at each milestone (max ~100).  
- Death: **none required** for this short game (no die scripts).  
- Save/load: already in engine; autosave on room enter.  
- Map menu: three rooms; only visited unlocked.

---

## 12. Content pack plan (`game_data/`)

```text
game_data/
  content.json                 # register 3 rooms + branding
  VISION.md                    # this file
  ui/title.jpg                 # done
  characters/protagonist/      # done
  rooms/
    maintenance_hall/          # done → revise script + exits
    pump_gallery/              # NEW pack
      room.json
      script.json
      backdrop.jpg
      props/…
    bathysphere_dock/          # NEW pack
      room.json
      script.json
      backdrop.jpg
      props/…
```

### `content.json` (target)

- `defaults.room`: `maintenance_hall`  
- `rooms.maintenance_hall`, `rooms.pump_gallery`, `rooms.bathysphere_dock`  
- paths relative to `game_data/`

### Engine features used (no new engine required for v1)

| Feature | Use |
|---------|-----|
| Pack load + scripts | All rooms |
| Flags / inventory / useWith | Full chain |
| `exits` + edge / door travel | Hall↔pumps↔dock |
| Score awards | Optional polish |
| Prop visual states | Safe open, valve turned, power lights, hatch open |
| Cutscene | Optional 2–3 step win or airlock open |
| Conversations / spells / economy systems | **Out of scope** for this short game (coin is inventory, not wallet) |

---

## 13. Script contract changes (room 1)

Minimal edits so the vision is playable end-to-end later:

1. Door success: **`setFlag: "airlockOpen"`** (keep or alias `escaped`), **remove `win`**.  
2. Say: airlock opens; objective becomes enter the pumps.  
3. Add `exits.east` → `pump_gallery`.  
4. Optional: `onEnter` if returning from pumps.  
5. Cat talk tree: last branch points east when airlock open.

---

## 14. Player fantasy & win feeling

- **Fantasy:** You are capable. The sector is a locked box; you open it with attention, not combat.  
- **Pacing:** Room 1 teaches. Room 2 is the craft puzzle. Room 3 is the payoff (short).  
- **Ending:** One strong image (sphere into light), one line, score, return to title. No sequel bait dump.

---

## 15. Non-goals (keep the game small)

- No combat, no timed death (unless later “leak” timer as hard mode).  
- No branching endings for v1.  
- No second playable character.  
- No more than **three** rooms.  
- No pixel-hunt inventory combinations of 3+ items.  
- No full voice acting requirement.  
- No open world, no street hub.

---

## 16. Implementation order (content)

1. **Revise hall script** — airlock opens sector; exits east; no win.  
2. **Author `pump_gallery`** — plate + 5–7 props + script chain (wrench/coin/fuse/valve/power).  
3. **Author `bathysphere_dock`** — plate + pedestal/scanner/hatch + ticket + win.  
4. **Register rooms** in `content.json`; play full path cold.  
5. **Polish** — score, objectives, cat lines, prop states, ambience, win cutscene.  
6. **QA** — soft-lock pass, refuse lines, save/load mid-chain, edge exits.

---

## 17. Success criteria

The game is “done” when a new player can:

1. Boot to title *Sealed*, start a new game in the hall.  
2. Solve hall without external hints (cat optional).  
3. Walk east into pumps, restore power, reach dock.  
4. Board the bathysphere and see a clear win.  
5. Total unique interactive props across all rooms ≈ **15–18**, not 40.

---

## 18. One-page summary

| | |
|--|--|
| **Title** | Sealed |
| **Rooms** | Maintenance Hall → Pump Gallery → Bathysphere Dock |
| **PC** | Protagonist / R. (existing pack) |
| **Core loop** | Look → take/use → gate opens → next room |
| **Key items** | coin, note, key, wrench, fuse, ticket |
| **True win** | Clearance + bathysphere hatch |
| **False win (remove)** | Opening the hall airlock alone |
| **Aesthetic** | Art-deco undersea, brass & teal, sober |
| **Scope** | Small complete game, not a demo fragment |

---

*This vision is the north star for `game_data/`. When content and vision disagree later, update this file in the same change so packs stay intentional.*
