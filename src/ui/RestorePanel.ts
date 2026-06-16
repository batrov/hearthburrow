import Phaser from 'phaser';
import { BasePanel } from './BasePanel';
import { gameState, itemDisplayName, itemIconKey } from '../systems/GameState';
import { canRestore } from '../systems/BuildingSystem';
import { getBuilding } from '../systems/DataRegistry';

export class RestorePanel extends BasePanel {
  private contentContainer: Phaser.GameObjects.Container;
  private closeBtn: Phaser.GameObjects.Text;
  private onCloseCb: () => void;

  constructor(scene: Phaser.Scene, onClose: () => void) {
    super(scene);
    this.onCloseCb = onClose;

    this.createOverlay();
    this.overlay.clear();

    this.contentContainer = scene.add.container(0, 0);
    this.container.add(this.contentContainer);

    this.closeBtn = scene.add.text(665, 216, '[X]', {
      fontSize: '14px', fontFamily: 'monospace', color: '#886666',
    }).setOrigin(0.5).setDepth(220).setInteractive({ useHandCursor: true }).setData('isUI', true);
    this.closeBtn.on('pointerdown', () => this.hide());
    this.container.add(this.closeBtn);
  }

  show(buildingId: string): void {
    const building = getBuilding(buildingId);
    if (!building) return;

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

    this.contentContainer.add(
      this.scene.add.text(480, textTop + (4 + costEntries.length) * lineH + lineH / 2,
        canAfford ? '[SPACE] Restore  |  [ESC] cancel' : '[ESC] close', {
        fontSize: '16px', fontFamily: 'monospace', color: '#e8d5b7',
      }).setOrigin(0.5)
    );

    this.fadeIn();
  }

  hide(): void {
    this.onCloseCb();
    super.hide();
  }
}
