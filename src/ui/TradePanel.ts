import Phaser from 'phaser';
import { gameState, itemDisplayName, itemIconKey } from '../systems/GameState';
import { audio } from '../systems/AudioSystem';
import { BasePanel } from './BasePanel';
import { VW, CX } from '../systems/Viewport';
import { fs, createText } from '../systems/Font';
import { UiButton } from './UiButton';

interface TradeItem {
  id: string;
  label: string;
  type: 'buy' | 'sell';
  priceId: string;
  priceQty: number;
}

const TRADE_ITEMS: TradeItem[] = [
  { id: 'stamina_potion', label: 'Stamina Potion', type: 'buy', priceId: 'carrot', priceQty: 2 },
  { id: 'teleport_scroll', label: 'Teleport Scroll', type: 'buy', priceId: 'carrot', priceQty: 3 },
  { id: 'mining_bomb', label: 'Mining Bomb', type: 'buy', priceId: 'carrot', priceQty: 2 },
  { id: 'stone', label: 'Stone', type: 'sell', priceId: 'carrot', priceQty: 1 },
  { id: 'bronze_ore', label: 'Bronze Ore', type: 'sell', priceId: 'carrot', priceQty: 2 },
  { id: 'silver_ore', label: 'Silver Ore', type: 'sell', priceId: 'carrot', priceQty: 3 },
  { id: 'monster_drop', label: 'Monster Essence', type: 'sell', priceId: 'carrot', priceQty: 1 },
];

export class TradePanel extends BasePanel {
  private text: Phaser.GameObjects.Text;
  private itemRows: Phaser.GameObjects.Container;
  private selectionIndex: number = 0;
  private clickZones: Phaser.GameObjects.Zone[] = [];
  private rowButtons: UiButton[] = [];
  private onCarrotChange: (() => void) | null;
  private clickHandler: ((p: Phaser.Input.Pointer) => void) | null = null;

  constructor(scene: Phaser.Scene, onCarrotChange: (() => void) | null = null) {
    super(scene);
    this.onCarrotChange = onCarrotChange;

    this.createOverlay();

    this.text = createText(scene, CX(), 44, '', {
      fontSize: fs(13), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7',
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);
    this.container.add(this.text);

    this.itemRows = scene.add.container(0, 0);
    this.container.add(this.itemRows);

    this.addCloseButton();
  }

  show(): void {
    this.selectionIndex = 0;
    this.render();
    this.fadeIn();

    this.clickHandler = (p: Phaser.Input.Pointer) => {
      if (!this._visible) return;
      for (const btn of this.rowButtons) {
        if (btn.handleClick(p)) return;
      }
    };
    this.scene.input.on('pointerdown', this.clickHandler);
  }

  hide(): void {
    if (this.clickHandler) {
      this.scene.input.off('pointerdown', this.clickHandler);
      this.clickHandler = null;
    }
    this.fadeOut();
  }

  private doTrade(item: TradeItem): void {
    if (item.type === 'buy') {
      const hasGold = gameState.inventory.count(item.priceId) >= item.priceQty;
      if (hasGold) {
        gameState.inventory.removeItem(item.priceId, item.priceQty);
        gameState.inventory.addItem(item.id, 1);
        audio.playItemPickup();
        gameState.save();
        this.onCarrotChange?.();
      } else {
        audio.playError();
      }
    } else {
      const hasItem = gameState.inventory.count(item.id) >= 1;
      if (hasItem) {
        gameState.inventory.removeItem(item.id, 1);
        gameState.inventory.addItem(item.priceId, item.priceQty);
        audio.playItemPickup();
        gameState.save();
        this.onCarrotChange?.();
      } else {
        audio.playError();
      }
    }
    this.render();
  }

  navigateUp(): void {
    if (this.selectionIndex > 0) {
      this.selectionIndex--;
      this.render();
    }
  }

  navigateDown(): void {
    if (this.selectionIndex < TRADE_ITEMS.length - 1) {
      this.selectionIndex++;
      this.render();
    }
  }

  confirm(): void {
    const item = TRADE_ITEMS[this.selectionIndex];
    if (!item) return;
    this.doTrade(item);
  }

  private render(): void {
    this.clickZones.forEach(z => z.destroy());
    this.clickZones = [];
    this.rowButtons.forEach(b => b.destroy());
    this.rowButtons = [];

    const carrot = gameState.inventory.count('carrot');
    const lines: string[] = [
      '--- Trading Post ---',
      '',
      `Carrots: ${carrot}`,
      '',
    ];
    this.text.setText(lines.join('\n'));

    this.itemRows.removeAll(true);
    const ROW_H = 28;
    const baseY = 44 + 4 * 18;
    let y = baseY;

    const renderSection = (type: 'buy' | 'sell', color: string): void => {
      const sectionItems = TRADE_ITEMS.filter(t => t.type === type);
      if (sectionItems.length === 0) return;

      this.itemRows.add(createText(this.scene, CX(), y, `── ${type === 'buy' ? 'Buy' : 'Sell'} ──`, {
        fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color, fontStyle: 'bold',
      }).setOrigin(0.5, 0.5));
      y += ROW_H;

      for (const item of sectionItems) {
        const i = TRADE_ITEMS.indexOf(item);
        const cursor = i === this.selectionIndex ? '▸' : ' ';
        const label = `${cursor} ${item.label}`;

        const row = this.scene.add.container(0, 0);
        const iconKey = itemIconKey(item.id);
        if (this.scene.textures.exists(iconKey)) {
          row.add(this.scene.add.image(20, y, iconKey).setScale(0.7));
        }
        row.add(createText(this.scene, 36, y, label, {
          fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7',
        }).setOrigin(0, 0.5));

        const have = gameState.inventory.count(item.id);
        row.add(createText(this.scene, VW() - 120, y, `(have ${have})`, {
          fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#8a8a9a',
        }).setOrigin(1, 0.5));
        this.itemRows.add(row);

        const btnX = VW() - 72;
        const btn = new UiButton(this.scene, btnX, y, `${item.priceQty}🥕`, 56, 22,
          () => this.doTrade(item),
          { color, fontSize: fs(10) }
        );
        btn.setDepth(210);
        for (const c of btn.getChildren()) this.container.add(c);
        this.rowButtons.push(btn);

        const zone = this.scene.add.zone(CX(), y, VW() - 32, ROW_H)
          .setDepth(210)
          .setScrollFactor(0)
          .setInteractive();
        zone.on('pointerdown', () => {
          this.selectionIndex = i;
          this.render();
        });
        this.container.add(zone);
        this.clickZones.push(zone);

        y += ROW_H;
      }
    };

    renderSection('buy', '#44cc66');
    y += 8;
    renderSection('sell', '#ccaa44');

    this.text.setText(lines.join('\n'));
  }

  protected relayout(): void {
    super.relayout();
    this.text.setPosition(CX(), 44);
    if (this._visible) this.render();
  }
}
