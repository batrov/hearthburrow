import Phaser from 'phaser';

export const TILE_W = 80;
export const TILE_H = 40;
export const HALF_W = 40;
export const HALF_H = 20;
export const WALL_HEIGHT = 30;

export function gridToIso(x: number, y: number): { x: number; y: number } {
  return {
    x: (x - y) * HALF_W,
    y: (x + y) * HALF_H,
  };
}

export function tileSortKey(x: number, y: number): number {
  return x + y;
}

export function drawDiamond(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  color: number, alpha?: number,
  strokeColor?: number,
  strokeAlpha?: number,
): void {
  g.fillStyle(color, alpha ?? 1);
  g.beginPath();
  g.moveTo(cx, cy - HALF_H);
  g.lineTo(cx + HALF_W, cy);
  g.lineTo(cx, cy + HALF_H);
  g.lineTo(cx - HALF_W, cy);
  g.closePath();
  g.fill();
  if (strokeColor !== undefined) {
    g.lineStyle(1, strokeColor, strokeAlpha ?? 0.3);
    g.strokePath();
  }
}

export function drawDiamondAt(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number,
  color: number, alpha?: number,
  strokeColor?: number,
  strokeAlpha?: number,
): void {
  const p = gridToIso(x, y);
  drawDiamond(g, p.x, p.y, color, alpha, strokeColor, strokeAlpha);
}

export function drawExtrudedTile(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  topColor: number,
  leftColor: number,
  rightColor: number,
  height: number = WALL_HEIGHT,
): void {
  const hw = HALF_W;
  const hh = HALF_H;

  const Wx = cx - hw, Wy = cy;
  const Sx = cx, Sy = cy + hh;
  const Ex = cx + hw, Ey = cy;

  const Wx_t = cx - hw, Wy_t = cy - height;
  const Sx_t = cx, Sy_t = cy + hh - height;
  const Ex_t = cx + hw, Ey_t = cy - height;

  g.fillStyle(leftColor, 1);
  g.beginPath();
  g.moveTo(Wx, Wy);
  g.lineTo(Sx, Sy);
  g.lineTo(Sx_t, Sy_t);
  g.lineTo(Wx_t, Wy_t);
  g.closePath();
  g.fill();

  g.fillStyle(rightColor, 1);
  g.beginPath();
  g.moveTo(Sx, Sy);
  g.lineTo(Ex, Ey);
  g.lineTo(Ex_t, Ey_t);
  g.lineTo(Sx_t, Sy_t);
  g.closePath();
  g.fill();

  g.fillStyle(topColor, 1);
  g.beginPath();
  g.moveTo(cx, cy - hh - height);
  g.lineTo(cx + hw, cy - height);
  g.lineTo(cx, cy + hh - height);
  g.lineTo(cx - hw, cy - height);
  g.closePath();
  g.fill();
}

export function drawExtrudedAt(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number,
  topColor: number,
  leftColor: number,
  rightColor: number,
  height?: number,
): void {
  const p = gridToIso(x, y);
  drawExtrudedTile(g, p.x, p.y, topColor, leftColor, rightColor, height);
}

export function worldWidth(cols: number, rows: number): number {
  return (cols + rows) * HALF_W;
}

export function worldHeight(cols: number, rows: number): number {
  return (cols + rows) * HALF_H;
}
