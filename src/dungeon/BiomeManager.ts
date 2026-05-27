export interface BiomeConfig {
  name: string;
  resourceTier: number;
  roomTypes: string[];
  eventPool: string[];
  bossId: string;
}

const BIOMES: Record<string, BiomeConfig> = {
  forest: {
    name: 'Forest',
    resourceTier: 1,
    roomTypes: ['standard', 'puzzle', 'merchant', 'shrine', 'villager', 'boss'],
    eventPool: ['wandering_trader', 'hidden_treasure', 'blessing_fountain'],
    bossId: 'forest_guardian',
  },
  cave: {
    name: 'Cave',
    resourceTier: 2,
    roomTypes: ['standard', 'puzzle', 'merchant', 'shrine', 'treasure', 'villager', 'boss'],
    eventPool: ['wandering_trader', 'gambling_goblin', 'hidden_treasure'],
    bossId: 'cave_worm',
  },
};

export class BiomeManager {
  getBiome(name: string): BiomeConfig | undefined {
    return BIOMES[name];
  }

  getAllBiomes(): BiomeConfig[] {
    return Object.values(BIOMES);
  }
}
