# Plan: Replace Rendered Shapes with Static Assets

## Scope: Phases 1–3 (Interactive Objects + Terrain + Walls)

### Architecture Change
Current: `ExpeditionScene.ts` uses `Graphics` objects (`terrainSprites` @ depth 4, `objectSprites` @ depth 6) that draw shapes every frame.

Target: Use `Container` + `Image` objects with pre-baked textures from `TextureGenerator.ts`, each with individual depth for proper painter's algorithm sorting.

---

### Phase 1: Interactive Objects (Ores, Enemies, Events, Stairs, Plate, Blocked)

**All textures already exist** in `TextureGenerator.ts`. No texture generation changes needed.

**Changes in `ExpeditionScene.ts`**:

1. **Fields**: Rename `objectSprites: Graphics` → `objectSprites: Phaser.GameObjects.Container` in `create()`

2. **drawInteractiveTiles()** — Replace each shape-drawing case with `this.add.image(px, py, textureKey).setDepth(6 + (x + y) * 0.001)` added to the container:

   | Tile Type | Current (Graphics shape) | New (`this.add.image`) |
   |-----------|-------------------------|----------------------|
   | `mineable` (ore) | `drawOreIso(resource, dur, maxDur)` | `'ore_' + resource` + durability overlay images |
   | `enemy` | `drawEnemyTileIso(type)` | `'enemy_' + type` |
   | `event_boss` | `drawBossTileIso()` | `'enemy_boss'` |
   | `event_*` | `drawEventTileIso(type)` | `type` (texture key same as event ID) |
   | `stairs_up` | `fillTriangle` inline | `'stairs_up'` |
   | `stairs_down` | `fillTriangle` inline | `'stairs_down'` |
   | `pressure_plate` | `strokeCircle` + `fillCircle` inline | `'pressure_plate'` |
   | `blocked` | `fillRect` + `lineBetween` inline | `'blocked'` |

3. **drawOreIso** — Now only needs to create two overlay images on top of the ore base:
   - `overlay_damage` when `ratio <= 0.66`
   - `overlay_crack` when `ratio <= 0.33`
   - Each adds `this.add.image(px, py, key).setDepth(depth + 0.001)` to the container

4. **drawEnemyTileIso / drawBossTileIso / drawEventTileIso** — These functions are deleted. Texture lookup replaces their logic.

5. **Cleanup**: In `drawFloor()`, `rebuildFloor()`, and wherever `terrainSprites.clear()` and `objectSprites.clear()` are called, change to `this.objectSprites.removeAll(true)` (Container method that destroys children).

6. **Minimap**: In `drawMinimap()`, enemy/event dots currently use the shape-based existence check. No change needed since minimap uses `fillRect` dots by tile type, not by sprite.

### Phase 2: Terrain Floor Diamonds

**Nothing to change** — terrain can stay as Graphics for now. The performance bottleneck is the interactive objects (depth 6), not the terrain diamonds. The terrain is rendered once per floor and rarely changes.

Actually, let me reconsider — the user chose phases 1-3, and terrain is part of that. But terrain rendering uses `drawDiamondAt()` for each tile which draws colored diamonds. The textures for these don't exist yet.

**Simpler approach for terrain**: Keep the current Graphics-based terrain rendering (`terrainSprites @ depth 4`). The terrain is drawn once per floor load and uses a single Graphics object, so it's already relatively efficient. The main visual win is replacing the interactive objects.

**If we do want to replace terrain**:
- Add to `TextureGenerator.ts`: Generate floor textures per biome palette
   - `floor_FOREST_even`, `floor_FOREST_odd`, `floor_FOREST_corridor`
   - `floor_CAVE_even`, `floor_CAVE_odd`, `floor_CAVE_corridor`
   - etc. (5 biomes × 3 types = 15 textures)
- In `drawFloor()`, replace `drawDiamondAt(this.terrainSprites, ...)` with `this.add.image(px, py, textureKey).setDepth(4)`
- Change `terrainSprites` from Graphics to Container

### Phase 3: Walls

**Texture already exists** (`wall_BIOME` from `getWallTextureKey()`).

**Changes in `drawInteractiveTiles()`**:
- Replace `drawExtrudedAt(this.objectSprites, x, y, ...)` with:
  ```typescript
  this.add.image(px, py, getWallTextureKey(floor.depth))
    .setDepth(6 + (x + y) * 0.001)
  ```
- Add to the `objectSprites` container

---

### File Changes Summary

| File | Changes |
|------|---------|
| `src/scenes/ExpeditionScene.ts` | Rewrite `drawInteractiveTiles()`: 7 cases. Replace `drawOreIso`, `drawEnemyTileIso`, `drawBossTileIso`, `drawEventTileIso` functions. Change `objectSprites` to Container. Update cleanup in `drawFloor()`, `rebuildFloor()`. |
| `src/systems/TextureGenerator.ts` | (Optional) Add floor terrain textures for Phase 2. |

No changes needed to HomelandScene or any UI files.

### Verification
`npm run build` — must pass without errors.
