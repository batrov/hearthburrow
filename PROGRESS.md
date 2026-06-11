# Progress Report

> Current state against GDD goals — feature-complete for MVP. Next phase: testing, balancing, and asset integration.

---

## ✅ Mobile Controls
- **Click-to-move** with BFS pathfinding (expedition + homeland)
- **Virtual analog stick** — tap-anywhere joystick, 4-cardinal, continuous hold

## ✅ Bug Fixes
- **Enemy sprite rendering** — `event_boss` no longer miscaught by `startsWith('event_')` guard
- **Puzzle stair spawning** — generation pipeline reordered, fallback stair position, `stairsSpawned` flag set
- **Biome cycling** — `getWallTextureKey` now uses `Math.floor(depth / 5) % 5` so biomes rotate every 5 levels instead of every level
- **Elevator redirect** — `generateFloor(0)` → `generateFloor(startFloor)`, HUD depth text uses actual depth instead of hardcoded `'Floor: 0'`
- **Ore distribution** — High-tier ores now distributed evenly across all rooms with per-room caps and randomized remainder allocation, instead of all spawning in the first room
- **Darkness overlay** — lantern no longer draws darkness overlay on non-dark floors (only `depth % 5 === 3`)
- **Storage/Crafting costs** — buildings now have proper `buildingId` so they require resource costs to restore instead of being always unlocked
- **Building restore panel centering** — `restoreContent` container was missing `setScrollFactor(0)`, causing panel text to shift off-center when camera scrolled

## ✅ UI Polish
- **Crafting panel**: 4-color recipe lines (crafted/craftable state) + persisted `craftedItems`
- **Inventory panel**: Description bar for selected item
- **Item sprites**: 22 procedurally generated item sprites (equipment, consumables, relics, food) shown left of item names in Inventory, Crafting, and Trade panels. Works via `itemIconKey()` helper mapping `itemId → texture key`.


## ✅ Touch Screen Improvements
- **8-directional analog** — quadrant-based snapping (top-right→UP, top-left→LEFT, bottom-right→RIGHT, bottom-left→DOWN)
- **Click-to-Face** — clicking an interactive object adjusts player facing direction
- **Click-to-Interact** — clicking the object the player is already facing performs the action (same as SPACE)
- **Clickable UIs** — mouse/touch support for rows in Inventory, Crafting, Trade, and Research panels
- **Screen dimension adjustment** — uses phone dimension (horizontal)
- **Asset replacement** — all interactive objects (ores, enemies, events, stairs, plate, blocked, walls) now use pre-baked textures from TextureGenerator instead of real-time Graphics shapes. Durability overlays use `overlay_damage`/`overlay_crack` at sub-depth increments. Facing preview uses Image at depth 7.1. Removed 442 lines of shape-drawing code.

## ✅ Mining Polish
- **Camera shake** — on every hit (50ms/0.006) and on break (120ms/0.015)
- **Circle-based particles** — `this.add.circle()` primitives for all hit/break effects (no texture dependency). Hit: 8-particle radial burst + central flash. Break: 4 large core chunks + 10 small debris + expanding shockwave ring
- **Ore disintegration** — ore Image scales 2×, fades, and rotates on break before floor redraw
- **Bomb explosion** — 200ms/0.02 shake, orange expansion ring, white flash, 8 debris particles
- **Damage tint** — ore sprite darkens via `setTint()` immediately on each hit (0xaaaaaa at ≤66%, 0x777777 at ≤33%). Uses `oreImageMap` for O(1) lookup. Preview tile tint synced.
- **Ore scale** — ore sprites scaled 1.5× for better visibility

## ✅ Code Quality — Refactoring (June 2026)
- **DEPTH constants** — all 50+ `setDepth(NN)` magic numbers replaced with `DEPTH.*` constants in a single typed object
- **isBlocked() helper** — 3 verbatim copies of the "full blocked" megacheck consolidated to one method
- **getDamageTint() helper** — inline tint logic replaced with shared helper, used in `drawInteractiveTiles` and `updateFacingHighlight`
- **createPopup() helper** — `showRecipeDiscovery()` and `showConsumableFeedback()` consolidated from ~30 lines → 2 lines each
- **buildEventConfig** — 210-line `switch` statement replaced with `Record<string, () => EventConfig>` data table (~170 lines, -40)
- **BasePanel class** — created `BasePanel` base class hiding `container`/`depth`/`_visible`/`isVisible()`/`toggle()`/`destroy()` boilerplate. All 7 UI panels refactored to extend it (~63 net lines saved across 7 panels)
- **Total**: ~137 lines removed from codebase, improving AI-agent scanability

## ✅ Boss Overhaul
- **3×3 grid** — boss now occupies 3×3 tiles (center = `event_boss`, 8 surrounding = `boss_body`), all blocking movement/pathfinding
- **120×120 texture** — boss rendered as a single large pre-baked texture, no body tile sprites
- **Click/SPACE interaction** — all 9 tiles trigger combat via `findBossCenter()` helper
- **3×3 defeat cleanup** — all 9 tiles cleared on boss defeat, `stairs_down` placed at center
- **Minimap** — all 9 tiles show as red dots
- **Preview** — facing any body tile shows boss preview at center position

## ✅ Seed-Based Generation (June 2026)
- **Seeded RNG** — `DungeonGenerator` now uses `Phaser.Math.RandomDataGenerator` with `setSeed(seed)` replacing all 26 `Math.random()` call sites
- **Seed input UI** — new "Seed" tab (tab 9) in the gate panel; type characters directly to set seed, Backspace to delete
- **Per-floor determinism** — seed derived as `runSeed + '_depth_' + depth` so same seed + same depth = identical floor layout
- **Persistence** — seed stored in `gameState.currentRunSeed`, saved/loaded with the rest of the save data
- **Backward compatible** — empty seed = unseeded RNG = existing random behavior


Resolved Bugs:
- Pressure plate puzzle stairs not spawning — `completePuzzle` only searched for `type === 'floor'`, but stepped-on plates are `type === 'pressure_plate'`. Fixed by including `pressure_plate` in the candidate search. Also updated `stairsDownX/Y` after placement for correct ascending landing.

## ✅ Item Sprite Polish (June 2026)
- **ExpeditionRecapScene** — item sprites now shown next to each item name in the collected/lost lists
- **TradePanel** — price/currency item now has its own sprite next to the cost text
- **Building restore costs** — Homeland building repair panel now shows item sprites per material + uses `itemDisplayName()` instead of raw IDs
- **Inventory qty badges** — small count overlay at bottom-right of each item sprite when `qty > 1`