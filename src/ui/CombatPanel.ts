import Phaser from 'phaser';
import { itemDisplayName } from '../systems/GameState';

export type CombatResult = 'victory' | 'retreat' | null;

export interface EnemyConfig {
  name: string;
  hp: number;
  timingSpeed: number;
  hitZoneWidth: number;
  rewards?: { id: string; quantity: number }[];
  ringBonusDamage?: number;
  ringCritChance?: number;
}

export class CombatPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Graphics;
  private enemyNameText: Phaser.GameObjects.Text;
  private hpBar: Phaser.GameObjects.Graphics;
  private hpText: Phaser.GameObjects.Text;
  private timingBar: Phaser.GameObjects.Graphics;
  private marker: Phaser.GameObjects.Rectangle;
  private hitZoneGfx: Phaser.GameObjects.Graphics;
  private feedbackText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private instructionText: Phaser.GameObjects.Text;

  private visible: boolean = false;
  private result: CombatResult = null;
  private enemyHP: number = 0;
  private enemyMaxHP: number = 0;
  private barLeft: number = 0;
  private barRight: number = 0;
  private barCenter: number = 0;
  private hitZoneHalf: number = 0;
  private currentEnemy: EnemyConfig | null = null;
  private onComplete: ((result: CombatResult, rewards: { id: string; quantity: number }[]) => void) | null = null;
  private markerTween: Phaser.Tweens.Tween | null = null;

  private readonly BAR_WIDTH = 300;
  private readonly BAR_HEIGHT = 20;
  private readonly BAR_Y = 320;
  private readonly MARKER_SIZE = 6;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    this.overlay = scene.add.graphics();
    this.overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 960, 640), Phaser.Geom.Rectangle.Contains);
    this.container.add(this.overlay);

    this.enemyNameText = scene.add.text(960 / 2, 150, '', {
      fontSize: '20px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.enemyNameText);

    this.hpBar = scene.add.graphics();
    this.container.add(this.hpBar);

    this.hpText = scene.add.text(960 / 2, 190, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#cc6666',
    }).setOrigin(0.5);
    this.container.add(this.hpText);

    this.instructionText = scene.add.text(960 / 2, 230, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#b8a898',
    }).setOrigin(0.5);
    this.container.add(this.instructionText);

    this.timingBar = scene.add.graphics();
    this.container.add(this.timingBar);

    this.hitZoneGfx = scene.add.graphics();
    this.container.add(this.hitZoneGfx);

    this.barLeft = 960 / 2 - this.BAR_WIDTH / 2;
    this.barRight = 960 / 2 + this.BAR_WIDTH / 2;
    this.barCenter = 960 / 2;

    this.marker = scene.add.rectangle(this.barLeft, this.BAR_Y, this.MARKER_SIZE, this.BAR_HEIGHT + 8, 0xffdd88);
    this.marker.setDepth(201);
    this.container.add(this.marker);

    this.feedbackText = scene.add.text(960 / 2, 360, '', {
      fontSize: '18px', fontFamily: 'monospace', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.feedbackText);

    this.hintText = scene.add.text(960 / 2, 520, '[SPACE] Strike  |  [ESC] Retreat', {
      fontSize: '12px', fontFamily: 'monospace', color: '#5a4a6a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);

    this.container.setVisible(false);
  }

  show(
    config: EnemyConfig,
    onComplete: (result: CombatResult, rewards: { id: string; quantity: number }[]) => void
  ): void {
    this.result = null;
    this.visible = true;
    this.enemyHP = config.hp;
    this.enemyMaxHP = config.hp;
    this.currentEnemy = config;
    this.onComplete = onComplete;

    this.overlay.clear();
    this.overlay.fillStyle(0x0a0a1a, 0.92);
    this.overlay.fillRect(0, 0, 960, 640);
    this.overlay.lineStyle(2, 0x5a4a7a, 0.6);
    this.overlay.strokeRoundedRect(960 / 2 - 260, 100, 520, 460, 10);

    this.enemyNameText.setText(config.name);
    this.instructionText.setText('Watch the marker — strike when it\'s in the green zone!');
    this.feedbackText.setText('');

    this.drawHP();
    this.drawTimingBar(config.hitZoneWidth);
    this.startMarker(config.timingSpeed);

    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeOut',
    });
  }

  hide(): void {
    if (this.markerTween) {
      this.markerTween.stop();
      this.markerTween = null;
    }
    this.visible = false;
    this.currentEnemy = null;
    this.container.setVisible(false);
    this.result = null;
  }

  isVisible(): boolean {
    return this.visible;
  }

  getResult(): CombatResult {
    return this.result;
  }

  handleStrike(): 'hit' | 'miss' | 'kill' {
    if (!this.visible || this.result) return 'miss';

    const markerX = this.marker.x;
    const zoneLeft = this.barCenter - this.hitZoneHalf;
    const zoneRight = this.barCenter + this.hitZoneHalf;

    const inZone = markerX >= zoneLeft && markerX <= zoneRight;

    if (inZone) {
      let damage = 1 + (this.currentEnemy?.ringBonusDamage ?? 0);
      const isCrit = Math.random() < (this.currentEnemy?.ringCritChance ?? 0);
      if (isCrit) damage *= 2;

      this.enemyHP -= damage;
      this.drawHP();
      this.showFeedback(isCrit ? 'CRIT! +' + damage : 'HIT!', '#44cc66');

      if (this.enemyHP <= 0) {
        this.result = 'victory';
        this.stopMarker();
        this.marker.setVisible(false);
        this.showFeedback('VICTORY!', '#44cc66');
        this.hintText.setText('[SPACE] Collect rewards');
        return 'kill';
      }

      this.startMarker(this.currentEnemy!.timingSpeed);
      return 'hit';
    } else {
      this.showFeedback('MISS!', '#cc4444');
      this.startMarker(this.currentEnemy!.timingSpeed);
      return 'miss';
    }
  }

  handleCollect(): void {
    if (this.result !== 'victory') return;

    const rewards = this.currentEnemy?.rewards ?? [];
    this.onComplete?.('victory', rewards);
    this.hide();
  }

  handleRetreat(): void {
    if (this.result === 'victory') return;
    this.result = 'retreat';
    this.onComplete?.('retreat', []);
    this.hide();
  }

  private drawHP(): void {
    this.hpBar.clear();
    const barW = 200;
    const barH = 12;
    const x = 960 / 2 - barW / 2;
    const y = 180;

    this.hpBar.fillStyle(0x2a1a1a, 1);
    this.hpBar.fillRoundedRect(x, y, barW, barH, 3);

    const ratio = this.enemyHP / this.enemyMaxHP;
    const color = ratio > 0.5 ? 0xcc4444 : ratio > 0.25 ? 0xcc8844 : 0xcc4444;
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRoundedRect(x + 1, y + 1, (barW - 2) * ratio, barH - 2, 2);

    this.hpText.setText(`HP: ${this.enemyHP}/${this.enemyMaxHP}`);
  }

  private drawTimingBar(hitZoneWidth: number): void {
    this.timingBar.clear();
    this.hitZoneGfx.clear();

    const y = this.BAR_Y;
    const h = this.BAR_HEIGHT;

    this.timingBar.fillStyle(0x1a1a2a, 1);
    this.timingBar.fillRoundedRect(this.barLeft, y, this.BAR_WIDTH, h, 4);
    this.timingBar.lineStyle(1, 0x3a3a4a, 1);
    this.timingBar.strokeRoundedRect(this.barLeft, y, this.BAR_WIDTH, h, 4);

    this.hitZoneHalf = hitZoneWidth / 2;

    this.hitZoneGfx.fillStyle(0x44cc66, 0.5);
    this.hitZoneGfx.fillRect(this.barCenter - this.hitZoneHalf, y + 2, hitZoneWidth, h - 4);
  }

  private startMarker(speed: number): void {
    if (this.markerTween) {
      this.markerTween.stop();
    }
    this.marker.setPosition(this.barLeft, this.BAR_Y);
    this.marker.setVisible(true);

    this.markerTween = this.scene.tweens.add({
      targets: this.marker,
      x: this.barRight,
      duration: speed,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private stopMarker(): void {
    if (this.markerTween) {
      this.markerTween.stop();
      this.markerTween = null;
    }
  }

  private showFeedback(text: string, color: string): void {
    this.feedbackText.setText(text);
    this.feedbackText.setColor(color);
    this.feedbackText.setAlpha(1);
    this.feedbackText.setScale(1.3);

    this.scene.tweens.add({
      targets: this.feedbackText,
      alpha: 0,
      scale: 1,
      duration: 600,
      ease: 'Quad.easeOut',
    });
  }
}
