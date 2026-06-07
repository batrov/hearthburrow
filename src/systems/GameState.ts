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
  bronze_ore: 'Bronze Ore',
  silver_ore: 'Silver Ore',
  gold_ore: 'Gold Ore',
  crystal: 'Crystal',
  monster_drop: 'Monster Essence',
  carrot: 'Carrot',
  stamina_potion: 'Stamina Potion',
  teleport_scroll: 'Teleport Scroll',
  mining_bomb: 'Mining Bomb',
  ring_critical: 'Critical Ring',
  ring_damage: 'Damage Ring',
  ring_precision: 'Precision Ring',
  ring_hunter: 'Hunter Ring',
  pickaxe_1: 'Common Pickaxe',
  pickaxe_2: 'Bronze Pickaxe',
  pickaxe_3: 'Silver Pickaxe',
  boots_stamina_bronze: 'Stamina Boots (Bronze)',
  boots_stamina_silver: 'Stamina Boots (Silver)',
  boots_stamina_gold: 'Stamina Boots (Gold)',
  boots_luck_bronze: 'Luck Boots (Bronze)',
  boots_luck_silver: 'Luck Boots (Silver)',
  boots_luck_gold: 'Luck Boots (Gold)',
  boots_regen: 'Regenerative Boots',
  lantern_bronze: 'Bronze Lantern',
  lantern_silver: 'Silver Lantern',
  lantern_gold: 'Gold Lantern',
};

export function itemDisplayName(id: string): string {
  return ITEM_NAMES[id] ?? id.replace(/_/g, ' ');
}

const MAX_PICKAXE_RUNS = 5;
const MAX_EQUIP_RUNS = 5;

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
  equippedBoots: string | null;
  equippedLantern: string | null;
  itemRuns: Record<string, number>;
  farmPlanted: number;
  farmHarvest: number;
  researchLevels: Record<string, number>;
  monsterKills: { slime: number; rat: number; bat: number };
  villagersRescued: number;
  foundRelics: string[];
  maxDepthReached: number;
  exhaustionCount: number;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;

  constructor() {
    this.inventory = new InventorySystem(32);
    this.crafting = new CraftingSystem();
    this.restoredBuildings = new Set();
    this.currentPickaxeTier = 1;
    this.maxStaminaBonus = 0;
    this.inventorySlotBonus = 0;
    this.pickaxeRuns = {};
    this.equippedRings = { ring1: null, ring2: null };
    this.equippedBoots = null;
    this.equippedLantern = null;
    this.itemRuns = {};
    this.farmPlanted = 0;
    this.farmHarvest = 0;
    this.researchLevels = {};
    this.monsterKills = { slime: 0, rat: 0, bat: 0 };
    this.villagersRescued = 0;
    this.foundRelics = [];
    this.maxDepthReached = 0;
    this.exhaustionCount = 0;
    this.masterVolume = 1;
    this.musicVolume = 0.4;
    this.sfxVolume = 0.6;
  }

  getResearchLevel(id: string): number {
    return this.researchLevels[id] ?? 0;
  }

  setResearchLevel(id: string, level: number): void {
    this.researchLevels[id] = level;
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

  getBootEffects(): { maxStaminaBonus: number; luckBonus: number; stairMultiplier: number } {
    switch (this.equippedBoots) {
      case 'boots_stamina_bronze': return { maxStaminaBonus: 10, luckBonus: 0, stairMultiplier: 1 };
      case 'boots_stamina_silver': return { maxStaminaBonus: 20, luckBonus: 0, stairMultiplier: 1 };
      case 'boots_stamina_gold':   return { maxStaminaBonus: 30, luckBonus: 0, stairMultiplier: 1 };
      case 'boots_luck_bronze':    return { maxStaminaBonus: 0, luckBonus: 0.10, stairMultiplier: 1.1 };
      case 'boots_luck_silver':    return { maxStaminaBonus: 0, luckBonus: 0.25, stairMultiplier: 1.25 };
      case 'boots_luck_gold':      return { maxStaminaBonus: 0, luckBonus: 0.40, stairMultiplier: 1.4 };
      default:                     return { maxStaminaBonus: 0, luckBonus: 0, stairMultiplier: 1 };
    }
  }

  getLanternRange(depth: number): number {
    const isDarkFloor = depth > 0 && depth % 5 === 3;
    const tierRanges: Record<string, number> = {
      lantern_bronze: 3, lantern_silver: 4, lantern_gold: 5,
    };
    const bonus = this.equippedLantern ? (tierRanges[this.equippedLantern] ?? 0) : 0;
    if (isDarkFloor) {
      return 90 + bonus * 60;
    }
    return bonus * 60;
  }

  hasUsageLimit(id: string): boolean {
    return id.startsWith('boots_') || id.startsWith('lantern_');
  }

  remainingEquipmentRuns(itemId: string): number {
    if (!this.hasUsageLimit(itemId)) return Infinity;
    return Math.max(0, MAX_EQUIP_RUNS - (this.itemRuns[itemId] ?? 0));
  }

  consumeEquipmentRun(itemId: string | null): void {
    if (!itemId || !this.hasUsageLimit(itemId)) return;
    this.itemRuns[itemId] = (this.itemRuns[itemId] ?? 0) + 1;
    if (this.remainingEquipmentRuns(itemId) <= 0) {
      this.inventory.removeItem(itemId, 1);
      if (this.equippedBoots === itemId) this.equippedBoots = null;
      if (this.equippedLantern === itemId) this.equippedLantern = null;
      if (this.inventory.count(itemId) > 0) {
        this.itemRuns[itemId] = 0;
      }
    }
  }

  getAvailableBoots(): { id: string; name: string; runs: number }[] {
    const bootIds = ['boots_stamina_bronze', 'boots_stamina_silver', 'boots_stamina_gold',
      'boots_luck_bronze', 'boots_luck_silver', 'boots_luck_gold', 'boots_regen'];
    const result: { id: string; name: string; runs: number }[] = [];
    for (const id of bootIds) {
      if (this.inventory.count(id) > 0 || this.equippedBoots === id) {
        result.push({ id, name: itemDisplayName(id), runs: this.remainingEquipmentRuns(id) });
      }
    }
    return result;
  }

  getAvailableLanterns(): { id: string; name: string; runs: number }[] {
    const lanternIds = ['lantern_bronze', 'lantern_silver', 'lantern_gold'];
    const result: { id: string; name: string; runs: number }[] = [];
    for (const id of lanternIds) {
      if (this.inventory.count(id) > 0 || this.equippedLantern === id) {
        result.push({ id, name: itemDisplayName(id), runs: this.remainingEquipmentRuns(id) });
      }
    }
    return result;
  }

  addFoundRelic(id: string): void {
    if (!this.foundRelics.includes(id)) {
      this.foundRelics.push(id);
      const relicData = this.getRelicData(id);
      if (relicData) {
        switch (relicData.effect) {
          case 'max_stamina': this.maxStaminaBonus += relicData.value; break;
          case 'inventory_slots': this.inventorySlotBonus += relicData.value; break;
          case 'luck': break;
        }
      }
      this.save();
    }
  }

  hasFoundRelic(id: string): boolean {
    return this.foundRelics.includes(id);
  }

  getFoundRelics(): string[] {
    return [...this.foundRelics];
  }

  private getRelicData(id: string): { effect: string; value: number } | undefined {
    const map: Record<string, { effect: string; value: number }> = {
      relic_stamina: { effect: 'max_stamina', value: 20 },
      relic_inventory: { effect: 'inventory_slots', value: 4 },
      relic_luck: { effect: 'luck', value: 1 },
    };
    return map[id];
  }

  getAvailableElevatorFloors(): number[] {
    const floors: number[] = [];
    for (let f = 0; f <= this.maxDepthReached; f += 5) {
      floors.push(f);
    }
    return floors;
  }

  resetProgress(): void {
    localStorage.removeItem('hearthburrow_save');
    localStorage.removeItem('researched_upgrades');
    this.inventory = new InventorySystem(32);
    this.crafting = new CraftingSystem();
    this.restoredBuildings = new Set();
    this.currentPickaxeTier = 1;
    this.maxStaminaBonus = 0;
    this.inventorySlotBonus = 0;
    this.pickaxeRuns = {};
    this.equippedRings = { ring1: null, ring2: null };
    this.equippedBoots = null;
    this.equippedLantern = null;
    this.itemRuns = {};
    this.farmPlanted = 0;
    this.farmHarvest = 0;
    this.researchLevels = {};
    this.monsterKills = { slime: 0, rat: 0, bat: 0 };
    this.villagersRescued = 0;
    this.foundRelics = [];
    this.maxDepthReached = 0;
    this.exhaustionCount = 0;
    this.masterVolume = 1;
    this.musicVolume = 0.4;
    this.sfxVolume = 0.6;
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
      equippedBoots: this.equippedBoots,
      equippedLantern: this.equippedLantern,
      itemRuns: { ...this.itemRuns },
      farmPlanted: this.farmPlanted,
      farmHarvest: this.farmHarvest,
      discovered: this.crafting.getDiscoveredIds(),
      researchLevels: { ...this.researchLevels },
      monsterKills: { ...this.monsterKills },
      villagersRescued: this.villagersRescued,
      foundRelics: this.foundRelics,
      maxDepthReached: this.maxDepthReached,
      exhaustionCount: this.exhaustionCount,
      masterVolume: this.masterVolume,
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
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
      this.equippedBoots = data.equippedBoots ?? null;
      this.equippedLantern = data.equippedLantern ?? null;
      this.itemRuns = data.itemRuns ?? {};
      this.farmPlanted = data.farmPlanted ?? 0;
      this.farmHarvest = data.farmHarvest ?? 0;
      this.monsterKills = data.monsterKills ?? { slime: 0, rat: 0, bat: 0 };
      this.villagersRescued = data.villagersRescued ?? 0;
      this.foundRelics = data.foundRelics ?? [];
      this.maxDepthReached = data.maxDepthReached ?? 0;
      this.exhaustionCount = data.exhaustionCount ?? 0;
      this.masterVolume = data.masterVolume ?? 1;
      this.musicVolume = data.musicVolume ?? 0.4;
      this.sfxVolume = data.sfxVolume ?? 0.6;

      // migrate researchLevels from old format
      if (data.researchLevels && typeof data.researchLevels === 'object' && !Array.isArray(data.researchLevels)) {
        this.researchLevels = { ...data.researchLevels };
      } else if (Array.isArray(data.researchedUpgrades)) {
        // old format: convert stamina_up → stamina:1, inventory_up → backpack:1
        this.researchLevels = {};
        for (const id of data.researchedUpgrades) {
          if (id === 'stamina_up') this.researchLevels['stamina'] = 1;
          if (id === 'inventory_up') this.researchLevels['backpack'] = 1;
        }
      }

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
