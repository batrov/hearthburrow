# Progress Report

> Current state against GDD goals — v0.2 with roulette, lighting, and shop economy changes.

## ✅ Roulette Wheel Mini-Game (June 2026)
- **Visual spinning wheel** — new `GamblePanel` with color-coded pie-slice segments, fixed golden pointer, physics-based deceleration (random friction 0.95–0.995) on SPACE/click
- **Biome-tiered rewards** — FOREST (stone/bronze/silver), CAVE (bronze/silver), ICE+ (silver/gold) — only items mineable at that depth
- **Reward sprites** — ore icons rendered at each segment's arc midpoint, rotating with the wheel
- **Cost scales with depth** — `5 + floor(depth/5)` stone; deducted on gamble, reward given on result close
- **Bingo SFX** — ascending C-E-G-C chime on win, `playError()` on loss

## ✅ Lantern & Lighting Overhaul (June 2026)
- **Circular light cutout** — `GeometryMask` with `invertAlpha=true` punches a smooth circle in the darkness overlay instead of 4 rectangle edges
- **Minimap respects lighting** — `visible[][]` grid tracks currently-lit tiles; unlit explored tiles render at 0.35 alpha on the minimap (dark floors only)
- **Reveal radius follows lantern** — `revealSurroundings()` computes grid radius from `getLanternRange(depth)` instead of hardcoded 8, using isometric conversion factor 45px/tile
- **Seed always displayed** — recap screen shows 8-char random seed fallback for unseeded runs

## ✅ Wandering Shop Economy (June 2026)
- **Gated behind Trading Post** — `placeShopTile()` now checks `gameState.restoredBuildings.has('trading_post')`
- **Homeland storage integration** — carrot count/check/deduction uses `gameState.inventory` (homeland storage) instead of expedition pack; `gameState.save()` after purchase
- **Visible carrot count** — shop description shows `"You have X carrots in storage. What catches your eye?"`

---

## ✅ Expedition Recap Scroll (June 2026)
- **Rescued/Discovered moved inside panel** — both sections now sit below Items Collected/Lost within the bordered recap panel instead of floating outside at y≥570
- **Scrollable content** — all content (items + rescued + discovered) lives in a masked `Container`; W/S or mouse wheel scrolls when content exceeds viewport height
- **Scrollbar indicator** — thin 4px bar on the right panel edge appears when `maxScroll > 0`, tracks scroll position
- **No more truncation** — `renderList` shows all items instead of capping at `maxItemsPerCol` with `...`
- **Hint updated** — now reads `[SPACE] Return to Homeland   [W/S] Scroll`

## ✅ Building Construction Animation (June 2026)
- **5-second construction** — restoring a building shows a centered progress bar panel (title, filling green bar, percentage text) instead of instantly popping in
- **Building shake** — the unrestored building tiles shake in place (3px oscillation, 60ms yoyo) during construction
- **Construction SFX** — `playConstruction()` fires 8 rhythmic square-wave clanks (250→180Hz, 0.6s apart) over the animation duration
- **Completion fanfare** — `playBuildComplete()` plays an ascending C-E-G-C arpeggio with sustaining triangle chord when the building finishes
- **Deferred restoration** — materials deducted and `drawHubBuildings()` called only after the 5s animation completes, then the "Restored!" float text appears

## ✅ Per-Biome Floor Sprites (June 2026)
- **Sprite-based terrain** — floor/corridor tiles no longer use procedural `Graphics.drawDiamondAt`; each biome has dedicated `floor_{BIOME}_a`, `floor_{BIOME}_b` (checker), and `corridor_{BIOME}` 160×80 PNG sprites scaled 0.5×
- **Placeholder generation** — 15 colored-diamond PNGs auto-generated via PIL; TextureGenerator creates matching fallbacks so the game works without any PNG on disk
- **`getBiomeKey(depth)` helper** — extracted shared biome→depth mapping, used by both wall and floor/corridor lookups
- **White selection highlight** — facing interactive tiles now shows a uniform `0xffffff` at 0.3 alpha diamond instead of per-type colored backgrounds
- **`getDepthPalette()` / `Palette` removed** — dead code after the sprite conversion

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
- Building shake animation not playing — `setData('bid', b.id)` used `HUB_BUILDINGS.id` (e.g. `'tavern'`) but `tryRestore` looked up by `buildingId` (e.g. `'housing'`). Fixed by using `b.buildingId || b.id` so filter matches.

## ✅ Item Sprite Polish (June 2026)
- **ExpeditionRecapScene** — item sprites now shown next to each item name in the collected/lost lists
- **TradePanel** — price/currency item now has its own sprite next to the cost text
- **Building restore costs** — Homeland building repair panel now shows item sprites per material + uses `itemDisplayName()` instead of raw IDs
- **Inventory qty badges** — small count overlay at bottom-right of each item sprite when `qty > 1`

## ✅ Isometric Tavern (June 2026)
- **TavernScene rewrite** — replaced top-down rendering with full 8×7 isometric grid using `terrain_diamond` floors + extruded walls/bar/tables, properly depth-sorted via painter's algorithm (`6 + (x+y)*0.01`)
- **Player movement** — WASD/arrows + click-to-move with BFS pathfinding + virtual analog stick, matching HomelandScene's movement system (150ms gate, facing sprites, step audio, collision against solids)
- **20 rescued NPCs** — placed on floor grid cells with painter's depth (`8 + (x+y)*0.01`), name labels, hover tooltips, and click-to-greet dialog overlays
- **Exit** — walk to door + SPACE, or ESC from anywhere, with fade transition back to HomelandScene

## ✅ Tavern Polish (June 2026)
- **Layout expansion** — tavern grid enlarged 8×7 → 10×8 with natural bar/tables/firepit layout, NPCs clustered at bar counters and table groups
- **Door interactable** — pulsing glow sprite on the door, `[SPACE] Exit` floating prompt when player is adjacent
- **NPC Photobook panel** — `[P]` key opens a full panel listing all rescued NPCs with variant number, name, and rescue depth; W/S scroll, ESC close
- **Rescue popup** — rescuing an NPC now shows a floating `Rescued: {name}!` notification via `createPopup`

## ✅ Dynamic Player Depth (June 2026)
- **Painter's-algorithm depth** — player and NPC depth now uses `6 + (x+y)*interval` instead of fixed values, correctly interleaving with walls so south/east walls partially occlude the player
- **Applied to all 3 scenes** — Expedition (`6 + (x+y)*0.001 + 0.0005`), Tavern (player `+0.005`, NPCs `+0.003`), Homeland (`6 + (x+y)*0.001 + 0.0005`)
- **Smooth tweening** — player depth animated alongside position in movement tweens for seamless transitions

## ✅ Sprite Config System (June 2026)
- **Centralized `sprite-offsets.json`** — all sprite positioning offsets, scale, and origin live in one JSON file instead of hardcoded across 3 scenes
- **Prefix-based wildcard matching** — `player_*` matches all player frames, `npc_*` matches all NPC variants, `ore_*` covers all ore types, etc.; longest pattern wins for specificity
- **Per-sprite config** — `originX/Y`, `offsetX/Y`, `scale` per texture key, applied in `makeImg()` and all player/NPC create/reposition sites
- **`player_bottom_left_0.png`** — resized from 37×48 → 32×48 to match other frames, removing need for per-frame config
- **`pixelArt: true`** — Phaser now uses nearest-neighbor filtering globally, eliminating blur on all scaled sprites (ores 1.5×, boss 0.25×, NPCs 0.5×, etc.)

## ✅ Expedition Polish (June 2026)
- **NPC variant sprites** — trapped villagers in the dungeon render their unique `npc_{variant}` texture instead of the generic `event_villager` sprite (works in `drawInteractiveTiles` and `updateFacingHighlight` preview)
- **Glow highlight** — facing highlight changed from flat white diamond to a 3-layer concentric diamond glow (2px solid inner, 6px at 0.25 alpha, 12px at 0.08 alpha)
- **Stair interaction overhaul**:
  - Stairs are walkable (removed from `tryMove` intercept)
  - Standing-on-stairs detection in `checkEventProximity` shows a full-screen popup (`[SPACE] Descend/Ascend / [ESC] Cancel`)
  - `floorEntry` flag suppresses prompt on initial floor spawn (sanctuary floor entry)
  - `stairDismissCell` prevents prompt re-trigger after ESC dismiss; auto-clears when player leaves the tile
  - Only triggers on intentional re-entry (walk off and back onto stairs)
- **Stair prompt style** — popup now has dark overlay background + rounded rect box + dynamic action button text

## ✅ Bug Fixes (June 2026)
- **Stairs_down broken flag** — mining sets `tile.broken = true`, then `spawnStairsOnBreak` changes type to `stairs_down` without resetting `broken`, so `!curTile.broken` guard rejects the tile. Fixed: `broken = false` in all three `stairs_down` placement paths (random spawn, puzzle, boss kill). Added `drawFloor()` after spawn for visual texture.
- **Facing-edge stairs detection** — `checkEventProximity` returned early when facing tile was out-of-bounds (player at map edge), skipping stairs-underfoot check. Fixed: stairs check moved before facing-tile bounds guard.
- **Facing highlight depth** — `previewTile.destroy()` moved to top of `updateFacingHighlight()` before early return guard, preventing stale Image at same depth from accumulating.
- **Guaranteed NPC per floor** — refactored `placeEventTiles()` to place one `trapped_villager` before random events; extracted `getFloorPositions()` and `canSpawnVillager()` helpers.

## ✅ NPC Personalities (June 2026)
- **20 unique personalities** — new `NPCPersonality` interface with name, archetype, rescueLine, greetings[], description. Replaces the old flat `NPC_NAMES` array.
- **Consistent voice** — each NPC uses their own archetype-specific dialog in all three contexts:
  - **Dungeon rescue**: unique `rescueLine` shown in the event panel (e.g. Mila: "I was cataloging glowing moss when the floor collapsed!")
  - **Tavern greeting**: 3 personality-consistent greetings rotated via `talkCount` (persisted per NPC)
  - **Photobook detail**: archetype label + description shown when selected
- **Save migration** — existing saves automatically get `talkCount: 0` backfilled on load

## ✅ Result Recap Sprites (June 2026)
- **Rescued NPCs** — recap screen now lists rescued villagers with their unique `npc_{variant}` sprite (scale 0.5) + name inline, wrapping per row
- **Discovered recipes** — each discovered recipe shows its item sprite + name, same inline pattern; recipes without known item icons (e.g. relics) fall back to text-only
- **Reverse lookup helper** — `itemIdFromDisplayName()` converts display names to item IDs for icon key resolution

## ✅ Sprite-Shaped Facing Highlight (June 2026)
- **Diamond glow → sprite outline** — replaced the 3-layer white diamond glow with offset-copy white outline that traces each interactive object's visible sprite shape (ores, NPCs, enemies, stairs, plates)
- **Offset-copy technique** — 24 white `setTintFill(0xffffff)` copies per facing tile (8 directions × 3 radii): 1px at 0.85 alpha, 2px at 0.40, 3px at 0.12; placed at depth 7.05, behind the preview sprite but above the dark backdrop
- **Persist fix** — outline array cleaned up at the top of `updateFacingHighlight()` before all early returns, preventing stale white sprites accumulating on floor tiles

## ✅ NPC Rescue → Tavern Reward System (June 2026)
- **Stamina bonus removed from rescue** — `gameState.maxStaminaBonus += 2` eliminated from `trapped_villager` handler; rescuing no longer gives direct stamina
- **Miner's Spirit one-time reward** — first talk with each rescued NPC in the tavern grants 1 `miners_spirit` item (stored in homeland inventory)
- **Miner's Potion recipe** — discovered on first NPC tavern talk; crafted in the homeland Crafting Station from 1 Miner's Spirit; consumed on craft to permanently add +5 max stamina
- **Recipe hint in panel** — undiscovered recipe shows `"Rescue a villager and talk to them at the Tavern"` in the crafting panel
- **Stacked obtain popups** — item and recipe notifications appear in the top-left corner matching the dungeon `queueObtainPopup` pattern (sprite + name + fade tween), stacked when both fire
- **SFX** — `playItemPickup()` chime for spirit acquisition; `playPuzzleComplete()` arpeggio for recipe discovery
- **20 spirits available** — each of the 20 unique NPCs can give one spirit on first tavern talk, enabling up to +100 max stamina from potion crafts

## ✅ Player Running Animation (June 2026)
- **6 walk frames per direction** — 12 pre-rendered PNGs (`player_bottom_left_0`…`5`, `player_top_right_0`…`5`) loaded from disk in BootScene, replacing 2 static procedural textures
- **Procedural fallback removed** — player section deleted from `TextureGenerator.ts` (frames now ship as real PNGs)
- **`animFrame`/`animTimer` fields** — added to all 3 scenes (Expedition, Tavern, Homeland); `update()` advances frame every 60ms while `isMoving`, resets to frame 0 on idle
- **`updatePlayerSprite()`** — constructs texture key as `${baseKey}_${this.animFrame}` instead of the static key
- **Generator script** — `scripts/generate_player_frames.cjs` standalone Node script (no deps) that can re-render frames via raw PNG encoder