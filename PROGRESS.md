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
- **Click-to-move** with BFS pathfinding (expedition + homeland) — clicking interactive objects (stair, ore, enemy, event) now pathfinds to the nearest walkable tile
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
- **Text resolution** — added `createText()` wrapper that applies LINEAR GPU filtering per-text, overriding `pixelArt: true`'s NEAREST default; patched `Text.prototype.updateText` to re-apply LINEAR after every `setText()` call, since `canvasToTexture` resets the filter on each text update. Uses `resolution: 4` for crisp rendering.


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

## ✅ Player Movement Smoothing (July 2026)
- **Removed timer throttling** — `moveTimer`/`moveDelay` (150ms) eliminated in all 3 scenes; input checked every frame with `isMoving` as the only gate — eliminates 50ms gap between tiles
- **Smooth easing** — all movement tweens changed from `Linear` to `Quad.easeOut` for smooth deceleration at each tile stop
- **Click-to-move fix** — added `!this.isMoving` guard before `movePath.shift()` to prevent path being drained mid-tween

## ✅ Separate Ore Drop Sprites (July 2026)
- **Node vs drop separation** — in-ground ore nodes now use `{resource}_node` textures (renamed existing PNGs); dropped items use `{resource}_ore` textures (new small nugget/crystal PNGs, 24×24)
- **6 new nugget sprites** — `stone_ore`, `bronze_ore`, `silver_ore`, `gold_ore`, `crystal_ore`, `monster_drop_ore` — small colored circle shapes with highlight
- **Fallback textures updated** — TextureGenerator generates both node (40×40 diamond) and drop (24×24 circle-nugget) textures
- **SpriteConfig updated** — node textures keep offsetY:-5/scale:1.2; drop textures use centered scale:0.6
- **Research panel icons** — mining research nodes now show the ore drop sprite instead of the node sprite
- **Parabolic arc flight** — ore drop flight changed from linear tween to parametric parabola: `y = startY - arcHeight * 4 * t * (1 - t) + (targetY - startY) * t` for natural arc trajectory; pop-to-arc delay removed for continuous animation flow

## ✅ Code Quality — Refactoring (June 2026)
- **DEPTH constants** — all 50+ `setDepth(NN)` magic numbers replaced with `DEPTH.*` constants in a single typed object
- **isBlocked() helper** — 3 verbatim copies of the "full blocked" megacheck consolidated to one method
- **getDamageTint() helper** — inline tint logic replaced with shared helper, used in `drawInteractiveTiles` and `updateFacingHighlight`
- **createPopup() helper** — `showRecipeDiscovery()` and `showConsumableFeedback()` consolidated from ~30 lines → 2 lines each
- **buildEventConfig** — 210-line `switch` statement replaced with `Record<string, () => EventConfig>` data table (~170 lines, -40)
- **BasePanel class** — created `BasePanel` base class hiding `container`/`depth`/`_visible`/`isVisible()`/`toggle()`/`destroy()` boilerplate. All 7 UI panels refactored to extend it (~63 net lines saved across 7 panels)
- **Total**: ~137 lines removed from codebase, improving AI-agent scanability

## ✅ Biome Boss Overhaul (June 2026)
- **5 biome-specific bosses** — FOREST (standard), CAVE (shrinking hit zone), ICE (accelerating marker), LAVA (fake decoy zones), RUINS (inverted hit/miss logic)
- **Per-biome drops** — `forest_gem`, `cave_heart`, `ice_shard`, `magma_core`, `void_essence` added to items.json + texture generators + GameState
- **Biome-key routing** — boss tile `.resource` stores biome name; `BOSS_CONFIGS` table keyed by biome stores hp, speed, zone width, damage mult, mechanic, and loot
- **Mechanic implementations** in CombatPanel: `shrink` (zone ×0.9/hit), `accelerate` (speed ×0.88/hit), `fake_zone` (decoy zones every 2s), `invert` (toggle every 2.5s)
- **Clean build** — `npm run build` zero errors

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
- Player walk animation stuck on frame 0↔1 — was `(animFrame+1)%6` (included frame 0 in cycle) with instant frame-0 reset on each step end. Fixed: `(animFrame%5)+1` cycles frames 1-5 while moving; 250ms linger before idle reset for Pokemon-style pose hold.
- **ExpeditionRecapScene empty lists** — `enableFilters().addMask()` on a `Phaser.Container` prevents child objects from rendering. Fixed by adding items/assets directly to the scene via `this.add.text()/image()` instead of the masked container. See Critical Warnings in AGENTS.md.
- **ExpeditionRecapScene "Rescued" label invisible** — `contentContainer` was created with `setVisible(false)`, so the "Rescued" label disappeared when reparented into it at line 89. Fixed by removing the reparent line — label stays on scene display list from `this.add.text()`.

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
- **Clickable stair buttons** — [Proceed]/[Cancel] buttons use scene-level pointerdown handler (same BasePanel pattern) to bypass Phaser 4 scrollFactor input bug

## ✅ Bug Fixes (June 2026)
- **Bridge tiles show path instead of bridge** — bridge tiles at (12,6)(13,6)(12,7)(13,7) were in `PATH_COORDS` so they rendered `terrain_path` with a separate `decoration_bridge` overlay sprite. Fixed: added `BRIDGE_COORDS` set, tiles now render `terrain_bridge` at depth 4 (terrain layer) instead of `terrain_path`, and the overlay sprite was removed entirely.
- **Stairs_down broken flag** — mining sets `tile.broken = true`, then `spawnStairsOnBreak` changes type to `stairs_down` without resetting `broken`, so `!curTile.broken` guard rejects the tile. Fixed: `broken = false` in all three `stairs_down` placement paths (random spawn, puzzle, boss kill). Added `drawFloor()` after spawn for visual texture.
- **Facing-edge stairs detection** — `checkEventProximity` returned early when facing tile was out-of-bounds (player at map edge), skipping stairs-underfoot check. Fixed: stairs check moved before facing-tile bounds guard.
- **Facing highlight depth** — `previewTile.destroy()` moved to top of `updateFacingHighlight()` before early return guard, preventing stale Image at same depth from accumulating.
- **Guaranteed NPC per floor** — refactored `placeEventTiles()` to place one `trapped_villager` before random events; extracted `getFloorPositions()` and `canSpawnVillager()` helpers.
- **CAVE boss shrink balance** — shrink rate 0.9→0.95 (10%→5% per hit), floor 20→35px, so the zone stays hittable through the full fight instead of becoming a narrow sliver by the midpoint

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

## ✅ Item Pickup Animation (June 2026)
- **Fly-to-inventory** — mined item sprites now fly to the bottom-left inventory bag icon `(48, camH - 44)` instead of the top-left corner `(100, 50)`, matching where items are stored

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

---

## ✅ Phaser 4.1.0 Upgrade (June 2026)
- **Version bump** — `phaser` upgraded from `^3.80.1` to `^4.1.0` ("Salusa")
- **GeometryMask → Filter mask** — darkness overlay (ExpeditionScene) and content clipping (ExpeditionRecapScene) migrated from Canvas-only `GeometryMask` to WebGL-native `addMask()` via `enableFilters()`
- **setTintFill → setTint + setTintMode** — replaced the removed `setTintFill()` with `setTint().setTintMode(FILL)`
- **Clean build** — `tsc` + `vite build` pass with zero errors

## ✅ Mobile Build (June 2026)
- **PWA foundation** — VitePWA plugin, manifest (standalone/portrait), workbox caching, 192+512 icons
- **Mobile HTML tags** — theme-color, viewport-fit=cover, touch-action: manipulation, safe-area padding, canvas touch-action: none
- **Multi-touch config** — `input.activePointers: 2`, `input.touch: { capture: true }`
- **On-screen Action Buttons** — ⚡Potion/📜Scroll/💣Bomb/❌Exit + ⚔️Fight button, scrollFactor(0), auto-hide on modals
- **Building/gate interaction zones** — semi-transparent Rectangles on HomelandScene with pointer handlers
- **Touch panel controls** — CombatPanel (tap zones), EventPanel (6 choice zones), FarmPanel (buttons), NPCPhotobookPanel (▲/▼ scroll)
- **[X] Close buttons** — all popups have top-right close button
- **Phase 1: AnalogStickInput** — extracted shared class, ~180 lines eliminated across 3 scenes
- **Phase 2: BasePanel lifecycle** — `fadeIn()`/`fadeOut()`, `createOverlay()`, `addCloseButton()` helpers; all 9 panel subclasses migrated
- **Phase 3: HomelandScene panels extracted** — BuildingInfoPanel, RestorePanel, GatePanel as proper BasePanel subclasses; HomelandScene drops ~686 lines
- **Phase 4: isModalActive unified** — all 3 scenes use consistent getter pattern; ExpeditionScene covers all panels

## ✅ Combat Panel Revamp (June 2026)
- **Stamina display removed from CombatPanel** — redundant stamina label/bar at y:525–535 eliminated; persists as HUD element in ExpeditionScene top-left
- **HUD stamina visible during combat** — stamina bar, portrait, and text depth bumped from 50–51 to 201, rendering above the combat overlay
- **HUD stamina updates live** — `drawStaminaBar()` called each combat frame so stamina consumed on miss reflects immediately
- **Enemy name/sprite swapped** — name now at y:120 (centered), sprite at y:150, creating a natural top-down reading order
- **Sprite fixed to 128×128** — `setDisplaySize` moved after `setTexture` in `show()`, ensuring boss and all enemies render at uniform size regardless of source texture resolution
- **Hit-stop on hit** — marker pauses for 250ms on successful strike, enemy sprite shakes (±5px × 4 cycles) during the pause
- **Stamina shake on miss** — miss now shakes all 4 stamina HUD elements (bg, portrait, bar, text) matching the enemy hit feedback pattern
- **Click-to-attack on sprite + timing bar** — enemy sprite and timing bar are interactive click targets for strike/collect; replaced full-screen touch zone
- **Retreat button** — `[ ESC ] Retreat` text button below timing bar at y:395, replacing touch zone bottom-half tap
- **Miss feedback timing fixed** — miss SFX/text fire immediately before marker pause (was inside the delayed callback)
- **Fix: queueObtainPopup stale references** — `activeObtainPopups` now resets on every `create()` so destroyed containers from prior runs don't block new popups
- **Portrait cropped to head** — `setCrop(50, 15, 156, 60)` on stamina HUD portrait, scale adjusted from 0.25 to 0.5
- **Ring arcs start at 6 o'clock** — inventory and pickaxe rings now sweep from `Math.PI/2` (bottom) instead of `-Math.PI/2` (top)

## ✅ Mining Animation (June 2026)
- **3-frame pickaxe swing** — 6 new sprites (3 per direction) with procedural pickaxe poses; plays at 80ms/frame (240ms total) on SPACE
- **One-shot animation** — frames 0→1→2 play once per press, then snap back to idle; movement locked and SPACE ignored during swing
- **Delayed damage** — mining damage/stamina/particles execute after the 240ms animation completes via `pendingMineTx/Ty` + `executeMine()`
- **Empty swings** — pressing SPACE with no mineable target still plays the full swing animation

## ✅ Wall Destruction & Tunneling (June 2026)
- **Pickaxe mines walls** — walls have durability 4 (set at generation), same pickaxe damage model as ores; stamina cost 8 per swing
- **Wall breaks into corridor** — destroyed wall converts to `'corridor'` tile, walkable and visually distinct as a tunnel
- **Bomb also destroys walls** — mining bomb damages adjacent walls, converts to corridor, gray dust particles
- **Wall hit feedback** — wall image shakes on hit, camera shake, gray damage tint (0xaaaaaa/0x777777), low sawtooth `playWallHit()` sound
- **Wall break effects** — `createWallBreakParticles()` with gray rock chunks + dust burst, low rumble `playWallBreak()` sound
- **Preview depth relative to player** — preview tile depth interleaves with painter's algorithm: above player when facing north/west, below when south/east
- **Biome-based scene backgrounds** — ExpeditionScene background now cycles with biome: FOREST `#0a0a15`, CAVE `#0f0804`, ICE `#0a1525`, LAVA `#150804`, RUINS `#0d0615`

## ✅ Laboratory Progression Tree (June 2026)
- **3 branches × 4 tiers** — Mining, Combat, and Survival trees with 12 research nodes, each requiring the previous tier as prerequisite
- **Crystal-first costs** — T1=1c+50s, T2=3c+10bronze, T3=5c+10silver, T4=10c+5gold
- **Node-link tree UI** — scrollable container with sprite icons, connector lines, WASD grid navigation, selection highlight
- **Click-focused interaction** — click to focus, re-click to research; confirmation prompt overlay with SPACE/Confirm/Cancel
- **Description bar** — fixed bottom panel showing node name, description, cost, and status (LOCKED/AVAILABLE/MAXED) for the focused node
- **Vitality Surge percent bonus** — +20% max stamina scales with all flat stamina sources; stored as `gameState.staminaPercentBonus`
- **All 10 effects wired** — mining stamina cost, double ore, mine tier offset, animation speed, combat damage, crit chance, boss multiplier, consumable boost, lantern range, and floor stamina recovery all read research levels at their respective hook sites

## ✅ Clickable Restore Buttons (June 2026)
- **RESTORE/CANCEL buttons** — RestorePanel now shows clickable side-by-side buttons instead of text hints; RESTORE (green) when sufficient materials, CANCEL (gray) always visible; solo CANCEL when cannot afford
- **Scene-level pointerdown handler** — follows same pattern as research confirm prompt and close button, avoiding Phaser 4 nested-container input issues
- **SPACE/ESC keyboard kept** — both keyboard shortcuts and mouse buttons work in parallel
- **Building descriptions fixed** — buildings.json descriptions now explain gameplay effects (e.g. "+20 max stamina", "+8 inventory capacity")
- **isRestored() bug fixed** — removed stale `return true` stub that caused all buildings to appear permanently restored

## ✅ Boot Screen Improvements (June 2026)
- **Title image** — replaced 48px text "HEARTHBURROW" with centered title.png sprite (480×320 @ 0.22 scale ≈ 106×70px displayed)
- **Loading bar fix** — progress/complete handlers moved from `create()` to `preload()` so they fire during actual asset loading instead of attaching after loading finished
- **Click to proceed** — loading complete now shows pulsing hint (`[ click anywhere to proceed ]`) instead of auto-transitioning; waits for click, SPACE, or ENTER before fading to HomelandScene
- **All assets in preload** — title + all sprites + audio load in a single `preload()` phase. `generateAll()` runs in `create()` only for procedural fallbacks (skipping keys that loaded from PNG). Two-phase approach was reverted because `generateAll()` creating textures before PNG queue prevented files from being added to the load queue via `File.hasCacheConflict()`.

## ✅ Player Default Facing (June 2026)
- **Default direction bottom-left** — `facingY` changed from `-1` to `1` in HomelandScene and ExpeditionScene, so the player sprite initially faces downward (bottom-left texture) instead of upward (top-right texture)

## ✅ Building Sprite Revamp (June 2026)
- **Single composite sprite per building** — replaced 6-tile grid rendering (repeated 80×64 wall tiles) with one cohesive 160×100 (3×2) or 120×80 (gate) sprite per building, procedurally generated via new `drawBuildingShape()` in IsoUtils.ts
- **Full building silhouette** — roof diamond + left/right wall faces as a single extruded isometric shape, color-coded per building type
- **Painter's algorithm depth** — buildings removed from fixed-depth container, now use `6 + centerY*0.002 + centerX*0.001` to interleave with player; south-most renders on top
- **Player Y-weighted depth** — player depth formula changed to `6 + y*0.002 + x*0.001 + 0.0005` so southward movement (Y) has double the depth impact of eastward (X), matching painter's sort
- **Editable PNGs** — `scripts/generate_building_sprites.py` exports placeholder PNGs to `tiles/building_*.png`; replace any with custom artwork to override the procedural fallback
- **BootScene restores building loads** — PNGs loaded from disk in preload, procedural generation in TextureGenerator is skipped when PNG exists

## ✅ Homeland Map Expansion (June 2026)
- **Bigger map** — hub grid expanded from 16×12 to **20×18** (56% larger)
- **Buildings now 3×3** — all 6 main buildings upgraded from 3×2 to 3×3 footprint for chunkier visual
- **Asymmetric staggered layout** — buildings placed at varied offsets (gx=3,4,5,12,13,14) instead of uniform left/right columns
- **Central path at cols 9-10** — shifted to center of wider grid
- **Gate at southern edge** — moved to row 16 (was row 9), player spawns at (9,15) directly above
- **Removed buildingsContainer** — building sprites tracked via Map<string,Image>, labels added directly to scene at depth 7
- **Un-restored alpha 0.2** (was 0.4)
- **Building texture sizes** — 3×3 canvas 160×120 (was 160×100), gate stays 120×80; all PNGs regenerated

## ✅ Mobile UI Polish (June 2026)
- **Analog stick no longer fires on UI touches** — `onPointerDown` now checks `isPointerOverUI` (was missing), plus HomelandScene and TavernScene pass `isPointerOverUI` to AnalogStickInput config
- **ESC closes EventPanel** — added ESC/TAB handler to the `eventActive` update block; was previously un-closable on mobile if the tiny [X] was missed
- **FarmPanel uses fadeIn lifecycle** — replaced raw `setVisible` with `fadeIn()/fadeOut()` matching BasePanel pattern
- **CombatPanel uses BasePanel show/hide** — migrated from manual alpha tween + `setVisible` to `fadeIn(200)/fadeOut(200)`
- **Close buttons enlarged to 24px** — BasePanel `addCloseButton()` now uses `fontSize: '24px'` with a 48×48 invisible hit zone behind it; BuildingInfoPanel, RestorePanel close buttons moved from embedded modal positions to standard `(920, 44)`
- **GatePanel close button enlarged** — moved from `(810, 50)` 16px to `(920, 44)` 24px with 48×48 hit zone
- **NPCPhotobook scroll arrows** — ▲/▼ enlarged to 22px with 60×40 invisible hit zones replacing 16px text-only targets
- **Action buttons dim during modals** — potion/bomb/escape sprites now set `alpha(0.3)` when `isModalActive`, showing they're disabled
- **Font size bumps** — GatePanel body text 14→16px, footer 13→15px, embark 15→18px; EventPanel desc 14→16px, choices 15→17px; CombatPanel HP 12→15px, hint 12→14px, retreat 14→16px; action badge counts 10→14px, escape label 9→12px
- **EventPanel [X] floating after close** — `selectChoice()` now hides the close button explicitly (was showing permanently after any choice selection)
- **RestorePanel handler cleanup** — `destroy()` null-checks and removes pointerdown listener to prevent leaks on scene transitions
- **BasePanel fadeIn consistency** — all 13 panels now use `fadeIn/fadeOut` (previously 4 panels bypassed it)

## ✅ Contextual Action Button (June 2026)
- **Center-right action button** — 72×72 rounded rect at `(920, 320)` with 28px Unicode icons: ⛏ (mine), ⚔ (attack/strike), 💬 (interact), ✨ (rescue), ↑/↓ (stairs), ↓ collect
- **Updates every frame** — `updateActionButton()` reads `combatActive`, `interactTarget`, and facing tile to choose icon/visibility
- **Tap dispatches SPACE logic** — `handleActionButton()` replicates the SPACE key dispatch: combat strike/collect → interact target actions → `tryMine()`
- **Hides during modals** — shares the `isModalActive` guard so it's never shown when event panel, gamble, stair prompt, or exhaustion overlay is active
- **No text label** — icon-only per user request, with color-coded borders (green collect, red combat, blue interact, gold mine)

## ✅ Bug Fix: Restoration Affordability Check (June 2026)
- **SPACE keyboard shortcut** was calling `tryRestore()` without checking `canRestore()`, bypassing the RESTORE button's affordability gate
- **Fix**: added `if (!canRestore(buildingId)) return;` at the top of `tryRestore()` so insufficient materials is a silent no-op before any animation starts

## ✅ Painter's Algorithm Consistency (June 2026)
- **Buildings use NE corner** — depth reference changed from center `(gx+gw/2, gy+gh/2)` to NE corner `(gx+gw-1, gy)`, so any player east of the building always gets higher depth (right-most wins)
- **Gate depth fixed** — NE corner `(10, 16)` instead of center `(10, 16.5)`
- **Expedition interactive tiles** — depth changed from `(x+y)*0.001` (equal weight) to `y*0.002 + x*0.001` (Y×2, matching player formula)
- **Expedition boss** — same consistency fix with `+0.003` offset
- All objects across both scenes now use the same Y-double-weight depth formula

## ✅ Tavern Scene Improvements (June 2026)
- **[EXIT] button** — bottom-right of screen, clicks call `leave()` 
- **[PHOTOBOOK] button** — bottom-left of screen, clicks toggle photobook panel
- **Dialog click-to-dismiss** — clicking anywhere closes NPC greeting (same as SPACE/ESC), deferred register to avoid same-click auto-close
- **NPC click fix** — expanded hit area (70×60) covers full tile, explicit Phaser.Geom.Rectangle hit area ensures reliable interactivity
- **Photobook entry selection** — clicking on any NPC entry line sets focus; uses localY calculation (22px line height) with scroll offset to determine the clicked entry

## ✅ Expedition Loadout Revamp (June 2026)
- **Icon-driven layout** — GatePanel rewritten with stats column (left), 5 equipment slots, 3 consumable slots, settings (text), bottom embark button, and a 2-line description panel below embark
- **Equipment picker** — `EquipmentPicker` popup with scrollable list, W/S keyboard navigation, SPACE confirm, click support. "(none)" option for rings/boots/lantern unequip
- **Consumable picker** — `ConsumablePicker` with icon, description, stash count, −/+ quantity controls (← → and click), SPACE/ESC/click-outside all confirm qty
- **Floor/Seed pickers** — `FloorPicker` (elevator floor list) and `SeedEntryPopup` (text input with blinking cursor)
- **ConfirmPopup** — yes/no dialog for reset game
- **Placeholder sprites** — empty equipment slots show dimmed (alpha 0.15) slot-appropriate base icon instead of blank frame
- **All inline text removed** — equipment/consumable names moved to dedicated bottom description panel
- **Phaser 4 Container Input fix** — interactive children of Container do not reliably fire pointerdown events; all click handling uses scene-level `pointerdown` with manual hit-testing and a transparent Rectangle blocker inside the container to prevent click-through

## ✅ Camera Zoom 1.5× (June 2026)
- **Dual-camera compositing** — `ExpeditionScene` now creates a second HUD camera (`this.hudCam`) at 1.0× zoom that renders all HUD elements (minimap, stamina, pickaxe, inventory button, potion/bomb, escape, action button, stair prompt, exhaustion/extraction overlays, obtain popups, recipe popups) while the main camera renders the game world at 1.5× zoom with player follow and bounds
- **Camera.ignore() approach** — ~50 per-object `cameras.main.ignore()` and `hudCam.ignore()` calls ensure each object renders in exactly one camera (world → main cam, HUD → HUD cam), avoiding Phaser 4's broken `cameraFilter` bit manipulation
- **HomelandScene zoom** — simple `cameras.main.setZoom(1.5)` since there are no HUD elements to exclude
- **All `setScrollFactor(0)` objects properly routed** — runtime-created objects (popups, particles, stair prompts, extraction overlays, item fly sprites, obtain popups) all tagged at creation time; item fly sprites correctly transition from world (`hudCam.ignore`) to screen (`cameras.main.ignore`) during fly-to-backpack animation
- **Clean build** — `tsc` + `vite build` pass with zero errors

## Resolved Bugs
- **Particles rendering twice** — `createMiningParticles` (14 circles) and shockwave ring in `executeMine` were missing `hudCam.ignore()`, rendering on both main + HUD cameras. Added the missing ignore calls.
- **Analog stick visible/stuck after panel opens** — `onPointerUp` returns early when `isModal()` is true, skipping `reset()` → gfx persists forever. Added `this.analog.reset()` before inventory/event/gamble panel shows, matching the existing pattern in `startCombat()`.
- **Item fly sprite invisible** — `spawnItemSprite` sets `hudCam.ignore()` (renders on main cam), then `flySpriteToBackpack` adds `main.ignore()` without clearing `hudCam.ignore()` → excluded from both cameras. Fixed by clearing HUD cam bit via `sprite.cameraFilter &= ~this.hudCam.id` before adding main cam ignore.
- **Click-outside-to-close broken in consumable popup** — Graphics.setInteractive() and container-child Rectangle.setInteractive() both unreliable in Phaser 4. Fixed with scene-level pointerdown handler + transparent Rectangle blocker
- **Placeholder sprites showing pickaxe** — scene.textures.exists() guard in else-branch skipped setTexture() when texture was generated (not PNG-loaded). Removed guard
- **GatePanel click-through during consumable picker** — added transparent interactive Rectangle blocker in container with empty pointerdown handler to consume clicks
- **Equipment picker not opening on click** — GatePanel's equip/consumable/settings zones and embark button used broken container-child setInteractive(). Replaced all per-zone setInteractive() with a single scene-level pointerdown handler using getBounds().contains() hit-testing + picker-visible guard to prevent sub-picker conflicts
- **FloorPicker/ConfirmPopup clicks not registering** — overlay Graphics.setInteractive() and row Rectangles inside container all broken. Same fix: blocker + scene-level handler with manual hit-testing
- **All remaining container-child setInteractive() instances fixed** — audit across 7 UI files: FloorPicker, ConfirmPopup, EquipmentPicker, GatePanel all migrated to blocker + scene-level handler pattern
- **Starting floor defaults to highest unlocked** — now picks the deepest elevator floor the player has reached instead of always defaulting to floor 0
- **[X] button bypassed CraftingPanel.hide()** — `BasePanel.addCloseButton()` called `this.fadeOut()` directly, skipping `CraftingPanel.hide()` which removes scene-level input handlers. Changed both click paths to call `this.hide()` so virtual dispatch cleans up handlers before fading.
- **Building sprite hit area scaled wrong** — custom `Rectangle(-60,-50,120,100)` hit area uses local texture coordinates, but most buildings have `scale: 0.2-0.3` in sprite-offsets.json, making clickable region 24-36px. Switched to default texture-bounds hit area which correctly accounts for per-sprite scale.

## ✅ Portrait Refactor — Phase 1-3 Complete (June 2026)
- **Resolution**: main.ts → `width: 390, height: 844` (iPhone Pro) with `Phaser.Scale.FIT` + `CENTER_BETTER`
- **Viewport constants**: `VW=390, VH=844, CX=195, CY=422, PANEL_PAD=16, OVERLAY_W=358, OVERLAY_H=812`
- **ExpeditionScene HUD**: full-width stamina bar, portrait left/depth/text blocks, minimap 1.5px cells, centered action button
- **Dual-camera zooms**: Expedition 1.2×, Homeland 0.85×, Tavern 1.2× — world tiles appear same visual size across scenes
- **All 12 panels** rewritten for 390px: GatePanel 2-row equipment, ResearchPanel 3-branch 200px span, CombatPanel 300w bar, EventPanel compact, GamblePanel 70px radius, etc.
- **3 scenes**: Homeland hudCam + zoom 0.85, Tavern OFFSET_X=CX-40 + zoom 1.2, ExpeditionRecap single-column 358w
- **Touch-size audit**: all interactive zones ≥40px height, standalone buttons ≥44px (FarmPanel, GatePanel embark, SeedEntryPopup randomize, ConfirmPopup yes/no, ConsumablePicker ±, NPCPhotobook ▲▼, CombatPanel timing)

## ✅ Portrait Refactor — Phase 4 Touch Audit Complete (June 2026)
- **Row zones**: InventoryPanel 20→40px, CraftingPanel 20→40px, TradePanel 20→40px, EquipmentPicker 36→44px, FloorPicker 34→44px, EventPanel 32→44px
- **Settings zones**: GatePanel 20→44px
- **Equip/cons slots**: GatePanel 42→44px
- **Standalone buttons**: FarmPanel setInteractive→transparent 44px zones, GatePanel embarkBtnZone 44px, SeedEntryPopup randomizeZone 44px, ConfirmPopup yesBtnZone/noBtnZone 44px
- **± buttons**: ConsumablePicker hw 20→22, hh 16→22
- **Scroll arrows**: NPCPhotobook 36→44px
- **Timing bar**: CombatPanel `BAR_HEIGHT+12=28`→44px
- **Clean build**: `npm run build` zero errors

## ✅ GatePanel Character Portrait & Equipment Layout Revamp (June 2026)
- **Full-body portrait**: `portrait` (256×256) added to GatePanel at (20, 42), 76×76 displaySize — shows full character sprite uncropped
- **Stats compacted**: moved from x=10 to x=110 beside portrait, 14px spacing, 10px font
- **5-square equipment grid**: pickaxe 104×104 (left), rings/boots/lantern 52×52 each (2×2 right grid)
- **All Y-values shifted**: cons rows→292, settings→342-408, embark→442, desc→494
- **Uniform rendering**: conditional half-size (`i===0 ? 52 : 26`) for pickaxe vs other slot backgrounds

## ✅ Expedition HUD Refresh (June 2026)
- **Depth moved**: from center-top `(CX, 4)` → bottom-center `(CX, VH-36)`, below action button
- **Pickaxe moved**: from top-right `(VW-76, 72×62)` → compact 160×42 block at `(4, 78)`, below stamina HUD left
- **Minimap moved**: from bottom-right → top-right at y=80, below stamina HUD
- **Potion/Bomb/Escape**: decoupled from minimap, now vertical stack at x=VW-40 (potion VH-130, bomb VH-88, escape VH-46)

## ✅ Combat Critical Mechanic & Damage Popup (June 2026)
- **Skill-based critical**: gold 40%-width center zone inside the green hit zone on the timing bar; landing marker there deals 2× damage
- **Stacking**: skill crit (2×) × RNG crit from rings/research (2×) = up to 4× damage
- **Damage popup**: floating number at marker position arcs in a parabola (60px up, 15px past marker) with random horizontal drift (±50px), grows 1×→2× scale over 900ms, fades out at end

## ✅ Homeland Building Interaction Improvements (June 2026)
- **White glow outline**: facing a building now shows a 3-layer white `setTint(0xffffff).setTintMode(FILL)` ghost outline (8 directions × 3 distances, alphas 0.85→0.40→0.12) behind the building sprite — matching the ExpeditionScene facing highlight pattern
- **Click-to-move-then-interact**: clicking a non-adjacent building now pathfinds the player to the nearest walkable tile beside it, then auto-triggers the building's action (open panel / show gate / restore prompt)
- **`handleBuildingClick()`** — checks adjacency; pathfinds if far, sets `pendingBuilding`, executed on proximity arrival via `checkProximity()`
- **`findAdjacentTile()`** — scans perimeter tiles for the closest non-solid walkable tile to the player
- **Sprite-based building click zones**: removed semi-transparent `Rectangle` overlays; building sprites and gate sprite now use `setInteractive()` with default texture-bounds hit area (accounts for per-sprite scale), `setData('isUI', true)` prevents analog stick interference
- **Locked buildings clickable**: non-restored buildings were excluded from `setInteractive()`; moved `pointerdown` handler outside `ul` guard so clicking any building shows restore panel — matching old zone behavior
- **Hover scale uses base 1**: `pointerover`/`pointerout` toggled between `cfg.scale` (0.2-0.3 for most buildings) and the image's actual scale (1.0), causing visible shrinkage; now uses plain `1 ↔ 1.05`
- **Retreat confirmation**: tapping the retreat button in combat shows a `ConfirmPopup` ("Retreat?" / "Leave the dungeon?") — keyboard ESC still bypasses confirmation
- **Combat click routing**: replaced broken container-child `setInteractive()` with blocker + scene-level `pointerdown` handler for strike/retreat/collect
- **Run inventory panel depth**: bumped `BasePanel.container` depth from 200→210 so panels render above HUD elements (stamina bar at 201)
- **Combat retreat button hidden on victory**: `retreatBtn.setVisible(false)` in the kill path, restored on `show()` and `hide()`
- **Combat confirm popup guard**: `confirmPopup.isVisible()` check added to combat click handler — prevents combat actions while confirm dialog is open

## ✅ Tavern NPC & Camera Polish (June 2026)
- **Camera follows player**: `startFollow` with X lerp 0.09 provides smooth horizontal tracking; `setBounds` constrains to the tavern interior (`-400,-100,900,1000`)
- **Click NPC to approach**: clicking an NPC container or tile pathfinds the player to an adjacent walkable tile, faces the NPC, then auto-greets — no more instant conversation from across the room
- **Facing required for interaction**: highlight glow, action button, prompt, and SPACE dialogue only work when player faces the adjacent NPC — `relX === facingX && relY === facingY` check in adjacency scan
- **Blocked facing works**: pressing WASD into a wall/NPC now correctly rotates the player sprite to face that direction (matching ExpeditionScene pattern — facing set before `isSolid` check in `tryMove`)
- **Camera coordinate fix**: removed `OFFSET_X` from `gridToScreen` — world renders at pure isometric positions, camera scroll handles centering. `doClickToMove` uses `pointer.worldX` directly (Phaser already accounts for camera scroll+zoom)
- **Action button faces NPC**: clicking the 💬 action button now sets `facingX/Y` before greeting
- **`updateFacingHighlight()` / `updateActionButton()`**: extracted into dedicated methods for clean per-frame updates

## ✅ Carrot Currency System (June 2026)
- **Pickable floor tiles** — `carrot_pickup` type added to `TileType` union; `(depth % 5) + 1` carrots spawn per floor on random walkable tiles (1 on boss floors); marked `broken` on pickup
- **Auto-pickup on step** — `tryMove()` calls `checkCarrotPickup(nx, ny)` after each move; tile broken + fly animation + `gameState.inventory.addItem('carrot', 1)` (homeland storage, not expedition pack)
- **Two-phase fly animation** — Phase 1: 300ms `Quad.easeOut` arc upward in world space (`hudCam.ignore`). Phase 2: 300ms `Quad.easeIn` fly to CX,78 in screen space (`setScrollFactor(0)` + camera swap), scale 1→0.4
- **Carrot pickup SFX** — `playCarrotPickup()` plays a bright descending 3-note arpeggio (sine 880→660→440 Hz)
- **HUD counters** — ExpeditionScene at (CX, 78), HomelandScene/TavernScene at top-right (VW-12, 12); `🥕 N` format with `setScrollFactor(0)` + camera routing
- **Persist on expedition end** — no explicit save on carrot pickup (natural death/survive flow saves inventory)
- **Facing highlight skipped** — `updateFacingHighlight()` early-returns for `carrot_pickup` (no white outline)
- **Gambling now uses carrots** — GamblePanel subtitle, spin button, and deduction all use 🥕 instead of stone; `gameState.inventory` with `gameState.save()` on spin

## ✅ Click-Leak Prevention (June 2026)
- **`uiHitOnDown` guard in AnalogStickInput** — `onPointerDown` sets `uiHitOnDown = true` when pointer is over any UI element or a modal is active; `onPointerUp` checks this flag first, absorbing the click even when the modal state changes between pointerdown and pointerup
- **EventPanel choice zones tagged** — `setData('isUI', true)` added to choice zone rectangles so `isPointerOverUI` identifies them even after container visibility changes

## ✅ iOS Storage Warning Overlay (July 2026)
- **`console.warn` logging** — all silent `catch` blocks in `GameState.ts` (static init, save, load) now log failures for discoverability
- **Full-screen dismissable overlay** — replaces subtle text line in BootScene; explains iOS Safari blocks localStorage in embedded Iframes on Itch.io, suggests "Pop Out" or non-Safari browser

## ✅ Farm Balance — Steps-Based Yield + Capped Plots (July 2026)
- **Steps-based yield** — farm now produces `floor(stepsTaken × farmPlanted / 100)` carrots per expedition, tying reward to exploration effort instead of expedition count
- **Steps tracked in `tryMove()`** — increment after every successful tile move, covers keyboard/analog/click-to-move equally
- **6-plot cap** — max 6 planted plots (no research expansion); `audio.playError()` on attempt to exceed cap or plant without carrots
- **Consumed on harvest** — `farmPlanted` resets to 0 after harvesting; must replant each expedition cycle
- **Visual plot grid** — FarmPanel shows `████░░ 4/6` bar indicating used/free plots
- **Recap display** — "Farm grew X carrots!" line shown in ExpeditionRecapScene when yield > 0
- **Farm yield moved to extraction** — calculated in `ExpeditionScene.extract()` and stored in `RunResult.farmYield`; removed from `ExpeditionRecapScene.returnToHomeland()`
- **`stepsTaken`/`farmYield` added to `RunResult` interface** — no schema migration needed

## ✅ Code Quality — Two-Phase Loading Reverted (June 2026)
- **`generateAll()` moved to `create()`** — reverted the two-phase loading experiment; `generateAll()` now runs after PNGs are in TextureManager, preventing `File.hasCacheConflict()` from silently dropping every PNG from the load queue
- **All assets load in `preload()`** — title sprites, all tile sprites, and audio load in a single `preload()` phase with no texture key conflicts

## ✅ Title-First Boot Screen (July 2026)
- **Title loads first** — `title_img` queued as the first asset; shown via `filecomplete` event as soon as the PNG finishes, while remaining assets continue loading in the bar below
- **Loading bar below title** — positioned at `cy + 10`, leaving room for the title at `cy - 80`; fills progressively as the remaining ~100+ assets load
- **No text placeholder** — the real title image pops in naturally at its own pace (typically within 1-2 frames from cache)

## ✅ Code Quality — Constants Extraction & Depth Dedup (July 2026)
- **Dead code removal** — removed `drawExtrudedAt()` from IsoUtils, `overlay_damage`/`overlay_crack` textures from BootScene + TextureGenerator, unnecessary `export` on `NPC_NAMES` in GameState
- **Constants files** — `src/constants/scenes.ts` (SCENES), `src/constants/items.ts` (ITEMS), `src/constants/buildings.ts` (BUILDINGS) — 14 hardcoded scene key strings replaced across 6 files
- **`interactiveDepth(x, y, offset)`** — shared function added to IsoUtils, replaces 12+ scattered `6 + y*0.002 + x*0.001 + ...` formulas in ExpeditionScene and HomelandScene
- **Duplicated map eliminated** — `buildingTextureKeys` defined once as module-level constant instead of twice in HomelandScene
- **Type safety** — 4 `any` annotations replaced with proper types (`Phaser.Types.Tweens.TweenBuilderConfig`, `DungeonTile`, typed union, `Phaser.Input.Pointer`)
- **Clean build** — `tsc --noEmit` zero errors

## Resolved Bugs
- **Gambling "Walk away" removes NPC** — `GamblePanel.showPreview()` set `onWalk = () => onClose(null)`, which in `ExpeditionScene.triggerGamble()` called `tile.broken = true` + `drawFloor()`, erasing the goblin NPC even when the player walked away without gambling. Fixed by adding optional `onWalk` parameter to `showPreview()` and passing a noop callback from `triggerGamble()` that only clears the interact target without marking the tile broken.
- **Carrot counter not updating on gamble** — `onSpin` callback deducted carrots and saved but never called `updateCarrotCounter()`. Counter stayed stale until the next carrot pickup from the floor. Fixed by adding `updateCarrotCounter()` after the deduction.

## ✅ VS-Style Chest Animation (July 2026)
- **Shake → beam → open → reward animation** — pressing SPACE on vault/chest tiles plays a 6-phase sequence (shake 300ms → golden light beam 200ms → scale pop + flash 150ms → beam fade 100ms → item pop-in → fly-to-backpack arc) instead of instant popup
- **No popup interaction** — animation plays automatically, no choice menu required; items queue into the existing `flySpriteToBackpack` parabolic arc system
- **Treasure vault rewards**: tiered ore by depth (bronze→silver→gold) with `qty = 2 + floor(depth/5)` + crystal at `1 + floor(depth/8)`
- **Hidden treasure rewards**: depth-pool resource (stone→bronze→silver→gold) at `qty = 3 + floor(depth/5) * 2`
- **No gold before depth 10** — pool indexing uses `min(floor(depth/2), 5)` so gold only enters at pool[5] (depth 10+)

## ✅ Tavern NPC Liveliness (July 2026)
- **Random seat shuffle** — NPCs assigned to randomized seat positions each tavern visit via `Phaser.Utils.Array.Shuffle` instead of fixed rescue-order placement
- **Random sprite flip** — each NPC spawns with 50/50 `setFlipX` so they don't all face the same direction
- **Player-facing on interaction** — NPC flips toward the player when adjacent and being faced; reverts to random flip when player walks away
- **Idle bob animation** — NPC containers gently oscillate 3px on a slow sine wave (600-1000ms random duration, staggered start delays) for subtle breathing/life
- **`NPC_GRID` → `NPC_SEATS`** — renamed for semantic clarity

## ✅ Ore Drop Glow Highlight (July 2026)
- **White filled glow on spawned drops** — when an ore node breaks, the drop sprite gets a 24-image white glow (8 directions × 3 layers, matching Tavern NPC highlight style) that fades in with the drop
- **Glow follows the flight arc** — glow images convert from world→screen space alongside the sprite and track it through the entire parabolic arc to the backpack
- **Persists until backpack** — glow stays visible for the full 600ms flight, destroyed only when `flySpriteToBackpack.onComplete` fires
- **Immediate flight** — drop flies directly with no pop-in delay; glow fades in during the first 150ms of the arc