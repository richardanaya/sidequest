# Path of the Blade — Vision (3 rooms)

**Title:** Path of the Blade  
**Tone:** Quiet, respectful, Japanese courtyard / shrine — easy point-and-click  
**Scope:** One character · three rooms · short linear puzzle (beginner-friendly)

## Pitch

A young samurai leaves the dojo. Carry a blossom to the shrine, receive the master’s blade, open the garden gate.

## Rooms

1. **bamboo_courtyard** — training yard, cherry tree, letter on a stone  
2. **shrine_chamber** — small shrine with altar  
3. **torii_gate** — wooden gate to the world beyond  

## Easy puzzle chain

1. Courtyard: **Take letter** (hint) · **Take blossom** from the tree · walk **east**  
2. Shrine: **Use blossom on altar** → receive **katana** · walk **east**  
3. Gate: **Use katana on gate** (or Use gate while carrying it) → **win**

No combos to invent. No reverse-order softlocks. Letter is optional flavor.

## Items (content-driven)

Catalog: `items.json` + green-keyed icons under `items/`.

| id | Name | Icon | Source | Sink |
|----|------|------|--------|------|
| letter | folded letter | `items/letter.png` | stone / letter prop | optional flavor |
| blossom | cherry blossom | `items/blossom.png` | tree / petals | altar |
| katana | master’s blade | `items/katana.png` | altar after offering | gate |

Engine does **not** hard-code these — only `game_samurai/items.json` defines them.

## Flags

| Flag | When |
|------|------|
| tookLetter | take letter |
| hasBlossom / item | take blossom |
| offeredBlossom | use blossom on altar |
| hasBlade / item | received katana |
| gateOpen | use katana on gate |
| won | exit |

## Design rules

- East exits free once prior step done (courtyard always open east; shrine always open east after enter; gate needs blade).  
- Actually courtyard and shrine east always open for easy exploration; win only at gate with blade.  
- Copy short and clear.
