import Phaser from 'phaser';
import { gameState, NPC_PERSONALITIES } from '../systems/GameState';
import { BasePanel } from './BasePanel';

export class NPCPhotobookPanel extends BasePanel {
  private titleText: Phaser.GameObjects.Text;
  private contentText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private entries: { variant: number; name: string; depth: number }[] = [];
  private selectionIndex: number = 0;
  private dirty: boolean = true;

  constructor(scene: Phaser.Scene) {
    super(scene);

    this.createOverlay();
    this.overlay.setData('isUI', true);

    this.titleText = scene.add.text(960 / 2, 30, 'NPC Photobook', {
      fontSize: '22px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.contentText = scene.add.text(960 / 2, 75, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#c8b898',
      align: 'center', lineSpacing: 8,
    }).setOrigin(0.5, 0);
    this.contentText.setInteractive();
    this.contentText.on('pointerdown', (_p: any, localX: number, localY: number) => {
      const lineHeight = 22;
      const lineIdx = Math.floor(localY / lineHeight);
      const startIdx = Math.max(0, this.selectionIndex - 8);
      const visibleCount = Math.min(14, Math.max(0, this.entries.length - startIdx));
      if (lineIdx >= 0 && lineIdx < visibleCount) {
        this.selectionIndex = startIdx + lineIdx;
        this.dirty = true;
      }
    });
    this.container.add(this.contentText);

    this.hintText = scene.add.text(960 / 2, 610, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#5a4a6a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);

    const upBtn = scene.add.text(960 / 2, 68, '▲', {
      fontSize: '22px', fontFamily: 'monospace', color: '#886644',
    }).setOrigin(0.5).setDepth(210).setScrollFactor(0);
    this.container.add(upBtn);
    const upHit = scene.add.rectangle(960 / 2, 68, 60, 40, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(211).setScrollFactor(0);
    upHit.on('pointerdown', () => { this.handleInput('W'); this.dirty = true; });
    this.container.add(upHit);

    const downBtn = scene.add.text(960 / 2, 580, '▼', {
      fontSize: '22px', fontFamily: 'monospace', color: '#886644',
    }).setOrigin(0.5).setDepth(210).setScrollFactor(0);
    this.container.add(downBtn);
    const downHit = scene.add.rectangle(960 / 2, 580, 60, 40, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(211).setScrollFactor(0);
    downHit.on('pointerdown', () => { this.handleInput('S'); this.dirty = true; });
    this.container.add(downHit);

    this.addCloseButton(920, 30);
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

  toggle(): void {
    if (this._visible) this.hide();
    else this.show();
  }

  show(): void {
    this.dirty = true;
    this.selectionIndex = 0;
    this.fadeIn();
  }

  hide(): void {
    this.fadeOut();
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
      this.hintText.setText('[ESC/TAB/TAP] close');
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

    this.hintText.setText('[W/S] scroll  [ESC/TAB] close  [▲/▼] tap');
  }
}
