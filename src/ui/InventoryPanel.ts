import Phaser from 'phaser';
import { InventorySystem } from '../systems/InventorySystem';
import { itemDisplayName, itemIconKey } from '../systems/GameState';
import { BasePanel } from './BasePanel';
import { NineSliceBg } from './NineSliceBg';
import { UiButton } from './UiButton';
import { isConsumable } from '../systems/DataRegistry';
import { VW, VH, CX, anchorBottom } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';
import { getInputMode } from '../systems/InputMode';

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
  private useBtn!: UiButton;
  private trashBtn!: UiButton;
  private dirty: boolean = true;
  private clickHandler: ((p: Phaser.Input.Pointer) => void) | null = null;

  // List area top (below title+warn text) is a fixed chrome height; the bottom
  // boundary is derived from the button row above so rows never overlap the
  // USE/TRASH buttons or description text, at any clamped viewport height.
  private static readonly LIST_TOP = 72;
  private listBottom(): number { return anchorBottom(100); }
  private rowHeight(): number {
    const available = this.listBottom() - InventoryPanel.LIST_TOP;
    const count = Math.max(1, this.items.length);
    return Math.min(20, available / count);
  }

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

    this.titleText = createText(scene, CX(), 28, title, {
      fontSize: fs(18), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.warnText = createText(scene, CX(), 50, '', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#ff6644', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.warnText);

    this.itemRows = scene.add.container(0, 0);
    this.container.add(this.itemRows);

    this.hintText = createText(scene, CX(), VH() - 40, '', {
      fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#5a4a6a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);

    this.descriptionText = createText(scene, CX(), VH() - 100, '', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#8a8a9a',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.descriptionText);

    this.useBtn = new UiButton(scene, CX() - 50, VH() - 70, 'USE', 80, 36, () => {
      const item = this.items[this.selectionIndex];
      if (item) {
        this.onUse?.(item.id);
        this.refresh();
      }
    }, { color: '#b8a888' });
    this.useBtn.setDepth(210).setVisible(false);
    for (const child of this.useBtn.getChildren()) this.container.add(child);

    this.trashBtn = new UiButton(scene, CX() + 50, VH() - 70, 'TRASH', 90, 36, () => {
      const item = this.items[this.selectionIndex];
      if (item) {
        this.onTrash?.(item.id);
        this.refresh();
      }
    }, { color: '#b8a888' });
    this.trashBtn.setDepth(210).setVisible(false);
    for (const child of this.trashBtn.getChildren()) this.container.add(child);

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

    this.clickHandler = (p: Phaser.Input.Pointer) => {
      if (!this._visible) return;
      if (this.useBtn.handleClick(p)) return;
      if (this.trashBtn.handleClick(p)) return;
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
        ? getInputMode() !== 'keyboard'
          ? `! OVER CAPACITY — free ${total - max} slot(s) by trashing or using!`
          : `! OVER CAPACITY — free ${total - max} slot(s) by trashing [Z] or using [SPACE] !`
        : `  Slots: ${used}/${max}  `,
    );

    this.itemRows.removeAll(true);
    const startY = InventoryPanel.LIST_TOP;
    const rowH = this.rowHeight();
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const cursor = i === this.selectionIndex ? '▸' : ' ';
      const y = startY + i * rowH;
      const row = this.scene.add.container(0, 0);
      const icon = this.scene.add.image(CX() - 28, y, itemIconKey(item.id)).setScale(0.7);
      row.add(icon);
      if (item.qty > 1) {
        row.add(createText(this.scene, CX() - 18, y + 10, `${item.qty}`, {
          fontSize: fs(9), fontFamily: 'Inter', resolution: 4, color: '#ffffff',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(1, 1));
      }
      const text = createText(this.scene, CX() - 14, y, `${cursor} ${item.name.padEnd(16)} ${item.qty}`, {
        fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#c8b898',
      }).setOrigin(0, 0.5);
      row.add([icon, text]);
      this.itemRows.add(row);
    }
    if (this.items.length === 0) {
      const emptyText = createText(this.scene, CX(), startY, '  (empty)', {
        fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#6a7a9a',
      });
      this.itemRows.add(emptyText);
    }

    this.clickZones.forEach(z => z.destroy());
    this.clickZones = [];
    for (let i = 0; i < this.items.length; i++) {
      const zone = this.scene.add.zone(CX(), startY + i * rowH, VW() - 40, Math.min(40, rowH))
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

    const isPointer = getInputMode() !== 'keyboard';
    const hints: string[] = [];
    if (this.items.length > 0 && (this.onUse || this.onTrash)) {
      hints.push(isPointer ? 'Select items' : '[W/S] select');
      if (this.onTrash) hints.push(isPointer ? 'Trash' : '[Z] trash');
      if (this.onUse) hints.push(isPointer ? 'Use' : '[SPACE] use');
    }
    if (!over) {
      hints.push(isPointer ? 'Close' : '[ESC/TAB] close');
    }
    this.hintText.setText(hints.join('    '));

    const selectedItem = this.items[this.selectionIndex];
    const info = selectedItem ? ITEM_INFO[selectedItem.id] : null;
    this.descriptionText.setText(info?.desc ?? '');
    this.descriptionText.setColor(info ? '#8a8a9a' : '#3a3a4a');

    const canUse = selectedItem && this.onUse && isConsumable(selectedItem.id);
    this.useBtn.setVisible(!!canUse);

    const canTrash = selectedItem && this.onTrash;
    this.trashBtn.setVisible(!!canTrash);
  }

  draw(): void {
    if (!this._visible) return;
    if (!this.dirty) return;
    this.dirty = false;

    this.overlay.clear();

    const pad = 16;
    this.overlay.lineStyle(1, 0x5a4a3a, 0.5);
    this.overlay.strokeRect(pad, InventoryPanel.LIST_TOP - 12, VW() - pad * 2, this.listBottom() - (InventoryPanel.LIST_TOP - 12));

    this.buildItemList();
  }

  protected relayout(): void {
    super.relayout();
    this.titleText.setPosition(CX(), 28);
    this.warnText.setPosition(CX(), 50);
    this.hintText.setPosition(CX(), anchorBottom(40));
    this.descriptionText.setPosition(CX(), anchorBottom(100));
    this.useBtn.setPosition(CX() - 50, anchorBottom(70));
    this.trashBtn.setPosition(CX() + 50, anchorBottom(70));
    this.dirty = true;
  }
}
