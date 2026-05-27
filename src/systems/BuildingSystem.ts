import { getBuilding } from './DataRegistry';
import { gameState } from './GameState';

export function canRestore(buildingId: string): boolean {
  if (gameState.restoredBuildings.has(buildingId)) return false;
  const building = getBuilding(buildingId);
  if (!building) return false;
  for (const [itemId, qty] of Object.entries(building.cost)) {
    if (gameState.inventory.count(itemId) < qty) return false;
  }
  return true;
}

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
  }

  return true;
}

export function isRestored(buildingId: string): boolean {
  return gameState.restoredBuildings.has(buildingId);
}
