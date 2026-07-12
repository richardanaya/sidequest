# The Crown & Cup — Vision

**Genre:** 1990s Sierra / King's Quest-style point-and-click  
**Setting:** A working medieval tavern on the day the King dines  
**Tone:** Warm fairy-tale adventure — helpful, slightly comic, never cruel  
**Player:** The tavernkeep (apron, practical clothes) — one shift to save the night

## Promise

Three rooms. Several items. Every goal line and object text points to the next sensible step: **get the royal ale, bake the golden loaf, set the King's table.**

## Art direction

- **VGA pixel adventure** — chunky pixels, limited palette, hard edges  
- King's Quest V/VI era stage rooms (fixed camera, walkable floor strip)  
- Warm wood, torchlight, stone, thatch — no modern CGI gloss  
- Backdrops are **empty architecture only** (no pickups, food, or NPCs baked in)  
- Props/items on pure green; same VGA crunch as rooms  

### Walk path rule (engine constraint)

The engine only walks **horizontally** on a floor band. Every room MUST keep the **lower third clear** left→right. Furniture, wells, tables, and props sit on the **back wall / sides only** — never mid-floor blocking the path.

## Rooms (empty plates)

| Room | Architecture only |
|------|-------------------|
| **Common Room** | Bar shell, empty tables, hearth/oven niche, doors to cellar & courtyard |
| **Cellar** | Stone vault, empty cask racks, shelves without goods, stairs up |
| **Courtyard** | Cobbles, well, stable wall, gate, empty market crate area |

## Puzzle spine (clear order)

1. **Look at** the royal notice by the bar → King dines tonight; needs **royal ale** and a **golden loaf**.
2. **Take** the **cellar key** from the mantel (or peg by the hearth).
3. **Use key** on the **cellar door** → enter cellar.
4. **Take** the **empty tankard** from the bar (if not already).
5. In cellar: **Use tankard** with the **crowned cask** → **royal ale** (filled tankard).
6. **Take flour sack** from the courtyard (or cellar shelf if preferred — courtyard reads clearer as "outside stores").
7. **Use flour** with the **hearth oven** in the common room → **golden loaf**.
8. **Use royal ale** and **golden loaf** with the **King's table** (set both) → **win**.

Wrong-order dialogue always redirects ("The notice said ale *and* bread." / "The cellar is still locked.").

## Items

| id | Name | How |
|----|------|-----|
| `notice` | royal notice | Take/read from wall (optional inventory) |
| `cellar_key` | iron cellar key | Mantel / peg |
| `tankard` | empty tankard | Bar |
| `royal_ale` | tankard of royal ale | Tankard + crowned cask |
| `flour` | sack of flour | Courtyard stores |
| `loaf` | golden loaf | Flour + oven |

## Score (Sierra-ish)

- Read notice: 5 · Key: 5 · Open cellar: 10 · Fill ale: 15 · Flour: 5 · Bake loaf: 15 · Set table (win): 25 · **~80 max**
