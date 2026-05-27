export interface TileData {
  x: number;
  y: number;
  durability: number;
  maxDurability: number;
  resource: string;
  broken: boolean;
}

export class MiningSystem {
  private pickaxeTier: number = 1;

  setPickaxeTier(tier: number): void {
    this.pickaxeTier = tier;
  }

  getDamage(): number {
    return this.pickaxeTier;
  }

  canMine(tile: TileData): boolean {
    return !tile.broken && this.pickaxeTier >= this.requiredTier(tile);
  }

  mine(tile: TileData): boolean {
    if (!this.canMine(tile)) return false;
    tile.durability -= this.getDamage();
    if (tile.durability <= 0) {
      tile.broken = true;
      return true;
    }
    return false;
  }

  private requiredTier(tile: TileData): number {
    if (tile.resource === 'stone') return 1;
    if (tile.resource === 'copper') return 1;
    if (tile.resource === 'silver') return 2;
    if (tile.resource === 'gold') return 3;
    return 1;
  }
}
