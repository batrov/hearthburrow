import Phaser from 'phaser';
import { audio } from '../systems/AudioSystem';
import { BasePanel } from './BasePanel';
import { ConfirmPopup } from './ConfirmPopup';
import { VW, VH, CX, CY } from '../systems/Viewport';
import { textStyle } from '../systems/Font';

export type CombatResult = 'victory' | 'retreat' | null;

export interface EnemyConfig {
  name: string;
  hp: number;
  timingSpeed: number;
  hitZoneWidth: number;
  spriteKey?: string;
  rewards?: { id: string; quantity: number }[];
  ringBonusDamage?: number;
  ringCritChance?: number;
  researchBonusDamage?: number;
  researchCritChance?: number;
  bossDamageMult?: number;
}

export class CombatPanel extends BasePanel {
  private enemyNameText: Phaser.GameObjects.Text;
  private hpBar: Phaser.GameObjects.Graphics;
  private hpText: Phaser.GameObjects.Text;
  private timingBar: Phaser.GameObjects.Graphics;
  private marker: Phaser.GameObjects.Rectangle;
  private hitZoneGfx: Phaser.GameObjects.Graphics;
  private feedbackText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private instructionText: Phaser.GameObjects.Text;
  private enemySprite: Phaser.GameObjects.Image;
  private retreatBtn: Phaser.GameObjects.Text;
  private result: CombatResult = null;
  private enemyHP: number = 0;
  private enemyMaxHP: number = 0;
  private barLeft: number = 0;
  private barRight: number = 0;
  private barCenter: number = 0;
  private hitZoneHalf: number = 0;
  private hitZoneOffset: number = 0;
  private currentHitZoneWidth: number = 0;
  private critZoneHalf: number = 0;
  private currentEnemy: EnemyConfig | null = null;
  private onComplete: ((result: CombatResult, rewards: { id: string; quantity: number }[]) => void) | null = null;
  private onMiss: (() => void) | null = null;
  private markerTween: Phaser.Tweens.Tween | null = null;
  private hitPauseTimer?: Phaser.Time.TimerEvent;
  private blocker: Phaser.GameObjects.Rectangle;
  private confirmPopup: ConfirmPopup;
  private retreatHitZone: Phaser.GameObjects.Rectangle;
  private clickHandler: ((p: Phaser.Input.Pointer) => void) | null = null;

  private readonly BAR_WIDTH = 300;
  private readonly BAR_HEIGHT = 16;
  private readonly BAR_Y = 400;
  private readonly MARKER_SIZE = 6;
  private readonly CRIT_RATIO = 0.4;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.container.setDepth(210);

    this.overlay = scene.add.graphics();
    this.container.add(this.overlay);

    this.enemyNameText = scene.add.text(CX, 100, '', {
      fontSize: '18px', fontFamily: 'Inter', resolution: 4, color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.enemyNameText);

    this.enemySprite = scene.add.image(CX, 180, '__DEFAULT');
    this.enemySprite.setOrigin(0.5);
    this.container.add(this.enemySprite);

    this.hpBar = scene.add.graphics();
    this.container.add(this.hpBar);

    this.hpText = scene.add.text(CX, 310, '', {
      fontSize: '14px', fontFamily: 'Inter', resolution: 4, color: '#cc6666',
    }).setOrigin(0.5);
    this.container.add(this.hpText);

    this.instructionText = scene.add.text(CX, 340, '', {
      fontSize: '12px', fontFamily: 'Inter', resolution: 4, color: '#b8a898',
    }).setOrigin(0.5);
    this.container.add(this.instructionText);

    this.timingBar = scene.add.graphics();
    this.container.add(this.timingBar);

    this.hitZoneGfx = scene.add.graphics();
    this.container.add(this.hitZoneGfx);

    this.barLeft = CX - this.BAR_WIDTH / 2;
    this.barRight = CX + this.BAR_WIDTH / 2;
    this.barCenter = CX;

    this.marker = scene.add.rectangle(this.barLeft, this.BAR_Y, this.MARKER_SIZE, this.BAR_HEIGHT + 8, 0xffdd88);
    this.marker.setDepth(201);
    this.container.add(this.marker);

    this.feedbackText = scene.add.text(CX, 440, '', {
      fontSize: '16px', fontFamily: 'Inter', resolution: 4, fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.feedbackText);

    this.hintText = scene.add.text(CX, 480, '[SPACE] Strike  |  Action button', {
      fontSize: '11px', fontFamily: 'Inter', resolution: 4, color: '#5a4a6a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);

    this.retreatBtn = scene.add.text(CX, 520, '[ ESC ] Retreat', {
      fontSize: '14px', fontFamily: 'Inter', resolution: 4, color: '#cc6644',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(210).setData('isUI', true).setVisible(false);

    this.retreatHitZone = scene.add.rectangle(CX, 520, 200, 36, 0x000000, 0)
      .setScrollFactor(0).setDepth(210).setData('isUI', true).setVisible(false);
    this.retreatHitZone.setInteractive({ useHandCursor: true });
    this.retreatHitZone.on('pointerdown', () => {
      if (this._visible && !this.result) {
        this.confirmPopup.show('Retreat?', 'Leave the dungeon?\nAll progress this floor is lost.', () => this.handleRetreat());
      }
    });

    this.blocker = scene.add.rectangle(CX, CY, VW, VH, 0x000000, 0)
      .setScrollFactor(0).setInteractive().setData('isUI', true);
    this.container.add(this.blocker);

    this.confirmPopup = new ConfirmPopup(scene);
  }

  show(
    config: EnemyConfig,
    onComplete: (result: CombatResult, rewards: { id: string; quantity: number }[]) => void,
    onMiss?: () => void,
  ): void {
    this.result = null;
    this._visible = true;
    this.enemyHP = config.hp;
    this.enemyMaxHP = config.hp;
    this.currentEnemy = config;
    this.onComplete = onComplete;
    this.onMiss = onMiss ?? null;

    this.overlay.clear();
    this.overlay.fillStyle(0x0a0a1a, 0.92);
    this.overlay.fillRect(0, 0, VW, VH);
    this.overlay.lineStyle(2, 0x5a4a7a, 0.6);
    this.overlay.strokeRoundedRect(CX - 160, 60, 320, 500, 10);

    this.enemyNameText.setText(config.name);
    this.instructionText.setText('Watch the marker — strike when it\'s in the green zone!');
    this.feedbackText.setText('');

    if (config.spriteKey && this.scene.textures.exists(config.spriteKey)) {
      this.enemySprite.setTexture(config.spriteKey);
      this.enemySprite.setDisplaySize(96, 96);
      this.enemySprite.setScrollFactor(0);
      this.enemySprite.setVisible(true);
    } else {
      this.enemySprite.setVisible(false);
    }

    this.hitZoneOffset = 0;
    this.retreatBtn.setVisible(true);
    this.retreatHitZone.setVisible(true);
    this.drawHP();
    this.drawTimingBar(config.hitZoneWidth);
    this.startMarker(config.timingSpeed);

    this.blocker.setVisible(true);
    this.clickHandler = (p: Phaser.Input.Pointer) => {
      if (!this._visible) return;
      if (this.confirmPopup.isVisible()) return;
      if (this.result === 'victory') {
        this.handleCollect();
      } else if (this.handleStrike() === 'miss') {
        this.onMiss?.();
      }
    };
    this.scene.time.delayedCall(0, () => {
      this.scene.input.on('pointerdown', this.clickHandler!);
    });
    this.fadeIn(200);
  }

  hide(): void {
    if (this.hitPauseTimer) {
      this.hitPauseTimer.remove();
      this.hitPauseTimer = undefined;
    }
    if (this.markerTween) {
      this.markerTween.stop();
    }
    if (this.clickHandler) {
      this.scene.input.off('pointerdown', this.clickHandler);
      this.clickHandler = null;
    }
    this.currentEnemy = null;
    this.enemySprite.setVisible(false);
    this.blocker.setVisible(false);
    this.retreatBtn.setVisible(false);
    this.retreatHitZone.setVisible(false);
    this.result = null;
    this.fadeOut(200);
  }

  destroy(): void {
    if (this.clickHandler) {
      this.scene.input.off('pointerdown', this.clickHandler);
      this.clickHandler = null;
    }
    this.retreatHitZone.destroy();
    this.retreatBtn.destroy();
    super.destroy();
  }

  getResult(): CombatResult {
    return this.result;
  }

  handleStrike(): 'hit' | 'miss' | 'kill' {
    if (!this._visible || this.result) return 'miss';

    const markerX = this.marker.x;
    const zoneCenter = this.barCenter + this.hitZoneOffset;
    const zoneLeft = zoneCenter - this.hitZoneHalf;
    const zoneRight = zoneCenter + this.hitZoneHalf;

    const inZone = markerX >= zoneLeft && markerX <= zoneRight;
    const inCritZone = inZone && markerX >= zoneCenter - this.critZoneHalf && markerX <= zoneCenter + this.critZoneHalf;

    if (inZone) {
      let damage = 1 + (this.currentEnemy?.ringBonusDamage ?? 0) + (this.currentEnemy?.researchBonusDamage ?? 0);
      if (inCritZone) damage *= 2;
      const isCrit = Math.random() < ((this.currentEnemy?.ringCritChance ?? 0) + (this.currentEnemy?.researchCritChance ?? 0));
      if (isCrit) damage *= 2;
      if (this.currentEnemy?.bossDamageMult) damage = Math.floor(damage * this.currentEnemy.bossDamageMult);
      this.spawnDamagePopup(damage, isCrit || inCritZone, this.marker.x, this.BAR_Y);

      this.enemyHP -= damage;
      if (this.enemyHP < 0) {
        this.enemyHP = 0;
      }
      this.drawHP();
      this.showFeedback(isCrit ? 'CRIT! +' + damage : 'HIT!', '#44cc66');
      if (isCrit || inCritZone) audio.playCombatCrit();
      else audio.playCombatHit();

      this.scene.tweens.add({
        targets: this.enemySprite,
        x: this.enemySprite.x + 5,
        duration: 25,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.easeInOut',
      });

      if (this.enemyHP <= 0) {
        this.result = 'victory';
        this.stopMarker();
        this.showFeedback('VICTORY!', '#44cc66');
        audio.playVictory();
        this.hintText.setText('[SPACE] Collect rewards');
        this.retreatBtn.setVisible(false);
        return 'kill';
      }

      this.markerTween?.pause();
      this.hitPauseTimer = this.scene.time.delayedCall(250, () => {
        this.hitPauseTimer = undefined;
        this.markerTween?.resume();
        this.randomizeHitZone();
      });
      return 'hit';
    } else {
      this.showFeedback('MISS!', '#cc4444');
      audio.playCombatMiss();
      this.markerTween?.pause();
      this.hitPauseTimer = this.scene.time.delayedCall(250, () => {
        this.hitPauseTimer = undefined;
        this.markerTween?.resume();
      });

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
    const barW = 180;
    const barH = 10;
    const x = CX - barW / 2;
    const y = 290;

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
    this.currentHitZoneWidth = hitZoneWidth;

    const zoneCenter = this.barCenter + this.hitZoneOffset;
    this.hitZoneGfx.fillStyle(0x44cc66, 0.5);
    this.hitZoneGfx.fillRect(zoneCenter - this.hitZoneHalf, y + 2, hitZoneWidth, h - 4);

    this.critZoneHalf = this.hitZoneHalf * this.CRIT_RATIO;
    this.hitZoneGfx.fillStyle(0xffdd44, 0.7);
    this.hitZoneGfx.fillRect(zoneCenter - this.critZoneHalf, y + 4, this.critZoneHalf * 2, h - 8);
  }

  private randomizeHitZone(): void {
    const maxOffset = (this.BAR_WIDTH / 2) - this.currentHitZoneWidth / 2;
    if (maxOffset <= 0) {
      this.hitZoneOffset = 0;
    } else {
      this.hitZoneOffset = Phaser.Math.Between(-maxOffset, maxOffset);
    }
    this.drawTimingBar(this.currentHitZoneWidth);
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

  private spawnDamagePopup(damage: number, isCritical: boolean, x: number, y: number): void {
    const popup = this.scene.add.text(x, y, isCritical ? `${damage}!` : `${damage}` , {
      fontSize: isCritical ? '22px' : '16px',
      fontFamily: 'Inter', resolution: 4,
      color: isCritical ? '#ffdd44' : '#ffffff',
      fontStyle: isCritical ? 'bold' : 'normal',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(250);
    this.container.add(popup);

    const duration = 900;
    const peakY = 60;
    const driftX = Phaser.Math.Between(-50, 50);

    this.scene.tweens.add({
      targets: popup,
      alpha: 0,
      duration,
      ease: 'Quad.easeIn',
      onUpdate: (tween) => {
        const t = tween.progress;
        popup.y = y - peakY * 4 * t * (1 - t) + 15 * t;
        popup.x = x + driftX * t;
        popup.setScale(1 + t * 1.0);
      },
      onComplete: () => popup.destroy(),
    });
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
