import Phaser from 'phaser';
import { gameState } from '../systems/GameState';
import { getRecipe } from '../systems/DataRegistry';
import { itemDisplayName } from '../systems/GameState';

export class CraftingPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private contentText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private visible: boolean = false;
  private recipes: { id: string; name: string }[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.container = scene.add.container(0, 0).setDepth(200);

    this.overlay = scene.add.graphics();
    this.overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 960, 640), Phaser.Geom.Rectangle.Contains);
    this.container.add(this.overlay);

    this.titleText = scene.add.text(960 / 2, 40, 'Crafting Station', {
      fontSize: '22px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.contentText = scene.add.text(960 / 2, 80, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#c8b898',
      align: 'left', lineSpacing: 5,
    }).setOrigin(0.5, 0);
    this.container.add(this.contentText);

    this.hintText = scene.add.text(960 / 2, 610, '[SPACE] Craft selected  |  [TAB/ESC] close', {
      fontSize: '11px', fontFamily: 'monospace', color: '#5a4a6a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);

    this.container.setVisible(false);
  }

  show(): void {
    this.visible = true;
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

  refresh(): void {
    this.overlay.clear();
    this.overlay.fillStyle(0x0a0a1a, 0.88);
    this.overlay.fillRect(0, 0, 960, 640);

    this.overlay.lineStyle(1, 0x3a3a4a, 0.5);
    this.overlay.strokeRect(40, 65, 880, 530);

    const discovered = gameState.crafting.getDiscoveredRecipes();
    const undiscovered = gameState.crafting.getUndiscoveredRecipes();

    const lines: string[] = [];

    if (discovered.length > 0) {
      for (let i = 0; i < discovered.length; i++) {
        const r = discovered[i];
        const canCraft = gameState.crafting.canCraft(r.id);
        const ings = Object.entries(r.ingredients)
          .map(([id, qty]) => {
            const have = gameState.inventory.count(id);
            return `${itemDisplayName(id)} ${have}/${qty}`;
          })
          .join(', ');
        const mark = canCraft ? '[CRAFT]' : '       ';
        const name = itemDisplayName(r.result);
        lines.push(`  ${mark}  ${name.padEnd(20)} ${ings}`);
      }
    }

    if (undiscovered.length > 0) {
      if (lines.length > 0) lines.push('');
      lines.push('  ???  Unknown Recipes ???');
      for (const r of undiscovered) {
        lines.push(`        ${'?'.repeat(r.result.length)}  (undiscovered)`);
      }
    }

    if (discovered.length === 0 && undiscovered.length === 0) {
      lines.push('  (no recipes)');
    }

    this.contentText.setText(lines.join('\n'));

    this.recipes = discovered.map(r => ({ id: r.id, name: itemDisplayName(r.result) }));
  }

  tryCraftSelected(): boolean {
    const discovered = gameState.crafting.getDiscoveredRecipes();
    for (const r of discovered) {
      if (gameState.crafting.canCraft(r.id)) {
        gameState.crafting.craft(r.id);
        this.refresh();
        this.showCraftSuccess(r.result);
        return true;
      }
    }
    this.showNoCraft();
    return false;
  }

  private showCraftSuccess(itemId: string): void {
    const popup = this.scene.add.text(
      960 / 2, 640 / 2,
      `Crafted: ${itemDisplayName(itemId)}`,
      { fontSize: '20px', fontFamily: 'monospace', color: '#44cc66', fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(250);

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
    ).setOrigin(0.5).setDepth(250);

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
