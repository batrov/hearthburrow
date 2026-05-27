import { InventorySystem } from './InventorySystem';
import { CraftingSystem } from './CraftingSystem';

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
  pickaxe_1: 'Common Pickaxe',
  pickaxe_2: 'Copper Pickaxe',
  pickaxe_3: 'Silver Pickaxe',
};

export function itemDisplayName(id: string): string {
  return ITEM_NAMES[id] ?? id.replace(/_/g, ' ');
}

const MAX_PICKAXE_RUNS = 5;

class GameState {
  inventory: InventorySystem;
  crafting: CraftingSystem;
  lastRunResult: RunResult | null = null;
  restoredBuildings: Set<string>;
  currentPickaxeTier: number;
  maxStaminaBonus: number;
  inventorySlotBonus: number;
  pickaxeRuns: Record<number, number>;

  constructor() {
    this.inventory = new InventorySystem(32);
    this.crafting = new CraftingSystem();
    this.restoredBuildings = new Set();
    this.currentPickaxeTier = 1;
    this.maxStaminaBonus = 0;
    this.inventorySlotBonus = 0;
    this.pickaxeRuns = {};
  }

  remainingPickaxeRuns(tier?: number): number {
    const t = tier ?? this.currentPickaxeTier;
    if (t === 1) return Infinity;
    const used = this.pickaxeRuns[t] ?? 0;
    return Math.max(0, MAX_PICKAXE_RUNS - used);
  }

  equipPickaxe(tier: number): void {
    this.currentPickaxeTier = tier;
  }

  consumePickaxeRun(): void {
    if (this.currentPickaxeTier === 1) return;
    this.pickaxeRuns[this.currentPickaxeTier] = (this.pickaxeRuns[this.currentPickaxeTier] ?? 0) + 1;
    if ((this.pickaxeRuns[this.currentPickaxeTier] ?? 0) >= MAX_PICKAXE_RUNS) {
      const pickaxeId = `pickaxe_${this.currentPickaxeTier}`;
      this.inventory.removeItem(pickaxeId, 1);
      if (this.inventory.count(pickaxeId) === 0) {
        delete this.pickaxeRuns[this.currentPickaxeTier];
      } else {
        this.pickaxeRuns[this.currentPickaxeTier] = 0;
      }
      this.currentPickaxeTier = 1;
    }
  }

  getAvailablePickaxes(): { id: string; tier: number }[] {
    const result: { id: string; tier: number }[] = [];
    result.push({ id: 'pickaxe_1', tier: 1 });
    for (let t = 2; t <= 3; t++) {
      const id = `pickaxe_${t}`;
      if (this.inventory.count(id) > 0) {
        result.push({ id, tier: t });
      }
    }
    return result.sort((a, b) => a.tier - b.tier);
  }
}

export const gameState = new GameState();
