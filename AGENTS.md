# AGENTS.md - Engineering Guide for Hearthburrow

This document provides the critical technical context, operational standards, and architectural constraints required for autonomous agents to contribute to the Hearthburrow codebase safely and efficiently.

## 🚀 Quick Start

### Essential Commands
- **Development**: `npm run dev` — Launches the Vite development server.
- **Verification**: `npm run build` — Runs `tsc` for type-checking and builds the project. **Always run this before concluding a task.**
- **Production**: `npm run preview` — Previews the production build.

---

## 🎨 Rendering & Depth SOP (The "Golden Rule")

To prevent render order bugs (e.g., enemies appearing behind walls), the following depth hierarchy **MUST** be strictly followed. Never use static depths for floor objects.

### Depth Layer Map
| Depth Range | Layer | Implementation | Notes |
| :--- | :--- | :--- | :--- |
| **4** | Base Terrain | `Graphics` | Floor and corridor diamonds. |
| **6 + `(x+y)*0.001`** | Interactive Objects | `Image` / `Graphics` | Walls, ores, enemies, plates. Must use the multiplier. |
| **7** | Selected Backdrop | `Graphics` | The dark diamond backing for facing highlights. |
| **8** | Player | `Image` | The player character. |
| **12** | Facing Highlight | `Graphics` | The white outline/glow around the selected object. |
| **48** | Darkness Overlay | `Graphics` | Visibility mask for dark floors. |
| **50 - 55** | HUD / Minimap | `Graphics` / `Text` | All fixed-screen UI elements. |
| **100+** | Popups / Prompts | `Container` | Interaction prompts and UI panels. |

### Implementation Detail: Painter's Algorithm
When rendering the dungeon, tiles **MUST** be sorted by their isometric sort key:
```typescript
tiles.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.x - b.x);
```
Every object added to the scene at depth 6 must use the formula `6 + (x + y) * 0.001` to interleave correctly with other objects on the same floor.

---

## 🗺️ Coordinate Systems

### Transformation Pipeline
1. **Grid Coordinates**: Integer `(x, y)` indices in the `DungeonFloor.tiles` array.
2. **Isometric Coordinates**: Calculated via `IsoUtils.gridToIso(x, y)`.
3. **Screen Coordinates**: Derived from Isometric coordinates relative to the camera (`cam.scrollX`, `cam.scrollY`).

### Core Constants (`IsoUtils.ts`)
- `TILE_W = 80`, `TILE_H = 40`
- `HALF_W = 40`, `HALF_H = 20`
- `WALL_HEIGHT = 20`

---

## 📷 Dual-Camera System (ExpeditionScene)

`ExpeditionScene` uses a **dual-camera setup** to render the game world at 1.5× zoom while keeping HUD at 1.0×:

### Camera Setup
```typescript
// Main camera: world rendering at 1.5×, follows player
this.cameras.main.setZoom(1.5);
this.cameras.main.startFollow(this.player, true, 0.5, 0.5);

// HUD camera: fixed viewport at 1.0×, transparent, no follow
this.hudCam = this.cameras.add(0, 0, 960, 640, false, 'hud');
this.hudCam.setZoom(1);
```

### Object Routing Rules
1. **World objects** (tiles, player, enemies, interactives, darkness, effects, particles): `this.hudCam.ignore(obj)`
2. **HUD objects** (minimap, stamina, pickaxe, buttons, popups, overlays, prompts): `this.cameras.main.ignore(obj)`

### Key Implementation Details
- `Camera.ignore()` sets a bitmask (`cameraFilter`) checked at render time — `(cameraFilter & camera.id) !== 0` means **excluded from that camera**
- Main camera has `id = 1` (bit 0), HUD camera has `id = 2` (bit 1)
- Objects created at runtime (popups, particles, item fly sprites) must get appropriate `ignore()` at creation time
- Item fly sprites transition from world space → screen space: start with `hudCam.ignore()`, then add `cameras.main.ignore()` in `flySpriteToBackpack()` when `setScrollFactor(0)` is applied
- **`HomelandScene`** uses full dual-camera (hudCam for analog stick + gate panel), same pattern as ExpeditionScene
- **`TavernScene`** uses dual-camera (hudCam for terrains/walls/player/NPCs, main Cam ignore for HUD text + greeting overlay + obtain popup + photobook panel + analog stick)
- **Missable gotcha**: World-space UI elements at fixed screen coords (e.g. `this.add.text(940, 620, ...)`) need **both** `setScrollFactor(0)` AND `cameras.main.ignore()` — otherwise they render at wrong positions under 1.5× zoom or appear in both cameras
- **Greeting overlay and obtain popups** are HUD objects despite being created at runtime in method calls — must get `setScrollFactor(0)` + `cameras.main.ignore()` at creation, not just `hudCam.ignore()`
- The zoom persists across `rebuildFloor()` calls (doesn't need re-setting after `stopFollow/startFollow`)

### ⚠️ Phaser 4 Camera Notes
- `cameraFilter` property on GameObjects is **not for direct manipulation** — always use `Camera.ignore()` which properly sets the bitmask
- `Camera.transparent` defaults to `true` (no need to set it explicitly)
- `clearBeforeRender` is **readonly** at the Game config level — not per-camera
- Camera ordering: first camera in `this.cameras.cameras[]` array renders first. The HUD camera is added after the main camera and renders on top since it doesn't clear the buffer

---

## 📦 State & Persistence

### State Management
- **Singleton**: All persistent data resides in the `gameState` singleton (`src/systems/GameState.ts`).
- **Persistence**: Data is saved to `localStorage` using the key `hearthburrow_save`.
- **Workflow**: 
    - Call `gameState.save()` after any permanent change (e.g., crafting, building restoration).
    - Call `gameState.load()` during scene initialization.

### Research System
Tiered upgrades are tracked via `researchLevels: Record<string, number>`. Costs and bonuses should scale based on the current level of the specific project ID.

---

## ⌨️ UI & Interaction Standards

### Navigation Pattern
All custom panels (Inventory, Crafting, Research, etc.) must implement the following keyboard interaction model:
- **Selection**: `W` / `UP` (Previous), `S` / `DOWN` (Next).
- **Confirmation**: `SPACE` (Use / Confirm / Select).
- **Special Action**: `Z` (Trash / Discard).
- **Exit**: `ESC` or `TAB` (Close / Hide).

---

## 🛠️ Dungeon Generation Pipeline

When modifying `DungeonGenerator.ts`, follow this sequence to maintain floor connectivity and balance:
1. **Carving**: Create rooms $\rightarrow$ Stitch corridors $\rightarrow$ Run `fixCorridorEntries()` to punch doorways.
2. **Special Rooms**: Place Boss, Vault, Puzzle, and Relic chambers.
3. **Population**: Populate rooms with ores $\rightarrow$ Apply `getFloorCaps(depth)` to demote excess ores (Gold $\rightarrow$ Silver $\rightarrow$ Bronze $\rightarrow$ Stone).
4. **Events**: Place random events from the `EVENT_POOL`.
5. **Extraction**: Determine `stairs_down` location (standard or boss-drop).

---

## ⚠️ Critical Warnings

- **Memory Leaks**: Any `Image` or `Graphics` object added to the scene during `drawInteractiveTiles` **MUST** be tracked in a cleanup array (e.g., `floorObjects` or `enemySprites`) and explicitly `destroy()`-ed before the next redraw.
- **Edit Safety**: When editing large functions in `ExpeditionScene.ts`, ensure the entire function block is replaced to avoid duplicating the function body, which causes catastrophic syntax errors.
- **Type Safety**: Always run `npm run build` to catch TypeScript errors that may not be apparent in the editor.
- **Phaser 4 Masking**: The custom `enableFilters().filters!.internal.addMask()` system is **broken for `Phaser.Container`** — child objects added to a masked container will not render. Always add UI text/images directly to the scene (`this.add.text(...)`) instead of to a container with a mask. The mask/clip behavior for scrollable content is non-functional; skip it and render directly.
- **Phaser 4 Container Input — DO NOT USE `setInteractive()` ON CONTAINER CHILDREN.**
  **Problem**: `setInteractive()` on any child (Graphics, Rectangle, Text, Image, Zone) that is then added to a `Phaser.GameObjects.Container` via `container.add()` does **not reliably fire** `pointerdown`/`pointerup` events. The input system registers the child for hit-testing (`hitTestPointer` still finds it, so `isPointerOverUI()` works), but event dispatch to the child's `on('pointerdown', ...)` callback is broken. This means clicks appear to do nothing.

  **Symptoms:**
  - Clicking a button inside a panel does nothing (no callback fires).
  - Keyboard navigation still works (it bypasses the input system).
  - `hitTestPointer` may still find the object, so `isPointerOverUI()` returns true (absorbing clicks in AnalogStickInput), making the panel feel "dead to clicks."
  - Clicks on transparent zones pass through to the scene below (click-to-move, building activation).

  **THE CORRECT PATTERN (scene-level handler):**
  1. Add a transparent `Rectangle` blocker to the container with `setInteractive()` — this ensures `hitTestPointer` finds it so `isPointerOverUI()` blocks scene clicks. Its own `pointerdown` handler is empty (`() => {}`).
  2. Register a scene-level `scene.input.on('pointerdown', handler)` in `show()` and remove it in `off('pointerdown', handler)` in `hide()`.
  3. The handler manually hit-tests each interactive element using `element.getBounds().contains(pointer.x, pointer.y)`.
  4. Clicks outside the popup bounds call `this.hide()`.

  ```typescript
  // CONSTRUCTOR — create elements without setInteractive, add a blocker
  this.blocker = scene.add.rectangle(480, 320, 960, 640, 0x000000, 0)
    .setScrollFactor(0).setInteractive().setData('isUI', true);
  this.blocker.on('pointerdown', () => {});
  this.container.add(this.blocker);

  // Rows/buttons — just positional markers, no setInteractive
  const zone = scene.add.rectangle(x, y, w, h, 0xffffff, 0).setScrollFactor(0);
  zone.setVisible(false);
  this.container.add(zone);

  // show() — register scene-level handler
  this.clickHandler = (p: Phaser.Input.Pointer) => {
    // Outside popup? Close it.
    if (p.x < popX || p.x > popX + popW || p.y < popY || p.y > popY + popH) {
      this.hide();
      return;
    }
    // Hit-test each interactive zone
    for (let i = 0; i < this.rows.length; i++) {
      const b = this.rows[i].zone.getBounds();
      if (b.contains(p.x, p.y)) { this.selectItem(i); return; }
    }
  };
  this.scene.input.on('pointerdown', this.clickHandler);

  // hide() — clean up handler
  if (this.clickHandler) {
    this.scene.input.off('pointerdown', this.clickHandler);
    this.clickHandler = null;
  }
  ```

  **Exception**: The `BasePanel.addCloseButton()` method places its hitZone Rectangle as a direct scene child (NOT in the container), so traditional `setInteractive()` works there. Follow that pattern for any element that must be outside the container.

  **Audit checklist** (run after any new UI panel or popup):
  - [ ] Does the panel have a `Container` that holds interactive children?
  - [ ] Does any child call `.setInteractive()` before/after `container.add()`?
  - [ ] If yes, remove `setInteractive()` + `on('pointerdown')` from the child, add a blocker, and use a scene-level handler.

### ⚠️ Phaser 4 Same-Frame Show/Hide Conflict ("Blinking Popup")

**Problem**: When a scene-level `pointerdown` handler shows a popup (e.g., `confirmPopup.show()`), and that popup has its own scene-level "outside-click → hide" handler, **both handlers fire in the same frame**. The show handler fires first, then the hide handler immediately closes it (because the click point is outside the popup bounds). The popup appears to "blink" or does nothing.

```
Frame N (pointerdown at escape-button coords):
  1. Escape-btn handler → confirmPopup.show()          ← popup visible
  2. ConfirmPopup clickHandler → "outside popup?" → YES → hide()  ← popup gone
  Result: user sees nothing (or a 1-frame flash)
```

**Solution — defer show to the next frame**:
Use `this.time.delayedCall(0, ...)` to defer `show()` to the next timestep. This ensures all `pointerdown` handlers for the current click have finished before the popup appears:

```typescript
this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
  if (this.confirmPopup.isVisible()) return;
  const b = this.escapeSprite.getBounds();
  if (b.contains(p.x, p.y)) {
    const hasScroll = this.inventory.count('teleport_scroll') > 0;
    this.time.delayedCall(0, () => {
      this.confirmPopup.show(
        hasScroll ? 'Use Teleport Scroll?' : 'Give Up?',
        hasScroll ? 'Return to Homeland safely.\nAll items kept.' : 'Emergency teleport home.\nYou will lose some items.',
        () => { /* confirm callback */ },
      );
    });
  }
});
```

Frame N:
  1. Escape-btn handler → this.time.delayedCall(0, showFn)   ← scheduled, not yet run
  2. ConfirmPopup clickHandler → popup not visible yet → no-op
Frame N+1 (timer fires):
  3. showFn() → confirmPopup.show()                           ← popup stays visible

**Key insight**: The `delayedCall(0)` moves the `show()` out of the current input processing batch into the next idle frame. This is the standard fix anytime a scene-level `pointerdown` handler triggers a popup that has its own outside-click-hide logic.

**Symptoms of this bug:**
- Button appears to blink/flash when clicked
- Click seems to do nothing (show + hide in same frame = no visible change)
- Works on keyboard (ESC key) but not on click — because keyboard handlers run in `update()`, not during input processing

**Exception**: If the popup doesn't have an outside-click-hide handler (e.g., it's a notification that auto-dismisses), the `delayedCall` is not needed.

---

# Hearthburrow Development Workflow

## PROGRESS.md Updates

Update PROGRESS.md when user gives **positive feedback** on a completed change
(e.g., "lgtm", "looks good", "perfect", "nice", "done", "works", "great", etc.):

1. Mark the feature as ✅ (implemented) or update its status row
2. Cross-reference GDD.md — if the feature matches a GDD section, update that too
3. Remove from "Known Bugs & Issues" if the bug was fixed
4. Move from "In Progress" to "Completed" in the anchored summary section
5. Compact the session to save context window

## GDD.md Updates

Update GDD.md when the user requests an **ad-hoc change** that is a fundamental
design change not already described in the GDD:

1. Add a new subsection under the relevant GDD section (e.g., §5 Player Systems)
2. If no existing section fits, add it under a new numbered section at the end
3. Keep descriptions concise but capture: what, why, key constraints
4. ⚠️ Do NOT modify GDD sections that describe already-implemented features
   unless the user explicitly asks to redesign them

## General Rules

- Always read PROGRESS.md before starting new work to understand current state
- When implementing a feature from GDD, add it to PROGRESS.md if not already there
- Keep PROGRESS.md bug list current — add new bugs as they're discovered
- When resolving a bug, move it from "Known Bugs & Issues" to "Resolved Bugs"
  with a brief description of the fix
- Mark partially implemented features as 🟡 until fully done
- Update PROGRESS.md immediately after positive feedback
- Always ask for any uncertainties
- Give multiple options for the possible actions on uncertainties
- Commit git changes on every positive feedbacks
- Plan for next milestones once every commit

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tools** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them. `codegraph_node` returns one symbol's source + callers, or reads a whole file with line numbers. If the tools are listed but deferred, load them by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` and `codegraph node <symbol-or-file>` print the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
