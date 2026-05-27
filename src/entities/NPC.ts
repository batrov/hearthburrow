import Phaser from 'phaser';

export type NPCType = 'merchant' | 'researcher' | 'villager';

export class NPC {
  sprite: Phaser.GameObjects.Container;
  npcType: NPCType;
  name: string;

  constructor(scene: Phaser.Scene, x: number, y: number, npcType: NPCType, name: string) {
    this.npcType = npcType;
    this.name = name;
    this.sprite = scene.add.container(x, y);
  }
}
