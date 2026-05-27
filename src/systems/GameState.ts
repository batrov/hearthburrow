import { InventorySystem } from './InventorySystem';
import { CraftingSystem } from './CraftingSystem';

const SAVE_KEY = 'hearthburrow_save';

export interface RunResult {
  itemsObtained: { id: string; quantity: number }[];
  itemsLost: { id: string; quantity: number }[];
  extractType: 'safe' | 'emergency';
  depth: number;
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
  ring_critical: 'Critical Ring',
  ring_damage: 'Damage Ring',
  ring_precision: 'Precision Ring',
  ring_hunter: 'Hunter Ring',
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
  equippedRings: { ring1: string | null; ring2: string | null };

  constructor() {
    this.inventory = new InventorySystem(32);
    this.crafting = new CraftingSystem();
    this.restoredBuildings = new Set();
    this.currentPickaxeTier = 1;
    this.maxStaminaBonus = 0;
    this.inventorySlotBonus = 0;
    this.pickaxeRuns = {};
    this.equippedRings = { ring1: null, ring2: null };
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

  getAvailableRings(): { id: string; name: string }[] {
    const ringIds = ['ring_critical', 'ring_damage', 'ring_precision', 'ring_hunter'];
    const result: { id: string; name: string }[] = [];
    for (const id of ringIds) {
      if (this.inventory.count(id) > 0 || this.equippedRings.ring1 === id || this.equippedRings.ring2 === id) {
        result.push({ id, name: itemDisplayName(id) });
      }
    }
    return result;
  }

  getRingEffects(): { critChance: number; bonusDamage: number; precisionMult: number; doubleLoot: boolean } {
    const effects = { critChance: 0, bonusDamage: 0, precisionMult: 1, doubleLoot: false };
    for (const slot of [this.equippedRings.ring1, this.equippedRings.ring2]) {
      switch (slot) {
        case 'ring_critical': effects.critChance += 0.2; break;
        case 'ring_damage': effects.bonusDamage += 1; break;
        case 'ring_precision': effects.precisionMult *= 1.3; break;
        case 'ring_hunter': effects.doubleLoot = true; break;
      }
    }
    return effects;
  }

  save(): void {
    const data = {
      inventory: this.inventory.getItems().map(s => s ? { itemId: s.itemId, quantity: s.quantity } : null),
      restoredBuildings: Array.from(this.restoredBuildings),
      currentPickaxeTier: this.currentPickaxeTier,
      maxStaminaBonus: this.maxStaminaBonus,
      inventorySlotBonus: this.inventorySlotBonus,
      pickaxeRuns: { ...this.pickaxeRuns },
      equippedRings: { ...this.equippedRings },
      discovered: this.crafting.getDiscoveredIds(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // storage full or unavailable
    }
  }

  load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);

      this.inventory = new InventorySystem(32);
      if (data.inventory) {
        for (const slot of data.inventory) {
          if (slot) this.inventory.addItem(slot.itemId, slot.quantity);
        }
      }

      this.restoredBuildings = new Set(data.restoredBuildings ?? []);
      this.currentPickaxeTier = data.currentPickaxeTier ?? 1;
      this.maxStaminaBonus = data.maxStaminaBonus ?? 0;
      this.inventorySlotBonus = data.inventorySlotBonus ?? 0;
      this.pickaxeRuns = data.pickaxeRuns ?? {};
      this.equippedRings = data.equippedRings ?? { ring1: null, ring2: null };

      if (data.discovered) {
        this.crafting = new CraftingSystem();
        for (const id of data.discovered) {
          this.crafting.discover(id);
        }
      }
    } catch {
      // corrupt save, start fresh
    }
  }
}

export const gameState = new GameState();
