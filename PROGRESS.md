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
| Trading Post | 🟡 | Building zone exists, interaction stub, no NPC |
| Laboratory | 🟡 | Building zone exists, interaction stub, no NPC |
| Villager House (Housing) | ✅ | Restorable; grants +20 max stamina |
| Farm | 🟡 | Building zone defined, restoration not wired |
| Decorative Structures | ❌ | Not planned for MVP |

---

## 2. NPCs (GDD §3)

| NPC | Status | Notes |
|-----|--------|-------|
| Merchant | ❌ | Not implemented |
| Researcher | ❌ | Not implemented |
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
| Inventory (slot-based, 16 base) | ✅ | Expandable to 24 via Storage building |
| Equipment: Pickaxe (3 tiers) | ✅ | Run-based durability (tier 1 infinite, tiers 2-3 = 5 runs) |
| Equipment: Rings (slots 1 & 2) | ❌ | Not implemented |
| Equipment: Boots | ❌ | Not implemented |
| Equipment: Lantern | ❌ | Not implemented |
| Consumable usage | ✅ | [Q] Stamina Potion, [E] Teleport Scroll, [F] Mining Bomb |
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
| Optional combat | ❌ | Not implemented |
| Timing-based interaction | ❌ | Not implemented |
| Ring effects | ❌ | Data exists but unused |
| Boss fights | ❌ | Not implemented |
| Monster drops | 🟡 | `monster_drop` resource exists but no enemy to drop it |

---

## 7. Progression (GDD §8)

| Feature | Status | Notes |
|---------|--------|-------|
| Homeland restoration | ✅ | Building restoration with material costs |
| Recipe discovery | ✅ | 5 recipes, discovery triggers via events/milestones |
| Rescued villagers | ❌ | Event exists but no persistent tracking |
| Relics | 🗑️ | Data file loaded but no gameplay integration |
| Building unlocks | 🟡 | Crafting Station & Storage unlockable; others stubs |
| Permanent stat upgrades | ✅ | Max stamina (+20 from housing) and inventory slots (+8 from storage) |
| Temporary run buffs | ❌ | No shrine/consumable buff system |

---

## 8. Crafting & Economy (GDD §9)

| Feature | Status | Notes |
|---------|--------|-------|
| Discovery-based crafting | ✅ | Recipes unlock via events and milestones |
| Recipe selection with W/S + SPACE | ✅ | Crafting panel now uses selectable list |
| 6 resource types | ✅ | Stone, Copper, Silver, Gold, Crystal, Monster Essence |
| 3 pickaxe recipes | ✅ | Common (default), Copper (craftable), Silver (discovered) |
| 3 consumable recipes | ✅ | Stamina Potion, Teleport Scroll, Mining Bomb |
| Farming system | ❌ | Farm building data exists, no production logic |
| Trading/buying | 🟡 | Wandering Trader event trades resources; no persistent economy |
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
Inventory | ✅ | Slot-based, expandable
Extraction | ✅ | Safe (0%) and emergency (30%)
One boss | ❌ | Not implemented
One puzzle type | ❌ | Not implemented
Two random events | ✅ | Five events implemented (exceeds MVP)
Crafting station | ✅ | Operational
Storage | ✅ | Operational
One villager house | ✅ | Restorable, grants stamina bonus
Three pickaxe tiers | ✅ | Common, Copper, Silver
Stamina upgrades | ✅ | Via housing restoration
Limited recipes | ✅ | 5 recipes with discovery triggers

---

## Known Bugs & Issues

1. **MiningSystem.requiredTier() bug** — checks `"copper"` / `"silver"` / `"gold"` (no `_ore` suffix), but DungeonGenerator uses `"copper_ore"` / `"silver_ore"` / `"gold_ore"`. Not currently triggered because `requiredTier()` is never called from ExpeditionScene.
2. **DataRegistry loads files unused by gameplay** — `rooms.json`, `relics.json`, `events.json` are loaded but the active game code uses hardcoded data structures instead.
