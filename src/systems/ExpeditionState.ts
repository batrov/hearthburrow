/** Tracks expedition depth and per-floor fog-of-war exploration grid. */
export class ExpeditionState {
  depth: number;
  explored: boolean[][];

  constructor() {
    this.depth = 0;
    this.explored = [];
  }

  initExplored(cols: number, rows: number): void {
    this.explored = [];
    for (let y = 0; y < rows; y++) {
      this.explored[y] = [];
      for (let x = 0; x < cols; x++) {
        this.explored[y][x] = false;
      }
    }
  }

  reveal(x: number, y: number, radius: number): void {
    if (this.explored.length === 0) return;
    const rows = this.explored.length;
    const cols = this.explored[0].length;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const rx = x + dx;
        const ry = y + dy;
        if (rx >= 0 && rx < cols && ry >= 0 && ry < rows) {
          this.explored[ry][rx] = true;
        }
      }
    }
  }

  descend(): void {
    this.depth++;
  }

  ascend(): void {
    if (this.depth > 0) {
      this.depth--;
    }
  }

  reset(): void {
    this.depth = 0;
    this.explored = [];
  }
}
