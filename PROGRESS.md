# Progress Report

> Current state compared against [GDD.md](./GDD.md) goals.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented |
| 🟡 | Partially implemented |
| ❌ | Not implemented |
| 🗑️ | Defined but unused (dead code) |

---

## 1. Homeland Buildings (GDD §3)

| Building | Status | Notes |
|----------|--------|-------|
| Crafting Station | ✅ | Operational; opens CraftingPanel with recipe list |
| Storage | ✅ | Operational; opens InventoryPanel with trash |
| Trading Post | ✅ | Restorable (no cost); opens TradePanel with buy/sell using carrots |
| Laboratory | ✅ | Restorable (no cost); opens ResearchPanel with permanent upgrades |
| Housing | ✅ | Restorable for 100 stone; grants +20 max stamina |
| Farm | ✅ | Restorable (no cost); plant carrots before expedition, harvest yield after |
| Decorative Structures | ❌ | Not planned for MVP |

---

## 2. NPCs (GDD §3)

| NPC | Status | Notes |
|-----|--------|-------|
| Merchant | ✅ | Trading Post restored; buy consumables with carrots, sell materials for carrots |
| Researcher | ✅ | Laboratory restored; spend crystals + ores for permanent stat upgrades |
| Villagers | 🟡 | Rescue events exist but no persistent NPC system |

---

## 3. Dungeon Generation (GDD §4)

| Feature | Status | Notes |
|---------|--------|-------|
| Procedural rooms (3-5 per floor) | ✅ | Hand-carved room algorithm with L-corridors |
| Room templates from data | 🗑️ | `rooms.json` files exist on disk but are not imported |
| 5 biomes | ✅ | Forest (0–4), Cave (5–9), Ice Cave (10–14), Lava (15–19), Ruins (20–25) with distinct wall/floor/corridor colors |
| Treasure vault rooms | ✅ | 40% chance on depth 1+; separate 6×6 walled room with enemies and treasure tile |
| Boss rooms | ✅ | depth % 5 === 4; single large room; boss drops stairs_down on defeat; entry tile is `floor` (no ascend) |
| Shop tiles | ✅ | `placeShopTile` inside existing rooms (depth 2+); also available via random event pool |
| Standard mining rooms | ✅ | Carved rooms with biome-scaled ore distribution |
| Puzzle/shrine/relic rooms | ❌ | Not implemented |
| Random events (5 types) | ✅ | Treasure, Fountain, Trader, Villager, Goblin — all hardcoded in `buildEventConfig()` |
| Biome-scaled ore distribution | ✅ | `pickResource(depth)` uses 5 biome tiers with per-biome scaling; Forest = stone/bronze heavy, Cave adds silver, Ice adds gold, Lava/Ruins = gold heavy |
| Stairs up/down | ✅ | `stairs_up` only on depth % 5 === 0 (return floors); all other floors get `floor` at entry tile; `stairs_down` no longer pre-placed — spawns dynamically when breaking mineable tiles on non-boss floors |
| Corridor connectivity | ✅ | Clean 1-tile L-shape with post-carve entry widening; no dead-ends |

---

## 4. Player Systems (GDD §5)

| Feature | Status | Notes |
|---------|--------|-------|
| Stamina System | ✅ | Walking no longer costs stamina; Mining (5), Combat miss (10); consumed **after** action |
| Exhaustion = emergency extract | ✅ | 30% loss, red shake overlay; auto-triggers when stamina reaches 0 |
| Emergency Escape (ESC) | ✅ | "Give Up", 30% loss, orange overlay |
| Safe extraction via stairs_up | ✅ | At depth 0 on return floors; 0% loss |
| Inventory (slot-based, 16 base) | ✅ | Per-unit-per-slot in dungeon, stacked in homeland; +8 from storage upgrade, +2 per research |
| Equipment: Pickaxe (3 tiers) | ✅ | Run-based durability (tier 1 unlimited runs, tiers 2-3 = 5 runs each); wood(3)/bronze(5)/iron(7) damage |
| Equipment: Rings (slots 1 & 2) | ✅ | 4 types (Critical, Damage, Precision, Hunter); crafted via monster kill thresholds; effects applied in combat |
| Equipment: Boots | ✅ | 7 items: 3 stamina tiers (+10/20/30 max), 3 luck tiers (10/25/40% double-drop + stair multiplier), 1 regen (1/5 rocks). All 5-run limited |
| Equipment: Lantern | ✅ | 3 tiers (3/4/5 tile range). 5-run limited. Dark floors (depth%5=3) = base 90px+lantern bonus. Recipes discovered on first entry to floor 3/8/13 |
| Consumable usage | ✅ | [Q] Stamina Potion, [E] Teleport Scroll, [F] Mining Bomb; [W] cycles consumable slot |
| Inventory management | ✅ | Interactive panel with W/S select, [Z] trash, [SPACE] use; available in dungeon and homeland storage |
| Consumable loadout | ✅ | Gate panel tab 3: select potions/scrolls/bombs from storage before descending; tabs 0-2 for pickaxe + ring selection |
| Turn-based grid movement | ✅ | 150ms delay, 4-direction, no diagonals |
| Smooth movement tween | ✅ | Player tweens to target tile over 100ms (Linear ease) instead of instant snap |

---

## 5. Mining System (GDD §6)

| Feature | Status | Notes |
|---------|--------|-------|
| Tile durability | ✅ | Per-tile HP, resource-specific |
| Pickaxe tier progression | ✅ | Tier 1 (wood) → 2 (bronze) → 3 (iron) |
| Mining particles | ✅ | Color-coded by ore type |
| Hit flash effect | ✅ | White flash on every hit |
| Item popup on break | ✅ | Floating "+1 Stone" text |
| Durability cracks visual | ✅ | Dark overlay (<66%), cross cracks (<33%) |
| Tile required tier | 🗑️ | `MiningSystem.requiredTier()` never called by ExpeditionScene; removed as dead code |
| Item sprite fly-to-backpack | ✅ | On break, ore sprite pops out at tile position, arcs to bottom-right backpack area over 500ms. Luck bonus drops queue sequentially. Reuses existing `ore_*` textures. |

---

## 6. Combat System (GDD §7)

| Feature | Status | Notes |
|---------|--------|-------|
| Optional combat | ✅ | Enemy tiles placed on floors; triggered via SPACE when adjacent; non-blocking to exploration |
| Timing-based interaction | ✅ | Oscillating marker with green hit zone; SPACE to strike; ESC to retreat |
| Ring effects | ✅ | Critical (double damage), Damage (+1), Precision (wider zone), Hunter (double loot) |
| Boss fights | ✅ | depth % 5 === 4 (floors 4, 9, 14, 19); single large room; 60 HP boss; stamina ≥ 10 to enter; no stairs_down until defeat |
| Monster drops | ✅ | Slime/Bat/Rat enemies drop 1-2 `gold_ore` each; boss drops 3-5 gold_ore + crystal |
| Combat auto-retreat | ✅ | Automatically retreats from combat when stamina ≤ 10 |

---

## 7. Progression (GDD §8)

| Feature | Status | Notes |
|---------|--------|-------|
| Homeland restoration | ✅ | Building restoration with material costs |
| Recipe discovery | ✅ | 5 discoverable recipes via events/milestones (bronze pick, iron pick, stamina potion, teleport scroll, mining bomb) |
| Rescued villagers | 🟡 | Event exists (+2 max stamina) but no persistent tracking system |
| Relics | ✅ | 3 types (stamina +20, inventory +4, luck +1). Found in relic chambers (depth ≥10, 15% chance per floor). Each found once permanently. |
| Building unlocks | ✅ | All 4 buildings restorable (housing, trading_post, laboratory, farm); each unlocks distinct gameplay |
| Permanent stat upgrades | ✅ | Max stamina (+20 from housing, +10 per research) and inventory slots (+8 from storage, +2 per research) |
| Temporary run buffs | ✅ | Ring effects applied per run; consumables provide on-demand effects |

---

## 8. Crafting & Economy (GDD §9)

| Feature | Status | Notes |
|---------|--------|-------|
| Discovery-based crafting | ✅ | Recipes unlock via events and milestones |
| Recipe selection with W/S + SPACE | ✅ | Crafting panel uses selectable list |
| 7 material types | ✅ | Stone, Bronze Ore, Silver Ore, Gold Ore, Crystal, Monster Essence, Carrot |
| 2 craftable pickaxe recipes | ✅ | Bronze (tier 2) and Iron (tier 3); wooden pickaxe (tier 1) is default |
| 3 consumable recipes | ✅ | Stamina Potion, Teleport Scroll, Mining Bomb |
| Farming system | ✅ | Restore farm building; plant carrots before expedition, harvest yield after expedition |
| Trading with carrots | ✅ | TradePanel at Trading Post: buy potions/scrolls/bombs with carrots, sell ore/essence for carrots |
| Research upgrades | ✅ | ResearchPanel at Laboratory: spend crystals + ores for +10 max stamina and +2 inventory slots |
| Consumable usage during expedition | ✅ | [Q] Potion (restore 30 stam), [E] Scroll (safe extract), [F] Bomb (damage 8 surrounding tiles) |

---

## 9. Puzzle & Interaction (GDD §10)

| Feature | Status | Notes |
|---------|--------|-------|
| 5 event interactions | ✅ | Treasure, Fountain, Trader, Villager, Goblin |
| Event tiles require proximity + SPACE | ✅ | Checks 5 tiles around player |
| Event panel with W/S/SPACE navigation | ✅ | Navigate choices, confirm with SPACE |
| Pressure plate puzzle | ✅ | Multi-plate rooms (3–5 plates). All plates must be stepped on to spawn `stairs_down` in puzzle room. Mining does not spawn stairs on puzzle floors. Placed via `placePuzzle()` with min Manhattan distance 3. |
| Pushable rocks | ❌ | Not implemented |

---

## 10. Art & Audio (GDD §11–12)

| Feature | Status | Notes |
|---------|--------|-------|
| Placeholder graphics (rectangles/shapes) | ✅ | All Phaser Graphics primitives; no pixel art or spritesheets |
| HD-2D pixel art | ❌ | Not started |
| Biome-specific color palettes | ✅ | 5 distinct color schemes for wall/floor/corridor across Forest, Cave, Ice Cave, Lava, Ruins |
| Player sprite (isometric diamond+body) | ✅ | Diamond base + body rectangle |
| Item/event sprites | ❌ | Drawn via Graphics primitives |
| Audio / sound effects / music | 🟡 | Web Audio API synthesis; generated tones for mine_hit, item_pickup, step, stairs, combat hit/miss, victory; per-resource pickup sounds (stone thud, ore clicks, gold ping, crystal sparkle, monster squish); no music or ambient tracks |
| Broken tile rendering | ✅ | Enemy and boss tiles revert to floor style when broken (no more black voids) |
| Isometric viewport | ✅ | Dungeon and hub both use 80×40 isometric diamond projection |
| 3D extruded walls | ✅ | Walls render as 3D blocks with visible height (top + left + right faces), height 12 to keep objects visible behind them |
| Depth sorting (painter's algorithm) | ✅ | Tiles sorted by `x + y` (back-to-front) for correct overlap |
| Wall sprites (per-tile depth) | ✅ | Walls converted from single Graphics to individual `Image` sprites at depth `6 + (x+y)*0.001`, sharing painter's algorithm range with object sprites |
| Player directional sprites | ✅ | Player changed from Container to Image; `player_top_right`/`player_bottom_left` textures; flipX for horizontal direction |
| Sprite system (PNG + fallback) | ✅ | 28+ placeholder PNGs in `public/assets/sprites/`; BootScene loads PNGs first; `TextureGenerator` provides runtime fallback for missing files |
| Real loading progress bar | ✅ | Changed from fake 1200ms tween to real `this.load.on('progress')` event + 3s fallback timeout |
| Minimap fog of war | ✅ | `expored` boolean grid on ExpeditionState; 10-tile reveal radius around player per move; entry room revealed immediately (radius 8); unexplored tiles hidden on minimap; player dot always visible; resets per floor |

---

## 11. Technical Architecture (GDD §13)

| Feature | Status | Notes |
|---------|--------|-------|
| Phaser 3 framework | ✅ | v3.80.1 |
| TypeScript | ✅ | Strict mode |
| Vite build | ✅ | Dev server + production build |
| Data-driven JSON files | 🟡 | 3 files used (`items.json`, `recipes.json`, `buildings.json`); `rooms.json`, `events.json` exist on disk but are not imported |
| Procedural generation | ✅ | Room carving, corridor stitching, event placement, biome-scaled ore distribution, relic chambers, puzzle rooms |
| Seed-based generation | ❌ | Not implemented (no seed, no replays) |
| Scene management | ✅ | Boot → Homeland → Expedition → Recap |
| Singleton game state | ✅ | `GameState` persists across scenes |
| Local storage persistence | ✅ | Auto-save on expedition finish, crafting, building restore; load on boot |
| Isometric projection system | ✅ | `IsoUtils.ts` with `gridToIso()`, diamond/extruded drawing, world bounds |
| Homelad grid-based movement | ✅ | Turn-based grid movement (150ms) matching dungeon |
| PNG sprite assets | ✅ | 28+ placeholder PNGs loaded in BootScene with runtime fallbacks |

---

## 12. MVP Scope Compliance (GDD §15)

Requirement | Status | Notes
------------|--------|-------
Procedural rooms | ✅ | 3-5 rooms per floor with L-corridors
Mining | ✅ | Complete with 3-tier progression
Stamina | ✅ | Movement, mining, and combat miss costs
Inventory | ✅ | 16 base slots, upgradeable to 26+
Extraction | ✅ | Safe (0% at depth 0) and emergency (30%)
One boss | ✅ | Forest Guardian on depth % 5 === 4 (floors 4, 9, 14, 19, ...)
One puzzle type | ✅ | Pressure plate puzzle implemented
Two random events | ✅ | Five events implemented (exceeds MVP)
Crafting station | ✅ | Operational with discovery system
Storage | ✅ | Operational with trash support
One villager house | ✅ | Restorable, grants +20 stamina
Three pickaxe tiers | ✅ | Wood (default), Bronze (craftable), Iron (craftable)
Stamina upgrades | ✅ | Via housing (+20) and research (+10 each)
Limited recipes | ✅ | 5 discoverable recipes

---

## Known Bugs & Issues

1. NPC interactions is not working

## Resolved Bugs

1. **Farm panel ESC not working** — `this.keys.X` was missing from `setupInput()` in HomelandScene; the `else if` chain threw TypeError at `JustDown(this.keys.X)` before reaching the ESC check. Fixed by adding `X: kb.addKey(...)` (line 277).
2. **Isometric camera bounds clipping (homeland + dungeon)** — Both scenes used `setBounds(0, 0, ...)` but the isometric grid projects to negative x when x < y. Fixed by offsetting `setBounds(xMin, 0, ...)` where `xMin = -(rows - 1) * HALF_W`. Lerp bumped from 0.1 → 0.5.
3. **Over-capacity panel per-frame refresh** — `refresh()` was called every frame while over capacity, forcing a full re-render each cycle. Fixed by moving `refresh()` inside the `!isVisible()` guard so it only runs once when the panel first shows.
4. **ResearchPanel parallel save system** — Research progress was stored under a separate localStorage key (`researched_upgrades`) that could de-sync from the main save. Merged into GameState as `researchedUpgrades` with automatic migration from the old key on load.
5. **Dead code removed** — Removed unused `MiningSystem.canMine()/mine()/requiredTier()` methods, 12 unused DataRegistry getter functions, 3 unused JSON imports (`relics.json`, `events.json`, `rooms.json`), 4 unused type exports, and 1 unused IsoUtils import.
6. **MiningSystem.requiredTier() string-comparison bug** — checked `"bronze"`/`"silver"`/`"gold"` (no `_ore` suffix) against DungeonGenerator's `"bronze_ore"`/`"silver_ore"`/`"gold_ore"`. Method was dead code and has been removed entirely.
7. **Corridor dead-end (post-carve entry widening)** — The L-shaped corridor could terminate at a room's corner wall tile where both adjacent cardinal tiles inside the room were still wall perimeter tiles, creating a dead-end. Fixed by adding `fixCorridorEntries()`: after all corridors are carved (including vault/puzzle corridors), scan every corridor tile; for each adjacent wall tile that separates the corridor from a walkable tile (floor/mineable/corridor/stairs), convert that wall to floor — effectively punching a doorway through thin room-perimeter walls.
8. **Pressure plate puzzle implemented** — New `pressure_plate` and `blocked` tile types. 25% chance per floor (depth 1+) to place a puzzle room: a pressure plate linked to a blocked barrier. Stepping on the plate converts the paired blocked tile to floor. Adds visual indicators (green circle on plate, stone slab with X on blocker).
9. **Basic audio system added** — `AudioSystem.ts` using Web Audio API to generate sounds programmatically (no asset files). Sounds: mine_hit (percussive square wave), item_pickup (ascending sine chime), stairs (sine sweep up/down), step (noise burst), combat hit/miss, victory (ascending arpeggio). Initialized in BootScene, wired into ExpeditionScene (mining, movement, stairs, events, combat) and HomelandScene (movement).
10. **Player sprite direction fixed** — `updatePlayerSprite()` now uses `isUpFacing = facingY < 0 || (facingY === 0 && facingX < 0)` to correctly map LEFT direction to `player_top_right` flipped. Facing change triggers sprite update immediately.
11. **Multi-plate puzzle redesign** — Replaced single-plate+blocker puzzle with N-plate (3–5) rooms. All plates must be stepped on to spawn `stairs_down` in the puzzle room. Mining does not spawn stairs on puzzle floors. Placed via `placePuzzle()` with min Manhattan distance 3 between plates.


## Feature Requests
1. Balancing mining node types each floors
    - Floor 0: max 1 bronze node
    - Floor 1: max 2 bronze node
    - Floor 2: max 3 bronze node
    - Floor 4: max 4 bronze node
    - Floor 5: max 5 bronze node, 1 silver node
    - Floor 6: max 6 bronze node, 2 silver node
    - Floor 7: max 7 bronze node, 3 silver node
    - Floor 10: max 10 bronze node, 5 silver node, 1 gold node
    - Floor 15: max 15 bronze node, 10 silver node, 5 gold node
2. Additional 2 mode of movements to support mobile: 
    - Click tiles to move (using pathfinding) 
    - Virtual analog
3. Make result screen more satisfying by showing the item qty gradually
6. Combat revamp:
    - Show player stamina as gauge during combat
    - Show enemy sprite
    - Randomize hit box location on every successful hit
    - Do not reset the pointer location on hit/miss, should continue moving
7. Elevator
    - Enable player to go directly to floor 0 / 5 / 10 / 15 / 20 once player descended to that floor once in expedition setup menu

