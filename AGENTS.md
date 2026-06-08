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
