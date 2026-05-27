import { RecipeData } from './DataRegistry';
import { getRecipe, getAllRecipes, getEquipment } from './DataRegistry';
import { InventorySystem } from './InventorySystem';
import { gameState } from './GameState';

export class CraftingSystem {
  private discovered: Set<string>;

  constructor() {
    this.discovered = new Set();
    for (const recipe of getAllRecipes()) {
      if (recipe.discovered) {
        this.discovered.add(recipe.id);
      }
    }
  }

  discover(id: string): void {
    this.discovered.add(id);
  }

  isDiscovered(id: string): boolean {
    return this.discovered.has(id);
  }

  getDiscoveredIds(): string[] {
    return Array.from(this.discovered);
  }

  getDiscoveredRecipes(): RecipeData[] {
    return getAllRecipes().filter(r => this.discovered.has(r.id));
  }

  getUndiscoveredRecipes(): RecipeData[] {
    return getAllRecipes().filter(r => !this.discovered.has(r.id));
  }

  canCraft(recipeId: string): boolean {
    const recipe = getRecipe(recipeId);
    if (!recipe || !this.discovered.has(recipeId)) return false;
    for (const [itemId, qty] of Object.entries(recipe.ingredients)) {
      if (gameState.inventory.count(itemId) < qty) return false;
    }
    return true;
  }

  craft(recipeId: string): boolean {
    const recipe = getRecipe(recipeId);
    if (!recipe || !this.canCraft(recipeId)) return false;

    for (const [itemId, qty] of Object.entries(recipe.ingredients)) {
      gameState.inventory.removeItem(itemId, qty);
    }

    const hadPickaxe = gameState.inventory.count(recipe.result) > 0;

    gameState.inventory.addItem(recipe.result, recipe.quantity);

    const equip = getEquipment(recipe.result);
    if (equip && equip.slot === 'pickaxe') {
      if (!hadPickaxe) {
        gameState.pickaxeRuns[equip.tier] = 0;
      }
      gameState.equipPickaxe(Math.max(gameState.currentPickaxeTier, equip.tier));
    }

    gameState.save();
    return true;
  }

  isPickaxeUpgrade(recipeId: string): boolean {
    const recipe = getRecipe(recipeId);
    if (!recipe) return false;
    const equip = getEquipment(recipe.result);
    return equip?.slot === 'pickaxe';
  }
}
