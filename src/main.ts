import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { HomelandScene } from './scenes/HomelandScene';
import { ExpeditionScene } from './scenes/ExpeditionScene';
import { ExpeditionRecapScene } from './scenes/ExpeditionRecapScene';
import { TavernScene } from './scenes/TavernScene';
import { computeLogicalSize, viewportManager } from './systems/ViewportManager';
import { __setViewportSize } from './systems/Viewport';

const { width, height } = computeLogicalSize(window.innerWidth, window.innerHeight);
__setViewportSize(width, height);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width,
  height,
  backgroundColor: '#1a1a2e',
  pixelArt: true,
  roundPixels: true,
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

const game = new Phaser.Game(config);
viewportManager.init(game);
