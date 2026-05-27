import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Assets will be loaded here
  }

  create(): void {
    this.scene.start('HomelandScene');
  }
}
