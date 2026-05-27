import Phaser from 'phaser';

export class HomelandScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HomelandScene' });
  }

  create(): void {
    // Homeland hub will be built here
    this.input.once('pointerdown', () => {
      this.scene.start('ExpeditionScene');
    });
  }
}
