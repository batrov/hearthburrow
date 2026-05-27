import Phaser from 'phaser';

export class InventoryUI {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private visible: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(200);
    this.container.setVisible(false);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.setVisible(this.visible);
  }
}
