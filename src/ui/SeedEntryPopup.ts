import Phaser from 'phaser';

export class SeedEntryPopup {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private visible = false;
  private currentSeed = '';
  private onConfirmCb: ((seed: string) => void) | null = null;
  private onCancelCb: (() => void) | null = null;

  private overlay: Phaser.GameObjects.Graphics;
  private popupBg: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private seedText: Phaser.GameObjects.Text;
  private cursorText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private destroyed = false;

  private cursorInterval: number | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(250).setScrollFactor(0).setVisible(false);

    this.overlay = scene.add.graphics();
    this.overlay.fillStyle(0x000000, 0.55);
    this.overlay.fillRect(0, 0, 960, 640);
    this.overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 960, 640), Phaser.Geom.Rectangle.Contains);
    this.overlay.on('pointerdown', () => this.hide());
    this.container.add(this.overlay);

    this.popupBg = scene.add.graphics();
    this.container.add(this.popupBg);

    this.titleText = scene.add.text(480, 170, 'Enter Run Seed', {
      fontSize: '20px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.seedText = scene.add.text(480, 250, '', {
      fontSize: '22px', fontFamily: 'monospace', color: '#88cc88',
    }).setOrigin(0.5);
    this.container.add(this.seedText);

    this.cursorText = scene.add.text(480, 250, '|', {
      fontSize: '22px', fontFamily: 'monospace', color: '#88cc88',
    }).setOrigin(0.5);
    this.cursorText.setVisible(false);
    this.container.add(this.cursorText);

    this.hintText = scene.add.text(480, 300, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#8a7a9a', align: 'center',
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

    this.popupBg.clear();
    this.popupBg.fillStyle(0x0a0a1a, 0.95);
    this.popupBg.fillRoundedRect(300, 140, 360, 200, 10);
    this.popupBg.lineStyle(2, 0x6a5a8a);
    this.popupBg.strokeRoundedRect(300, 140, 360, 200, 10);

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
        this.hide();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (this.currentSeed.length < 24) {
          this.currentSeed += e.key;
          this.updateDisplay();
        }
      }
    };
    this.scene.input.keyboard!.on('keydown', this.keyHandler);

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
    this.cursorText.setPosition(480 + seedW / 2 + 4, 250);
    this.cursorText.setVisible(true);
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
