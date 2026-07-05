import Phaser from 'phaser';
import { audio } from '../systems/AudioSystem';
import { BasePanel } from './BasePanel';
import { ConfirmPopup } from './ConfirmPopup';
import { VW, VH, CX, CY } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';
import { createAdaptiveText } from './AdaptiveText';
import { getInputMode } from '../systems/InputMode';
import { NineSliceBg } from './NineSliceBg';
import { UiButton } from './UiButton';

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
  bossMechanic?: 'shrink' | 'accelerate' | 'fake_zone' | 'invert';
  pickaxeBonusDamage?: number;
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
  private retreatBtn: UiButton;
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
  private clickHandler: ((p: Phaser.Input.Pointer) => void) | null = null;
  private currentSpeed: number = 600;
  private fakeZoneTimer?: Phaser.Time.TimerEvent;
  private fakeZoneGfx?: Phaser.GameObjects.Graphics;
  private fakeZoneX: number = 0;
  private isInverted: boolean = false;
  private invertTimer?: Phaser.Time.TimerEvent;
  private panelBg: Phaser.GameObjects.NineSlice;
  private modalBg: Phaser.GameObjects.NineSlice;

  private readonly BAR_WIDTH = 300;
  private readonly BAR_HEIGHT = 16;
  private BAR_Y = 0;
  private readonly MARKER_SIZE = 6;
  private readonly CRIT_RATIO = 0.4;

  // Fixed-size modal box, always centered via CY() — every internal Y below is
  // rebased from this live box top so the panel stays centered at any clamped
  // viewport height, instead of a chain of independent literal offsets.
  private static readonly BOX_W = 320;
  private static readonly BOX_H = 500;

  private boxTop(): number { return CY() - CombatPanel.BOX_H / 2; }

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.container.setDepth(210);

    this.overlay = scene.add.graphics();
    this.container.add(this.overlay);

    this.panelBg = NineSliceBg.panel(scene, CX(), VH() / 2, VW(), VH());
    this.panelBg.setAlpha(0.85);
    this.container.add(this.panelBg);
    this.modalBg = NineSliceBg.modal(scene, CX(), CY(), CombatPanel.BOX_W, CombatPanel.BOX_H);
    this.modalBg.setAlpha(0.85);
    this.container.add(this.modalBg);

    const boxTop = this.boxTop();
    this.BAR_Y = boxTop + 340;

    this.enemyNameText = createText(scene, CX(), boxTop + 40, '', {
      fontSize: fs(18), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.enemyNameText);

    this.enemySprite = scene.add.image(CX(), boxTop + 120, '__DEFAULT');
    this.enemySprite.setOrigin(0.5);
    this.container.add(this.enemySprite);

    this.hpBar = scene.add.graphics();
    this.container.add(this.hpBar);

    this.hpText = createText(scene, CX(), boxTop + 250, '', {
      fontSize: fs(14), fontFamily: 'Inter', resolution: 4, color: '#cc6666',
    }).setOrigin(0.5);
    this.container.add(this.hpText);

    this.instructionText = createText(scene, CX(), boxTop + 280, '', {
      fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#b8a898',
    }).setOrigin(0.5);
    this.container.add(this.instructionText);

    this.timingBar = scene.add.graphics();
    this.container.add(this.timingBar);

    this.hitZoneGfx = scene.add.graphics();
    this.container.add(this.hitZoneGfx);

    this.barLeft = CX() - this.BAR_WIDTH / 2;
    this.barRight = CX() + this.BAR_WIDTH / 2;
    this.barCenter = CX();

    this.marker = scene.add.rectangle(this.barLeft, this.BAR_Y, this.MARKER_SIZE, this.BAR_HEIGHT + 8, 0xffdd88);
    this.marker.setDepth(201);
    this.container.add(this.marker);

    this.feedbackText = createText(scene, CX(), boxTop + 380, '', {
      fontSize: fs(16), fontFamily: 'Inter', resolution: 4, fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.feedbackText);

    this.hintText = createAdaptiveText(scene, CX(), boxTop + 420, '[SPACE] Strike  |  Action button', 'Tap to strike', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#5a4a6a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);

    this.retreatBtn = new UiButton(scene, CX(), boxTop + 460, 'Retreat', 200, 36,
      () => {
        if (this._visible && !this.result) {
          this.scene.time.delayedCall(0, () => {
            this.confirmPopup.show('Retreat?', 'Leave the combat?\nAll progress during combat will be lost.', () => this.handleRetreat());
          });
        }
      },
      { fontSize: fs(14), color: '#cc6644' });
    this.retreatBtn.setDepth(210);
    this.retreatBtn.setVisible(false);
    for (const child of this.retreatBtn.getChildren()) {
      this.scene.cameras.main.ignore(child);
      this.container.add(child);
    }

    this.blocker = scene.add.rectangle(CX(), CY(), VW(), VH(), 0x000000, 0)
      .setScrollFactor(0).setInteractive().setData('isUI', true);
    this.container.add(this.blocker);

    this.confirmPopup = new ConfirmPopup(scene);
  }

  /**
   * CombatPanel manages its own overlay/box (not BasePanel's default full-bleed
   * overlay) and has no close button, so this overrides the base implementation
   * entirely rather than extending it. Repositions in place; never toggles
   * visibility. Combat is gameplay-critical and likely to be open during a
   * resize, so this repositions immediately rather than deferring to next show().
   */
  onViewportResize(): void {
    const boxTop = this.boxTop();
    this.barLeft = CX() - this.BAR_WIDTH / 2;
    this.barRight = CX() + this.BAR_WIDTH / 2;
    this.barCenter = CX();
    this.BAR_Y = boxTop + 340;

    this.enemyNameText.setPosition(CX(), boxTop + 40);
    this.enemySprite.setPosition(CX(), boxTop + 120);
    this.hpText.setPosition(CX(), boxTop + 250);
    this.instructionText.setPosition(CX(), boxTop + 280);
    this.feedbackText.setPosition(CX(), boxTop + 380);
    this.hintText.setPosition(CX(), boxTop + 420);
    this.retreatBtn.setPosition(CX(), boxTop + 460);
    this.blocker.setPosition(CX(), CY()).setSize(VW(), VH());

    if (this._visible) {
      this.overlay.clear();
      NineSliceBg.updateSize(this.panelBg, VW(), VH());
      this.panelBg.setPosition(CX(), VH() / 2);
      NineSliceBg.updateSize(this.modalBg, CombatPanel.BOX_W, CombatPanel.BOX_H);
      this.modalBg.setPosition(CX(), CY());
      this.drawHP();
      if (this.currentHitZoneWidth > 0) this.drawTimingBar(this.currentHitZoneWidth);
      if (!this.result) this.startMarker(this.currentSpeed);
    }

    this.confirmPopup.onViewportResize();
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
    NineSliceBg.updateSize(this.panelBg, VW(), VH());
    this.panelBg.setPosition(CX(), VH() / 2);
    NineSliceBg.updateSize(this.modalBg, CombatPanel.BOX_W, CombatPanel.BOX_H);
    this.modalBg.setPosition(CX(), CY());

    this.enemyNameText.setText(config.name);
    this.instructionText.setText('Watch the marker — strike when it\'s in the green zone!');
    this.feedbackText.setText('');

    if (config.spriteKey && this.scene.textures.exists(config.spriteKey)) {
      this.enemySprite.setTexture(config.spriteKey);
      this.enemySprite.setDisplaySize(config.bossDamageMult !== undefined ? 200 : 96, config.bossDamageMult !== undefined ? 200 : 96);
      this.enemySprite.setScrollFactor(0);
      if (config.bossDamageMult !== undefined) this.enemySprite.y += 20;
      this.enemySprite.setVisible(true);
    } else {
      this.enemySprite.setVisible(false);
    }

    this.hitZoneOffset = 0;
    this.currentSpeed = config.timingSpeed;
    this.isInverted = false;
    this.retreatBtn.setVisible(true);
    this.drawHP();
    this.drawTimingBar(config.hitZoneWidth);
    this.startMarker(config.timingSpeed);

    if (config.bossMechanic === 'fake_zone') {
      this.fakeZoneTimer = this.scene.time.addEvent({
        delay: 2000, loop: true,
        callback: () => this.spawnFakeZone(),
      });
    }
    if (config.bossMechanic === 'invert') {
      this.invertTimer = this.scene.time.addEvent({
        delay: 2500, loop: true,
        callback: () => this.toggleInvert(),
      });
    }

    // Boss entrance effects
    if (config.bossDamageMult !== undefined) {
      const flash = this.scene.add.rectangle(CX(), VH() / 2, VW(), VH(), 0xffffff, 0)
        .setScrollFactor(0).setDepth(210);
      this.container.add(flash);
      this.scene.tweens.add({
        targets: flash,
        alpha: { from: 0.5, to: 0 },
        duration: 400,
        onComplete: () => flash.destroy(),
      });

      const targetW = this.enemySprite.displayWidth;
      const targetH = this.enemySprite.displayHeight;
      this.enemySprite.setDisplaySize(targetW * 0.3, targetH * 0.3);
      this.scene.tweens.add({
        targets: this.enemySprite,
        displayWidth: targetW,
        displayHeight: targetH,
        duration: 500,
        ease: 'Back.easeOut',
      });

      this.enemyNameText.setScale(2).setAlpha(0);
      this.scene.tweens.add({
        targets: this.enemyNameText,
        scale: 1,
        alpha: 1,
        duration: 300,
        ease: 'Quad.easeOut',
        delay: 200,
      });
    }

    this.blocker.setVisible(true);
    this.clickHandler = (p: Phaser.Input.Pointer) => {
      if (!this._visible) return;
      if (this.confirmPopup.isVisible()) return;
      if (this.retreatBtn.handleClick(p)) return;
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
    if (this.fakeZoneTimer) {
      this.fakeZoneTimer.remove();
      this.fakeZoneTimer = undefined;
    }
    if (this.invertTimer) {
      this.invertTimer.remove();
      this.invertTimer = undefined;
    }
    if (this.fakeZoneGfx) {
      this.fakeZoneGfx.destroy();
      this.fakeZoneGfx = undefined;
    }
    if (this.clickHandler) {
      this.scene.input.off('pointerdown', this.clickHandler);
      this.clickHandler = null;
    }
    this.currentEnemy = null;
    this.enemySprite.setVisible(false);
    this.blocker.setVisible(false);
    this.retreatBtn.setVisible(false);
    this.result = null;
    this.isInverted = false;
    this.fadeOut(200);
  }

  destroy(): void {
    if (this.clickHandler) {
      this.scene.input.off('pointerdown', this.clickHandler);
      this.clickHandler = null;
    }
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

    // LAVA: fake zone check — hitting inside a decoy counts as miss
    if (this.currentEnemy?.bossMechanic === 'fake_zone' && this.fakeZoneGfx?.visible) {
      const inFake = Math.abs(markerX - this.fakeZoneX) < this.hitZoneHalf;
      if (inFake) {
        this.showFeedback('MISS! (Decoy)', '#cc4444');
        audio.playCombatMiss();
        this.spawnStaminaPopup(10, this.marker.x, this.BAR_Y);
        this.markerTween?.pause();
        this.hitPauseTimer = this.scene.time.delayedCall(250, () => {
          this.hitPauseTimer = undefined;
          this.markerTween?.resume();
        });
        return 'miss';
      }
    }

    // RUINS: invert zone — hitting outside = damage, hitting inside = miss
    const effectiveInZone = this.isInverted ? !inZone : inZone;
    const effectiveInCrit = this.isInverted ? false : inCritZone;

    if (effectiveInZone) {
      let damage = 1 + (this.currentEnemy?.ringBonusDamage ?? 0) + (this.currentEnemy?.researchBonusDamage ?? 0) + (this.currentEnemy?.pickaxeBonusDamage ?? 0);
      if (effectiveInCrit) damage *= 2;
      const isCrit = Math.random() < ((this.currentEnemy?.ringCritChance ?? 0) + (this.currentEnemy?.researchCritChance ?? 0));
      if (isCrit) damage *= 2;
      if (this.currentEnemy?.bossDamageMult) damage = Math.floor(damage * this.currentEnemy.bossDamageMult);
      this.spawnDamagePopup(damage, isCrit || effectiveInCrit, this.marker.x, this.BAR_Y);

      this.enemyHP -= damage;
      if (this.enemyHP < 0) {
        this.enemyHP = 0;
      }
      this.drawHP();
      this.showFeedback(isCrit ? 'CRIT! +' + damage : 'HIT!', '#44cc66');
      if (isCrit || effectiveInCrit) audio.playCombatCrit();
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
        this.retreatBtn.setVisible(false);

        if (this.currentEnemy?.bossDamageMult !== undefined) {
          audio.playBossVictory();

          this.scene.tweens.add({
            targets: this.enemySprite,
            x: { value: '+=' + 15 },
            duration: 35,
            yoyo: true,
            repeat: 7,
            ease: 'Sine.easeInOut',
          });

          const killFlash = this.scene.add.rectangle(CX(), VH() / 2, VW(), VH(), 0xffffff, 0)
            .setScrollFactor(0).setDepth(210);
          this.container.add(killFlash);
          this.scene.tweens.add({
            targets: killFlash,
            alpha: { value: { from: 0.4, to: 0 } },
            duration: 200,
            yoyo: true,
            repeat: 2,
            onComplete: () => killFlash.destroy(),
          });

          this.scene.time.delayedCall(600, () => {
            this.showFeedback('VICTORY!', '#44cc66');
            const isPointer = getInputMode() !== 'keyboard';
            this.hintText.setText(isPointer ? 'Tap to collect' : '[SPACE] Collect rewards');
          });
        } else {
          this.showFeedback('VICTORY!', '#44cc66');
          audio.playVictory();
          this.hintText.setText('[SPACE] Collect rewards');
        }
        return 'kill';
      }

      // CAVE: shrink hit zone on each hit
      if (this.currentEnemy?.bossMechanic === 'shrink') {
        this.currentHitZoneWidth = Math.max(35, this.currentHitZoneWidth * 0.95);
      }

      // ICE: accelerate marker on each hit
      if (this.currentEnemy?.bossMechanic === 'accelerate') {
        this.currentSpeed = Math.max(200, this.currentSpeed * 0.88);
      }

      this.markerTween?.pause();
      this.hitPauseTimer = this.scene.time.delayedCall(250, () => {
        this.hitPauseTimer = undefined;
        if (this.currentEnemy?.bossMechanic === 'accelerate') {
          this.startMarker(this.currentSpeed);
        } else {
          this.markerTween?.resume();
        }
        this.randomizeHitZone();
      });
      return 'hit';
    } else {
      this.showFeedback('MISS!', '#cc4444');
      audio.playCombatMiss();
      this.spawnStaminaPopup(10, this.marker.x, this.BAR_Y);
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
    const x = CX() - barW / 2;
    const y = this.boxTop() + 230;

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

  private spawnFakeZone(): void {
    if (!this._visible || this.result) return;
    if (!this.fakeZoneGfx) {
      this.fakeZoneGfx = this.scene.add.graphics().setScrollFactor(0).setDepth(205);
      this.container.add(this.fakeZoneGfx);
    }
    const maxOffset = (this.BAR_WIDTH / 2) - this.currentHitZoneWidth / 2;
    this.fakeZoneX = this.barCenter + Phaser.Math.Between(-maxOffset, maxOffset);
    const y = this.BAR_Y;
    const h = this.BAR_HEIGHT;
    this.fakeZoneGfx.clear();
    this.fakeZoneGfx.fillStyle(0xcc4444, 0.4);
    this.fakeZoneGfx.fillRect(this.fakeZoneX - this.hitZoneHalf, y + 2, this.currentHitZoneWidth, h - 4);
    this.fakeZoneGfx.setVisible(true);
    this.scene.time.delayedCall(500, () => {
      if (this.fakeZoneGfx) {
        this.fakeZoneGfx.clear();
        this.fakeZoneGfx.setVisible(false);
      }
    });
  }

  private toggleInvert(): void {
    if (!this._visible || this.result) return;
    this.isInverted = !this.isInverted;
    if (this.isInverted) {
      this.instructionText.setText('⚠ ZONE INVERTED — hit OUTSIDE the green!');
      this.instructionText.setColor('#ff6644');
      this.hintText.setColor('#ff6644');
    } else {
      this.instructionText.setText('Watch the marker — strike when it\'s in the green zone!');
      this.instructionText.setColor('#b8a898');
      this.hintText.setColor('#5a4a6a');
    }
  }

  private spawnDamagePopup(damage: number, isCritical: boolean, x: number, y: number): void {
    const popup = createText(this.scene, x, y, isCritical ? `${damage}!` : `${damage}` , {
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

  private spawnStaminaPopup(amount: number, x: number, y: number): void {
    const popup = createText(this.scene, x, y, `-${amount}`, {
      fontSize: fs(14),
      fontFamily: 'Inter', resolution: 4,
      color: '#ff4444',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(250);
    this.container.add(popup);

    const duration = 700;
    const peakY = 50;
    const driftX = Phaser.Math.Between(-30, 30);

    this.scene.tweens.add({
      targets: popup,
      alpha: 0,
      duration,
      ease: 'Quad.easeIn',
      onUpdate: (tween) => {
        const t = tween.progress;
        popup.y = y - peakY * 4 * t * (1 - t) + 15 * t;
        popup.x = x + driftX * t;
        popup.setScale(1 + t * 0.8);
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
