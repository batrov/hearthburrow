import { InventorySystem } from './InventorySystem';

export interface RunResult {
  itemsObtained: { id: string; quantity: number }[];
  itemsLost: { id: string; quantity: number }[];
  extractType: 'safe' | 'emergency';
}

const ITEM_NAMES: Record<string, string> = {
  stone: 'Stone',
  copper_ore: 'Copper Ore',
  silver_ore: 'Silver Ore',
  gold_ore: 'Gold Ore',
  crystal: 'Crystal',
  monster_drop: 'Monster Essence',
  stamina_potion: 'Stamina Potion',
  teleport_scroll: 'Teleport Scroll',
  mining_bomb: 'Mining Bomb',
};

export function itemDisplayName(id: string): string {
  return ITEM_NAMES[id] ?? id.replace(/_/g, ' ');
}

class GameState {
  inventory: InventorySystem;
  lastRunResult: RunResult | null = null;

  constructor() {
    this.inventory = new InventorySystem(32);
  }
}

export const gameState = new GameState();
