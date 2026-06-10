import Phaser from 'phaser';

export class BasePanel {
  protected scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  protected _visible: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0);
    this.container.setVisible(false);
  }

  isVisible(): boolean {
    return this._visible;
  }

  protected setVisible(v: boolean): void {
    this._visible = v;
    this.container.setVisible(v);
  }

  toggle(): void {
    this.setVisible(!this._visible);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
