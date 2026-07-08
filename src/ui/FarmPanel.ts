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
  private bottomText: Phaser.GameObjects.Text;
  private plantBtn!: UiButton;
  private harvestBtn!: UiButton;
  private onCarrotChange: (() => void) | null;
  private plotBgGraphics: Phaser.GameObjects.Graphics[] = [];
  private plotCarrotSprites: Phaser.GameObjects.Image[] = [];
  private plotProgressTexts: Phaser.GameObjects.Text[] = [];
  private plotYieldTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, onCarrotChange: (() => void) | null = null) {
    super(scene);
    this.onCarrotChange = onCarrotChange;

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.text = createText(scene, CX(), 44, '', {
      fontSize: fs(13), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7',
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);
    this.container.add(this.text);

    this.bottomText = createText(scene, CX(), 220, '', {
      fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#c8b898',
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);
    this.container.add(this.bottomText);

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
    this.onCarrotChange?.();
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
    gameState.farmPlotProgress = [0, 0, 0, 0, 0, 0];
    gameState.farmPlotYield = [0, 0, 0, 0, 0, 0];
    gameState.save();
    this.onCarrotChange?.();
    this.render();
  }

  private render(): void {
    this.bg.clear();
    this.bg.fillStyle(0x0a0a1a, 0.92);
    this.bg.fillRect(0, 0, VW(), VH());
    const pad = 16;
    this.bg.lineStyle(1, 0x3a3a4a, 0.5);
    this.bg.strokeRect(pad, pad, VW() - pad * 2, VH() - pad * 2);

    this.plotBgGraphics.forEach(g => g.destroy());
    this.plotBgGraphics = [];
    this.plotCarrotSprites.forEach(s => s.destroy());
    this.plotCarrotSprites = [];
    this.plotProgressTexts.forEach(t => t.destroy());
    this.plotProgressTexts = [];
    this.plotYieldTexts.forEach(t => t.destroy());
    this.plotYieldTexts = [];

    const carrots = gameState.inventory.count('carrot');
    const used = gameState.farmPlanted;

    this.text.setText('--- Farm ---');

    this.bottomText.setText(
      `Plots: ${used}/${this.MAX_FARM_PLOTS}\n` +
      `Harvest ready: ${gameState.farmHarvest}\n` +
      `Each plot yields 1 carrot per 100 steps\n` +
      `You have ${carrots} Carrots`
    );

    const cols = 3;
    const slotSize = 48;
    const gap = 8;
    const totalW = cols * slotSize + (cols - 1) * gap;
    const startX = CX() - totalW / 2 + slotSize / 2;
    const startY = 90;

    for (let i = 0; i < this.MAX_FARM_PLOTS; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (slotSize + gap);
      const y = startY + row * (slotSize + gap);

      const bg = this.scene.add.graphics();
      bg.fillStyle(i < used ? 0x4a3a2a : 0x2a1a0a, 1);
      bg.fillRoundedRect(x - slotSize / 2, y - slotSize / 2, slotSize, slotSize, 6);
      bg.lineStyle(1, 0x5a4a3a, 0.8);
      bg.strokeRoundedRect(x - slotSize / 2, y - slotSize / 2, slotSize, slotSize, 6);
      this.container.add(bg);
      this.plotBgGraphics.push(bg);

      if (i < used) {
        const sprite = this.scene.add.image(x, y, 'item_carrot').setScale(0.7);
        this.container.add(sprite);
        this.plotCarrotSprites.push(sprite);
        const pct = createText(this.scene, x + slotSize / 2 - 2, y + slotSize / 2 - 2, `${gameState.farmPlotProgress[i]}%`, {
          fontSize: fs(7), color: '#ffffff', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(1, 1);
        this.container.add(pct);
        this.plotProgressTexts.push(pct);
        const yieldTxt = createText(this.scene, x - slotSize / 2 + 2, y + slotSize / 2 - 2, gameState.farmPlotYield[i] > 0 ? `+${gameState.farmPlotYield[i]}` : '', {
          fontSize: fs(8), color: '#88ff88', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0, 1);
        this.container.add(yieldTxt);
        this.plotYieldTexts.push(yieldTxt);
      }
    }
  }

  protected relayout(): void {
    super.relayout();
    this.bottomText.setPosition(CX(), 220);
    if (this._visible) this.render();
  }
}
