import Phaser from 'phaser';
import { VW, VH, CX, CY } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';
import { NineSliceBg } from './NineSliceBg';
import { UiButton } from './UiButton';

export class SeedEntryPopup {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private visible = false;
  private currentSeed = '';
  private onConfirmCb: ((seed: string) => void) | null = null;
  private onCancelCb: (() => void) | null = null;

  private overlay: Phaser.GameObjects.NineSlice;
  private blocker: Phaser.GameObjects.Rectangle;
  private popupBg!: Phaser.GameObjects.NineSlice;
  private titleText: Phaser.GameObjects.Text;
  private seedText: Phaser.GameObjects.Text;
  private cursorText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private randomizeBtn: UiButton;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((p: Phaser.Input.Pointer) => void) | null = null;
  private destroyed = false;

  private cursorInterval: number | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(250).setScrollFactor(0).setVisible(false);

    this.overlay = NineSliceBg.panel(this.scene, CX(), CY(), VW(), VH());
    this.overlay.setDepth(249);
    this.container.add(this.overlay);

    this.blocker = scene.add.rectangle(CX(), VH() / 2, VW(), VH(), 0x000000, 0)
      .setScrollFactor(0)
      .setInteractive()
      .setData('isUI', true);
    this.blocker.on('pointerdown', () => {});
    this.container.add(this.blocker);

    this.titleText = createText(scene, CX(), 170, 'Enter Run Seed', {
      fontSize: fs(18), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.seedText = createText(scene, CX(), 225, '', {
      fontSize: fs(18), fontFamily: 'Inter', resolution: 4, color: '#88cc88',
    }).setOrigin(0.5);
    this.container.add(this.seedText);

    this.cursorText = createText(scene, CX(), 225, '|', {
      fontSize: fs(18), fontFamily: 'Inter', resolution: 4, color: '#88cc88',
    }).setOrigin(0.5);
    this.cursorText.setVisible(false);
    this.container.add(this.cursorText);

    this.randomizeBtn = new UiButton(scene, CX(), 270, '[ RANDOMIZE ]', 130, 44, () => { this.randomize(); }, {
      color: '#88aa88', fontSize: fs(13),
    });
    for (const child of this.randomizeBtn.getChildren()) this.container.add(child);

    this.hintText = createText(scene, CX(), 308, '', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#8a7a9a', align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.hintText);
  }

  show(
    currentSeed: string,
    onConfirm: (seed: string) => void,
    onCancel?: () => void,
  ): void {
    this.currentSeed = currentSeed;
    this.onConfirmCb = onConfirm;
    this.onCancelCb = onCancel ?? null;

    this.popupBg = NineSliceBg.modal(this.scene, CX(), 240, 320, 200);
    this.popupBg.setDepth(249);
    this.container.addAt(this.popupBg, 2);

    this.hintText.setText('Type to edit  [SPACE] done  [ESC] cancel');

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        this.currentSeed = this.currentSeed.slice(0, -1);
        this.updateDisplay();
      } else if (e.key === ' ') {
        e.preventDefault();
        this.confirm();
      } else if (e.key === 'Escape') {
        this.confirm();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (this.currentSeed.length < 24) {
          this.currentSeed += e.key;
          this.updateDisplay();
        }
      }
    };
    this.scene.input.keyboard!.on('keydown', this.keyHandler);

    this.clickHandler = (p: Phaser.Input.Pointer) => {
      const insidePopup = p.x >= CX() - 160 && p.x <= CX() + 160 && p.y >= 140 && p.y <= 340;
      if (!insidePopup) {
        this.confirm();
        return;
      }
      if (this.randomizeBtn.handleClick(p)) return;
    };
    this.scene.input.on('pointerdown', this.clickHandler);

    this.updateDisplay();

    this.cursorInterval = window.setInterval(() => {
      this.cursorText.setVisible(!this.cursorText.visible);
    }, 530);

    this.container.setAlpha(0).setVisible(true);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 120,
      ease: 'Quad.easeOut',
    });
    this.visible = true;
  }

  private updateDisplay(): void {
    this.seedText.setText(this.currentSeed || '(empty — random)');
    this.seedText.setColor(this.currentSeed ? '#88cc88' : '#666666');

    const seedW = this.seedText.width;
    this.cursorText.setPosition(CX() + seedW / 2 + 4, 225);
    this.cursorText.setVisible(true);
  }

  private randomize(): void {
    this.currentSeed = Math.random().toString(36).substring(2, 10);
    this.updateDisplay();
  }

  private confirm(): void {
    this.onConfirmCb?.(this.currentSeed);
    this.hide();
  }

  hide(): void {
    if (!this.visible) return;
    if (this.cursorInterval !== null) {
      clearInterval(this.cursorInterval);
      this.cursorInterval = null;
    }
    if (this.keyHandler) {
      this.scene.input.keyboard!.off('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.clickHandler) {
      this.scene.input.off('pointerdown', this.clickHandler);
      this.clickHandler = null;
    }
    if (this.popupBg) {
      this.popupBg.destroy();
      (this.popupBg as unknown) = undefined;
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
    this.randomizeBtn.destroy();
    this.container.destroy(true);
  }
}
