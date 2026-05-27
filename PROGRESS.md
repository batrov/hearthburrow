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
| Crafting Station | ✅ | Operational; opens CraftingPanel |
| Storage | ✅ | Operational; opens InventoryPanel |
| Trading Post | ✅ | Restorable; opens TradePanel with buy/sell using gold_ore |
| Laboratory | ✅ | Restorable; opens ResearchPanel with permanent upgrades |
| Villager House (Housing) | ✅ | Restorable; grants +20 max stamina |
| Farm | ✅ | Restorable; plant carrots, harvest carrots after expeditions |
| Decorative Structures | ❌ | Not planned for MVP |

---

## 2. NPCs (GDD §3)

| NPC | Status | Notes |
|-----|--------|-------|
| Merchant | ✅ | Trading Post restored; buy consumables with gold, sell materials for gold |
| Researcher | ✅ | Laboratory restored; spend crystals + ores for permanent stat upgrades |
| Villagers | 🟡 | Rescue events exist but no persistent NPC system |

---

## 3. Dungeon Generation (GDD §4)

| Feature | Status | Notes |
|---------|--------|-------|
| Procedural rooms (3-5 per floor) | ✅ | Hand-carved room algorithm with L-corridors |
| Room templates from data | 🗑️ | `rooms.json` loaded but not used |
| 5 biomes | 🟡 | Only Forest implemented |
| 8 room types | 🟡 | Only standard mining rooms; no puzzle/merchant/shrine/vault/boss/relic rooms |
| Random events (5 types) | ✅ | All 5 hardcoded in `buildEventConfig()` |
| Depth-scaled ore distribution | ✅ | `pickResource(depth)` with weighted probabilities |
| Stairs up/down | ✅ | Depth tracking via ExpeditionState |

---

## 4. Player Systems (GDD §5)

| Feature | Status | Notes |
|---------|--------|-------|
| Stamina System | ✅ | Movement (2), Mining (5); consumed **after** action |
| Exhaustion = emergency extract | ✅ | 30% loss, red shake overlay |
| Emergency Escape (ESC) | ✅ | "Give Up", 30% loss, orange overlay |
| Safe extraction via stairs_up | ✅ | Automatically at depth 0; 0% loss |
| Inventory (slot-based, 16 base) | ✅ | Per-unit-per-slot in dungeon, stacked in homeland; over-capacity overflow with forced management |
| Equipment: Pickaxe (3 tiers) | ✅ | Run-based durability (tier 1 infinite, tiers 2-3 = 5 runs) |
| Equipment: Rings (slots 1 & 2) | ✅ | 4 ring types (Critical, Damage, Precision, Hunter); effects applied in combat |
| Equipment: Boots | ❌ | Not implemented |
| Equipment: Lantern | ❌ | Not implemented |
| Consumable usage | ✅ | [Q] Stamina Potion, [E] Teleport Scroll, [F] Mining Bomb; also via inventory panel [SPACE] |
| Inventory management | ✅ | Interactive panel with W/S select, [Z] trash, [SPACE] use; available in dungeon and homeland storage |
| Consumable loadout | ✅ | Gate panel tab 3: select potions/scrolls/bombs from storage before descending |
| Turn-based grid movement | ✅ | 150ms delay, 4-direction, no diagonals |

---

## 5. Mining System (GDD §6)

| Feature | Status | Notes |
|---------|--------|-------|
| Tile durability | ✅ | Per-tile HP, resource-specific |
| Pickaxe tier progression | ✅ | Tier 1 → 2 → 3 |
| Mining particles | ✅ | Color-coded by ore type |
| Hit flash effect | ✅ | White flash on every hit |
| Item popup on break | ✅ | Floating "+1 Stone" text |
| Durability cracks visual | ✅ | Dark overlay (<66%), cross cracks (<33%) |
| Tile required tier | 🗑️ | `MiningSystem.requiredTier()` never called by ExpeditionScene |

---

## 6. Combat System (GDD §7)

| Feature | Status | Notes |
|---------|--------|-------|
| Optional combat | ✅ | Enemy tiles placed on floors; triggered via SPACE when adjacent; non-blocking to exploration |
| Timing-based interaction | ✅ | Oscillating marker with green hit zone; SPACE to strike; ESC to retreat |
| Ring effects | ✅ | Critical (double damage), Damage (+1), Precision (wider zone), Hunter (double loot) |
| Boss fights | ✅ | Floor 3, 7, 11, ... (every 4 floors); single large room; Forest Guardian (5 HP); no stairs_down until defeated |
| Monster drops | ✅ | Slime, Rat, Bat enemies drop `monster_drop` + ore; boss drops gold_ore + crystal |

---

## 7. Progression (GDD §8)

| Feature | Status | Notes |
|---------|--------|-------|
| Homeland restoration | ✅ | Building restoration with material costs |
| Recipe discovery | ✅ | 5 recipes, discovery triggers via events/milestones |
| Rescued villagers | 🟡 | Event exists but no persistent tracking |
| Relics | 🗑️ | Data file loaded but no gameplay integration |
| Building unlocks | ✅ | All 4 buildings restorable (housing, trading_post, laboratory, farm); each unlocks distinct gameplay |
| Permanent stat upgrades | ✅ | Max stamina (+20 from housing) and inventory slots (+8 from storage) |
| Temporary run buffs | ✅ | Ring effects applied per run; consumables provide on-demand effects |

---

## 8. Crafting & Economy (GDD §9)

| Feature | Status | Notes |
|---------|--------|-------|
| Discovery-based crafting | ✅ | Recipes unlock via events and milestones |
| Recipe selection with W/S + SPACE | ✅ | Crafting panel now uses selectable list |
| 6 resource types | ✅ | Stone, Bronze, Silver, Gold, Crystal, Monster Essence |
| 3 pickaxe recipes | ✅ | Common (default), Bronze (craftable), Silver (discovered) |
| 3 consumable recipes | ✅ | Stamina Potion, Teleport Scroll, Mining Bomb |
| Farming system | ✅ | Farm restorable; plant carrots, harvest more carrots after each expedition |
| Trading/buying | ✅ | TradePanel at Trading Post: buy potions/scrolls/bombs with carrots, sell ore/essence for carrots |
| Research upgrades | ✅ | ResearchPanel at Laboratory: spend crystals + ores for +stamina and +inventory slots |
| Consumable usage during expedition | ✅ | [Q] Potion (restore 30 stam), [E] Scroll (safe extract), [F] Bomb (damage 8 surrounding tiles) |

---

## 9. Puzzle & Interaction (GDD §10)

| Feature | Status | Notes |
|---------|--------|-------|
| 5 event interactions | ✅ | Treasure, Fountain, Trader, Villager, Goblin |
| Event tiles require proximity + SPACE | ✅ | Checks 5 tiles around player |
| Event panel with W/S/SPACE navigation | ✅ | Navigate choices, confirm with SPACE |
| Pressure plates | ❌ | Not implemented |
| Pushable rocks | ❌ | Not implemented |

---

## 10. Art & Audio (GDD §11–12)

| Feature | Status | Notes |
|---------|--------|-------|
| Placeholder graphics (rectangles/shapes) | ✅ | Functional but placeholder |
| HD-2D pixel art | ❌ | Not started |
| Biome-specific tilesets | ❌ | Single dark dungeon aesthetic |
| Player sprite | ❌ | Blue rectangle |
| Item/event sprites | ❌ | Drawn via Graphics primitives |
| Audio / music | ❌ | Not started |
| Broken tile rendering | ✅ | Enemy and boss tiles revert to floor style when broken (no more black voids) |

---

## 11. Technical Architecture (GDD §13)

| Feature | Status | Notes |
|---------|--------|-------|
| Phaser 3 framework | ✅ | v3.80.1 |
| TypeScript | ✅ | Strict mode |
| Vite build | ✅ | Dev server + production build |
| Data-driven JSON files | 🟡 | 6 files exist but several are unused at runtime |
| Procedural generation | ✅ | Room carving, corridor stitching, event placement |
| Seed-based generation | ❌ | Not implemented (no seed, no replays) |
| Scene management | ✅ | Boot → Homeland → Expedition → Recap |
| Singleton game state | ✅ | `GameState` persists across scenes |
| Local storage persistence | ✅ | Auto-save on expedition finish, crafting, building restore; load on boot |

---

## 12. MVP Scope Compliance (GDD §15)

Requirement | Status | Notes
------------|--------|-------
Procedural rooms | ✅ | Handles 3-5 rooms per floor
Mining | ✅ | Complete with 3-tier progression
Stamina | ✅ | Movement + mining costs
Inventory | ✅ | Per-unit-per-slot in dungeon, over-capacity management, interactive panel
Extraction | ✅ | Safe (0%) and emergency (30%)
One boss | ✅ | Forest Guardian every 4 floors (depth 3, 7, 11, ...)
One puzzle type | ❌ | Not implemented
Two random events | ✅ | Five events implemented (exceeds MVP)
Crafting station | ✅ | Operational
Storage | ✅ | Operational with trash support
One villager house | ✅ | Restorable, grants stamina bonus
Three pickaxe tiers | ✅ | Common, Bronze, Silver
Stamina upgrades | ✅ | Via housing restoration
Limited recipes | ✅ | 5 recipes with discovery triggers

---

## Known Bugs & Issues

1. **MiningSystem.requiredTier() bug** — checks `"bronze"` / `"silver"` / `"gold"` (no `_ore` suffix), but DungeonGenerator uses `"bronze_ore"` / `"silver_ore"` / `"gold_ore"`. Not currently triggered because `requiredTier()` is never called from ExpeditionScene.
2. **DataRegistry loads files unused by gameplay** — `rooms.json`, `relics.json`, `events.json` are loaded but the active game code uses hardcoded data structures instead.
3. **Over-capacity panel hint flicker** — When inventory is exactly at capacity and an item is added to overflow, the panel auto-shows with `show()` tween each frame (mitigated by `!isVisible()` guard).

## Resolved Bugs

1. **Farm panel ESC not working** — `this.keys.X` was missing from `setupInput()` in HomelandScene; the `else if` chain threw TypeError at `JustDown(this.keys.X)` before reaching the ESC check. Fixed by adding `X: kb.addKey(...)` (line 277).
