import Phaser from 'phaser';
import { itemIconKey } from '../systems/GameState';
import { VW, VH, CX, CY } from '../systems/Viewport';

export interface PickerOption {
  id: string;
  name: string;
  iconKey?: string;
  desc1?: string;
  desc2?: string;
  desc3?: string;
  disabled?: boolean;
}

export class EquipmentPicker {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private visible = false;
  private options: PickerOption[] = [];
  private selectedIdx = 0;
  private onSelectCb: ((id: string) => void) | null = null;
  private onCancelCb: (() => void) | null = null;

  private overlay: Phaser.GameObjects.Graphics;
  private popupBg: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private rows: {
    bg: Phaser.GameObjects.Graphics;
    icon: Phaser.GameObjects.Image;
    nameText: Phaser.GameObjects.Text;
    descText: Phaser.GameObjects.Text;
    zone: Phaser.GameObjects.Rectangle;
  }[] = [];
  private footerText: Phaser.GameObjects.Text;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private blocker: Phaser.GameObjects.Rectangle;
  private clickHandler: ((p: Phaser.Input.Pointer) => void) | null = null;
  private destroyed = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(250).setScrollFactor(0).setVisible(false);

    this.overlay = scene.add.graphics();
    this.overlay.fillStyle(0x000000, 0.55);
    this.overlay.fillRect(0, 0, VW, VH);
    this.container.add(this.overlay);

    this.blocker = scene.add.rectangle(CX, CY, VW, VH, 0x000000, 0)
      .setScrollFactor(0)
      .setInteractive()
      .setData('isUI', true);
    this.blocker.on('pointerdown', () => {});
    this.container.add(this.blocker);

    this.popupBg = scene.add.graphics();
    this.container.add(this.popupBg);

    this.titleText = scene.add.text(CX, 170, '', {
      fontSize: '20px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    for (let i = 0; i < 7; i++) {
      const bg = scene.add.graphics();
      this.container.add(bg);

      const icon = scene.add.image(0, 0, 'item_pickaxe_1').setScale(1.2);
      icon.setVisible(false);
      this.container.add(icon);

      const nameText = scene.add.text(0, 0, '', {
        fontSize: '11px', fontFamily: 'monospace', color: '#c8b898',
      });
      nameText.setVisible(false);
      this.container.add(nameText);

      const descText = scene.add.text(0, 0, '', {
        fontSize: '10px', fontFamily: 'monospace', color: '#888888',
      });
      descText.setVisible(false);
      this.container.add(descText);

      const zone = scene.add.rectangle(0, 0, 340, 44, 0xffffff, 0)
        .setScrollFactor(0);
      zone.setVisible(false);
      this.container.add(zone);

      this.rows.push({ bg, icon, nameText, descText, zone });
    }

    this.footerText = scene.add.text(CX, 520, '[W/S] select  [SPACE] equip  [ESC] cancel', {
      fontSize: '11px', fontFamily: 'monospace', color: '#8a7a9a',
    }).setOrigin(0.5);
    this.container.add(this.footerText);
  }

  show(
    options: PickerOption[],
    currentId: string | null,
    title: string,
    onSelect: (id: string) => void,
    onCancel?: () => void,
  ): void {
    this.options = options;
    this.selectedIdx = options.findIndex(o => o.id === currentId);
    if (this.selectedIdx < 0) this.selectedIdx = 0;
    this.onSelectCb = onSelect;
    this.onCancelCb = onCancel ?? null;

    this.titleText.setText(title);

    this.keyHandler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'w': case 'ArrowUp': e.preventDefault(); this.navigate(-1); break;
        case 's': case 'ArrowDown': e.preventDefault(); this.navigate(1); break;
        case ' ': case 'Enter': e.preventDefault(); this.confirm(); break;
        case 'Escape': this.hide(); break;
      }
    };
    this.scene.input.keyboard!.on('keydown', this.keyHandler);

    this.clickHandler = (p: Phaser.Input.Pointer) => {
      const count = Math.min(this.options.length, 7);
      const popH = 60 + count * 40 + 24;
      const popY = Math.floor((VH - popH) / 2);
      const popX = 20, popW = VW - 40;
      if (p.x < popX || p.x > popX + popW || p.y < popY || p.y > popY + popH) {
        this.hide();
        return;
      }
      const startY = popY + 48;
      for (let i = 0; i < count; i++) {
        const rowY = startY + i * 40;
        if (p.y >= rowY && p.y < rowY + 36) {
          this.selectItem(i);
          return;
        }
      }
    };
    this.scene.input.on('pointerdown', this.clickHandler);

    this.render();
    this.container.setAlpha(0).setVisible(true);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 120,
      ease: 'Quad.easeOut',
    });
    this.visible = true;
  }

  private render(): void {
    const count = Math.min(this.options.length, 7);
    const popH = 60 + count * 40 + 24;
    const popY = Math.floor((VH - popH) / 2);
    const popX = 20;
    const popW = VW - 40;

    this.popupBg.clear();
    this.popupBg.fillStyle(0x0a0a1a, 0.95);
    this.popupBg.fillRoundedRect(popX, popY, popW, popH, 10);
    this.popupBg.lineStyle(2, 0x6a5a8a);
    this.popupBg.strokeRoundedRect(popX, popY, popW, popH, 10);

    this.titleText.setPosition(CX, popY + 22);
    this.footerText.setPosition(CX, popY + popH - 14);

    const startY = popY + 48;
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const opt = this.options[i];
      const y = startY + i * 40;

      row.bg.clear();

      if (!opt) {
        row.icon.setVisible(false);
        row.nameText.setVisible(false);
        row.descText.setVisible(false);
        row.zone.setVisible(false);
        continue;
      }

      const isSelected = i === this.selectedIdx;
      row.bg.fillStyle(isSelected ? 0x3a3a5a : 0x1a1a2a, 0.8);
      row.bg.fillRoundedRect(popX + 8, y, popW - 16, 36, 4);

      if (!opt.id) {
        row.icon.setVisible(false);
      } else {
        const iconKey = opt.iconKey ?? itemIconKey(opt.id);
        if (this.scene.textures.exists(iconKey)) {
          row.icon.setTexture(iconKey);
        }
        row.icon.setPosition(popX + 28, y + 18);
        row.icon.setVisible(true);
      }

      row.nameText.setText(opt.name);
      row.nameText.setPosition(popX + 48, y + 4);
      row.nameText.setColor(isSelected ? '#ffddaa' : (opt.disabled ? '#666666' : '#c8b898'));
      row.nameText.setVisible(true);

      const descLine = opt.disabled ? 'Not owned' : (opt.desc1 ?? '');
      row.descText.setText(descLine);
      row.descText.setPosition(popX + 48, y + 20);
      row.descText.setColor(opt.disabled ? '#555555' : '#999999');
      row.descText.setVisible(true);

      row.zone.setPosition(popX + popW / 2, y + 18);
      row.zone.setVisible(true);
    }
  }

  private navigate(dir: number): void {
    const step = dir > 0 ? 1 : -1;
    let newIdx = this.selectedIdx + step;
    while (newIdx >= 0 && newIdx < this.options.length && this.options[newIdx].disabled) {
      newIdx += step;
    }
    if (newIdx >= 0 && newIdx < this.options.length) {
      this.selectedIdx = newIdx;
      this.render();
    }
  }

  private selectItem(idx: number): void {
    if (idx < 0 || idx >= this.options.length) return;
    if (this.options[idx].disabled) return;
    this.selectedIdx = idx;
    this.render();
    this.confirm();
  }

  private confirm(): void {
    if (this.selectedIdx < 0 || this.selectedIdx >= this.options.length) return;
    const opt = this.options[this.selectedIdx];
    if (opt.disabled) return;
    this.onSelectCb?.(opt.id);
    this.hide();
  }

  hide(): void {
    if (!this.visible) return;
    if (this.keyHandler) {
      this.scene.input.keyboard!.off('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.clickHandler) {
      this.scene.input.off('pointerdown', this.clickHandler);
      this.clickHandler = null;
    }
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 100,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.container.setVisible(false);
        this.visible = false;
        this.onCancelCb?.();
      },
    });
  }

  isVisible(): boolean { return this.visible; }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.hide();
    this.container.destroy(true);
  }
}
