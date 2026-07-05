import Phaser from 'phaser';
import { audio } from '../systems/AudioSystem';
import { BasePanel } from './BasePanel';
import { UiButton } from './UiButton';
import { NineSliceBg } from './NineSliceBg';
import { VH, CX } from '../systems/Viewport';
import { fs, createText } from '../systems/Font';

export interface EventChoice {
  label: string;
  action: () => void;
}

export interface EventConfig {
  title: string;
  description: string;
  choices: EventChoice[];
}

export class EventPanel extends BasePanel {
  private titleText: Phaser.GameObjects.Text;
  private descText: Phaser.GameObjects.Text;
  private onComplete: (() => void) | null = null;
  private selectedIndex: number = 0;
  private choiceButtons: UiButton[] = [];
  private _clickHandler: ((p: Phaser.Input.Pointer) => void) | null = null;
  private _moveHandler: ((p: Phaser.Input.Pointer) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene);

    this.createOverlay();
    this.overlay!.setData('isUI', true);

    this.titleText = createText(scene, CX(), 120, '', {
      fontSize: fs(18), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.descText = createText(scene, CX(), 160, '', {
      fontSize: fs(13), fontFamily: 'Inter', resolution: 4, color: '#b8a898',
      align: 'center', wordWrap: { width: 320 }, lineSpacing: 4,
    }).setOrigin(0.5, 0);
    this.container.add(this.descText);

    this.addCloseButton();
  }

  confirm(): void {
    if (!this._visible) return;
    this.selectChoice(this.selectedIndex);
  }

  navigateUp(): void {
    if (!this._visible || this.choiceButtons.length < 2) return;
    this.choiceButtons[this.selectedIndex].setSelected(false);
    this.selectedIndex = (this.selectedIndex - 1 + this.choiceButtons.length) % this.choiceButtons.length;
    this.choiceButtons[this.selectedIndex].setSelected(true);
  }

  navigateDown(): void {
    if (!this._visible || this.choiceButtons.length < 2) return;
    this.choiceButtons[this.selectedIndex].setSelected(false);
    this.selectedIndex = (this.selectedIndex + 1) % this.choiceButtons.length;
    this.choiceButtons[this.selectedIndex].setSelected(true);
  }

  show(config: EventConfig, onComplete?: () => void): void {
    this.cleanupInteraction();
    this.onComplete = onComplete ?? null;
    this._visible = true;
    this.selectedIndex = 0;

    this.overlay!.clear();
    const boxH = VH() - 160;
    const modal = NineSliceBg.modal(this.scene, CX(), 80 + boxH / 2, 340, boxH);
    modal.setDepth(199);
    this.container.addAt(modal, 1);

    this.titleText.setText(config.title);
    this.descText.setText(config.description);

    const btnW = 300;
    const btnH = 38;
    const gap = 8;
    for (let i = 0; i < config.choices.length; i++) {
      const y = 260 + i * (btnH + gap);

      const btn = new UiButton(this.scene, CX(), y, config.choices[i].label, btnW, btnH,
        () => this.selectChoice(i),
        { fontSize: fs(13), color: '#c8b898' }
      );
      btn.setDepth(200);
      for (const c of btn.getChildren()) {
        this.container.add(c);
      }
      this.choiceButtons.push(btn);
    }
    this.currentChoices = config.choices.slice();
    if (this.choiceButtons.length > 0) {
      this.choiceButtons[0].setSelected(true);
    }

    this._clickHandler = (p: Phaser.Input.Pointer) => {
      if (!this._visible) return;
      const cx = CX();
      for (let i = 0; i < this.choiceButtons.length; i++) {
        const by = 260 + i * (btnH + gap);
        if (p.x >= cx - btnW / 2 && p.x <= cx + btnW / 2 && p.y >= by - btnH / 2 && p.y <= by + btnH / 2) {
          this.selectChoice(i);
          return;
        }
      }
    };
    this.scene.input.on('pointerdown', this._clickHandler);

    this._moveHandler = (p: Phaser.Input.Pointer) => {
      if (!this._visible) return;
      for (const btn of this.choiceButtons) {
        btn.handleHover(p);
      }
    };
    this.scene.input.on('pointermove', this._moveHandler);

    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeOut',
    });
    if (this._closeBtn) this._closeBtn.setVisible(true);
  }

  private cleanupInteraction(): void {
    if (this._clickHandler) {
      this.scene.input.off('pointerdown', this._clickHandler);
      this._clickHandler = null;
    }
    if (this._moveHandler) {
      this.scene.input.off('pointermove', this._moveHandler);
      this._moveHandler = null;
    }
    this.choiceButtons.forEach(b => b.destroy());
    this.choiceButtons = [];
  }

  private selectChoice(index: number): void {
    if (!this._visible) return;
    if (index < 0 || index >= this.choiceButtons.length) return;

    this._visible = false;
    this.container.setVisible(false);
    if (this._closeBtn) this._closeBtn.setVisible(false);

    this.cleanupInteraction();
    this.currentChoices[index].action();
    audio.playItemPickup();
    if (this.onComplete) this.onComplete();
    this.currentChoices = [];
  }

  hide(): void {
    this.cleanupInteraction();
    if (this._visible && this.onComplete) {
      this.onComplete();
    }
    this._visible = false;
    this.container.setVisible(false);
    if (this._closeBtn) this._closeBtn.setVisible(false);
    this.currentChoices = [];
  }

  private currentChoices: EventChoice[] = [];
}
