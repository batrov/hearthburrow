import Phaser from 'phaser';
import { BasePanel } from './BasePanel';
import { gameState, itemDisplayName, itemIconKey } from '../systems/GameState';
import { canRestore } from '../systems/BuildingSystem';
import { getBuilding } from '../systems/DataRegistry';
import { CX, CY } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';
import { NineSliceBg } from './NineSliceBg';
import { UiButton } from './UiButton';

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

    const lineH = 26;
    const totalLines = 5 + costEntries.length;
    const totalTextH = totalLines * lineH;

    this.contentContainer.add(
      NineSliceBg.modal(this.scene, CX(), CY(), 360, totalTextH + 16)
    );
    const textTop = CY() - totalTextH / 2;

    this.contentContainer.add(
      createText(this.scene, CX(), textTop + 0 * lineH + lineH / 2, building.name, {
        fontSize: fs(14), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7',
      }).setOrigin(0.5)
    );

    this.contentContainer.add(
      createText(this.scene, CX(), textTop + 1 * lineH + lineH / 2, building.description, {
        fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#a08559',
      }).setOrigin(0.5)
    );

    this.contentContainer.add(
      createText(this.scene, CX(), textTop + 2 * lineH + lineH / 2, 'Required Materials:', {
        fontSize: fs(14), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7',
      }).setOrigin(0.5)
    );

    const spriteX = CX() - 60;
    const textX = CX() - 46;

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
      const restoreBtn = new UiButton(this.scene, CX() - 50, btnY, 'RESTORE', 80, 24,
        () => this.onRestoreCb(this.currentBuildingId),
        { fontSize: fs(11), color: '#88ff88' });
      for (const c of restoreBtn.getChildren()) this.contentContainer.add(c);

      const cancelBtn = new UiButton(this.scene, CX() + 50, btnY, 'CANCEL', 80, 24,
        () => this.hide(),
        { fontSize: fs(11), color: '#b8a8d8' });
      for (const c of cancelBtn.getChildren()) this.contentContainer.add(c);

      this.restoreHandler = (pointer: Phaser.Input.Pointer) => {
        restoreBtn.handleClick(pointer);
        cancelBtn.handleClick(pointer);
      };
      this.scene.input.on('pointerdown', this.restoreHandler);
    } else {
      const cancelBtn = new UiButton(this.scene, CX(), btnY, 'CANCEL', 100, 24,
        () => this.hide(),
        { fontSize: fs(11), color: '#b8a8d8' });
      for (const c of cancelBtn.getChildren()) this.contentContainer.add(c);

      this.restoreHandler = (pointer: Phaser.Input.Pointer) => {
        cancelBtn.handleClick(pointer);
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
