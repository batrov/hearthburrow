import Phaser from 'phaser';
import { gameState, itemDisplayName, itemIconKey, itemIdFromDisplayName } from '../systems/GameState';

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

    const panelX = 120, panelW = 720, panelY = 100, panelH = 460;
    const colGap = 40;
    const colW = (panelW - colGap * 3) / 2;
    const leftX = panelX + colGap;
    const rightX = leftX + colW + colGap * 2;
    const lineH = 24;

    const viewportX = panelX + 10;
    const viewportY = panelY + 25;
    const viewportW = panelW - 20;
    const viewportH = panelH - 40;

    const bg = this.add.graphics();
    bg.fillStyle(0x12121e, 0.8);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    bg.lineStyle(1, 0x2a2a3a, 0.6);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);

    this.contentContainer = this.add.container(0, 0).setVisible(false);

    this.scrollbar = this.add.graphics();

    let contentY = viewportY;

    const netItems = this.computeNetItems(result.itemsObtained, result.itemsLost);

    const noItems = netItems.length === 0 && result.itemsLost.length === 0;

    if (!noItems) {
      this.add.text(leftX, contentY, 'Items Collected', {
        fontSize: '15px', fontFamily: 'monospace', color: '#88dd88', fontStyle: 'bold',
      });

      this.add.text(rightX, contentY, 'Items Lost', {
        fontSize: '15px', fontFamily: 'monospace', color: '#dd6666', fontStyle: 'bold',
      });

      contentY += 24;

      const next1 = this.renderList(leftX, contentY, lineH, netItems, '#c8b898', '#88dd88');
      const next2 = this.renderList(rightX, contentY, lineH, result.itemsLost, '#c8b898', '#dd6666');
      contentY = Math.max(next1, next2) + 8;
    }

    const rescued = result.villagersRescued;
    if (rescued.length > 0) {
      const rescuedLabel = this.add.text(leftX, contentY, 'Rescued', {
        fontSize: '13px', fontFamily: 'monospace', color: '#44cc66', fontStyle: 'bold',
      });
      this.contentContainer.add(rescuedLabel);
      contentY += 18;

      let rx = leftX;
      const maxRX = panelX + panelW - 20;
      for (const v of rescued) {
        const iconKey = 'npc_' + v.variant;
        const entryW = 12 + v.name.length * 8 + 16;
        if (rx + entryW > maxRX) { rx = leftX; contentY += 18; }
        if (this.textures.exists(iconKey)) {
          const img = this.add.image(rx, contentY + 6, iconKey).setScale(0.5);
        }
        const t = this.add.text(rx + 12, contentY, v.name, {
          fontSize: '13px', fontFamily: 'monospace', color: '#c8b898',
        });
        rx += entryW;
      }
      contentY += 22;
    }

    const recipes = result.recipesDiscovered;
    if (recipes.length > 0) {
      const recipeLabel = this.add.text(leftX, contentY, 'Discovered', {
        fontSize: '13px', fontFamily: 'monospace', color: '#88ddff', fontStyle: 'bold',
      });
      contentY += 18;

      let rx = leftX;
      const maxRX = panelX + panelW - 20;
      for (const name of recipes) {
        const itemId = itemIdFromDisplayName(name);
        const entryW = (itemId ? 12 : 0) + name.length * 8 + 16;
        if (rx + entryW > maxRX) { rx = leftX; contentY += 18; }
        if (itemId && this.textures.exists(itemIconKey(itemId))) {
          const img = this.add.image(rx, contentY + 6, itemIconKey(itemId)).setScale(0.5);
        }
        const t = this.add.text(rx + (itemId ? 12 : 0), contentY, name, {
          fontSize: '13px', fontFamily: 'monospace', color: '#b8b8c8',
        });
        rx += entryW;
      }
      contentY += 22;
    }

    const contentBottom = contentY + 10;
    const viewportBottom = viewportY + viewportH;
    this.maxScroll = Math.max(0, contentBottom - viewportBottom);

    const hintY = panelY + panelH + 16;
    if (gameState.currentRunSeed) {
      this.add.text(cx, hintY - 12, `Seed: ${gameState.currentRunSeed}`, {
        fontSize: '11px', fontFamily: 'monospace', color: '#5a5a6a',
      }).setOrigin(0.5);
    }

    this.add.text(cx, hintY, '[SPACE] Return to Homeland   [W/S] Scroll', {
      fontSize: '13px', fontFamily: 'monospace', color: '#6a5a8a',
    }).setOrigin(0.5);

    const btnX = 730, btnY = 590, btnW = 200, btnH = 32;
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x1a1a2e, 0.9);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
    btnBg.lineStyle(1, 0x5a4a7a, 0.6);
    btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);

    const btnText = this.add.text(btnX + btnW / 2, btnY + btnH / 2, 'Return to Homeland', {
      fontSize: '13px', fontFamily: 'monospace', color: '#b8a8d8',
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
    const result = gameState.lastRunResult;
    if (result && gameState.restoredBuildings.has('farm') && gameState.farmPlanted > 0) {
      const yieldPer = Math.max(1, Math.floor(gameState.farmPlanted / 2));
      gameState.farmHarvest += yieldPer;
      gameState.save();
    }
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HomelandScene');
    });
  }

  private updateScrollbar(vx: number, vy: number, vh: number): void {
    this.scrollbar.clear();
    if (this.maxScroll <= 0) return;

    const barH = Math.max(20, vh * (vh / (vh + this.maxScroll)));
    const barY = vy + (this.scrollY / this.maxScroll) * (vh - barH);
    const barX = vx + 698;

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
    const labelW = 140;

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      const y = startY + i * lineH;

      const iconKey = itemIconKey(item.id);
      const img = this.add.image(x, y + 7, iconKey).setScale(0.7);

      const nameText = this.add.text(x + 18, y, itemDisplayName(item.id), {
        fontSize: '13px', fontFamily: 'monospace', color: nameColor,
      });

      const qtyText = this.add.text(x + 18 + labelW, y, 'x0', {
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

    return startY + sorted.length * lineH;
  }
}
