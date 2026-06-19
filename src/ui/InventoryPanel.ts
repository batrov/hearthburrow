import Phaser from 'phaser';
import { InventorySystem } from '../systems/InventorySystem';
import { itemDisplayName, itemIconKey } from '../systems/GameState';
import { BasePanel } from './BasePanel';

const ITEM_INFO: Record<string, { desc: string }> = {
  stone: { desc: 'Common stone. Used for building and basic crafting.' },
  bronze_ore: { desc: 'Bronze ore. Smelt into tools and equipment.' },
  silver_ore: { desc: 'Silver ore. Used for advanced equipment upgrades.' },
  gold_ore: { desc: 'Gold ore. A rare resource for high-tier gear.' },
  crystal: { desc: 'A shimmering crystal. Required for research and scrolls.' },
  monster_drop: { desc: 'Essence from defeated monsters. Used in rings and potions.' },
  carrot: { desc: 'A crunchy vegetable. Currency at the Trading Post.' },
  stamina_potion: { desc: 'Restores 30 stamina during an expedition.' },
  teleport_scroll: { desc: 'Instantly escape the dungeon to safety.' },
  mining_bomb: { desc: 'Destroys 8 surrounding tiles in one blast.' },
  ring_critical: { desc: '20% chance to deal double damage in combat.' },
  ring_damage: { desc: '+1 base damage on every combat strike.' },
  ring_precision: { desc: '30% wider hit zone for easier strikes.' },
  ring_hunter: { desc: 'Combines critical and damage bonuses.' },
  pickaxe_1: { desc: 'A basic wooden pickaxe. Unlimited uses.' },
  pickaxe_2: { desc: 'A bronze pickaxe. 5 runs, mines bronze ore.' },
  pickaxe_3: { desc: 'A silver pickaxe. 5 runs, mines silver ore.' },
  pickaxe_4: { desc: 'A gold pickaxe. 5 runs, mines gold ore.' },
  boots_stamina_bronze: { desc: '+10 max stamina for 5 expeditions. Requires bronze version first.' },
  boots_stamina_silver: { desc: '+20 max stamina for 5 expeditions. Requires bronze version first.' },
  boots_stamina_gold: { desc: '+30 max stamina for 5 expeditions. Requires silver version first.' },
  boots_luck_bronze: { desc: '10% double-drop chance for 5 expeditions.' },
  boots_luck_silver: { desc: '25% double-drop chance for 5 expeditions.' },
  boots_luck_gold: { desc: '40% double-drop chance for 5 expeditions.' },
  boots_regen: { desc: '+1 stamina per 5 rocks broken for 5 expeditions.' },
  lantern_bronze: { desc: 'Extends light radius by 60px for 5 expeditions.' },
  lantern_silver: { desc: 'Extends light radius by 60px for 5 expeditions.' },
  lantern_gold: { desc: 'Extends light radius by 60px for 5 expeditions.' },
};

export class InventoryPanel extends BasePanel {
  private titleText: Phaser.GameObjects.Text;
  private itemRows: Phaser.GameObjects.Container;
  private hintText: Phaser.GameObjects.Text;
  private warnText: Phaser.GameObjects.Text;
  private descriptionText: Phaser.GameObjects.Text;
  private inventory: InventorySystem;

  private items: { id: string; name: string; qty: number }[] = [];
  private selectionIndex: number = 0;
  private onUse: ((itemId: string) => void) | null = null;
  private onTrash: ((itemId: string) => void) | null = null;
  private clickZones: Phaser.GameObjects.Zone[] = [];
  private dirty: boolean = true;

  constructor(
    scene: Phaser.Scene,
    inventory: InventorySystem,
    onUse: ((itemId: string) => void) | null = null,
    onTrash: ((itemId: string) => void) | null = null,
    title: string = 'Inventory',
  ) {
    super(scene);
    this.inventory = inventory;
    this.onUse = onUse;
    this.onTrash = onTrash;

    this.createOverlay();

    this.titleText = scene.add.text(960 / 2, 30, title, {
      fontSize: '22px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.warnText = scene.add.text(960 / 2, 55, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#ff6644', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.warnText);

    this.itemRows = scene.add.container(0, 0);
    this.container.add(this.itemRows);

    this.hintText = scene.add.text(960 / 2, 620, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#5a4a6a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);

    this.descriptionText = scene.add.text(960 / 2, 595, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#8a8a9a',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.descriptionText);

    this.addCloseButton();
  }

  handleInput(key: string): void {
    if (!this._visible) return;

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

  toggle(): void {
    if (this._visible) this.hide();
    else this.show();
  }

  show(): void {
    this.fadeIn();
    this.dirty = true;
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

    this.itemRows.removeAll(true);
    const startY = 80;
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const cursor = i === this.selectionIndex ? '▸' : ' ';
      const y = startY + i * 20;
      const row = this.scene.add.container(0, 0);
      const icon = this.scene.add.image(452, y, itemIconKey(item.id)).setScale(0.8);
      row.add(icon);
      if (item.qty > 1) {
        row.add(this.scene.add.text(462, y + 10, `${item.qty}`, {
          fontSize: '9px', fontFamily: 'monospace', color: '#ffffff',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(1, 1));
      }
      const text = this.scene.add.text(466, y, `${cursor} ${item.name.padEnd(18)} ${item.qty}`, {
        fontSize: '14px', fontFamily: 'monospace', color: '#c8b898',
      }).setOrigin(0, 0.5);
      row.add([icon, text]);
      this.itemRows.add(row);
    }
    if (this.items.length === 0) {
      const emptyText = this.scene.add.text(480, startY, '  (empty)', {
        fontSize: '14px', fontFamily: 'monospace', color: '#6a7a9a',
      });
      this.itemRows.add(emptyText);
    }

    this.clickZones.forEach(z => z.destroy());
    this.clickZones = [];
    for (let i = 0; i < this.items.length; i++) {
      const zone = this.scene.add.zone(480, 80 + i * 20, 860, 20)
        .setDepth(210)
        .setScrollFactor(0)
        .setInteractive();
      zone.on('pointerdown', () => {
        this.selectionIndex = i;
        this.dirty = true;
        this.handleInput('SPACE');
      });
      this.container.add(zone);
      this.clickZones.push(zone);
    }


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

    const selectedItem = this.items[this.selectionIndex];
    const info = selectedItem ? ITEM_INFO[selectedItem.id] : null;
    this.descriptionText.setText(info?.desc ?? '');
    this.descriptionText.setColor(info ? '#8a8a9a' : '#3a3a4a');
  }

  draw(): void {
    if (!this._visible) return;
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
