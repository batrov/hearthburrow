import Phaser from 'phaser';
import { gameState, itemDisplayName } from '../systems/GameState';

export class ExpeditionRecapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ExpeditionRecapScene' });
  }

  create(): void {
    const result = gameState.lastRunResult;
    if (!result) {
      this.scene.start('HomelandScene');
      return;
    }

    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#0a0a1a');

    const cx = 960 / 2;
    const isEmergency = result.extractType === 'emergency';

    this.add.text(cx, 35, 'Expedition Results', {
      fontSize: '24px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, 63, isEmergency ? 'Emergency Extraction' : 'Safe Return', {
      fontSize: '14px', fontFamily: 'monospace', color: isEmergency ? '#cc4444' : '#44cc66',
    }).setOrigin(0.5);

    this.add.text(cx, 82, `Depth Reached: ${result.depth}`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#7a8a9a',
    }).setOrigin(0.5);

    const panelX = 120;
    const panelW = 720;
    const panelY = 100;
    const panelH = 460;
    const colGap = 40;
    const colW = (panelW - colGap * 3) / 2;
    const leftX = panelX + colGap;
    const rightX = leftX + colW + colGap * 2;
    const headerY = panelY + 20;
    const itemStartY = headerY + 30;
    const lineH = 24;

    const bg = this.add.graphics();
    bg.fillStyle(0x12121e, 0.8);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    bg.lineStyle(1, 0x2a2a3a, 0.6);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);

    this.add.text(leftX, headerY, 'Items Collected', {
      fontSize: '15px', fontFamily: 'monospace', color: '#88dd88', fontStyle: 'bold',
    });

    this.add.text(rightX, headerY, 'Items Lost', {
      fontSize: '15px', fontFamily: 'monospace', color: '#dd6666', fontStyle: 'bold',
    });

    const maxItemsPerCol = Math.floor((panelY + panelH - itemStartY - 10) / lineH);

    const netItems = this.computeNetItems(result.itemsObtained, result.itemsLost);

    this.renderList(leftX, itemStartY, lineH, netItems, maxItemsPerCol, '#c8b898', '#88dd88');

    this.renderList(rightX, itemStartY, lineH, result.itemsLost, maxItemsPerCol, '#c8b898', '#dd6666');

    this.add.text(cx, 590, '[SPACE] Return to Homeland', {
      fontSize: '14px', fontFamily: 'monospace', color: '#6a5a8a',
    }).setOrigin(0.5);

    this.input.keyboard!.once('keydown-SPACE', () => {
      if (gameState.restoredBuildings.has('farm') && gameState.farmPlanted > 0) {
        const yieldPer = Math.max(1, Math.floor(gameState.farmPlanted / 2));
        gameState.farmHarvest += yieldPer;
        gameState.save();
      }
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('HomelandScene');
      });
    });
  }

  private computeNetItems(
    obtained: { id: string; quantity: number }[],
    lost: { id: string; quantity: number }[]
  ): { id: string; quantity: number }[] {
    const map = new Map<string, number>();
    for (const item of obtained) {
      map.set(item.id, (map.get(item.id) ?? 0) + item.quantity);
    }
    for (const item of lost) {
      map.set(item.id, Math.max(0, (map.get(item.id) ?? 0) - item.quantity));
    }
    return Array.from(map.entries())
      .filter(([_, qty]) => qty > 0)
      .map(([id, quantity]) => ({ id, quantity }));
  }

  private renderList(
    x: number, startY: number, lineH: number,
    items: { id: string; quantity: number }[],
    maxItems: number,
    nameColor: string, qtyColor: string
  ): void {
    if (items.length === 0) {
      this.add.text(x, startY, '(none)', {
        fontSize: '13px', fontFamily: 'monospace', color: '#5a5a5a',
      });
      return;
    }

    const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
    const shown = sorted.slice(0, maxItems);
    const labelW = 140;

    for (let i = 0; i < shown.length; i++) {
      const item = shown[i];
      const y = startY + i * lineH;

      this.add.text(x, y, itemDisplayName(item.id), {
        fontSize: '13px', fontFamily: 'monospace', color: nameColor,
      });

      const qtyText = this.add.text(x + labelW, y, 'x0', {
        fontSize: '13px', fontFamily: 'monospace', color: qtyColor,
      });

      const data = { count: 0 };
      this.tweens.add({
        targets: data,
        count: item.quantity,
        duration: 2000,
        delay: 80 * i,
        ease: 'Quad.easeOut',
        onUpdate: () => {
          qtyText.setText(`x${Math.round(data.count)}`);
        },
      });
    }

    if (sorted.length > maxItems) {
      this.add.text(x, startY + maxItems * lineH, '...', {
        fontSize: '13px', fontFamily: 'monospace', color: '#5a5a5a',
      });
    }
  }
}
