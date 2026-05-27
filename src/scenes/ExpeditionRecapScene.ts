import Phaser from 'phaser';
import { gameState, itemDisplayName } from '../systems/GameState';

interface NetItem {
  id: string;
  net: number;
  lost: number;
}

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

    const netItems = this.computeNet(result.itemsObtained, result.itemsLost);
    const totalLost = result.itemsLost.reduce((s, i) => s + i.quantity, 0);

    this.add.text(cx, 40, 'Expedition Results', {
      fontSize: '26px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, 72, isEmergency ? 'Emergency Extraction' : 'Safe Return', {
      fontSize: '14px', fontFamily: 'monospace', color: isEmergency ? '#cc4444' : '#44cc66',
    }).setOrigin(0.5);

    const panelX = 120;
    const panelW = 720;
    const panelY = 100;
    const panelH = 460;

    const bg = this.add.graphics();
    bg.fillStyle(0x12121e, 0.8);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    bg.lineStyle(1, 0x2a2a3a, 0.6);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);

    const colX = panelX + 40;
    const headerY = panelY + 30;
    const lineH = 26;

    this.add.text(colX, headerY, 'Items Collected', {
      fontSize: '16px', fontFamily: 'monospace', color: '#88dd88', fontStyle: 'bold',
    });

    for (let i = 0; i < netItems.length && i < 14; i++) {
      const item = netItems[i];
      const y = headerY + 34 + i * lineH;

      this.add.text(colX, y, itemDisplayName(item.id), {
        fontSize: '13px', fontFamily: 'monospace', color: '#c8b898',
      });

      this.add.text(colX + 300, y, `x${item.net}`, {
        fontSize: '13px', fontFamily: 'monospace', color: '#88dd88',
      });

      if (item.lost > 0) {
        this.add.text(colX + 380, y, `(-${item.lost} lost)`, {
          fontSize: '11px', fontFamily: 'monospace', color: '#dd6666',
        });
      }
    }

    if (netItems.length === 0) {
      this.add.text(colX, headerY + 34, '( nothing collected )', {
        fontSize: '13px', fontFamily: 'monospace', color: '#5a5a5a',
      });
    }

    if (totalLost > 0) {
      this.add.text(colX, panelY + panelH - 50, `Total lost: ${totalLost}`, {
        fontSize: '14px', fontFamily: 'monospace', color: '#dd6666',
      });
    }

    this.add.text(cx, 590, '[SPACE] Return to Homeland', {
      fontSize: '15px', fontFamily: 'monospace', color: '#6a5a8a',
    }).setOrigin(0.5);

    this.input.keyboard!.once('keydown-SPACE', () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('HomelandScene');
      });
    });
  }

  private computeNet(
    obtained: { id: string; quantity: number }[],
    lost: { id: string; quantity: number }[]
  ): NetItem[] {
    const map = new Map<string, NetItem>();

    for (const item of obtained) {
      map.set(item.id, { id: item.id, net: item.quantity, lost: 0 });
    }

    for (const item of lost) {
      const entry = map.get(item.id);
      if (entry) {
        entry.net -= item.quantity;
        entry.lost = item.quantity;
      }
    }

    return Array.from(map.values()).filter(i => i.net > 0);
  }
}
