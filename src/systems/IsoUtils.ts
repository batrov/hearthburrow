import Phaser from 'phaser';

/** Tile width in pixels (isometric). */
export const TILE_W = 80;
/** Tile height in pixels (isometric). */
export const TILE_H = 40;
/** Half tile width. */
export const HALF_W = 40;
/** Half tile height. */
export const HALF_H = 20;
/** Height of wall extrusion. */
export const WALL_HEIGHT = 20;

/** Convert grid coordinates to isometric pixel coordinates. */
export function gridToIso(x: number, y: number): { x: number; y: number } {
  return {
    x: (x - y) * HALF_W,
    y: (x + y) * HALF_H,
  };
}

/** Convert isometric pixel coordinates back to grid coordinates. Inverse of gridToIso. */
export function isoToGrid(isoX: number, isoY: number): { x: number; y: number } {
  return {
    x: Math.round((isoX / HALF_W + isoY / HALF_H) / 2),
    y: Math.round((isoY / HALF_H - isoX / HALF_W) / 2),
  };
}

/** Painter's algorithm sort key: tiles with higher (x+y) render in front. */
export function tileSortKey(x: number, y: number): number {
  return x + y;
}

/** Draw an isometric diamond at a pixel position. */
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

/** Draw an isometric diamond at a grid position. */
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

/** Draw a 3D extruded tile (wall block) at a pixel position — top + left + right faces. */
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

/** Draw a 3D extruded tile at a grid position. */
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

/** Draw a cohesive building shape (roof + side walls) covering a gw×gh grid, centered in a w×h canvas. */
export function drawBuildingShape(
  g: Phaser.GameObjects.Graphics,
  w: number, h: number,
  gw: number, gh: number,
  topColor: number,
  leftColor: number,
  rightColor: number,
  height: number = WALL_HEIGHT,
): void {
  const cx = w / 2;
  const cy = h / 2;

  const bn = { x: cx + gh * 20, y: cy - gh * 10 };
  const bs = { x: cx - gh * 20, y: cy + gh * 10 };
  const bw = { x: cx - gw * 20, y: cy - gw * 10 };
  const be = { x: cx + gw * 20, y: cy + gw * 10 };

  const bn_t = { x: bn.x, y: bn.y - height };
  const bs_t = { x: bs.x, y: bs.y - height };
  const bw_t = { x: bw.x, y: bw.y - height };
  const be_t = { x: be.x, y: be.y - height };

  g.fillStyle(leftColor, 1);
  g.beginPath();
  g.moveTo(bw.x, bw.y);
  g.lineTo(bs.x, bs.y);
  g.lineTo(bs_t.x, bs_t.y);
  g.lineTo(bw_t.x, bw_t.y);
  g.closePath();
  g.fill();

  g.fillStyle(rightColor, 1);
  g.beginPath();
  g.moveTo(bs.x, bs.y);
  g.lineTo(be.x, be.y);
  g.lineTo(be_t.x, be_t.y);
  g.lineTo(bs_t.x, bs_t.y);
  g.closePath();
  g.fill();

  g.fillStyle(topColor, 1);
  g.beginPath();
  g.moveTo(bn_t.x, bn_t.y);
  g.lineTo(be_t.x, be_t.y);
  g.lineTo(bs_t.x, bs_t.y);
  g.lineTo(bw_t.x, bw_t.y);
  g.closePath();
  g.fill();
}

/** Compute world width in pixels for an isometric grid of given dimensions. */
export function worldWidth(cols: number, rows: number): number {
  return (cols + rows) * HALF_W;
}

/** Compute world height in pixels for an isometric grid of given dimensions. */
export function worldHeight(cols: number, rows: number): number {
  return (cols + rows) * HALF_H;
}

const DIRS = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];

/** BFS shortest path on a grid. Returns ordered array of steps or null if unreachable. */
export function findPath(
  startX: number, startY: number,
  endX: number, endY: number,
  cols: number, rows: number,
  isWalkable: (x: number, y: number) => boolean,
): { x: number; y: number }[] | null {
  if (startX === endX && startY === endY) return [];

  const visited = new Uint8Array(cols * rows);
  const parent = new Int16Array(cols * rows * 2);

  const queue: { x: number; y: number }[] = [{ x: startX, y: startY }];
  visited[startY * cols + startX] = 1;

  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    for (const d of DIRS) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (visited[ny * cols + nx]) continue;
      if (!isWalkable(nx, ny)) continue;
      visited[ny * cols + nx] = 1;
      parent[(ny * cols + nx) * 2] = cur.x;
      parent[(ny * cols + nx) * 2 + 1] = cur.y;
      if (nx === endX && ny === endY) {
        const path: { x: number; y: number }[] = [];
        let cx = nx, cy = ny;
        while (cx !== startX || cy !== startY) {
          path.push({ x: cx, y: cy });
          const px = parent[(cy * cols + cx) * 2];
          const py = parent[(cy * cols + cx) * 2 + 1];
          cx = px; cy = py;
        }
        return path.reverse();
      }
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}
