import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { HomelandScene } from './scenes/HomelandScene';
import { ExpeditionScene } from './scenes/ExpeditionScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 960,
  height: 640,
  backgroundColor: '#1a1a2e',
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, HomelandScene, ExpeditionScene],
};

new Phaser.Game(config);
