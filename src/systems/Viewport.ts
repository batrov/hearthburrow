let _vw = 390;
let _vh = 844;

/** Current logical viewport width. Always re-read live — never cache across a resize boundary. */
export function VW(): number { return _vw; }
/** Current logical viewport height. Always re-read live — never cache across a resize boundary. */
export function VH(): number { return _vh; }
/** Current logical viewport horizontal center. */
export function CX(): number { return _vw / 2; }
/** Current logical viewport vertical center. */
export function CY(): number { return _vh / 2; }

/** Fixed design padding — not viewport-dependent. */
export const PANEL_PAD = 16;

export function OVERLAY_W(): number { return _vw - PANEL_PAD * 2; }
export function OVERLAY_H(): number { return _vh - PANEL_PAD * 2; }

/** Internal — called only by ViewportManager. Do not call from scenes/UI. */
export function __setViewportSize(w: number, h: number): void {
  _vw = w;
  _vh = h;
}

/** Distance from the bottom edge of the current viewport. */
export function anchorBottom(offsetFromBottom: number): number { return _vh - offsetFromBottom; }
/** Distance from the right edge of the current viewport. */
export function anchorRight(offsetFromRight: number): number { return _vw - offsetFromRight; }

// The bottom-center action button (ExpeditionScene, HomelandScene, TavernScene)
// is always centered at (CX(), anchorBottom(ACTION_BTN_BOTTOM_OFFSET)) with the
// same 64px glow box — shared here so the three scenes' formulas can't drift.
export const ACTION_BTN_SIZE = 64;
export const ACTION_BTN_BOTTOM_OFFSET = 90;

export function actionButtonCenter(): { x: number; y: number } {
  return { x: _vw / 2, y: _vh - ACTION_BTN_BOTTOM_OFFSET };
}

export function actionButtonGlowBoxTopLeft(): { x: number; y: number } {
  const c = actionButtonCenter();
  return { x: c.x - ACTION_BTN_SIZE / 2, y: c.y - ACTION_BTN_SIZE / 2 };
}
