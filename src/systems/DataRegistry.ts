export interface MaterialData {
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

export interface ConsumableData {
  id: string;
  name: string;
  effect: string;
  value: number;
}

export type ItemData = MaterialData | EquipmentData | ConsumableData;

export interface RecipeData {
  id: string;
  result: string;
  quantity: number;
  ingredients: Record<string, number>;
  discovered: boolean;
}

export interface BuildingData {
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

export interface EventData {
  id: string;
  name: string;
  description: string;
  type: string;
}

export interface RoomTemplateData {
  id: string;
  type: string;
  biome: string;
  width: number;
  height: number;
  tile_types: Record<string, string>;
}

import itemsJson from '../data/items.json';
import recipesJson from '../data/recipes.json';
import buildingsJson from '../data/buildings.json';
import relicsJson from '../data/relics.json';
import eventsJson from '../data/events.json';
import roomsJson from '../data/rooms.json';

const materials = new Map<string, MaterialData>();
const equipment = new Map<string, EquipmentData>();
const consumables = new Map<string, ConsumableData>();
const recipes = new Map<string, RecipeData>();
const buildings = new Map<string, BuildingData>();
const relics = new Map<string, RelicData>();
const events = new Map<string, EventData>();
const roomTemplates = new Map<string, RoomTemplateData>();

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

  const eventsFile = eventsJson as unknown as { events: EventData[] };
  for (const e of eventsFile.events) events.set(e.id, e);

  const roomsFile = roomsJson as unknown as { room_templates: RoomTemplateData[] };
  for (const t of roomsFile.room_templates) roomTemplates.set(t.id, t);
}

init();

export function getItem(id: string): ItemData | undefined {
  return materials.get(id) ?? equipment.get(id) ?? consumables.get(id);
}

export function getMaterial(id: string): MaterialData | undefined {
  return materials.get(id);
}

export function getEquipment(id: string): EquipmentData | undefined {
  return equipment.get(id);
}

export function getConsumable(id: string): ConsumableData | undefined {
  return consumables.get(id);
}

export function getAllMaterials(): MaterialData[] {
  return Array.from(materials.values());
}

export function getAllEquipment(): EquipmentData[] {
  return Array.from(equipment.values());
}

export function getAllConsumables(): ConsumableData[] {
  return Array.from(consumables.values());
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

export function getAllBuildings(): BuildingData[] {
  return Array.from(buildings.values());
}

export function getRelic(id: string): RelicData | undefined {
  return relics.get(id);
}

export function getAllRelics(): RelicData[] {
  return Array.from(relics.values());
}

export function getEvent(id: string): EventData | undefined {
  return events.get(id);
}

export function getAllEvents(): EventData[] {
  return Array.from(events.values());
}

export function getRoomTemplate(id: string): RoomTemplateData | undefined {
  return roomTemplates.get(id);
}

export function getAllRoomTemplates(): RoomTemplateData[] {
  return Array.from(roomTemplates.values());
}
