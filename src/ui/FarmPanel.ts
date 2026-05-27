import Phaser from 'phaser';
import { gameState } from '../systems/GameState';

export class FarmPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private visible: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.text = scene.add.text(960 / 2, 50, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#e8d5b7',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0);
    this.container.add(this.text);

    this.container.setVisible(false);
  }

  show(): void {
    this.visible = true;
    this.render();
    this.container.setVisible(true);
  }

  hide(): void {
    this.visible = false;
    this.container.setVisible(false);
  }

  isVisible(): boolean {
    return this.visible;
  }

  plant(): void {
    if (gameState.inventory.count('carrot') < 1) return;
    gameState.inventory.removeItem('carrot', 1);
    gameState.farmPlanted++;
    gameState.save();
    this.render();
  }

  harvest(): void {
    if (gameState.farmHarvest <= 0) return;
    const amount = gameState.farmHarvest;
    gameState.inventory.addItem('carrot', amount);
    gameState.farmHarvest = 0;
    gameState.save();
    this.render();
  }

  private render(): void {
    this.bg.clear();
    this.bg.fillStyle(0x0a0a1a, 0.92);
    this.bg.fillRect(0, 0, 960, 640);
    this.bg.lineStyle(1, 0x3a3a4a, 0.5);
    this.bg.strokeRect(40, 40, 880, 560);

    const carrots = gameState.inventory.count('carrot');
    const yieldPerExpedition = Math.max(1, Math.floor(gameState.farmPlanted / 2));

    this.text.setText(
      `--- Farm ---\n\n` +
      `Planted: ${gameState.farmPlanted} Carrots\n` +
      `Harvest ready: ${gameState.farmHarvest}\n\n` +
      `Plant 1 Carrot → yields ${yieldPerExpedition} per expedition\n` +
      `(Harvest grows after each expedition)\n\n` +
      `You have ${carrots} Carrots\n\n` +
      `[Z] Plant one  |  [X] Harvest all  |  [ESC] close`
    );
  }
}
