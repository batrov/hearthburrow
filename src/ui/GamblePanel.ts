import Phaser from 'phaser';
import { BasePanel } from './BasePanel';
import { audio } from '../systems/AudioSystem';
import { itemIconKey } from '../systems/GameState';
import { VW, VH, CX, CY } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';
import { getInputMode } from '../systems/InputMode';
import { NineSliceBg } from './NineSliceBg';
import { UiButton } from './UiButton';

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
  private wheelCY: number = 0;

  private legendGfx!: Phaser.GameObjects.Graphics;
  private legendTitle!: Phaser.GameObjects.Text;
  private legendLines: Phaser.GameObjects.Text[] = [];
  private spinBtn!: UiButton;
  private walkBtn!: UiButton;
  private panelBg: Phaser.GameObjects.NineSlice | null = null;
  private modalBg: Phaser.GameObjects.NineSlice | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene);

    this.createOverlay();
    this.wheelCY = CY() - 70;

    this.wheelGfx = scene.add.graphics();
    this.wheelContainer = scene.add.container(CX(), this.wheelCY, [this.wheelGfx]);
    this.container.add(this.wheelContainer);

    this.pointerGfx = scene.add.graphics();
    this.container.add(this.pointerGfx);

    this.titleText = createText(scene, CX(), 180, '', {
      fontSize: fs(16), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.subtitleText = createText(scene, CX(), 206, '', {
      fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#6a5a8a',
    }).setOrigin(0.5);
    this.container.add(this.subtitleText);

    this.hintText = createText(scene, CX(), CY() + 20, '', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#6a5a8a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);

    this.resultBg = scene.add.graphics();
    this.container.add(this.resultBg);

    this.resultText = createText(scene, CX(), this.wheelCY, '', {
      fontSize: fs(18), fontFamily: 'Inter', resolution: 4, color: '#ffffff', fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.resultText);

    this.createLegend(scene);
    this.createButtons(scene);

    this.addCloseButton();

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.isVisible()) return;
      if (this._closeBtn && this._closeBtn.handleClick(pointer)) return;
      if (this.mode === 'preview') {
        if (this.spinBtn.handleClick(pointer)) return;
        if (this.walkBtn.handleClick(pointer)) return;
      }
      this.onPress();
    });
  }

  private createLegend(scene: Phaser.Scene): void {
    this.legendGfx = scene.add.graphics();
    this.container.add(this.legendGfx);

    this.legendTitle = createText(scene, CX(), 430, 'Rewards (% chance)', {
      fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#8a7a6a', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.legendTitle);
  }

  private createButtons(scene: Phaser.Scene): void {
    const by = 590, bw = 130, bh = 40, gap = 24;
    const spinX = CX() - gap / 2 - bw;
    const walkX = CX() + gap / 2;

    this.spinBtn = new UiButton(scene, spinX + bw / 2, by + bh / 2, 'Spin!', bw, bh,
      () => this.doSpin(),
      { fontSize: fs(14), color: '#44cc66' });
    for (const c of this.spinBtn.getChildren()) {
      this.scene.cameras.main.ignore(c);
      this.container.add(c);
    }

    this.walkBtn = new UiButton(scene, walkX + bw / 2, by + bh / 2, 'Walk away', bw, bh,
      () => this.doWalk(),
      { fontSize: fs(14), color: '#cc8888' });
    for (const c of this.walkBtn.getChildren()) {
      this.scene.cameras.main.ignore(c);
      this.container.add(c);
    }
  }

  showPreview(
    segments: RouletteSegment[],
    cost: number,
    canGamble: boolean,
    onSpin: () => void,
    onClose: (reward: { id: string; quantity: number } | null) => void,
    onWalk?: () => void,
  ): void {
    this.segments = segments;
    this.cost = cost;
    this.canGamble = canGamble;
    this.onSpin = onSpin;
    this.onWalk = onWalk ?? (() => onClose(null));
    this.onResult = onClose;
    this.mode = 'preview';
    this.spinning = false;
    this.decelerating = false;
    this.spinVelocity = 0;
    this.resolved = false;
    this.resultReward = null;
    this.wheelContainer.angle = 0;

    this.wheelCY = CY() - 70;
    this.wheelContainer.setPosition(CX(), this.wheelCY);
    this.resultText.setPosition(CX(), this.wheelCY);

    if (this.panelBg) { this.panelBg.destroy(); this.panelBg = null; }
    if (this.modalBg) { this.modalBg.destroy(); this.modalBg = null; }
    this.overlay!.clear();
    this.panelBg = NineSliceBg.panel(this.scene, CX(), VH() / 2, VW(), VH());
    this.container.add(this.panelBg);
    this.container.sendToBack(this.panelBg);
    this.modalBg = NineSliceBg.modal(this.scene, CX(), 395, 310, 470);
    this.container.add(this.modalBg);
    this.container.sendToBack(this.modalBg);

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
        const txt = createText(this.scene, 
          Math.cos(midAngle) * pctDist,
          Math.sin(midAngle) * pctDist,
          `${pct}%`,
          { fontSize: fs(8), fontFamily: 'Inter', resolution: 4, color: '#ffffff' },
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
    const lx = CX() - 130;
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
        const txt = createText(this.scene, x + 14, y, `${seg.label}  ${pct}%`, {
          fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#b0a090',
        });
        this.container.add(txt);
        this.legendLines.push(txt);
      }
    }
  }

  private drawButtons(): void {
    const bw = 130, bh = 40, gap = 24;
    const spinX = CX() - gap / 2 - bw;
    const walkX = CX() + gap / 2;
    const by = 590;
    const spinCX = spinX + bw / 2;
    const walkCX = walkX + bw / 2;
    const cy = by + bh / 2;

    if (this.canGamble) {
      this.spinBtn.setPosition(spinCX, cy);
      this.spinBtn.setEnabled(true);
      this.spinBtn.setText(this.cost > 0 ? `Spin!  (${this.cost} 🥕)` : 'Spin!');
      this.spinBtn.label.setColor('#44cc66');
    } else {
      this.spinBtn.setPosition(spinCX, cy);
      this.spinBtn.setEnabled(false);
      this.spinBtn.setText(`Need ${this.cost} 🥕`);
      this.spinBtn.label.setColor('#666666');
    }
    this.spinBtn.setVisible(true);

    this.walkBtn.setPosition(walkCX, cy);
    this.walkBtn.setVisible(true);
    this.walkBtn.label.setColor('#cc8888');
  }

  private hideButtons(): void {
    this.spinBtn.setVisible(false);
    this.walkBtn.setVisible(false);
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
    this.hintText.setText(getInputMode() !== 'keyboard' ? 'Tap to stop' : '[SPACE] Stop the wheel!').setVisible(true);
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
      CX() - 8, py - this.RADIUS - 18,
      CX() + 8, py - this.RADIUS - 18,
      CX(), py - this.RADIUS - 6,
    );
    this.pointerGfx.fillStyle(0xffaa44, 1);
    this.pointerGfx.fillTriangle(
      CX() - 5, py - this.RADIUS - 16,
      CX() + 5, py - this.RADIUS - 16,
      CX(), py - this.RADIUS - 8,
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
      this.resultBg.fillRoundedRect(CX() - 110, this.wheelCY - 24, 220, 48, 8);
      this.resultBg.lineStyle(2, 0x44cc66, 0.8);
      this.resultBg.strokeRoundedRect(CX() - 110, this.wheelCY - 24, 220, 48, 8);
      this.resultText.setText(`You won!\n${seg.reward.quantity}x ${seg.label}`);
      this.resultText.setColor('#66ee66');
      audio.playBingo();
    } else {
      this.resultBg.clear();
      this.resultBg.fillStyle(0x442222, 0.9);
      this.resultBg.fillRoundedRect(CX() - 80, this.wheelCY - 16, 160, 32, 8);
      this.resultBg.lineStyle(2, 0xcc4444, 0.6);
      this.resultBg.strokeRoundedRect(CX() - 80, this.wheelCY - 16, 160, 32, 8);
      this.resultText.setText(`${seg.label}!`);
      this.resultText.setColor('#cc6666');
      audio.playError();
    }

    this.hintText.setText(getInputMode() !== 'keyboard' ? 'Tap to close' : '[SPACE] Close');
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

  /**
   * showPreview() (called every time the panel opens) already recomputes
   * wheelCY and redraws the overlay/wheel/legend/buttons live — only the
   * handful of texts positioned once in the constructor need an explicit
   * reposition here.
   */
  onViewportResize(): void {
    super.onViewportResize();
    this.titleText.setPosition(CX(), 180);
    this.subtitleText.setPosition(CX(), 206);
    this.hintText.setPosition(CX(), CY() + 20);
    this.legendTitle.setPosition(CX(), 430);

    const by = 590, bw = 130, gap = 24;
    const spinX = CX() - gap / 2 - bw;
    const walkX = CX() + gap / 2;
    this.spinBtn.setPosition(spinX + bw / 2, by + 20);
    this.walkBtn.setPosition(walkX + bw / 2, by + 20);

    if (this._visible) {
      this.wheelCY = CY() - 70;
      this.wheelContainer.setPosition(CX(), this.wheelCY);
      this.resultText.setPosition(CX(), this.wheelCY);
      this.drawWheel();
      this.drawPointer();
      this.drawLegend();
      this.drawButtons();
    }
  }
}
