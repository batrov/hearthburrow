import Phaser from 'phaser';
import { gameState, itemDisplayName, itemIconKey } from '../systems/GameState';
import { audio } from '../systems/AudioSystem';
import { BasePanel } from './BasePanel';
import { VW, VH, CX } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';
import { getInputMode } from '../systems/InputMode';
import { NineSliceBg } from './NineSliceBg';
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

  constructor(scene: Phaser.Scene) {
    super(scene);

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

    if (item.type === 'buy') {
      const hasGold = gameState.inventory.count(item.priceId) >= item.priceQty;
      if (hasGold) {
        gameState.inventory.removeItem(item.priceId, item.priceQty);
        gameState.inventory.addItem(item.id, 1);
        audio.playItemPickup();
        gameState.save();
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
      } else {
        audio.playError();
      }
    }
    this.render();
  }

  private render(): void {
    this.clickZones.forEach(z => z.destroy());
    this.clickZones = [];

    const carrot = gameState.inventory.count('carrot');
    const lines: string[] = [
      '--- Trading Post ---',
      '',
      `Carrots: ${carrot}`,
      '',
      '',
    ];

    this.text.setText(lines.join('\n'));

    this.itemRows.removeAll(true);
    const baseY = 44 + 5 * 18;
    for (let i = 0; i < TRADE_ITEMS.length; i++) {
      const item = TRADE_ITEMS[i];
      const cursor = i === this.selectionIndex ? '▸' : ' ';
      const tag = item.type === 'buy' ? 'BUY ' : 'SELL';
      const label = `${tag} ${item.label.padEnd(14)}`;
      const price = `${item.priceQty} ${itemDisplayName(item.priceId)}`;
      const have = gameState.inventory.count(item.id);
      const haveText = item.type === 'buy' ? '' : `  (have ${have})`;
      const y = baseY + i * 20;

      const row = this.scene.add.container(0, 0);
      const iconKey = itemIconKey(item.id);
      if (this.scene.textures.exists(iconKey)) {
        row.add(this.scene.add.image(30, y, iconKey).setScale(0.6));
      }
      row.add(createText(this.scene, 46, y, `${cursor} ${label}`, {
        fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7',
      }).setOrigin(0, 0.5));
      row.add(createText(this.scene, CX() + 20, y, `${item.priceQty}${haveText}`, {
        fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7',
      }).setOrigin(0, 0.5));
      this.itemRows.add(row);

      const zone = this.scene.add.zone(CX(), y, VW() - 32, 40)
        .setDepth(210)
        .setScrollFactor(0)
        .setInteractive();
      zone.on('pointerdown', () => {
        this.selectionIndex = i;
        this.render();
        this.confirm();
      });
      this.container.add(zone);
      this.clickZones.push(zone);
    }

    lines.push('', '', getInputMode() !== 'keyboard' ? '  Tap to navigate & trade' : '  [W/S] navigate  [SPACE] trade  [ESC] close');
    this.text.setText(lines.join('\n'));
  }
}
