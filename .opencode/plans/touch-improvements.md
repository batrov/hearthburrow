# Plan: Touch Improvements Sprint

## Files to Modify
- `src/scenes/ExpeditionScene.ts` — analog direction, click-to-face/interact
- `src/scenes/HomelandScene.ts` — analog direction, building click interactions
- `src/ui/InventoryPanel.ts` — clickable item rows
- `src/ui/CraftingPanel.ts` — clickable recipe rows, description update
- `src/ui/TradePanel.ts` — clickable trade rows
- `src/ui/ResearchPanel.ts` — clickable research rows

---

### 1. 8-Directional Analog (ExpeditionScene:884–890, HomelandScene:339–345)

Replace `|dx| > |dy|` axis-dominant fallback with quadrant-based:

```
dx > 0 && dy < 0 → UP
dx < 0 && dy < 0 → LEFT
dx > 0 && dy > 0 → RIGHT
dx < 0 && dy > 0 → DOWN
pure dx → horizontal
pure dy → vertical
```

### 2. Click-to-Face (ExpeditionScene `doClickToMove`, ~line 934)

After computing grid `g.x, g.y` and the tile:
1. Compute `fdx = Math.sign(g.x - playerX)`, `fdy = Math.sign(g.y - playerY)`
2. If both differ, snap to dominant axis (same rule as keyboard movement)
3. Set `this.facingX/Y`, call `updatePlayerSprite()` + `updateFacingHighlight()`
4. If tile is interactive (blocked / stairs / plate / event) → face + return (no pathfind)
5. If tile is walkable → pathfind to it (facing updates during movement ticks)

### 3. Click-to-Interact (ExpeditionScene `pointerup` handler, ~line 916)

Before falling through to `doClickToMove`:
1. Convert click `worldX/worldY` to grid via `isoToGrid`
2. If it's the tile in front of the player (`playerX + facingX, playerY + facingY`) AND is interactive:
   - Ore → call `tryMine()`
   - Enemy/boss → call `startCombat()` / `triggerTileEvent()`
   - Event → call `triggerTileEvent()`
   - Return early (don't pathfind)
3. Otherwise fall through to existing `doClickToMove`

### 4. Clickable UIs

**InventoryPanel** — In `buildItemList()` or `draw()`, after rendering text lines, create a transparent `Phaser.GameObjects.Zone` at `(480, 80 + i * 20, 860, 20)` for each row. Set interactive, listen for `pointerdown` → `handleInput('SPACE')`. Store clickZones in array, destroy on each redraw.

**CraftingPanel** — Same pattern in `renderContent()`: `this.scene.add.zone(...)` over each recipe line. `pointerdown` sets `selectedIndex = i`, calls `craftSelected()`. Destroyed/rebuild with `this.recipeLines`.

**TradePanel + ResearchPanel** — Same zone-over-row approach. `pointerdown` → `confirm()`. Each row gets a `Rectangle` interactive zone during `render()`, tracked in an array, destroyed on each re-render.
