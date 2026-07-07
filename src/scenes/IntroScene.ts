import Phaser from 'phaser';
import { SCENES } from '../constants/scenes';
import { fs, createText } from '../systems/Font';
import { UiButton } from '../ui/UiButton';

interface SlideDef {
  topColor: number;
  bottomColor: number;
  text: string;
  showLogo: boolean;
}

const SLIDES: SlideDef[] = [
  {
    topColor: 0x2a1a0a,
    bottomColor: 0x1a0a00,
    text: `Long before the darkness,
Hearthburrow flourished.

Its miners walked the living depths,
returning with radiant crystals,
ancient metals,
and treasures the surface had long forgotten.`,
    showLogo: true,
  },
  {
    topColor: 0x0a1520,
    bottomColor: 0x050a10,
    text: `Then, without warning,
the mountain awoke.

The tunnels collapsed.
The deepest passages vanished.
Those still below were never seen again.

The village slowly faded into silence.`,
    showLogo: false,
  },
  {
    topColor: 0x150a15,
    bottomColor: 0x0a050a,
    text: `Years have passed...

Yet whispers speak of untouched caverns,
veins of forgotten ore,
powerful relics,
and spirits still waiting in the dark.`,
    showLogo: false,
  },
  {
    topColor: 0x1a0a0a,
    bottomColor: 0x2a1a0a,
    text: `You are the newest explorer.

Take up your pickaxe.
Brave the depths.
Recover what was lost.

Bring the light back to Hearthburrow.`,
    showLogo: true,
  },
];

export class IntroScene extends Phaser.Scene {
  private currentSlide = 0;
  private slideObjects: Phaser.GameObjects.GameObject[] = [];
  private skipBtn!: UiButton;
  private transitioning = false;
  private logoImage: Phaser.GameObjects.Image | null = null;
  private proceedHint!: Phaser.GameObjects.Text;

  private isTyping = false;
  private fullText = '';
  private textObject: Phaser.GameObjects.Text | null = null;
  private charIndex = 0;
  private typingTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: SCENES.INTRO });
  }

  create(): void {
    this.currentSlide = 0;
    this.transitioning = false;
    this.slideObjects = [];
    this.isTyping = false;
    this.fullText = '';
    this.textObject = null;
    this.charIndex = 0;
    if (this.typingTimer) { this.typingTimer.destroy(); this.typingTimer = null; }

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const cx = this.cameras.main.centerX;

    this.cameras.main.setBackgroundColor('#000000');

    this.skipBtn = new UiButton(this, w - 52, 22, 'Skip', 80, 28, () => this.goToHomeland(), { small: true, color: '#6a5a4a', fontSize: fs(14) });
    this.skipBtn.setDepth(10);

    this.proceedHint = createText(this, cx, h - 24, '[ click to skip ]', {
      fontSize: fs(12),
      fontFamily: 'Inter', resolution: 4,
      color: '#5a4a3a',
    }).setOrigin(0.5).setDepth(10).setScrollFactor(0);
    this.tweens.add({
      targets: this.proceedHint,
      alpha: { from: 1, to: 0.3 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    this.logoImage = this.add.image(cx, h * 0.28, 'title_img')
      .setOrigin(0.5).setScale(0.5).setDepth(9).setScrollFactor(0).setVisible(false);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.transitioning) return;
      if (this.skipBtn.handleClick(pointer)) return;
      this.advance();
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.skipBtn.handleHover(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.skipBtn.handleRelease(pointer));

    this.input.keyboard?.on('keydown-SPACE', () => { if (!this.transitioning) this.advance(); });
    this.input.keyboard?.on('keydown-ENTER', () => { if (!this.transitioning) this.advance(); });

    this.showSlide(0);
  }

  private advance(): void {
    if (this.transitioning) return;
    if (this.isTyping) {
      this.skipTyping();
      return;
    }
    if (this.currentSlide < SLIDES.length - 1) {
      this.transitionToSlide(this.currentSlide + 1);
    } else {
      this.goToHomeland();
    }
  }

  private skipTyping(): void {
    this.isTyping = false;
    if (this.typingTimer) { this.typingTimer.destroy(); this.typingTimer = null; }
    if (this.textObject) this.textObject.setText(this.fullText);
    this.proceedHint.setText('[ click to continue ]');
  }

  private showSlide(index: number): void {
    this.currentSlide = index;
    const slide = SLIDES[index];
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const cx = this.cameras.main.centerX;

    const bg = this.add.graphics().setDepth(0).setScrollFactor(0);
    bg.fillGradientStyle(slide.topColor, slide.topColor, slide.bottomColor, slide.bottomColor, 1);
    bg.fillRect(0, 0, w, h);
    this.slideObjects.push(bg);

    if (slide.showLogo && this.logoImage) {
      this.logoImage.setVisible(true);
    } else if (this.logoImage) {
      this.logoImage.setVisible(false);
    }

    const textY = slide.showLogo ? h * 0.58 : h * 0.45;
    this.textObject = createText(this, cx, textY, '', {
      fontSize: fs(16),
      fontFamily: 'Inter', resolution: 4,
      color: '#c8b89a',
      align: 'center',
      lineSpacing: 8,
      wordWrap: { width: Math.min(w - 60, 320) },
    }).setOrigin(0.5).setDepth(2).setScrollFactor(0);
    this.slideObjects.push(this.textObject);

    this.fullText = slide.text;
    this.charIndex = 0;
    this.isTyping = true;
    this.proceedHint.setText('[ click to skip ]');
    this.typeNextChar();

    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  private typeNextChar(): void {
    if (!this.isTyping || !this.textObject) return;

    this.charIndex++;
    this.textObject.setText(this.fullText.substring(0, this.charIndex));

    if (this.charIndex >= this.fullText.length) {
      this.isTyping = false;
      this.proceedHint.setText('[ click to continue ]');
      return;
    }

    const nextChar = this.fullText[this.charIndex];
    let delay = 30;
    if (nextChar === '.' || nextChar === '!' || nextChar === '?') delay = 300;
    else if (nextChar === '\n') delay = 200;
    else if (nextChar === '—' || nextChar === ',') delay = 100;

    this.typingTimer = this.time.delayedCall(delay, () => this.typeNextChar());
  }

  private transitionToSlide(nextIndex: number): void {
    this.transitioning = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.clearSlide();
      this.showSlide(nextIndex);
      this.transitioning = false;
    });
  }

  private clearSlide(): void {
    this.isTyping = false;
    if (this.typingTimer) { this.typingTimer.destroy(); this.typingTimer = null; }
    this.textObject = null;
    for (const obj of this.slideObjects) {
      obj.destroy();
    }
    this.slideObjects = [];
    if (this.logoImage) this.logoImage.setVisible(false);
  }

  private goToHomeland(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.isTyping = false;
    if (this.typingTimer) { this.typingTimer.destroy(); this.typingTimer = null; }
    this.skipBtn.setVisible(false);
    this.proceedHint.setVisible(false);
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.HOMELAND);
    });
  }
}
