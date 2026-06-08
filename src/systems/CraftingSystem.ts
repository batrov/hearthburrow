import { RecipeData } from './DataRegistry';
import { getRecipe, getAllRecipes, getEquipment } from './DataRegistry';
import { InventorySystem } from './InventorySystem';
import { gameState } from './GameState';

const TIER_UPGRADE_REQUIRES: Record<string, string> = {
  'boots_stamina_silver': 'boots_stamina_bronze',
  'boots_stamina_gold': 'boots_stamina_silver',
  'boots_luck_silver': 'boots_luck_bronze',
  'boots_luck_gold': 'boots_luck_silver',
  'lantern_silver': 'lantern_bronze',
  'lantern_gold': 'lantern_silver',
};

/** Manages recipe discovery and crafting. */
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

  /** Mark a recipe as discovered (unlocked). */
  discover(id: string): void {
    this.discovered.add(id);
  }

  /** Check whether a recipe has been discovered. */
  isDiscovered(id: string): boolean {
    return this.discovered.has(id);
  }

  /** Get array of all discovered recipe IDs. */
  getDiscoveredIds(): string[] {
    return Array.from(this.discovered);
  }

  /** Get full recipe data for all discovered recipes. */
  getDiscoveredRecipes(): RecipeData[] {
    return getAllRecipes().filter(r => this.discovered.has(r.id));
  }

  /** Get full recipe data for all undiscovered recipes. */
  getUndiscoveredRecipes(): RecipeData[] {
    return getAllRecipes().filter(r => !this.discovered.has(r.id));
  }

  /** Check if a discovered recipe has sufficient materials + meets tier prerequisites. */
  canCraft(recipeId: string): boolean {
    const recipe = getRecipe(recipeId);
    if (!recipe || !this.discovered.has(recipeId)) return false;
    for (const [itemId, qty] of Object.entries(recipe.ingredients)) {
      if (gameState.inventory.count(itemId) < qty) return false;
    }
    const prev = TIER_UPGRADE_REQUIRES[recipeId];
    if (prev && gameState.inventory.count(prev) <= 0) return false;
    return true;
  }

  craft(recipeId: string): boolean {
    const recipe = getRecipe(recipeId);
    if (!recipe || !this.canCraft(recipeId)) return false;

    for (const [itemId, qty] of Object.entries(recipe.ingredients)) {
      gameState.inventory.removeItem(itemId, qty);
    }

    const hadItem = gameState.inventory.count(recipe.result) > 0;

    gameState.inventory.addItem(recipe.result, recipe.quantity);
    gameState.addCraftedItem(recipe.result);

    const equip = getEquipment(recipe.result);
    if (equip) {
      if (equip.slot === 'pickaxe') {
        if (!hadItem) {
          gameState.pickaxeRuns[equip.tier] = 0;
        }
        gameState.equipPickaxe(Math.max(gameState.currentPickaxeTier, equip.tier));
      } else if (equip.slot === 'boots') {
        gameState.equippedBoots = recipe.result;
      } else if (equip.slot === 'lantern') {
        gameState.equippedLantern = recipe.result;
      }
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
