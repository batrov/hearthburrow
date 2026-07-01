import Phaser from 'phaser';
import { gameState, itemDisplayName, itemIconKey, itemIdFromDisplayName } from '../systems/GameState';
import { VW, VH, CX, CY } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';

export class ExpeditionRecapScene extends Phaser.Scene {
  private scrollY: number = 0;
  private maxScroll: number = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private scrollbar!: Phaser.GameObjects.Graphics;
  private readonly SCROLL_SPEED = 28;

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

    const isEmergency = result.extractType === 'emergency';

    createText(this, CX, 28, 'Expedition Results', {
      fontSize: fs(20), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);

    createText(this, CX, 50, isEmergency ? 'Emergency Extraction' : 'Safe Return', {
      fontSize: fs(13), fontFamily: 'Inter', resolution: 4, color: isEmergency ? '#cc4444' : '#44cc66',
    }).setOrigin(0.5);

    createText(this, CX, 68, `Depth Reached: ${result.depth}`, {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#7a8a9a',
    }).setOrigin(0.5);

    const panelX = 12, panelW = VW - 24, panelY = 80, panelH = VH - 180;
    const lineH = 22;
    const leftX = panelX + 16;
    const viewportX = panelX + 6;
    const viewportY = panelY + 22;
    const viewportW = panelW - 12;
    const viewportH = panelH - 34;

    const bg = this.add.graphics();
    bg.fillStyle(0x12121e, 0.8);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    bg.lineStyle(1, 0x2a2a3a, 0.6);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);

    this.contentContainer = this.add.container(0, 0).setVisible(false);

    this.scrollbar = this.add.graphics();

    let contentY = viewportY;

    const netItems = this.computeNetItems(result.itemsObtained, result.itemsLost);

    if (netItems.length > 0) {
      createText(this, leftX, contentY, 'Items Collected', {
        fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#88dd88', fontStyle: 'bold',
      });
      contentY += 20;

      const nextY = this.renderList(leftX, contentY, lineH, netItems, '#c8b898', '#88dd88');
      contentY = nextY + 6;
    }

    if (result.itemsLost.length > 0) {
      createText(this, leftX, contentY, 'Items Lost', {
        fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#dd6666', fontStyle: 'bold',
      });
      contentY += 20;

      const nextY = this.renderList(leftX, contentY, lineH, result.itemsLost, '#c8b898', '#dd6666');
      contentY = nextY + 6;
    }

    const rescued = result.villagersRescued;
    if (rescued.length > 0) {
      createText(this, leftX, contentY, 'Rescued', {
        fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#44cc66', fontStyle: 'bold',
      });
      contentY += 18;

      let rx = leftX;
      const maxRX = panelX + panelW - 16;
      for (const v of rescued) {
        const iconKey = 'npc_' + v.variant;
        const entryW = 10 + v.name.length * 7 + 14;
        if (rx + entryW > maxRX) { rx = leftX; contentY += 18; }
        if (this.textures.exists(iconKey)) {
          this.add.image(rx, contentY + 6, iconKey).setScale(0.45);
        }
        createText(this, rx + 10, contentY, v.name, {
          fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#c8b898',
        });
        rx += entryW;
      }
      contentY += 20;
    }

    const recipes = result.recipesDiscovered;
    if (recipes.length > 0) {
      createText(this, leftX, contentY, 'Discovered', {
        fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#88ddff', fontStyle: 'bold',
      });
      contentY += 18;

      let rx = leftX;
      const maxRX = panelX + panelW - 16;
      for (const name of recipes) {
        const itemId = itemIdFromDisplayName(name);
        const entryW = (itemId ? 10 : 0) + name.length * 7 + 14;
        if (rx + entryW > maxRX) { rx = leftX; contentY += 18; }
        if (itemId && this.textures.exists(itemIconKey(itemId))) {
          this.add.image(rx, contentY + 6, itemIconKey(itemId)).setScale(0.45);
        }
        createText(this, rx + (itemId ? 10 : 0), contentY, name, {
          fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#b8b8c8',
        });
        rx += entryW;
      }
      contentY += 20;
    }

    if (result.farmYield > 0) {
      createText(this, leftX, contentY, `Farm grew ${result.farmYield} carrots!`, {
        fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#88dd88',
      });
      contentY += 20;
    }

    const contentBottom = contentY + 8;
    const viewportBottom = viewportY + viewportH;
    this.maxScroll = Math.max(0, contentBottom - viewportBottom);

    const hintY = panelY + panelH + 10;
    if (gameState.currentRunSeed) {
      createText(this, CX, hintY - 10, `Seed: ${gameState.currentRunSeed}`, {
        fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#5a5a6a',
      }).setOrigin(0.5);
    }

    createText(this, CX, hintY + 4, '[SPACE] Return   [W/S] Scroll', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#6a5a8a',
    }).setOrigin(0.5);

    const btnX = CX - 80, btnY = hintY + 20, btnW = 160, btnH = 28;
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x1a1a2e, 0.9);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
    btnBg.lineStyle(1, 0x5a4a7a, 0.6);
    btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);

    const btnText = createText(this, btnX + btnW / 2, btnY + btnH / 2, 'Return to Homeland', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#b8a8d8',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btnText.on('pointerover', () => btnText.setColor('#e8d8ff'));
    btnText.on('pointerout', () => btnText.setColor('#b8a8d8'));
    btnText.on('pointerdown', () => this.returnToHomeland());

    this.updateScrollbar(viewportX, viewportY, viewportH);

    const doScroll = (dy: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + dy, 0, this.maxScroll);
      this.contentContainer.y = -this.scrollY;
      this.updateScrollbar(viewportX, viewportY, viewportH);
    };

    this.input.keyboard!.on('keydown-W', () => doScroll(-this.SCROLL_SPEED));
    this.input.keyboard!.on('keydown-UP', () => doScroll(-this.SCROLL_SPEED));
    this.input.keyboard!.on('keydown-S', () => doScroll(this.SCROLL_SPEED));
    this.input.keyboard!.on('keydown-DOWN', () => doScroll(this.SCROLL_SPEED));

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gx: number[], _gy: number[], _gz: number[], dz: number) => {
      doScroll(dz > 0 ? this.SCROLL_SPEED : -this.SCROLL_SPEED);
    });

    this.input.keyboard!.once('keydown-SPACE', () => this.returnToHomeland());
  }

  private returnToHomeland(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HomelandScene');
    });
  }

  private updateScrollbar(vx: number, vy: number, vh: number): void {
    this.scrollbar.clear();
    if (this.maxScroll <= 0) return;

    const barH = Math.max(16, vh * (vh / (vh + this.maxScroll)));
    const barY = vy + (this.scrollY / this.maxScroll) * (vh - barH);
    const barX = vx + VW - 40;

    this.scrollbar.fillStyle(0x5a5a7a, 0.5);
    this.scrollbar.fillRoundedRect(barX, barY, 4, barH, 2);
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
    nameColor: string, qtyColor: string
  ): number {
    if (items.length === 0) return startY;

    const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
    const labelW = 120;

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      const y = startY + i * lineH;

      const iconKey = itemIconKey(item.id);
      this.add.image(x, y + 6, iconKey).setScale(0.6);

      createText(this, x + 16, y, itemDisplayName(item.id), {
        fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: nameColor,
      });

      const qtyText = createText(this, x + 16 + labelW, y, 'x0', {
        fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: qtyColor,
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

    return startY + sorted.length * lineH;
  }
}
