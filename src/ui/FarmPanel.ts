import Phaser from 'phaser';
import { gameState } from '../systems/GameState';
import { audio } from '../systems/AudioSystem';
import { BasePanel } from './BasePanel';
import { VW, VH, CX } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';
import { getInputMode } from '../systems/InputMode';
import { NineSliceBg } from './NineSliceBg';
import { UiButton } from './UiButton';

export class FarmPanel extends BasePanel {
  private readonly MAX_FARM_PLOTS = 6;
  private bg: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private plantBtn!: UiButton;
  private harvestBtn!: UiButton;

  constructor(scene: Phaser.Scene) {
    super(scene);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.text = createText(scene, CX(), 44, '', {
      fontSize: fs(13), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7',
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);
    this.container.add(this.text);

    const plantBtn = new UiButton(scene, CX() - 80, VH() - 80, 'PLANT', 80, 28,
      () => this.plant(),
      { color: '#44cc66', fontSize: fs(12) }
    );
    plantBtn.setDepth(210);
    for (const c of plantBtn.getChildren()) this.container.add(c);
    this.plantBtn = plantBtn;

    const harvestBtn = new UiButton(scene, CX() + 80, VH() - 80, 'HARVEST', 100, 28,
      () => this.harvest(),
      { color: '#ccaa44', fontSize: fs(12) }
    );
    harvestBtn.setDepth(210);
    for (const c of harvestBtn.getChildren()) this.container.add(c);
    this.harvestBtn = harvestBtn;

    this.scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this._visible) return;
      this.plantBtn.handleClick(p);
      this.harvestBtn.handleClick(p);
    });
    this.scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this._visible) return;
      this.plantBtn.handleRelease(p);
      this.harvestBtn.handleRelease(p);
    });

    this.addCloseButton(VW() - 40, 40);
  }

  show(): void {
    this.fadeIn();
    this.render();
  }

  hide(): void {
    this.fadeOut();
  }

  plant(): void {
    if (gameState.inventory.count('carrot') < 1 || gameState.farmPlanted >= this.MAX_FARM_PLOTS) {
      audio.playError();
      return;
    }
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
    gameState.farmPlanted = 0;
    gameState.save();
    this.render();
  }

  private render(): void {
    this.bg.clear();
    this.bg.fillStyle(0x0a0a1a, 0.92);
    this.bg.fillRect(0, 0, VW(), VH());
    const pad = 16;
    this.bg.lineStyle(1, 0x3a3a4a, 0.5);
    this.bg.strokeRect(pad, pad, VW() - pad * 2, VH() - pad * 2);

    const carrots = gameState.inventory.count('carrot');
    const used = gameState.farmPlanted;
    const empty = this.MAX_FARM_PLOTS - used;
    const plotBar = '█'.repeat(used) + '░'.repeat(empty);

    this.text.setText(
      `--- Farm ---\n\n` +
      `Plots: ${plotBar}  ${used}/${this.MAX_FARM_PLOTS}\n` +
      `Harvest ready: ${gameState.farmHarvest}\n\n` +
      `Each plot yields 1 carrot\n` +
      `per 100 steps taken\n\n` +
      `You have ${carrots} Carrots\n\n` +
      getInputMode() !== 'keyboard' ? 'Plant  |  Harvest  |  Close' : '[Z] Plant one  |  [X] Harvest all  |  [ESC/TAP] close'
    );
  }
}
