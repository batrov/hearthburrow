import Phaser from 'phaser';
import { gameState } from '../systems/GameState';
import { audio } from '../systems/AudioSystem';
import { BasePanel } from './BasePanel';

export class FarmPanel extends BasePanel {
  private bg: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private plantBtn: Phaser.GameObjects.Text;
  private harvestBtn: Phaser.GameObjects.Text;
  private closeBtn: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.text = scene.add.text(960 / 2, 50, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#e8d5b7',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0);
    this.container.add(this.text);

    this.plantBtn = scene.add.text(960 / 2 - 80, 570, '[PLANT]', {
      fontSize: '14px', fontFamily: 'monospace', color: '#44cc66',
      backgroundColor: '#1a2a1a', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(210);
    this.plantBtn.on('pointerdown', () => this.plant());
    this.container.add(this.plantBtn);

    this.harvestBtn = scene.add.text(960 / 2 + 80, 570, '[HARVEST]', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ccaa44',
      backgroundColor: '#2a1a0a', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(210);
    this.harvestBtn.on('pointerdown', () => this.harvest());
    this.container.add(this.harvestBtn);

    this.closeBtn = scene.add.text(960 - 40, 40, '[X]', {
      fontSize: '16px', fontFamily: 'monospace', color: '#886666',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(210);
    this.closeBtn.on('pointerdown', () => this.hide());
    this.container.add(this.closeBtn);
  }

  show(): void {
    this.setVisible(true);
    this.render();
  }

  hide(): void {
    this.setVisible(false);
  }

  plant(): void {
    if (gameState.inventory.count('carrot') < 1) return;
    gameState.inventory.removeItem('carrot', 1);
    gameState.farmPlanted++;
    gameState.save();
    this.render();
  }

  harvest(): void {
    if (gameState.farmHarvest <= 0) {
      audio.playError();
      return;
    }
    const amount = gameState.farmHarvest;
    gameState.inventory.addItem('carrot', amount);
    audio.playItemPickup();
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
      `[Z] Plant one  |  [X] Harvest all  |  [ESC/TAP] close`
    );
  }
}
