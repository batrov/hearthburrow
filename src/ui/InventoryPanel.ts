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
  private warnText: Phaser.GameObjects.Text;
  private visible: boolean = false;
  private inventory: InventorySystem;

  private items: { id: string; name: string; qty: number }[] = [];
  private selectionIndex: number = 0;
  private onUse: ((itemId: string) => void) | null = null;
  private onTrash: ((itemId: string) => void) | null = null;
  private dirty: boolean = true;

  constructor(
    scene: Phaser.Scene,
    inventory: InventorySystem,
    onUse: ((itemId: string) => void) | null = null,
    onTrash: ((itemId: string) => void) | null = null,
    title: string = 'Inventory',
  ) {
    this.scene = scene;
    this.inventory = inventory;
    this.onUse = onUse;
    this.onTrash = onTrash;

    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    this.overlay = scene.add.graphics();
    this.overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 960, 640), Phaser.Geom.Rectangle.Contains);
    this.container.add(this.overlay);

    this.titleText = scene.add.text(960 / 2, 30, title, {
      fontSize: '22px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.warnText = scene.add.text(960 / 2, 55, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#ff6644', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.warnText);

    this.contentText = scene.add.text(480, 80, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#c8b898',
      align: 'left', lineSpacing: 6,
      wordWrap: { width: 860 },
    });
    this.container.add(this.contentText);

    this.hintText = scene.add.text(960 / 2, 620, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#5a4a6a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);

    this.container.setVisible(false);
  }

  handleInput(key: string): void {
    if (!this.visible) return;

    if (key === 'W' || key === 'UP') {
      this.selectionIndex = Math.max(0, this.selectionIndex - 1);
      this.dirty = true;
    } else if (key === 'S' || key === 'DOWN') {
      this.selectionIndex = Math.min(this.items.length - 1, this.selectionIndex + 1);
      this.dirty = true;
    } else if (key === 'Z') {
      const item = this.items[this.selectionIndex];
      if (item) {
        this.onTrash?.(item.id);
      }
    } else if (key === 'SPACE') {
      const item = this.items[this.selectionIndex];
      if (item) {
        this.onUse?.(item.id);
      }
    }
  }

  show(): void {
    this.visible = true;
    this.dirty = true;
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

  isVisible(): boolean {
    return this.visible;
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  refresh(): void {
    this.dirty = true;
  }

  private buildItemList(): void {
    const slots = this.inventory.getItems();
    const map = new Map<string, { id: string; name: string; qty: number }>();

    for (const slot of slots) {
      if (!slot) continue;
      const existing = map.get(slot.itemId);
      if (existing) {
        existing.qty += slot.quantity;
      } else {
        map.set(slot.itemId, { id: slot.itemId, name: itemDisplayName(slot.itemId), qty: slot.quantity });
      }
    }

    this.items = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    if (this.selectionIndex >= this.items.length) {
      this.selectionIndex = Math.max(0, this.items.length - 1);
    }

    const over = this.inventory.overCapacity();
    const used = this.inventory.capacityUsed();
    const max = this.inventory.capacityMax();
    const total = this.items.reduce((s, i) => s + i.qty, 0);

    this.warnText.setText(
      over
        ? `! OVER CAPACITY — free ${total - max} slot(s) by trashing [Z] or using [SPACE] !`
        : `  Slots: ${used}/${max}  `,
    );

    const lines: string[] = [];
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const cursor = i === this.selectionIndex ? '▸' : ' ';
      const namePadded = item.name.padEnd(18);
      lines.push(` ${cursor} ${namePadded} ${item.qty}`);
    }

    this.contentText.setText(lines.length > 0 ? lines.join('\n') : '  (empty)');

    const hints: string[] = [];
    if (this.items.length > 0 && (this.onUse || this.onTrash)) {
      hints.push('[W/S] select');
      if (this.onTrash) hints.push('[Z] trash');
      if (this.onUse) hints.push('[SPACE] use');
    }
    if (!over) {
      hints.push('[ESC/TAB] close');
    }
    this.hintText.setText(hints.join('    '));
  }

  draw(): void {
    if (!this.visible) return;
    if (!this.dirty) return;
    this.dirty = false;

    this.overlay.clear();
    this.overlay.fillStyle(0x0a0a1a, 0.92);
    this.overlay.fillRect(0, 0, 960, 640);

    this.overlay.lineStyle(1, 0x3a3a4a, 0.5);
    this.overlay.strokeRect(40, 65, 880, 540);

    this.buildItemList();
  }
}
