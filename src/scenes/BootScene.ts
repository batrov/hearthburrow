import Phaser from 'phaser';
import { gameState } from '../systems/GameState';
import { audio } from '../systems/AudioSystem';

export class BootScene extends Phaser.Scene {
  private loadingBar!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    gameState.load();
    audio.init();
    audio.setMasterVolume(gameState.masterVolume);
    audio.setSfxVolume(gameState.sfxVolume);

    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    this.cameras.main.setBackgroundColor('#0a0a1a');

    this.add.text(cx, cy - 80, 'HEARTHBURROW', {
      fontSize: '48px',
      fontFamily: 'monospace',
      color: '#e8d5b7',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 30, 'a cozy mining roguelite', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#8a7a6a',
    }).setOrigin(0.5);

    const barWidth = 300;
    const barHeight = 20;
    const barX = cx - barWidth / 2;
    const barY = cy + 30;

    const barBg = this.add.graphics();
    barBg.fillStyle(0x2a2a3a, 1);
    barBg.fillRoundedRect(barX, barY, barWidth, barHeight, 4);

    this.loadingBar = this.add.graphics();

    this.progressText = this.add.text(cx, barY + barHeight + 12, '0%', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#6a5a4a',
    }).setOrigin(0.5);

    this.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 1200,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const val = Math.floor(tween.getValue() ?? 0);
        this.loadingBar.clear();
        this.loadingBar.fillStyle(0xe8d5b7, 1);
        this.loadingBar.fillRoundedRect(barX + 2, barY + 2, (barWidth - 4) * (val / 100), barHeight - 4, 3);
        this.progressText.setText(`${val}%`);
      },
      onComplete: () => {
        this.progressText.setText('ready!');
        this.time.delayedCall(300, () => {
          this.cameras.main.fadeOut(400, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('HomelandScene');
          });
        });
      },
    });
  }
}
