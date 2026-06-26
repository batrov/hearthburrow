/** Tracks current and max stamina with consume/refill/upgrade operations. */
export class StaminaSystem {
  private current: number;
  private max: number;
  private _onChange?: (prev: number, current: number) => void;

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

  set onChange(cb: ((prev: number, current: number) => void) | null) {
    this._onChange = cb ?? undefined;
  }

  /** Spend stamina. Returns false if exhausted (stamina already 0). */
  consume(amount: number): boolean {
    const prev = this.current;
    if (this.current <= 0) return false;
    this.current = Math.max(0, this.current - amount);
    this._onChange?.(prev, this.current);
    return this.current > 0;
  }

  /** Whether stamina is at or below 0. */
  isExhausted(): boolean {
    return this.current <= 0;
  }

  /** Restore stamina without exceeding max. */
  refill(amount: number): void {
    const prev = this.current;
    this.current = Math.min(this.max, this.current + amount);
    this._onChange?.(prev, this.current);
  }

  /** Permanently increase max stamina and refill to new max. */
  upgradeMax(additional: number): void {
    const prev = this.current;
    this.max += additional;
    this.current = this.max;
    this._onChange?.(prev, this.current);
  }
}
