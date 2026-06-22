interface MaterialData {
  id: string;
  name: string;
  tier: number;
  rarity: 'common' | 'uncommon' | 'rare';
  maxStack: number;
}

export interface EquipmentData {
  id: string;
  name: string;
  tier: number;
  slot: string;
  mining_power: number;
}

interface ConsumableData {
  id: string;
  name: string;
  effect: string;
  value: number;
}

type ItemData = MaterialData | EquipmentData | ConsumableData;

export interface RecipeData {
  id: string;
  result: string;
  quantity: number;
  ingredients: Record<string, number>;
  discovered: boolean;
}

interface BuildingData {
  id: string;
  name: string;
  description: string;
  cost: Record<string, number>;
  unlocked: boolean;
}

export interface RelicData {
  id: string;
  name: string;
  description: string;
  effect: string;
  value: number;
}

import itemsJson from '../data/items.json';
import recipesJson from '../data/recipes.json';
import buildingsJson from '../data/buildings.json';
import relicsJson from '../data/relics.json';

const materials = new Map<string, MaterialData>();
const equipment = new Map<string, EquipmentData>();
const consumables = new Map<string, ConsumableData>();
const recipes = new Map<string, RecipeData>();
const buildings = new Map<string, BuildingData>();
const relics = new Map<string, RelicData>();

function init(): void {
  const itemsFile = itemsJson as unknown as {
    materials: MaterialData[];
    equipment: EquipmentData[];
    consumables: ConsumableData[];
  };
  for (const m of itemsFile.materials) materials.set(m.id, m);
  for (const e of itemsFile.equipment) equipment.set(e.id, e);
  for (const c of itemsFile.consumables) consumables.set(c.id, c);

  const recipesFile = recipesJson as unknown as { recipes: RecipeData[] };
  for (const r of recipesFile.recipes) recipes.set(r.id, r);

  const buildingsFile = buildingsJson as unknown as { buildings: BuildingData[] };
  for (const b of buildingsFile.buildings) buildings.set(b.id, b);

  const relicsFile = relicsJson as unknown as { relics: RelicData[] };
  for (const r of relicsFile.relics) relics.set(r.id, r);
}

init();

export function getEquipment(id: string): EquipmentData | undefined {
  return equipment.get(id);
}

export function getRecipe(id: string): RecipeData | undefined {
  return recipes.get(id);
}

export function getAllRecipes(): RecipeData[] {
  return Array.from(recipes.values());
}

export function getBuilding(id: string): BuildingData | undefined {
  return buildings.get(id);
}

export function getRelic(id: string): RelicData | undefined {
  return relics.get(id);
}

export function getAllRelics(): RelicData[] {
  return Array.from(relics.values());
}

export function isConsumable(id: string): boolean {
  return consumables.has(id);
}
