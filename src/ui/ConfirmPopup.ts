import Phaser from 'phaser';
import { VW, VH, CX } from '../systems/Viewport';
import { textStyle } from '../systems/Font';

export class ConfirmPopup {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private visible = false;
  private onConfirmCb: (() => void) | null = null;
  private onCancelCb: (() => void) | null = null;

  private overlay: Phaser.GameObjects.Graphics;
  private popupBg: Phaser.GameObjects.Graphics;
  private messageText: Phaser.GameObjects.Text;
  private subText: Phaser.GameObjects.Text;
  private yesBtn: Phaser.GameObjects.Text;
  private noBtn: Phaser.GameObjects.Text;
  private yesBtnZone: Phaser.GameObjects.Rectangle;
  private noBtnZone: Phaser.GameObjects.Rectangle;
  private footerText: Phaser.GameObjects.Text;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private blocker: Phaser.GameObjects.Rectangle;
  private clickHandler: ((p: Phaser.Input.Pointer) => void) | null = null;
  private destroyed = false;

  private selectedYes = true;

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

    this.messageText = scene.add.text(CX, 200, '', {
      fontSize: '18px', fontFamily: 'Inter', resolution: 4, color: '#ff8844', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.messageText);

    this.subText = scene.add.text(CX, 230, '', {
      fontSize: '11px', fontFamily: 'Inter', resolution: 4, color: '#b8a898',
    }).setOrigin(0.5);
    this.container.add(this.subText);

    this.yesBtn = scene.add.text(CX - 60, 280, '[ YES ]', {
      fontSize: '14px', fontFamily: 'Inter', resolution: 4, color: '#cc6666',
      backgroundColor: '#3a1a1acc', padding: { x: 12, y: 4 },
    }).setOrigin(0.5);
    this.container.add(this.yesBtn);
    const yesZone = scene.add.rectangle(CX - 60, 280, 80, 44, 0xffffff, 0).setScrollFactor(0).setDepth(251);
    this.container.add(yesZone);
    this.yesBtnZone = yesZone;

    this.noBtn = scene.add.text(CX + 60, 280, '[Cancel]', {
      fontSize: '14px', fontFamily: 'Inter', resolution: 4, color: '#aaaacc',
      backgroundColor: '#1a1a3acc', padding: { x: 10, y: 4 },
    }).setOrigin(0.5);
    this.container.add(this.noBtn);
    const noZone = scene.add.rectangle(CX + 60, 280, 90, 44, 0xffffff, 0).setScrollFactor(0).setDepth(251);
    this.container.add(noZone);
    this.noBtnZone = noZone;

    this.footerText = scene.add.text(CX, 340, '[← →] switch  [SPACE] confirm  [ESC] cancel', {
      fontSize: '11px', fontFamily: 'Inter', resolution: 4, color: '#8a7a9a',
    }).setOrigin(0.5);
    this.container.add(this.footerText);
  }

  show(
    message: string,
    subMessage: string,
    onConfirm: () => void,
    onCancel?: () => void,
  ): void {
    this.messageText.setText(message);
    this.subText.setText(subMessage);
    this.onConfirmCb = onConfirm;
    this.onCancelCb = onCancel ?? null;
    this.selectedYes = false;

    this.popupBg.clear();
    this.popupBg.fillStyle(0x0a0a1a, 0.95);
    this.popupBg.fillRoundedRect(CX - 160, 150, 320, 220, 10);
    this.popupBg.lineStyle(2, 0x6a5a8a);
    this.popupBg.strokeRoundedRect(CX - 160, 150, 320, 220, 10);

    this.keyHandler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft': case 'a': e.preventDefault(); this.selectedYes = false; this.render(); break;
        case 'ArrowRight': case 'd': e.preventDefault(); this.selectedYes = true; this.render(); break;
        case ' ': case 'Enter': e.preventDefault(); this.confirm(); break;
        case 'Escape': this.hide(); break;
      }
    };
    this.scene.input.keyboard!.on('keydown', this.keyHandler);

    this.clickHandler = (p: Phaser.Input.Pointer) => {
      const popX = CX - 160, popY = 150, popW = 320, popH = 220;
      if (p.x < popX || p.x > popX + popW || p.y < popY || p.y > popY + popH) {
        this.hide();
        return;
      }
      const yesX = CX - 60, yesY = 280, yesW = 80, yesH = 44;
      if (p.x >= yesX - yesW / 2 && p.x <= yesX + yesW / 2 &&
          p.y >= yesY - yesH / 2 && p.y <= yesY + yesH / 2) {
        this.selectedYes = true;
        this.confirm();
        return;
      }
      const noX = CX + 60, noY = 280, noW = 90, noH = 44;
      if (p.x >= noX - noW / 2 && p.x <= noX + noW / 2 &&
          p.y >= noY - noH / 2 && p.y <= noY + noH / 2) {
        this.selectedYes = false;
        this.hide();
        return;
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
    this.yesBtn.setStyle({
      backgroundColor: this.selectedYes ? '#4a2222cc' : '#2a1a1acc',
      color: this.selectedYes ? '#ff6666' : '#886666',
    });
  }

  private confirm(): void {
    if (this.selectedYes) {
      this.onConfirmCb?.();
    }
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

  getContainer(): Phaser.GameObjects.Container { return this.container; }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.hide();
    this.container.destroy(true);
  }
}
