import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { HomelandScene } from './scenes/HomelandScene';
import { ExpeditionScene } from './scenes/ExpeditionScene';
import { ExpeditionRecapScene } from './scenes/ExpeditionRecapScene';
import { TavernScene } from './scenes/TavernScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 390,
  height: 844,
  backgroundColor: '#1a1a2e',
  pixelArt: true,
  input: {
    activePointers: 2,
    touch: { capture: true },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, HomelandScene, ExpeditionScene, ExpeditionRecapScene, TavernScene],
};

new Phaser.Game(config);
