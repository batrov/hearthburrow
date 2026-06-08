/** Tracks pickaxe tier and computes mining damage. */
export class MiningSystem {
  private pickaxeTier: number = 1;

  /** Set active pickaxe tier (1/2/3). */
  setPickaxeTier(tier: number): void {
    this.pickaxeTier = tier;
  }

  /** Mining damage per hit equal to pickaxe tier. */
  getDamage(): number {
    return this.pickaxeTier;
  }
}
