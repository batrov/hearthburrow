import Phaser from 'phaser';
import { BasePanel } from './BasePanel';
import { audio } from '../systems/AudioSystem';
import { itemIconKey } from '../systems/GameState';

export interface RouletteSegment {
  label: string;
  weight: number;
  color: number;
  reward?: { id: string; quantity: number };
}

export class GamblePanel extends BasePanel {
  private wheelContainer: Phaser.GameObjects.Container;
  private wheelGfx: Phaser.GameObjects.Graphics;
  private pointerGfx: Phaser.GameObjects.Graphics;
  private resultBg: Phaser.GameObjects.Graphics;
  private resultText: Phaser.GameObjects.Text;
  private titleText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;

  private segments: RouletteSegment[] = [];
  private wheelSprites: Phaser.GameObjects.Image[] = [];
  private spinVelocity: number = 0;
  private friction: number = 0;
  private spinning: boolean = false;
  private decelerating: boolean = false;
  private resolved: boolean = false;
  private resultReward: { id: string; quantity: number } | null = null;
  private onResult: ((reward: { id: string; quantity: number } | null) => void) | null = null;

  private readonly CX = 480;
  private readonly CY = 290;
  private readonly RADIUS = 110;

  constructor(scene: Phaser.Scene) {
    super(scene);

    this.createOverlay();

    this.wheelGfx = scene.add.graphics();
    this.wheelContainer = scene.add.container(this.CX, this.CY, [this.wheelGfx]);
    this.container.add(this.wheelContainer);

    this.pointerGfx = scene.add.graphics();
    this.container.add(this.pointerGfx);

    this.titleText = scene.add.text(this.CX, this.CY - this.RADIUS - 50, '', {
      fontSize: '20px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.hintText = scene.add.text(this.CX, this.CY + this.RADIUS + 40, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#6a5a8a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);

    this.resultBg = scene.add.graphics();
    this.container.add(this.resultBg);

    this.resultText = scene.add.text(this.CX, this.CY, '', {
      fontSize: '22px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.resultText);

    this.addCloseButton();

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.isVisible()) return;
      if (this._closeBtn) {
        const b = this._closeBtn.getBounds();
        if (b.contains(pointer.x, pointer.y)) return;
      }
      this.onPress();
    });
  }

  show(
    segments: RouletteSegment[],
    cost: number,
    onResult: (reward: { id: string; quantity: number } | null) => void,
  ): void {
    this.segments = segments;
    this.onResult = onResult;
    this.resolved = false;
    this.resultReward = null;
    this.spinning = false;
    this.decelerating = false;
    this.spinVelocity = 0;
    this.wheelContainer.angle = 0;

    this.overlay!.clear();
    this.overlay!.fillStyle(0x0a0a1a, 0.85);
    this.overlay!.fillRect(0, 0, 960, 640);
    this.overlay!.lineStyle(2, 0x5a4a7a, 0.6);
    this.overlay!.strokeRoundedRect(this.CX - 200, this.CY - this.RADIUS - 70, 400, this.RADIUS * 2 + 130, 12);

    this.titleText.setText(`Roulette! (Cost: ${cost} Stone)`);
    this.hintText.setText('[SPACE] Stop the wheel!');
    this.resultText.setText('');
    this.resultBg.clear();

    this.drawWheel();
    this.drawPointer();
    this.startSpin();

    this._visible = true;
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeOut',
    });
  }

  onPress(): void {
    if (!this._visible) return;
    if (this.resolved) {
      this.close();
    } else if (this.spinning && !this.decelerating) {
      this.stopSpin();
    }
  }

  private stopSpin(): void {
    this.decelerating = true;
    this.friction = 0.95 + Math.random() * 0.045;
    this.hintText.setText('Spinning down...');
  }

  private startSpin(): void {
    this.spinVelocity = 600 + Math.random() * 600;
    this.friction = 0;
    this.spinning = true;
    this.decelerating = false;
    this.scene.events.on('update', this.onUpdate, this);
  }

  private onUpdate(_time: number, delta: number): void {
    if (!this.spinning) return;
    const dt = delta / 1000;
    this.wheelContainer.angle += this.spinVelocity * dt;
    if (this.decelerating) {
      this.spinVelocity *= Math.pow(this.friction, dt * 60);
      if (this.spinVelocity < 5) {
        this.spinVelocity = 0;
        this.spinning = false;
        this.scene.events.off('update', this.onUpdate, this);
        this.evaluateResult();
      }
    }
  }

  private drawWheel(): void {
    this.wheelGfx.clear();
    this.wheelSprites.forEach(s => s.destroy());
    this.wheelSprites = [];
    const totalWeight = this.segments.reduce((s, seg) => s + seg.weight, 0);
    let currentAngle = -Math.PI / 2;

    for (const seg of this.segments) {
      const segAngle = (seg.weight / totalWeight) * Math.PI * 2;
      this.wheelGfx.beginPath();
      this.wheelGfx.moveTo(0, 0);
      this.wheelGfx.arc(0, 0, this.RADIUS, currentAngle, currentAngle + segAngle, false);
      this.wheelGfx.closePath();
      this.wheelGfx.fillStyle(seg.color, 1);
      this.wheelGfx.fillPath();
      this.wheelGfx.lineStyle(1, 0xffffff, 0.3);
      this.wheelGfx.strokePath();

      if (seg.reward && this.scene.textures.exists(itemIconKey(seg.reward.id))) {
        const midAngle = currentAngle + segAngle / 2;
        const iconDist = this.RADIUS * 0.62;
        const img = this.scene.add.image(
          Math.cos(midAngle) * iconDist,
          Math.sin(midAngle) * iconDist,
          itemIconKey(seg.reward.id),
        ).setScale(0.55).setDepth(1);
        this.wheelContainer.add(img);
        this.wheelSprites.push(img);
      }

      currentAngle += segAngle;
    }

    this.wheelGfx.lineStyle(2, 0xffffff, 0.5);
    this.wheelGfx.strokeCircle(0, 0, this.RADIUS);
    this.wheelGfx.fillStyle(0xffffff, 0.8);
    this.wheelGfx.fillCircle(0, 0, 6);
  }

  private drawPointer(): void {
    this.pointerGfx.clear();
    this.pointerGfx.fillStyle(0xffdd88, 1);
    this.pointerGfx.fillTriangle(
      this.CX - 10, this.CY - this.RADIUS - 24,
      this.CX + 10, this.CY - this.RADIUS - 24,
      this.CX, this.CY - this.RADIUS - 8,
    );
    this.pointerGfx.fillStyle(0xffaa44, 1);
    this.pointerGfx.fillTriangle(
      this.CX - 6, this.CY - this.RADIUS - 22,
      this.CX + 6, this.CY - this.RADIUS - 22,
      this.CX, this.CY - this.RADIUS - 10,
    );
  }

  private evaluateResult(): void {
    const normalizedAngle = ((this.wheelContainer.angle % 360) + 360) % 360;
    const pointerAngle = (360 - normalizedAngle) % 360;
    const totalWeight = this.segments.reduce((s, seg) => s + seg.weight, 0);
    let cumulative = 0;

    for (const seg of this.segments) {
      const segAngleDeg = (seg.weight / totalWeight) * 360;
      if (pointerAngle >= cumulative - 0.001 && pointerAngle < cumulative + segAngleDeg - 0.001) {
        this.showResult(seg);
        return;
      }
      cumulative += segAngleDeg;
    }

    this.showResult(this.segments[0]);
  }

  private showResult(seg: RouletteSegment): void {
    this.resolved = true;
    this.resultReward = seg.reward ?? null;

    if (seg.reward) {
      this.resultBg.clear();
      this.resultBg.fillStyle(0x224422, 0.9);
      this.resultBg.fillRoundedRect(this.CX - 140, this.CY - 30, 280, 60, 8);
      this.resultBg.lineStyle(2, 0x44cc66, 0.8);
      this.resultBg.strokeRoundedRect(this.CX - 140, this.CY - 30, 280, 60, 8);
      this.resultText.setText(`You won!\n${seg.reward.quantity}x ${seg.label}`);
      this.resultText.setColor('#66ee66');
      audio.playBingo();
    } else {
      this.resultBg.clear();
      this.resultBg.fillStyle(0x442222, 0.9);
      this.resultBg.fillRoundedRect(this.CX - 100, this.CY - 20, 200, 40, 8);
      this.resultBg.lineStyle(2, 0xcc4444, 0.6);
      this.resultBg.strokeRoundedRect(this.CX - 100, this.CY - 20, 200, 40, 8);
      this.resultText.setText(`${seg.label}!`);
      this.resultText.setColor('#cc6666');
      audio.playError();
    }

    this.hintText.setText('[SPACE] Close');
  }

  private close(): void {
    if (this.onResult) {
      this.onResult(this.resultReward);
    }
    this.hide();
  }

  hide(): void {
    if (this.spinning) {
      this.scene.events.off('update', this.onUpdate, this);
    }
    this.wheelSprites.forEach(s => s.destroy());
    this.wheelSprites = [];
    this._visible = false;
    this.container.setVisible(false);
  }
}
