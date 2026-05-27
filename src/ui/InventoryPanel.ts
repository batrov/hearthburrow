import Phaser from 'phaser';
import { InventorySystem } from '../systems/InventorySystem';
import { itemDisplayName } from '../systems/GameState';

export class InventoryPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private contentText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private visible: boolean = false;
  private inventory: InventorySystem;
  private panelTitle: string;

  constructor(scene: Phaser.Scene, inventory: InventorySystem, title: string = 'Inventory') {
    this.scene = scene;
    this.inventory = inventory;
    this.panelTitle = title;

    this.container = scene.add.container(0, 0).setDepth(200);

    this.overlay = scene.add.graphics();
    this.overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 960, 640), Phaser.Geom.Rectangle.Contains);
    this.container.add(this.overlay);

    this.titleText = scene.add.text(960 / 2, 40, title, {
      fontSize: '22px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.contentText = scene.add.text(960 / 2, 80, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#c8b898',
      align: 'left', lineSpacing: 6,
    }).setOrigin(0.5, 0);
    this.container.add(this.contentText);

    this.hintText = scene.add.text(960 / 2, 600, '[TAB/ESC] close', {
      fontSize: '12px', fontFamily: 'monospace', color: '#5a4a6a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);

    this.container.setVisible(false);
  }

  show(): void {
    this.visible = true;
    this.refresh();
    this.container.setVisible(true);

    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 150,
      ease: 'Quad.easeOut',
    });
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 150,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.visible = false;
        this.container.setVisible(false);
      },
    });
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  refresh(): void {
    this.overlay.clear();
    this.overlay.fillStyle(0x0a0a1a, 0.88);
    this.overlay.fillRect(0, 0, 960, 640);

    this.overlay.lineStyle(1, 0x3a3a4a, 0.5);
    this.overlay.strokeRect(40, 65, 880, 520);

    const slots = this.inventory.getItems();
    const items: { id: string; name: string; qty: number }[] = [];

    for (const slot of slots) {
      if (!slot) continue;
      const existing = items.find(i => i.id === slot.itemId);
      if (existing) {
        existing.qty += slot.quantity;
      } else {
        items.push({ id: slot.itemId, name: itemDisplayName(slot.itemId), qty: slot.quantity });
      }
    }

    items.sort((a, b) => a.name.localeCompare(b.name));

    if (items.length === 0) {
      this.contentText.setText('  (empty)');
      return;
    }

    const lines: string[] = [];
    const leftCol: string[] = [];
    const rightCol: string[] = [];

    const mid = Math.ceil(items.length / 2);
    for (let i = 0; i < items.length; i++) {
      const line = `  ${items[i].name.padEnd(18)} ${items[i].qty}`;
      if (i < mid) {
        leftCol.push(line);
      } else {
        rightCol.push(line);
      }
    }

    while (leftCol.length < rightCol.length) leftCol.push('');
    while (rightCol.length < leftCol.length) rightCol.push('');

    for (let i = 0; i < leftCol.length; i++) {
      lines.push(`${leftCol[i]}    ${rightCol[i]}`);
    }

    this.contentText.setText(lines.join('\n'));
  }
}
