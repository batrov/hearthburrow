import Phaser from 'phaser';
import { gameState, NPC_PERSONALITIES } from '../systems/GameState';
import { BasePanel } from './BasePanel';

export class NPCPhotobookPanel extends BasePanel {
  private overlay: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private contentText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private entries: { variant: number; name: string; depth: number }[] = [];
  private selectionIndex: number = 0;
  private dirty: boolean = true;

  constructor(scene: Phaser.Scene) {
    super(scene);

    this.overlay = scene.add.graphics();
    this.overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 960, 640), Phaser.Geom.Rectangle.Contains);
    this.container.add(this.overlay);

    this.titleText = scene.add.text(960 / 2, 30, 'NPC Photobook', {
      fontSize: '22px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.contentText = scene.add.text(960 / 2, 75, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#c8b898',
      align: 'center', lineSpacing: 8,
    }).setOrigin(0.5, 0);
    this.container.add(this.contentText);

    this.hintText = scene.add.text(960 / 2, 610, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#5a4a6a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);
  }

  handleInput(key: string): void {
    if (!this._visible) return;
    if (key === 'W' || key === 'UP') {
      this.selectionIndex = Math.max(0, this.selectionIndex - 1);
      this.dirty = true;
    } else if (key === 'S' || key === 'DOWN') {
      this.selectionIndex = Math.min(this.entries.length - 1, this.selectionIndex + 1);
      this.dirty = true;
    }
  }

  show(): void {
    this.setVisible(true);
    this.dirty = true;
    this.selectionIndex = 0;
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container, alpha: 1, duration: 150, ease: 'Quad.easeOut',
    });
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 150, ease: 'Quad.easeIn',
      onComplete: () => { this.setVisible(false); },
    });
  }

  draw(): void {
    if (!this._visible) return;
    if (!this.dirty) return;
    this.dirty = false;

    this.overlay.clear();
    this.overlay.fillStyle(0x0a0a1a, 0.92);
    this.overlay.fillRect(0, 0, 960, 640);
    this.overlay.lineStyle(1, 0x3a3a4a, 0.5);
    this.overlay.strokeRect(40, 65, 880, 540);

    const rescued = gameState.rescuedVillagers;
    this.entries = rescued.map((r) => {
      const p = NPC_PERSONALITIES[r.variant];
      return { variant: r.variant, name: p?.name ?? r.name, depth: r.rescuedAtDepth };
    });

    if (this.selectionIndex >= this.entries.length) {
      this.selectionIndex = Math.max(0, this.entries.length - 1);
    }

    if (this.entries.length === 0) {
      this.contentText.setText('No villagers rescued yet.\nVenture into the dungeon to find them!');
      this.hintText.setText('[ESC/TAB] close');
      return;
    }

    const lines: string[] = [];
    const startIdx = Math.max(0, this.selectionIndex - 8);
    const visible = this.entries.slice(startIdx, startIdx + 14);

    for (const entry of visible) {
      const cursor = entry.variant === this.entries[this.selectionIndex].variant ? '▸' : ' ';
      const texKey = 'npc_' + entry.variant;
      const hasPortrait = this.scene.textures.exists(texKey);
      const portrait = hasPortrait ? '[♦]' : '[ ]';
      lines.push(`${cursor} ${portrait} ${entry.name.padEnd(20)} Depth ${entry.depth}`);
    }

    const selected = this.entries[this.selectionIndex];
    const selPersonality = selected ? NPC_PERSONALITIES[selected.variant] : null;
    const info = selected && selPersonality
      ? `\n\n---\n${selPersonality.archetype}\nRescued at floor ${selected.depth}\n"${selPersonality.description}"`
      : '';

    this.contentText.setText(lines.join('\n') + info);

    this.hintText.setText('[W/S] scroll  [ESC/TAB] close');
  }
}
