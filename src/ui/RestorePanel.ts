import Phaser from 'phaser';
import { BasePanel } from './BasePanel';
import { gameState, itemDisplayName, itemIconKey } from '../systems/GameState';
import { canRestore } from '../systems/BuildingSystem';
import { getBuilding } from '../systems/DataRegistry';

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

    this.addCloseButton(665, 216);
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
    this.overlay.fillRoundedRect(480 - 200, 320 - 110, 400, 220, 10);
    this.overlay.lineStyle(2, 0x6a5a8a, 1);
    this.overlay.strokeRoundedRect(480 - 200, 320 - 110, 400, 220, 10);

    const lineH = 28;
    const totalLines = 5 + costEntries.length;
    const totalTextH = totalLines * lineH;
    const textTop = 320 - totalTextH / 2;

    this.contentContainer.add(
      this.scene.add.text(480, textTop + 0 * lineH + lineH / 2, building.name, {
        fontSize: '16px', fontFamily: 'monospace', color: '#e8d5b7',
      }).setOrigin(0.5)
    );

    this.contentContainer.add(
      this.scene.add.text(480, textTop + 1 * lineH + lineH / 2, building.description, {
        fontSize: '12px', fontFamily: 'monospace', color: '#a08559',
      }).setOrigin(0.5)
    );

    this.contentContainer.add(
      this.scene.add.text(480, textTop + 2 * lineH + lineH / 2, 'Required Materials:', {
        fontSize: '16px', fontFamily: 'monospace', color: '#e8d5b7',
      }).setOrigin(0.5)
    );

    const spriteX = 420;
    const textX = 435;

    for (let i = 0; i < costEntries.length; i++) {
      const [id, qty] = costEntries[i];
      const have = gameState.inventory.count(id);
      const color = have >= qty ? '#88dd88' : '#dd6666';
      const y = textTop + (3 + i) * lineH + lineH / 2;

      const iconKey = itemIconKey(id);
      if (this.scene.textures.exists(iconKey)) {
        this.contentContainer.add(
          this.scene.add.image(spriteX, y, iconKey).setScale(0.7)
        );
      }

      this.contentContainer.add(
        this.scene.add.text(textX, y, `${itemDisplayName(id)}: ${have}/${qty}`, {
          fontSize: '16px', fontFamily: 'monospace', color,
        }).setOrigin(0, 0.5)
      );
    }

    const btnY = textTop + (4 + costEntries.length) * lineH + lineH / 2;

    if (canAfford) {
      const restoreBg = this.scene.add.graphics();
      restoreBg.fillStyle(0x1a3a1a, 0.9);
      restoreBg.fillRoundedRect(360, btnY - 14, 100, 28, 6);
      restoreBg.lineStyle(1, 0x44aa44, 0.6);
      restoreBg.strokeRoundedRect(360, btnY - 14, 100, 28, 6);
      this.contentContainer.add(restoreBg);

      const restoreText = this.scene.add.text(410, btnY, 'RESTORE', {
        fontSize: '13px', fontFamily: 'monospace', color: '#88ff88',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.contentContainer.add(restoreText);

      const cancelBg = this.scene.add.graphics();
      cancelBg.fillStyle(0x1a1a2e, 0.9);
      cancelBg.fillRoundedRect(500, btnY - 14, 100, 28, 6);
      cancelBg.lineStyle(1, 0x5a4a7a, 0.6);
      cancelBg.strokeRoundedRect(500, btnY - 14, 100, 28, 6);
      this.contentContainer.add(cancelBg);

      const cancelText = this.scene.add.text(550, btnY, 'CANCEL', {
        fontSize: '13px', fontFamily: 'monospace', color: '#b8a8d8',
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
      cancelBg.fillRoundedRect(430, btnY - 14, 100, 28, 6);
      cancelBg.lineStyle(1, 0x5a4a7a, 0.6);
      cancelBg.strokeRoundedRect(430, btnY - 14, 100, 28, 6);
      this.contentContainer.add(cancelBg);

      const cancelText = this.scene.add.text(480, btnY, 'CANCEL', {
        fontSize: '13px', fontFamily: 'monospace', color: '#b8a8d8',
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
