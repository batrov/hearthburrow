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

## ✅ UI Polish
- **Crafting panel**: 4-color recipe lines (crafted/craftable state) + persisted `craftedItems`
- **Inventory panel**: Description bar for selected item


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