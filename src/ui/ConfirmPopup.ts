import Phaser from 'phaser';
import { VW, VH, CX, CY } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';
import { createAdaptiveText } from './AdaptiveText';
import { NineSliceBg } from './NineSliceBg';
import { UiButton } from './UiButton';

export class ConfirmPopup {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private visible = false;
  private onConfirmCb: (() => void) | null = null;
  private onCancelCb: (() => void) | null = null;

  private overlay: Phaser.GameObjects.Graphics;
  private popupBg!: Phaser.GameObjects.NineSlice;
  private messageText: Phaser.GameObjects.Text;
  private subText: Phaser.GameObjects.Text;
  private yesBtn: UiButton;
  private noBtn: UiButton;
  private footerText: Phaser.GameObjects.Text;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private blocker: Phaser.GameObjects.Rectangle;
  private clickHandler: ((p: Phaser.Input.Pointer) => void) | null = null;
  private destroyed = false;

  private selectedYes = true;

  private static readonly BOX_W = 320;
  private static readonly BOX_H = 220;

  private boxTop(): number { return CY() - ConfirmPopup.BOX_H / 2; }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(250).setScrollFactor(0).setVisible(false);

    this.overlay = scene.add.graphics();
    this.overlay.fillStyle(0x000000, 0.55);
    this.overlay.fillRect(0, 0, VW(), VH());
    this.container.add(this.overlay);

    this.blocker = scene.add.rectangle(CX(), VH() / 2, VW(), VH(), 0x000000, 0)
      .setScrollFactor(0)
      .setInteractive()
      .setData('isUI', true);
    this.blocker.on('pointerdown', () => {});
    this.container.add(this.blocker);

    const boxTop = this.boxTop();

    this.messageText = createText(scene, CX(), boxTop + 50, '', {
      fontSize: fs(18), fontFamily: 'Inter', resolution: 4, color: '#ff8844', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.messageText);

    this.subText = createText(scene, CX(), boxTop + 80, '', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#b8a898',
    }).setOrigin(0.5);
    this.container.add(this.subText);

    this.yesBtn = new UiButton(scene, CX() - 60, boxTop + 130, 'YES', 80, 36, () => {
      this.selectedYes = true;
      this.confirm();
    }, { color: '#cc6666' });
    for (const child of this.yesBtn.getChildren()) this.container.add(child);

    this.noBtn = new UiButton(scene, CX() + 60, boxTop + 130, 'Cancel', 90, 36, () => {
      this.selectedYes = false;
      this.hide();
    }, { color: '#aaaacc' });
    for (const child of this.noBtn.getChildren()) this.container.add(child);

    this.footerText = createAdaptiveText(scene, CX(), boxTop + 190, '[← →] switch  [SPACE] confirm  [ESC] cancel', 'Tap to switch & confirm', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#8a7a9a',
    }).setOrigin(0.5);
    this.container.add(this.footerText);
  }

  /** Called by the owning scene's relayout(). Repositions in place; never toggles visibility. */
  onViewportResize(): void {
    this.overlay.clear();
    this.overlay.fillStyle(0x000000, 0.55);
    this.overlay.fillRect(0, 0, VW(), VH());
    this.blocker.setPosition(CX(), VH() / 2).setSize(VW(), VH());

    const boxTop = this.boxTop();
    this.messageText.setPosition(CX(), boxTop + 50);
    this.subText.setPosition(CX(), boxTop + 80);
    this.yesBtn.setPosition(CX() - 60, boxTop + 130);
    this.noBtn.setPosition(CX() + 60, boxTop + 130);
    this.footerText.setPosition(CX(), boxTop + 190);

    if (this.visible) {
      NineSliceBg.updateSize(this.popupBg, ConfirmPopup.BOX_W, ConfirmPopup.BOX_H);
    }
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

    const boxTop = this.boxTop();

    this.popupBg = NineSliceBg.modal(this.scene, CX(), boxTop + ConfirmPopup.BOX_H / 2, ConfirmPopup.BOX_W, ConfirmPopup.BOX_H);
    this.popupBg.setDepth(249);
    this.container.addAt(this.popupBg, 2);

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
      const boxTop = this.boxTop();
      const popX = CX() - ConfirmPopup.BOX_W / 2, popY = boxTop, popW = ConfirmPopup.BOX_W, popH = ConfirmPopup.BOX_H;
      if (p.x < popX || p.x > popX + popW || p.y < popY || p.y > popY + popH) {
        this.hide();
        return;
      }
      if (this.yesBtn.handleClick(p)) return;
      if (this.noBtn.handleClick(p)) return;
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
    this.yesBtn.setSelected(this.selectedYes);
    this.noBtn.setSelected(!this.selectedYes);
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

  getContainer(): Phaser.GameObjects.Container { return this.container; }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.hide();
    this.yesBtn.destroy();
    this.noBtn.destroy();
    this.container.destroy(true);
  }
}
