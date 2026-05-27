import Phaser from 'phaser';
import { itemDisplayName } from '../systems/GameState';

export interface EventChoice {
  label: string;
  action: () => void;
}

export interface EventConfig {
  title: string;
  description: string;
  choices: EventChoice[];
}

export class EventPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private descText: Phaser.GameObjects.Text;
  private choicesText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private visible: boolean = false;
  private onComplete: (() => void) | null = null;
  private selectedIndex: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    this.overlay = scene.add.graphics();
    this.overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 960, 640), Phaser.Geom.Rectangle.Contains);
    this.container.add(this.overlay);

    this.titleText = scene.add.text(960 / 2, 160, '', {
      fontSize: '22px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.descText = scene.add.text(960 / 2, 210, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#b8a898',
      align: 'center', wordWrap: { width: 500 }, lineSpacing: 4,
    }).setOrigin(0.5, 0);
    this.container.add(this.descText);

    this.choicesText = scene.add.text(960 / 2, 310, '', {
      fontSize: '15px', fontFamily: 'monospace', color: '#c8b898',
      align: 'left', lineSpacing: 14,
    }).setOrigin(0.5, 0);
    this.container.add(this.choicesText);

    this.hintText = scene.add.text(960 / 2, 520, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#5a4a6a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);

    this.container.setVisible(false);
  }

  confirm(): void {
    if (!this.visible) return;
    this.selectChoice(this.selectedIndex);
  }

  navigateUp(): void {
    if (!this.visible || this.currentChoices.length < 2) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.currentChoices.length) % this.currentChoices.length;
    this.renderChoices();
  }

  navigateDown(): void {
    if (!this.visible || this.currentChoices.length < 2) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.currentChoices.length;
    this.renderChoices();
  }

  show(config: EventConfig, onComplete?: () => void): void {
    this.onComplete = onComplete ?? null;
    this.visible = true;
    this.selectedIndex = 0;
    this.currentChoices = config.choices;

    this.overlay.clear();
    this.overlay.fillStyle(0x0a0a1a, 0.9);
    this.overlay.fillRect(0, 0, 960, 640);

    this.overlay.lineStyle(2, 0x5a4a7a, 0.6);
    this.overlay.strokeRoundedRect(960 / 2 - 260, 120, 520, 420, 10);

    this.titleText.setText(config.title);
    this.descText.setText(config.description);

    this.renderChoices();

    this.hintText.setText('[W/S] Navigate  [SPACE] Confirm');

    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeOut',
    });
  }

  private currentChoices: EventChoice[] = [];

  private renderChoices(): void {
    const lines = this.currentChoices.map((c, i) => {
      const marker = i === this.selectedIndex ? '▸' : ' ';
      return `  ${marker} ${c.label}`;
    }).join('\n');
    this.choicesText.setText(lines);
  }

  private selectChoice(index: number): void {
    if (!this.visible) return;
    if (index < 0 || index >= this.currentChoices.length) return;

    const choice = this.currentChoices[index];
    this.visible = false;
    this.container.setVisible(false);

    choice.action();

    if (this.onComplete) {
      this.onComplete();
    }

    this.currentChoices = [];
  }

  isVisible(): boolean {
    return this.visible;
  }

  hide(): void {
    this.visible = false;
    this.container.setVisible(false);
    this.currentChoices = [];
  }
}
