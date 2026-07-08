import Phaser from 'phaser';
import { BasePanel } from './BasePanel';
import { gameState } from '../systems/GameState';
import { SeedEntryPopup } from './SeedEntryPopup';
import { ConfirmPopup } from './ConfirmPopup';
import { VW, VH, CX } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';
import { getInputMode } from '../systems/InputMode';
import { SCENES } from '../constants/scenes';

interface DevMenuConfig {
  debugMode: boolean;
  gateSeed: string;
}

export class DeveloperPanel extends BasePanel {
  onChange!: (config: DevMenuConfig) => void;
  private seedPopup: SeedEntryPopup;
  private confirmPopup: ConfirmPopup;
  private clickHandler: ((p: Phaser.Input.Pointer) => void) | null = null;

  private debugMode = false;
  private gateSeed = '';

  private titleText!: Phaser.GameObjects.Text;
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private rowZones: Phaser.GameObjects.Rectangle[] = [];
  private footerText!: Phaser.GameObjects.Text;
  private panelBlocker!: Phaser.GameObjects.Rectangle;

  private readonly ROWS = ['Debug Mode', 'Seed', 'Reset Game'];
  private readonly ROW_Y = 180;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.seedPopup = new SeedEntryPopup(scene);
    this.confirmPopup = new ConfirmPopup(scene);
    this.buildUI();
  }

  private buildUI(): void {
    this.createOverlay();
    this.panelBlocker = this.scene.add.rectangle(CX(), VH() / 2, VW(), VH(), 0x000000, 0)
      .setScrollFactor(0).setData('isUI', true).setInteractive();
    this.panelBlocker.on('pointerdown', () => {});
    this.container.add(this.panelBlocker);

    this.titleText = createText(this.scene, CX(), 60, 'Developer Menu', {
      fontSize: fs(18), fontFamily: 'Inter', resolution: 4, color: '#ff8844', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    for (let i = 0; i < 3; i++) {
      const t = createText(this.scene, CX(), this.ROW_Y + i * 60, '', {
        fontSize: fs(13), fontFamily: 'Inter', resolution: 4, color: '#b8a898',
      }).setOrigin(0.5);
      this.container.add(t);
      this.rowTexts.push(t);

      const zone = this.scene.add.rectangle(CX(), this.ROW_Y + i * 60, 260, 44, 0xffffff, 0)
        .setScrollFactor(0);
      zone.setVisible(false);
      this.container.add(zone);
      this.rowZones.push(zone);
    }

    this.footerText = createText(this.scene, CX(), VH() - 30, '', {
      fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#8a7a9a', align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.footerText);

    this.addCloseButton();
  }

  show(debugMode: boolean, gateSeed: string): void {
    this.debugMode = debugMode;
    this.gateSeed = gateSeed;

    this.render();
    this.rowZones.forEach(z => z.setVisible(true));

    this.clickHandler = (p: Phaser.Input.Pointer) => {
      if (this.seedPopup.isVisible() || this.confirmPopup.isVisible()) return;
      for (let i = 0; i < 3; i++) {
        const z = this.rowZones[i];
        if (z.visible) {
          const b = z.getBounds();
          if (b.contains(p.x, p.y)) {
            this.onRowClick(i);
            return;
          }
        }
      }
    };
    this.scene.input.on('pointerdown', this.clickHandler);

    this.fadeIn();
  }

  hide(): void {
    this.rowZones.forEach(z => z.setVisible(false));
    if (this.clickHandler) {
      this.scene.input.off('pointerdown', this.clickHandler);
      this.clickHandler = null;
    }
    super.hide();
  }

  private render(): void {
    const debugStr = this.debugMode ? 'ON' : 'OFF';
    const seedDisplay = this.gateSeed || '(empty)';

    this.rowTexts[0].setText(`Debug Mode:  ${debugStr}`);
    this.rowTexts[0].setColor(this.debugMode ? '#88cc88' : '#b8a898');

    this.rowTexts[1].setText(`Seed:  ${seedDisplay}`);
    this.rowTexts[1].setColor(this.gateSeed ? '#88cc88' : '#666666');

    this.rowTexts[2].setText('Reset Game');
    this.rowTexts[2].setColor('#cc6666');

    this.footerText.setText(getInputMode() !== 'keyboard'
      ? 'Tap a row to change'
      : '[W/S] nav  [SPACE] select  [ESC] close');
  }

  private onRowClick(idx: number): void {
    switch (idx) {
      case 0:
        this.debugMode = !this.debugMode;
        this.emitChange();
        this.render();
        break;
      case 1:
        this.seedPopup.show(this.gateSeed, (seed) => {
          this.gateSeed = seed;
          this.emitChange();
          this.render();
        });
        break;
      case 2:
        this.confirmPopup.show(
          'Reset all progress?',
          'This cannot be undone. All items, buildings, and research will be lost.',
          () => {
            gameState.resetProgress();
            if (this.debugMode) {
              const allBuildingIds = ['trading_post', 'crafting_station', 'farm', 'housing', 'storage', 'laboratory'];
              for (const id of allBuildingIds) {
                gameState.restoredBuildings.add(id);
              }
              gameState.maxStaminaBonus += 20;
              gameState.inventorySlotBonus += 8;
              gameState.inventory.expandSlots(8);
              gameState.save();
            }
            this.hide();
            this.scene.cameras.main.fadeOut(400, 0, 0, 0);
            this.scene.cameras.main.once('camerafadeoutcomplete', () => {
              this.scene.scene.start(SCENES.HOMELAND);
            });
          },
        );
        break;
    }
  }

  private emitChange(): void {
    this.onChange?.({ debugMode: this.debugMode, gateSeed: this.gateSeed });
  }

  onViewportResize(): void {
    super.onViewportResize();
    this.panelBlocker.setPosition(CX(), VH() / 2).setSize(VW(), VH());
    this.footerText.setPosition(CX(), VH() - 30);
    if (this._visible) this.render();
  }

  destroy(): void {
    this.seedPopup.destroy();
    this.confirmPopup.destroy();
    super.destroy();
  }
}
