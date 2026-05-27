import Phaser from 'phaser';
import { StaminaSystem } from '../systems/StaminaSystem';
import { InventorySystem } from '../systems/InventorySystem';

export class Player {
  sprite: Phaser.GameObjects.Container;
  stamina: StaminaSystem;
  inventory: InventorySystem;
  pickaxeTier: number = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.stamina = new StaminaSystem(100);
    this.inventory = new InventorySystem(16);

    this.sprite = scene.add.container(x, y);
  }

  moveTo(x: number, y: number): void {
    this.sprite.setPosition(x, y);
  }
}
