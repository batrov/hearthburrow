import Phaser from 'phaser';
import { VW, VH, CX, PANEL_PAD, OVERLAY_W, OVERLAY_H } from '../systems/Viewport';

export class BasePanel {
  protected scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  protected _visible: boolean = false;
  protected overlay!: Phaser.GameObjects.Graphics;
  protected _closeBtn: Phaser.GameObjects.Text | null = null;
  private _closePointerDown: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private _closePointerMove: ((pointer: Phaser.Input.Pointer) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(210).setScrollFactor(0);
    this.container.setVisible(false);
  }

  isVisible(): boolean {
    return this._visible;
  }

  hide(): void {
    this.fadeOut();
  }

  protected fadeIn(duration = 150): void {
    this._visible = true;
    this.container.setAlpha(0);
    this.container.setVisible(true);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration,
      ease: 'Quad.easeOut',
    });
    if (this._closeBtn) this._closeBtn.setVisible(true);
  }

  protected fadeOut(duration = 150): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this._visible = false;
        this.container.setVisible(false);
        if (this._closeBtn) this._closeBtn.setVisible(false);
      },
    });
  }

  protected createOverlay(): Phaser.GameObjects.Graphics {
    this.overlay = this.scene.add.graphics();
    this.overlay.fillStyle(0x0a0a1a, 0.92);
    this.overlay.fillRect(0, 0, VW, VH);
    this.overlay.lineStyle(1, 0x3a3a4a, 0.5);
    this.overlay.strokeRect(PANEL_PAD, PANEL_PAD, OVERLAY_W, OVERLAY_H);
    this.container.add(this.overlay);
    return this.overlay;
  }

  protected addCloseButton(x = VW - 40, y = 44): Phaser.GameObjects.Text {
    const btn = this.scene.add.text(x, y, '[X]', {
      fontSize: '24px', fontFamily: 'monospace', color: '#886666',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(220).setData('isUI', true);
    this.scene.cameras.main.ignore(btn);
    btn.setVisible(false);

    const hitZone = this.scene.add.rectangle(x, y, 48, 48, 0xffffff, 0)
      .setScrollFactor(0).setDepth(220).setData('isUI', true).setVisible(false);
    this.scene.cameras.main.ignore(hitZone);
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', () => {
      if (this.isVisible()) this.hide();
    });

    this._closePointerDown = (pointer: Phaser.Input.Pointer) => {
      if (!this.isVisible()) return;
      const b = btn.getBounds();
      if (b.contains(pointer.x, pointer.y)) {
        this.hide();
      }
    };
    this.scene.input.on('pointerdown', this._closePointerDown);

    const canvas = this.scene.input.manager.canvas as HTMLCanvasElement;
    this._closePointerMove = (pointer: Phaser.Input.Pointer) => {
      if (!this.isVisible()) {
        if (canvas.style.cursor === 'pointer') {
          canvas.style.cursor = 'default';
        }
        return;
      }
      const b = btn.getBounds();
      if (b.contains(pointer.x, pointer.y)) {
        canvas.style.cursor = 'pointer';
      } else if (canvas.style.cursor === 'pointer') {
        canvas.style.cursor = 'default';
      }
    };
    this.scene.input.on('pointermove', this._closePointerMove);

    this._closeBtn = btn;
    return btn;
  }

  protected setVisible(v: boolean): void {
    this._visible = v;
    this.container.setVisible(v);
  }

  destroy(): void {
    if (this._closePointerDown) this.scene.input.off('pointerdown', this._closePointerDown);
    if (this._closePointerMove) this.scene.input.off('pointermove', this._closePointerMove);
    if (this._closeBtn) this._closeBtn.destroy();
    this.container.destroy(true);
  }
}
