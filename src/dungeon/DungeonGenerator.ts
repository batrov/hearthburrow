export interface RoomTemplate {
  id: string;
  type: 'standard' | 'puzzle' | 'merchant' | 'shrine' | 'treasure' | 'villager' | 'boss' | 'relic';
  width: number;
  height: number;
  tiles: number[][];
}

export interface DungeonFloor {
  rooms: RoomInstance[];
  grid: (string | null)[][];
}

export interface RoomInstance {
  templateId: string;
  type: string;
  gridX: number;
  gridY: number;
}

export class DungeonGenerator {
  generateFloor(seed: number, biome: string): DungeonFloor {
    // Procedural generation will be implemented here
    return { rooms: [], grid: [] };
  }
}
