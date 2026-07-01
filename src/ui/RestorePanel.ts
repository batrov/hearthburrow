import Phaser from 'phaser';
import { BasePanel } from './BasePanel';
import { gameState, itemDisplayName, itemIconKey } from '../systems/GameState';
import { canRestore } from '../systems/BuildingSystem';
import { getBuilding } from '../systems/DataRegistry';
import { CX, CY } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';

export class RestorePanel extends BasePanel {
  private contentContainer: Phaser.GameObjects.Container;
  private onCloseCb: () => void;
  private onRestoreCb: (buildingId: string) => void;
  private currentBuildingId: string = '';
  private restoreHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;

  constructor(scene: Phaser.Scene, onClose: () => void, onRestore: (buildingId: string) => void) {
    super(scene);
    this.onCloseCb = onClose;
    this.onRestoreCb = onRestore;

    this.createOverlay();
    this.overlay.clear();

    this.contentContainer = scene.add.container(0, 0);
    this.container.add(this.contentContainer);

    this.addCloseButton();
  }

  show(buildingId: string): void {
    const building = getBuilding(buildingId);
    if (!building) return;

    this.currentBuildingId = buildingId;

    if (this.restoreHandler) {
      this.scene.input.off('pointerdown', this.restoreHandler);
      this.restoreHandler = null;
    }

    this.contentContainer.removeAll(true);

    const costEntries = Object.entries(building.cost);
    const canAfford = canRestore(buildingId);

    this.overlay.clear();
    this.overlay.fillStyle(0x0a0a1a, 0.85);
    this.overlay.fillRoundedRect(CX - 180, CY - 110, 360, 220, 10);
    this.overlay.lineStyle(2, 0x6a5a8a, 1);
    this.overlay.strokeRoundedRect(CX - 180, CY - 110, 360, 220, 10);

    const lineH = 26;
    const totalLines = 5 + costEntries.length;
    const totalTextH = totalLines * lineH;
    const textTop = CY - totalTextH / 2;

    this.contentContainer.add(
      createText(this.scene, CX, textTop + 0 * lineH + lineH / 2, building.name, {
        fontSize: fs(14), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7',
      }).setOrigin(0.5)
    );

    this.contentContainer.add(
      createText(this.scene, CX, textTop + 1 * lineH + lineH / 2, building.description, {
        fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#a08559',
      }).setOrigin(0.5)
    );

    this.contentContainer.add(
      createText(this.scene, CX, textTop + 2 * lineH + lineH / 2, 'Required Materials:', {
        fontSize: fs(14), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7',
      }).setOrigin(0.5)
    );

    const spriteX = CX - 60;
    const textX = CX - 46;

    for (let i = 0; i < costEntries.length; i++) {
      const [id, qty] = costEntries[i];
      const have = gameState.inventory.count(id);
      const color = have >= qty ? '#88dd88' : '#dd6666';
      const y = textTop + (3 + i) * lineH + lineH / 2;

      const iconKey = itemIconKey(id);
      if (this.scene.textures.exists(iconKey)) {
        this.contentContainer.add(
          this.scene.add.image(spriteX, y, iconKey).setScale(0.65)
        );
      }

      this.contentContainer.add(
        createText(this.scene, textX, y, `${itemDisplayName(id)}: ${have}/${qty}`, {
          fontSize: fs(14), fontFamily: 'Inter', resolution: 4, color,
        }).setOrigin(0, 0.5)
      );
    }

    const btnY = textTop + (4 + costEntries.length) * lineH + lineH / 2;

    if (canAfford) {
      const restoreBg = this.scene.add.graphics();
      restoreBg.fillStyle(0x1a3a1a, 0.9);
      restoreBg.fillRoundedRect(CX - 90, btnY - 12, 80, 24, 4);
      restoreBg.lineStyle(1, 0x44aa44, 0.6);
      restoreBg.strokeRoundedRect(CX - 90, btnY - 12, 80, 24, 4);
      this.contentContainer.add(restoreBg);

      const restoreText = createText(this.scene, CX - 50, btnY, 'RESTORE', {
        fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#88ff88',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.contentContainer.add(restoreText);

      const cancelBg = this.scene.add.graphics();
      cancelBg.fillStyle(0x1a1a2e, 0.9);
      cancelBg.fillRoundedRect(CX + 10, btnY - 12, 80, 24, 4);
      cancelBg.lineStyle(1, 0x5a4a7a, 0.6);
      cancelBg.strokeRoundedRect(CX + 10, btnY - 12, 80, 24, 4);
      this.contentContainer.add(cancelBg);

      const cancelText = createText(this.scene, CX + 50, btnY, 'CANCEL', {
        fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#b8a8d8',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.contentContainer.add(cancelText);

      this.restoreHandler = (pointer: Phaser.Input.Pointer) => {
        if (restoreText.getBounds().contains(pointer.x, pointer.y)) {
          this.onRestoreCb(this.currentBuildingId);
        } else if (cancelText.getBounds().contains(pointer.x, pointer.y)) {
          this.hide();
        }
      };
      this.scene.input.on('pointerdown', this.restoreHandler);
    } else {
      const cancelBg = this.scene.add.graphics();
      cancelBg.fillStyle(0x1a1a2e, 0.9);
      cancelBg.fillRoundedRect(CX - 50, btnY - 12, 100, 24, 4);
      cancelBg.lineStyle(1, 0x5a4a7a, 0.6);
      cancelBg.strokeRoundedRect(CX - 50, btnY - 12, 100, 24, 4);
      this.contentContainer.add(cancelBg);

      const cancelText = createText(this.scene, CX, btnY, 'CANCEL', {
        fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#b8a8d8',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.contentContainer.add(cancelText);

      this.restoreHandler = (pointer: Phaser.Input.Pointer) => {
        if (cancelText.getBounds().contains(pointer.x, pointer.y)) {
          this.hide();
        }
      };
      this.scene.input.on('pointerdown', this.restoreHandler);
    }

    this.fadeIn();
  }

  hide(): void {
    if (this.restoreHandler) {
      this.scene.input.off('pointerdown', this.restoreHandler);
      this.restoreHandler = null;
    }
    this.onCloseCb();
    super.hide();
  }
}
