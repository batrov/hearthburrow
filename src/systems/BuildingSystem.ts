import { getBuilding } from './DataRegistry';
import { gameState } from './GameState';

/** Check if a building can be restored (has materials, not already restored). */
export function canRestore(buildingId: string): boolean {
  if (gameState.restoredBuildings.has(buildingId)) return false;
  const building = getBuilding(buildingId);
  if (!building) return false;
  for (const [itemId, qty] of Object.entries(building.cost)) {
    if (gameState.inventory.count(itemId) < qty) return false;
  }
  return true;
}

/** Deduct materials and mark a building as restored. Applies stat bonuses. */
export function restoreBuilding(buildingId: string): boolean {
  if (!canRestore(buildingId)) return false;
  const building = getBuilding(buildingId);
  if (!building) return false;

  for (const [itemId, qty] of Object.entries(building.cost)) {
    gameState.inventory.removeItem(itemId, qty);
  }

  gameState.restoredBuildings.add(buildingId);

  switch (buildingId) {
    case 'housing':
      gameState.maxStaminaBonus += 20;
      break;
    case 'storage':
      gameState.inventorySlotBonus += 8;
      gameState.inventory.expandSlots(8);
      break;
    case 'crafting_station':
      break;
    case 'trading_post':
      break;
    case 'laboratory':
      break;
    case 'farm':
      break;
  }

  gameState.save();
  return true;
}

/** Check if a building has been restored. */
export function isRestored(buildingId: string): boolean {
  return gameState.restoredBuildings.has(buildingId);
}
