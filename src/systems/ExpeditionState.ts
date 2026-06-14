/** Tracks expedition depth and per-floor fog-of-war exploration grid. */
export class ExpeditionState {
  depth: number;
  explored: boolean[][];
  visible: boolean[][];

  constructor() {
    this.depth = 0;
    this.explored = [];
    this.visible = [];
  }

  initExplored(cols: number, rows: number): void {
    this.explored = [];
    this.visible = [];
    for (let y = 0; y < rows; y++) {
      this.explored[y] = [];
      this.visible[y] = [];
      for (let x = 0; x < cols; x++) {
        this.explored[y][x] = false;
        this.visible[y][x] = false;
      }
    }
  }

  reveal(x: number, y: number, radius: number): void {
    if (this.explored.length === 0) return;
    const rows = this.explored.length;
    const cols = this.explored[0].length;
    for (let ry = 0; ry < rows; ry++) {
      for (let rx = 0; rx < cols; rx++) {
        this.visible[ry][rx] = false;
      }
    }
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const rx = x + dx;
        const ry = y + dy;
        if (rx >= 0 && rx < cols && ry >= 0 && ry < rows) {
          this.explored[ry][rx] = true;
          this.visible[ry][rx] = true;
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
    this.visible = [];
  }
}
