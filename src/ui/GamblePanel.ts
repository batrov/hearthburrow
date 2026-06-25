import Phaser from 'phaser';
import { BasePanel } from './BasePanel';
import { audio } from '../systems/AudioSystem';
import { itemIconKey } from '../systems/GameState';
import { VW, VH, CX, CY } from '../systems/Viewport';

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
  private subtitleText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;

  private segments: RouletteSegment[] = [];
  private wheelSprites: Phaser.GameObjects.Image[] = [];
  private wheelPctTexts: Phaser.GameObjects.Text[] = [];
  private spinVelocity: number = 0;
  private friction: number = 0;
  private spinning: boolean = false;
  private decelerating: boolean = false;
  private resolved: boolean = false;
  private resultReward: { id: string; quantity: number } | null = null;
  private onResult: ((reward: { id: string; quantity: number } | null) => void) | null = null;

  private mode: 'preview' | 'spinning' | 'result' = 'preview';
  private cost: number = 0;
  private canGamble: boolean = true;
  private onSpin: (() => void) | null = null;
  private onWalk: (() => void) | null = null;

  private readonly RADIUS = 70;
  private wheelCY: number = CY - 70;

  private legendGfx!: Phaser.GameObjects.Graphics;
  private legendTitle!: Phaser.GameObjects.Text;
  private legendLines: Phaser.GameObjects.Text[] = [];
  private spinBtnGfx!: Phaser.GameObjects.Graphics;
  private spinBtnText!: Phaser.GameObjects.Text;
  private walkBtnGfx!: Phaser.GameObjects.Graphics;
  private walkBtnText!: Phaser.GameObjects.Text;
  private spinBtnZone!: Phaser.GameObjects.Rectangle;
  private walkBtnZone!: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    super(scene);

    this.createOverlay();

    this.wheelGfx = scene.add.graphics();
    this.wheelContainer = scene.add.container(CX, this.wheelCY, [this.wheelGfx]);
    this.container.add(this.wheelContainer);

    this.pointerGfx = scene.add.graphics();
    this.container.add(this.pointerGfx);

    this.titleText = scene.add.text(CX, 180, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.subtitleText = scene.add.text(CX, 206, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#6a5a8a',
    }).setOrigin(0.5);
    this.container.add(this.subtitleText);

    this.hintText = scene.add.text(CX, CY + 20, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#6a5a8a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);

    this.resultBg = scene.add.graphics();
    this.container.add(this.resultBg);

    this.resultText = scene.add.text(CX, this.wheelCY, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.resultText);

    this.createLegend(scene);
    this.createButtons(scene);

    this.addCloseButton();

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.isVisible()) return;
      if (this._closeBtn) {
        const b = this._closeBtn.getBounds();
        if (b.contains(pointer.x, pointer.y)) return;
      }
      if (this.mode === 'preview') {
        const sb = this.spinBtnZone.getBounds();
        if (sb.contains(pointer.x, pointer.y)) { this.doSpin(); return; }
        const wb = this.walkBtnZone.getBounds();
        if (wb.contains(pointer.x, pointer.y)) { this.doWalk(); return; }
      }
      this.onPress();
    });
  }

  private createLegend(scene: Phaser.Scene): void {
    this.legendGfx = scene.add.graphics();
    this.container.add(this.legendGfx);

    this.legendTitle = scene.add.text(CX, 430, 'Rewards (% chance)', {
      fontSize: '12px', fontFamily: 'monospace', color: '#8a7a6a', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.legendTitle);
  }

  private createButtons(scene: Phaser.Scene): void {
    const by = 590, bw = 130, bh = 40, gap = 24;
    const spinX = CX - gap / 2 - bw;
    const walkX = CX + gap / 2;

    this.spinBtnGfx = scene.add.graphics();
    this.container.add(this.spinBtnGfx);

    this.spinBtnText = scene.add.text(spinX + bw / 2, by + bh / 2, 'Spin!', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.spinBtnText);

    this.spinBtnZone = scene.add.rectangle(spinX + bw / 2, by + bh / 2, bw, bh, 0xffffff, 0);
    this.spinBtnZone.setVisible(false);
    this.container.add(this.spinBtnZone);

    this.walkBtnGfx = scene.add.graphics();
    this.container.add(this.walkBtnGfx);

    this.walkBtnText = scene.add.text(walkX + bw / 2, by + bh / 2, 'Walk away', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5);
    this.container.add(this.walkBtnText);

    this.walkBtnZone = scene.add.rectangle(walkX + bw / 2, by + bh / 2, bw, bh, 0xffffff, 0);
    this.walkBtnZone.setVisible(false);
    this.container.add(this.walkBtnZone);
  }

  private drawBtn(gfx: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, enabled: boolean): void {
    gfx.clear();
    gfx.fillStyle(enabled ? color : 0x333333, enabled ? 0.2 : 0.1);
    gfx.fillRoundedRect(x, y, w, h, 8);
    gfx.lineStyle(2, enabled ? color : 0x555555, enabled ? 0.8 : 0.3);
    gfx.strokeRoundedRect(x, y, w, h, 8);
  }

  showPreview(
    segments: RouletteSegment[],
    cost: number,
    canGamble: boolean,
    onSpin: () => void,
    onClose: (reward: { id: string; quantity: number } | null) => void,
  ): void {
    this.segments = segments;
    this.cost = cost;
    this.canGamble = canGamble;
    this.onSpin = onSpin;
    this.onWalk = () => onClose(null);
    this.onResult = onClose;
    this.mode = 'preview';
    this.spinning = false;
    this.decelerating = false;
    this.spinVelocity = 0;
    this.resolved = false;
    this.resultReward = null;
    this.wheelContainer.angle = 0;

    this.overlay!.clear();
    this.overlay!.fillStyle(0x0a0a1a, 0.85);
    this.overlay!.fillRect(0, 0, VW, VH);
    this.overlay!.lineStyle(2, 0x5a4a7a, 0.6);
    this.overlay!.strokeRoundedRect(CX - 155, 160, 310, 470, 12);

    this.titleText.setText('Gambling Goblin');
    this.subtitleText.setText(`Risk ${cost} 🥕 for a spin!`).setVisible(true);
    this.hintText.setVisible(false);
    this.resultText.setText('');
    this.resultBg.clear();

    this.drawWheel();
    this.drawPointer();
    this.drawLegend();
    this.drawButtons();

    this.fadeIn(200);
  }

  private drawWheel(): void {
    this.wheelGfx.clear();
    this.wheelSprites.forEach(s => s.destroy());
    this.wheelSprites = [];
    this.wheelPctTexts.forEach(s => s.destroy());
    this.wheelPctTexts = [];
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
        ).setScale(0.5).setDepth(1);
        this.wheelContainer.add(img);
        this.wheelSprites.push(img);
      }

      if (this.mode === 'preview') {
        const midAngle = currentAngle + segAngle / 2;
        const pctDist = this.RADIUS * 0.82;
        const pct = Math.round((seg.weight / totalWeight) * 100);
        const txt = this.scene.add.text(
          Math.cos(midAngle) * pctDist,
          Math.sin(midAngle) * pctDist,
          `${pct}%`,
          { fontSize: '8px', fontFamily: 'monospace', color: '#ffffff' },
        ).setOrigin(0.5).setDepth(1);
        this.wheelContainer.add(txt);
        this.wheelPctTexts.push(txt);
      }

      currentAngle += segAngle;
    }

    this.wheelGfx.lineStyle(2, 0xffffff, 0.5);
    this.wheelGfx.strokeCircle(0, 0, this.RADIUS);
    this.wheelGfx.fillStyle(0xffffff, 0.8);
    this.wheelGfx.fillCircle(0, 0, 6);
  }

  private drawLegend(): void {
    this.legendGfx.clear();
    this.legendLines.forEach(t => t.destroy());
    this.legendLines = [];

    this.legendTitle.setVisible(true);

    const totalWeight = this.segments.reduce((s, seg) => s + seg.weight, 0);
    const lx = CX - 130;
    const startY = 454;
    const rowH = 17;
    const colW = 130;
    const mid = Math.ceil(this.segments.length / 2);

    const cols = [this.segments.slice(0, mid), this.segments.slice(mid)];

    for (let ci = 0; ci < cols.length; ci++) {
      for (let ri = 0; ri < cols[ci].length; ri++) {
        const seg = cols[ci][ri];
        const y = startY + ri * rowH;
        const x = lx + ci * colW;

        this.legendGfx.fillStyle(seg.color, 1);
        this.legendGfx.fillRect(x, y + 2, 10, 10);

        const pct = Math.round((seg.weight / totalWeight) * 100);
        const txt = this.scene.add.text(x + 14, y, `${seg.label}  ${pct}%`, {
          fontSize: '11px', fontFamily: 'monospace', color: '#b0a090',
        });
        this.container.add(txt);
        this.legendLines.push(txt);
      }
    }
  }

  private drawButtons(): void {
    const bw = 130, bh = 40, gap = 24;
    const spinX = CX - gap / 2 - bw;
    const walkX = CX + gap / 2;
    const by = 590;

    if (this.canGamble) {
      this.drawBtn(this.spinBtnGfx, spinX, by, bw, bh, 0x44cc66, true);
      this.spinBtnText.setColor('#44cc66').setText(this.cost > 0 ? `Spin!  (${this.cost} 🥕)` : 'Spin!');
    } else {
      this.drawBtn(this.spinBtnGfx, spinX, by, bw, bh, 0x666666, false);
      this.spinBtnText.setColor('#666666').setText(`Need ${this.cost} 🥕`);
    }
    this.spinBtnText.setVisible(true);
    this.spinBtnZone.setVisible(true);

    this.drawBtn(this.walkBtnGfx, walkX, by, bw, bh, 0x886666, true);
    this.walkBtnText.setColor('#cc8888').setText('Walk away');
    this.walkBtnText.setVisible(true);
    this.walkBtnZone.setVisible(true);
  }

  private hideButtons(): void {
    this.spinBtnGfx.clear();
    this.walkBtnGfx.clear();
    this.spinBtnText.setVisible(false);
    this.walkBtnText.setVisible(false);
    this.spinBtnZone.setVisible(false);
    this.walkBtnZone.setVisible(false);
  }

  private hideLegend(): void {
    this.legendGfx.clear();
    this.legendTitle.setVisible(false);
    this.legendLines.forEach(t => t.destroy());
    this.legendLines = [];
  }

  onPress(): void {
    if (!this._visible) return;
    if (this.mode === 'preview') {
      return;
    }
    if (this.resolved) {
      this.doClose();
    } else if (this.spinning && !this.decelerating) {
      this.stopSpin();
    }
  }

  private doSpin(): void {
    if (!this.onSpin) return;
    this.onSpin();
    this.mode = 'spinning';
    this.hideLegend();
    this.hideButtons();
    this.subtitleText.setVisible(false);
    this.hintText.setText('[SPACE] Stop the wheel!').setVisible(true);
    this.resultText.setText('');
    this.resultBg.clear();
    this.wheelPctTexts.forEach(s => s.destroy());
    this.wheelPctTexts = [];
    this.startSpin();
  }

  private doWalk(): void {
    if (this.onWalk) this.onWalk();
    this.hide();
  }

  private doClose(): void {
    if (this.onResult) this.onResult(this.resultReward);
    this.hide();
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

  private drawPointer(): void {
    const py = this.wheelCY;
    this.pointerGfx.clear();
    this.pointerGfx.fillStyle(0xffdd88, 1);
    this.pointerGfx.fillTriangle(
      CX - 8, py - this.RADIUS - 18,
      CX + 8, py - this.RADIUS - 18,
      CX, py - this.RADIUS - 6,
    );
    this.pointerGfx.fillStyle(0xffaa44, 1);
    this.pointerGfx.fillTriangle(
      CX - 5, py - this.RADIUS - 16,
      CX + 5, py - this.RADIUS - 16,
      CX, py - this.RADIUS - 8,
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
    this.mode = 'result';
    this.resolved = true;
    this.resultReward = seg.reward ?? null;

    if (seg.reward) {
      this.resultBg.clear();
      this.resultBg.fillStyle(0x224422, 0.9);
      this.resultBg.fillRoundedRect(CX - 110, this.wheelCY - 24, 220, 48, 8);
      this.resultBg.lineStyle(2, 0x44cc66, 0.8);
      this.resultBg.strokeRoundedRect(CX - 110, this.wheelCY - 24, 220, 48, 8);
      this.resultText.setText(`You won!\n${seg.reward.quantity}x ${seg.label}`);
      this.resultText.setColor('#66ee66');
      audio.playBingo();
    } else {
      this.resultBg.clear();
      this.resultBg.fillStyle(0x442222, 0.9);
      this.resultBg.fillRoundedRect(CX - 80, this.wheelCY - 16, 160, 32, 8);
      this.resultBg.lineStyle(2, 0xcc4444, 0.6);
      this.resultBg.strokeRoundedRect(CX - 80, this.wheelCY - 16, 160, 32, 8);
      this.resultText.setText(`${seg.label}!`);
      this.resultText.setColor('#cc6666');
      audio.playError();
    }

    this.hintText.setText('[SPACE] Close');
  }

  hide(): void {
    if (this.spinning) {
      this.scene.events.off('update', this.onUpdate, this);
    }
    this.wheelSprites.forEach(s => s.destroy());
    this.wheelSprites = [];
    this.wheelPctTexts.forEach(s => s.destroy());
    this.wheelPctTexts = [];
    this.legendLines.forEach(t => t.destroy());
    this.legendLines = [];
    this.mode = 'preview';
    this._visible = false;
    this.container.setVisible(false);
    if (this._closeBtn) this._closeBtn.setVisible(false);
  }
}
