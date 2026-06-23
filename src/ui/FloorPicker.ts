import Phaser from 'phaser';
import { VW, VH, CX } from '../systems/Viewport';

export class FloorPicker {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private visible = false;
  private floors: number[] = [];
  private selectedIdx = 0;
  private onSelectCb: ((floor: number) => void) | null = null;
  private onCancelCb: (() => void) | null = null;

  private overlay: Phaser.GameObjects.Graphics;
  private popupBg: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private rows: { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Rectangle }[] = [];
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

    this.blocker = scene.add.rectangle(CX, VH / 2, VW, VH, 0x000000, 0)
      .setScrollFactor(0)
      .setInteractive()
      .setData('isUI', true);
    this.blocker.on('pointerdown', () => {});
    this.container.add(this.blocker);

    this.popupBg = scene.add.graphics();
    this.container.add(this.popupBg);

    this.titleText = scene.add.text(CX, 170, 'Select Start Floor', {
      fontSize: '18px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    for (let i = 0; i < 10; i++) {
      const bg = scene.add.graphics();
      this.container.add(bg);

      const text = scene.add.text(0, 0, '', {
        fontSize: '14px', fontFamily: 'monospace', color: '#c8b898',
      });
      text.setVisible(false);
      this.container.add(text);

      const zone = scene.add.rectangle(0, 0, VW - 40, 44, 0xffffff, 0)
        .setScrollFactor(0);
      zone.setVisible(false);
      this.container.add(zone);

      this.rows.push({ bg, text, zone });
    }

    this.footerText = scene.add.text(CX, 520, '[W/S] select  [SPACE] confirm  [ESC] cancel', {
      fontSize: '11px', fontFamily: 'monospace', color: '#8a7a9a',
    }).setOrigin(0.5);
    this.container.add(this.footerText);
  }

  show(
    floors: number[],
    currentFloor: number,
    onSelect: (floor: number) => void,
    onCancel?: () => void,
  ): void {
    this.floors = floors;
    this.selectedIdx = floors.indexOf(currentFloor);
    if (this.selectedIdx < 0) this.selectedIdx = 0;
    this.onSelectCb = onSelect;
    this.onCancelCb = onCancel ?? null;

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
      const count = Math.min(this.floors.length, 10);
      const popH = 60 + count * 38 + 24;
      const popY = Math.floor((VH - popH) / 2);
      const popX = 16, popW = VW - 32;
      if (p.x < popX || p.x > popX + popW || p.y < popY || p.y > popY + popH) {
        this.hide();
        return;
      }
      const startY = popY + 48;
      for (let i = 0; i < count; i++) {
        const rowY = startY + i * 38;
        if (p.y >= rowY && p.y < rowY + 32) {
          this.selectFloor(i);
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
    const count = Math.min(this.floors.length, 10);
    const popH = 60 + count * 38 + 24;
    const popY = Math.floor((VH - popH) / 2);

    this.popupBg.clear();
    this.popupBg.fillStyle(0x0a0a1a, 0.95);
    this.popupBg.fillRoundedRect(16, popY, VW - 32, popH, 10);
    this.popupBg.lineStyle(2, 0x6a5a8a);
    this.popupBg.strokeRoundedRect(16, popY, VW - 32, popH, 10);

    this.titleText.setPosition(CX, popY + 22);
    this.footerText.setPosition(CX, popY + popH - 14);

    const startY = popY + 48;
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const floor = this.floors[i];
      const y = startY + i * 38;

      row.bg.clear();

      if (floor === undefined) {
        row.text.setVisible(false);
        row.zone.setVisible(false);
        continue;
      }

      const isSelected = i === this.selectedIdx;
      row.bg.fillStyle(isSelected ? 0x3a3a5a : 0x1a1a2a, 0.8);
      row.bg.fillRoundedRect(24, y, VW - 48, 32, 4);

      const label = floor === 0 ? '0 (Homeland)' : `Floor ${floor}`;
      row.text.setText(label);
      row.text.setPosition(CX, y + 8);
      row.text.setOrigin(0.5);
      row.text.setColor(isSelected ? '#ffddaa' : '#c8b898');
      row.text.setVisible(true);

      row.zone.setPosition(CX, y + 16);
      row.zone.setVisible(true);
    }
  }

  private navigate(dir: number): void {
    const newIdx = this.selectedIdx + (dir > 0 ? 1 : -1);
    if (newIdx >= 0 && newIdx < this.floors.length) {
      this.selectedIdx = newIdx;
      this.render();
    }
  }

  private selectFloor(idx: number): void {
    if (idx < 0 || idx >= this.floors.length) return;
    this.selectedIdx = idx;
    this.render();
    this.confirm();
  }

  private confirm(): void {
    if (this.selectedIdx < 0 || this.selectedIdx >= this.floors.length) return;
    this.onSelectCb?.(this.floors[this.selectedIdx]);
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
