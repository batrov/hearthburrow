import Phaser from 'phaser';
import { gameState, itemDisplayName } from '../systems/GameState';

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

export class TradePanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private visible: boolean = false;
  private selectionIndex: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.text = scene.add.text(960 / 2, 50, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#e8d5b7',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0);
    this.container.add(this.text);

    this.container.setVisible(false);
  }

  show(): void {
    this.visible = true;
    this.selectionIndex = 0;
    this.render();
    this.container.setVisible(true);
  }

  hide(): void {
    this.visible = false;
    this.container.setVisible(false);
  }

  isVisible(): boolean {
    return this.visible;
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
        gameState.save();
      }
    } else {
      const hasItem = gameState.inventory.count(item.id) >= 1;
      if (hasItem) {
        gameState.inventory.removeItem(item.id, 1);
        gameState.inventory.addItem(item.priceId, item.priceQty);
        gameState.save();
      }
    }
    this.render();
  }

  private render(): void {
    this.bg.clear();
    this.bg.fillStyle(0x0a0a1a, 0.92);
    this.bg.fillRect(0, 0, 960, 640);
    this.bg.lineStyle(1, 0x3a3a4a, 0.5);
    this.bg.strokeRect(40, 40, 880, 560);

    const carrot = gameState.inventory.count('carrot');
    const lines: string[] = [
      '--- Trading Post ---',
      '',
      `Carrots: ${carrot}`,
      '',
      '',
    ];

    for (let i = 0; i < TRADE_ITEMS.length; i++) {
      const item = TRADE_ITEMS[i];
      const cursor = i === this.selectionIndex ? '▸' : ' ';
      const tag = item.type === 'buy' ? 'BUY ' : 'SELL';
      const label = `${tag} ${item.label.padEnd(18)}`;
      const price = `${item.priceQty} ${itemDisplayName(item.priceId)}`;
      const have = gameState.inventory.count(item.id);
      const haveText = item.type === 'buy' ? '' : `  (have ${have})`;
      lines.push(` ${cursor} ${label} ${price}${haveText}`);
    }

    lines.push('', '', '  [W/S] navigate  [SPACE] trade  [ESC] close');
    this.text.setText(lines.join('\n'));
  }
}
