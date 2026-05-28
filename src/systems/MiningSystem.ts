export class MiningSystem {
  private pickaxeTier: number = 1;

  setPickaxeTier(tier: number): void {
    this.pickaxeTier = tier;
  }

  getDamage(): number {
    return this.pickaxeTier;
  }
}
