import Phaser from 'phaser';

export class BasePanel {
  protected scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  protected _visible: boolean = false;
  protected overlay!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0);
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
      },
    });
  }

  protected createOverlay(): Phaser.GameObjects.Graphics {
    this.overlay = this.scene.add.graphics();
    this.overlay.fillStyle(0x0a0a1a, 0.92);
    this.overlay.fillRect(0, 0, 960, 640);
    this.overlay.lineStyle(1, 0x3a3a4a, 0.5);
    this.overlay.strokeRect(40, 40, 880, 560);
    this.overlay.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, 960, 640),
      Phaser.Geom.Rectangle.Contains,
    );
    this.container.add(this.overlay);
    return this.overlay;
  }

  protected addCloseButton(x = 920, y = 44): Phaser.GameObjects.Text {
    const btn = this.scene.add.text(x, y, '[X]', {
      fontSize: '16px', fontFamily: 'monospace', color: '#886666',
    }).setOrigin(0.5).setDepth(220).setInteractive({ useHandCursor: true }).setData('isUI', true);
    btn.on('pointerdown', () => this.fadeOut());
    this.container.add(btn);
    return btn;
  }

  protected setVisible(v: boolean): void {
    this._visible = v;
    this.container.setVisible(v);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
