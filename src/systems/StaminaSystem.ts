export class StaminaSystem {
  private current: number;
  private max: number;

  constructor(max: number = 100) {
    this.max = max;
    this.current = max;
  }

  get remaining(): number {
    return this.current;
  }

  get maxStamina(): number {
    return this.max;
  }

  get ratio(): number {
    return this.current / this.max;
  }

  consume(amount: number): boolean {
    if (this.current <= 0) return false;
    this.current = Math.max(0, this.current - amount);
    return this.current > 0;
  }

  isExhausted(): boolean {
    return this.current <= 0;
  }

  refill(amount: number): void {
    this.current = Math.min(this.max, this.current + amount);
  }

  upgradeMax(additional: number): void {
    this.max += additional;
    this.current = this.max;
  }
}
