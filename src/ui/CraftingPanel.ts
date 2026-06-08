import Phaser from 'phaser';
import { gameState, itemDisplayName } from '../systems/GameState';
import { getRecipe } from '../systems/DataRegistry';
import { audio } from '../systems/AudioSystem';

const RECIPE_INFO: Record<string, { desc: string; unlock?: string }> = {
  pickaxe_2: { desc: 'Bronze Pickaxe — 5 runs, mines bronze ore' },
  pickaxe_3: { desc: 'Silver Pickaxe — 5 runs, mines silver ore', unlock: 'Mine silver ore' },
  stamina_potion: { desc: 'Restores 50 stamina during expedition', unlock: 'Defeat the boss on floor 4' },
  teleport_scroll: { desc: 'Emergency teleport back to homeland', unlock: 'Exhaust yourself 3 times' },
  mining_bomb: { desc: 'Destroys surrounding walls instantly', unlock: 'Unlocked via events' },
  ring_critical: { desc: 'Chance to deal double damage in combat', unlock: 'Defeat 3 slimes' },
  ring_damage: { desc: '+1 base damage in combat', unlock: 'Defeat 3 rats' },
  ring_precision: { desc: 'Wider hit zone in combat', unlock: 'Defeat 3 bats' },
  ring_hunter: { desc: 'Combines crit + damage bonuses', unlock: 'Defeat 3 of each monster' },
  boots_stamina_bronze: { desc: '+10 max stamina for 5 expeditions', unlock: 'Reach floor 3 (dark)' },
  boots_stamina_silver: { desc: '+20 max stamina for 5 expeditions', unlock: 'Craft bronze version first' },
  boots_stamina_gold: { desc: '+30 max stamina for 5 expeditions', unlock: 'Craft silver version first' },
  boots_luck_bronze: { desc: '10% double-drop chance for 5 expeditions', unlock: 'Reach floor 3 (dark)' },
  boots_luck_silver: { desc: '25% double-drop chance for 5 expeditions', unlock: 'Craft bronze version first' },
  boots_luck_gold: { desc: '40% double-drop chance for 5 expeditions', unlock: 'Craft silver version first' },
  boots_regen: { desc: '+1 stamina per 5 rocks broken for 5 expeditions', unlock: 'Reach floor 8 (dark)' },
  lantern_bronze: { desc: '+60px light radius for 5 expeditions', unlock: 'Reach floor 3 (dark)' },
  lantern_silver: { desc: '+60px light radius for 5 expeditions', unlock: 'Craft bronze version first' },
  lantern_gold: { desc: '+60px light radius for 5 expeditions', unlock: 'Craft silver version first' },
};

export class CraftingPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private recipeLines: Phaser.GameObjects.Container;
  private hintText: Phaser.GameObjects.Text;
  private descriptionText: Phaser.GameObjects.Text;
  private visible: boolean = false;
  private recipes: { id: string; name: string }[] = [];
  private selectedIndex: number = 0;
  private clickZones: Phaser.GameObjects.Zone[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    this.overlay = scene.add.graphics();
    this.overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 960, 640), Phaser.Geom.Rectangle.Contains);
    this.container.add(this.overlay);

    this.titleText = scene.add.text(960 / 2, 40, 'Crafting Station', {
      fontSize: '22px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.recipeLines = scene.add.container(0, 0);
    this.container.add(this.recipeLines);

    this.descriptionText = scene.add.text(960 / 2, 585, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#b8a898',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.descriptionText);

    this.hintText = scene.add.text(960 / 2, 610, '[W/S] Select  [SPACE] Craft  [ESC] Close', {
      fontSize: '11px', fontFamily: 'monospace', color: '#5a4a6a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);

    this.container.setVisible(false);
  }

  show(): void {
    this.visible = true;
    this.selectedIndex = 0;
    this.refresh();
    this.container.setVisible(true);

    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 150,
      ease: 'Quad.easeOut',
    });
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 150,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.visible = false;
        this.container.setVisible(false);
      },
    });
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  navigateUp(): void {
    if (this.recipes.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.recipes.length) % this.recipes.length;
    this.renderContent();
  }

  navigateDown(): void {
    if (this.recipes.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.recipes.length;
    this.renderContent();
  }

  craftSelected(): boolean {
    if (this.recipes.length === 0) {
      audio.playError();
      this.showNoCraft();
      return false;
    }
    const recipe = this.recipes[this.selectedIndex];
    if (!gameState.crafting.isDiscovered(recipe.id)) {
      audio.playError();
      const info = RECIPE_INFO[recipe.id];
      this.showHowToUnlock(info?.unlock ?? 'Unknown discovery method');
      return false;
    }
    if (!gameState.crafting.canCraft(recipe.id)) {
      audio.playError();
      this.showNoCraft();
      return false;
    }
    gameState.crafting.craft(recipe.id);
    audio.playItemPickup();
    this.refresh();
    this.showCraftSuccess(recipe.id);
    return true;
  }

  private renderContent(): void {
    this.recipeLines.removeAll(true);
    this.clickZones.forEach(z => z.destroy());
    this.clickZones = [];


    const lineSpacing = 20;
    const startY = 80;

    for (let i = 0; i < this.recipes.length; i++) {
      const r = this.recipes[i];
      const discovered = gameState.crafting.isDiscovered(r.id);
      const marker = i === this.selectedIndex ? '▸' : ' ';
      let text: string;
      let color: string;

      if (discovered) {
        const recipe = gameState.crafting.getDiscoveredRecipes().find(d => d.id === r.id);
        const canCraft = recipe ? gameState.crafting.canCraft(r.id) : false;
        const craftedBefore = gameState.hasCraftedItem(recipe?.result ?? '');

        const ings = recipe ? Object.entries(recipe.ingredients)
          .map(([id, qty]) => {
            const have = gameState.inventory.count(id);
            return `${itemDisplayName(id)} ${have}/${qty}`;
          })
          .join(', ') : '';

        text = `  ${marker} ${r.name.padEnd(20)} ${ings}${canCraft ? '  ✓' : ''}`;

        if (canCraft) {
          color = craftedBefore ? '#e8d080' : '#b8a040';
        } else {
          color = craftedBefore ? '#8ab0d0' : '#6a7a9a';
        }
      } else {
        const info = RECIPE_INFO[r.id];
        const unlockStr = info?.unlock ? ` (${info.unlock})` : '';
        text = `  ${marker} ???${unlockStr}`;
        color = '#6a7a9a';
      }

      const line = this.scene.add.text(960 / 2, startY + i * lineSpacing, text, {
        fontSize: '13px', fontFamily: 'monospace', color,
        align: 'left',
      }).setOrigin(0.5, 0);
      this.recipeLines.add(line);

      const zone = this.scene.add.zone(960 / 2, startY + i * lineSpacing + 10, 860, 20)
        .setDepth(210)
        .setInteractive();
      zone.on('pointerdown', () => {
        this.selectedIndex = i;
        this.renderContent();
        this.craftSelected();
      });
      this.recipeLines.add(zone);
      this.clickZones.push(zone);
    }

    if (this.recipes.length === 0) {
      const line = this.scene.add.text(960 / 2, startY, '  (no recipes)', {
        fontSize: '13px', fontFamily: 'monospace', color: '#6a7a9a',
        align: 'left',
      }).setOrigin(0.5, 0);
      this.recipeLines.add(line);
    }

    if (this.recipes.length > 0 && this.selectedIndex < this.recipes.length) {
      const selectedId = this.recipes[this.selectedIndex].id;
      const disc = gameState.crafting.isDiscovered(selectedId);
      const info = RECIPE_INFO[selectedId];
      if (info) {
        if (disc) {
          this.descriptionText.setText(info.desc);
          this.descriptionText.setColor('#b8a898');
        } else {
          this.descriptionText.setText(`??? — ${info.unlock ?? 'Unknown discovery method'}`);
          this.descriptionText.setColor('#aa8844');
        }
      } else {
        this.descriptionText.setText('');
      }
    } else {
      this.descriptionText.setText('');
    }
  }

  refresh(): void {
    this.overlay.clear();
    this.overlay.fillStyle(0x0a0a1a, 0.88);
    this.overlay.fillRect(0, 0, 960, 640);

    this.overlay.lineStyle(1, 0x3a3a4a, 0.5);
    this.overlay.strokeRect(40, 65, 880, 530);

    const discovered = gameState.crafting.getDiscoveredRecipes();
    const undiscovered = gameState.crafting.getUndiscoveredRecipes();
    this.recipes = [
      ...discovered.map(r => ({ id: r.id, name: itemDisplayName(r.result) })),
      ...undiscovered.map(r => ({ id: r.id, name: '???' })),
    ];

    if (this.selectedIndex >= this.recipes.length) {
      this.selectedIndex = 0;
    }

    this.renderContent();
  }

  private showCraftSuccess(itemId: string): void {
    const popup = this.scene.add.text(
      960 / 2, 640 / 2,
      `Crafted: ${itemDisplayName(itemId)}`,
      { fontSize: '20px', fontFamily: 'monospace', color: '#44cc66', fontStyle: 'bold' }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(250);

    this.scene.tweens.add({
      targets: popup,
      y: popup.y - 60,
      alpha: 0,
      scale: { from: 1.2, to: 0.9 },
      duration: 1200,
      ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }

  private showNoCraft(): void {
    const popup = this.scene.add.text(
      960 / 2, 640 / 2,
      'No craftable recipe — need more materials!',
      { fontSize: '16px', fontFamily: 'monospace', color: '#cc6644' }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(250);

    this.scene.tweens.add({
      targets: popup,
      y: popup.y - 40,
      alpha: 0,
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }

  private showHowToUnlock(hint: string): void {
    const popup = this.scene.add.text(
      960 / 2, 640 / 2,
      `??? — ${hint}`,
      { fontSize: '16px', fontFamily: 'monospace', color: '#aa8844' }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(250);

    this.scene.tweens.add({
      targets: popup,
      y: popup.y - 40,
      alpha: 0,
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }
}
