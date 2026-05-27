export class ExpeditionState {
  depth: number;

  constructor() {
    this.depth = 0;
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
  }
}
