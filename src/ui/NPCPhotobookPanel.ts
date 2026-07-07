import Phaser from 'phaser';
import { gameState, NPC_PERSONALITIES } from '../systems/GameState';
import { BasePanel } from './BasePanel';
import { VW, VH, CX } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';
import { getInputMode } from '../systems/InputMode';
import { NineSliceBg } from './NineSliceBg';
import { UiButton } from './UiButton';

const COLS = 4;
const ROWS = 5;
const CELL = 64;
const GAP = 8;
const GRID_LEFT = CX() - 108;
const GRID_TOP = 55;

interface PhotobookEntry {
  variant: number;
  name: string;
  archetype: string;
  description: string;
  rescued: boolean;
  rescuedAtDepth: number;
  talkCount: number;
}

export class NPCPhotobookPanel extends BasePanel {
  private titleText: Phaser.GameObjects.Text;
  private gridButtons: UiButton[] = [];
  private npcSprites: Phaser.GameObjects.Image[] = [];
  private npcLabels: Phaser.GameObjects.Text[] = [];
  private detailBg!: Phaser.GameObjects.NineSlice;
  private detailLines: Phaser.GameObjects.Text[] = [];
  private entries: PhotobookEntry[] = [];
  private selectedIndex: number = 0;
  private clickHandler: ((p: Phaser.Input.Pointer) => void) | null = null;
  private hoverHandler: ((p: Phaser.Input.Pointer) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene);

    this.createOverlay();
    this.overlay.setData('isUI', true);

    this.titleText = createText(scene, CX(), 18, 'NPC Photobook', {
      fontSize: fs(16), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    for (let i = 0; i < 20; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = GRID_LEFT + col * (CELL + GAP) + CELL / 2;
      const cy = GRID_TOP + row * (CELL + GAP) + CELL / 2;

      const btn = new UiButton(scene, cx, cy, '', CELL, CELL, () => this.onEntryClick(i), { small: true });
      btn.setDepth(200);
      for (const c of btn.getChildren()) this.container.add(c);
      this.gridButtons.push(btn);

      const sprite = scene.add.image(cx, cy - 3, `npc_${i}`).setScale(1.0);
      this.container.add(sprite);
      this.npcSprites.push(sprite);

      const label = createText(scene, cx, cy + CELL / 2 - 2, '', {
        fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#b8a898', stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5, 1);
      if (label.frame?.source) label.frame.source.setFilter(1);
      this.container.add(label);
      this.npcLabels.push(label);
    }

    this.detailBg = NineSliceBg.modal(scene, CX(), 490, 340, 140);
    this.detailBg.setDepth(199);
    this.container.add(this.detailBg);

    for (let i = 0; i < 5; i++) {
      const t = createText(scene, CX(), 440 + i * 22, '', {
        fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#c8b898', align: 'center',
        wordWrap: { width: 310, useAdvancedWrap: false },
      }).setOrigin(0.5, 0);
      this.container.add(t);
      this.detailLines.push(t);
    }

    this.addCloseButton(VW() - 40, 22);
  }

  private onEntryClick(idx: number): void {
    this.selectedIndex = idx;
    this.renderGrid();
    this.renderDetail();
  }

  handleInput(key: string): void {
    if (!this._visible) return;
    let idx = this.selectedIndex;
    if (key === 'W' || key === 'UP') {
      idx = Math.max(0, idx - COLS);
    } else if (key === 'S' || key === 'DOWN') {
      idx = Math.min(19, idx + COLS);
    } else if (key === 'A' || key === 'LEFT') {
      if (idx % COLS > 0) idx--;
    } else if (key === 'D' || key === 'RIGHT') {
      if (idx % COLS < COLS - 1) idx++;
    }
    if (idx !== this.selectedIndex) {
      this.selectedIndex = idx;
      this.renderGrid();
      this.renderDetail();
    }
  }

  toggle(): void {
    if (this._visible) this.hide();
    else this.show();
  }

  show(): void {
    this.rebuildEntries();
    this.selectedIndex = 0;
    this.renderGrid();
    this.renderDetail();

    this.clickHandler = (p: Phaser.Input.Pointer) => {
      for (const btn of this.gridButtons) {
        if (btn.handleClick(p)) return;
      }
    };
    this.scene.input.on('pointerdown', this.clickHandler);

    this.hoverHandler = (p: Phaser.Input.Pointer) => {
      for (const btn of this.gridButtons) {
        btn.handleHover(p);
      }
    };
    this.scene.input.on('pointermove', this.hoverHandler);

    this.fadeIn();
  }

  hide(): void {
    if (this.clickHandler) {
      this.scene.input.off('pointerdown', this.clickHandler);
      this.clickHandler = null;
    }
    if (this.hoverHandler) {
      this.scene.input.off('pointermove', this.hoverHandler);
      this.hoverHandler = null;
    }
    this.fadeOut();
  }

  private rebuildEntries(): void {
    this.entries = [];
    for (let v = 0; v < 20; v++) {
      const rescued = gameState.rescuedVillagers.find(r => r.variant === v);
      const p = NPC_PERSONALITIES[v];
      this.entries.push({
        variant: v,
        name: p.name,
        archetype: p.archetype,
        description: p.description,
        rescued: !!rescued,
        rescuedAtDepth: rescued?.rescuedAtDepth ?? 0,
        talkCount: rescued?.talkCount ?? 0,
      });
    }
  }

  private renderGrid(): void {
    for (let i = 0; i < 20; i++) {
      const entry = this.entries[i];
      const isSelected = this.selectedIndex === i;
      const sprite = this.npcSprites[i];

      if (entry.rescued) {
        sprite.clearTint();
        sprite.setAlpha(1);
        this.npcLabels[i].setText(entry.name);
        this.npcLabels[i].setColor(isSelected ? '#ffddaa' : '#b8a898');
      } else {
        sprite.setTint(0x000000);
        sprite.setAlpha(0.4);
        this.npcLabels[i].setText('???');
        this.npcLabels[i].setColor('#555555');
      }
      if (this.npcLabels[i].frame?.source) this.npcLabels[i].frame.source.setFilter(1);

      if (isSelected) {
        this.gridButtons[i].setSelected(true);
      } else {
        this.gridButtons[i].setSelected(false);
      }
    }
  }

  private renderDetail(): void {
    const entry = this.entries[this.selectedIndex];
    if (!entry) return;

    if (entry.rescued) {
      this.detailLines[0].setText(entry.name);
      this.detailLines[0].setColor('#ffddaa');
      this.detailLines[1].setText(`${entry.archetype}  ·  Rescued at Depth ${entry.rescuedAtDepth}`);
      this.detailLines[1].setColor('#b8a898');
      this.detailLines[2].setText(`Talked ${entry.talkCount} time${entry.talkCount !== 1 ? 's' : ''}`);
      this.detailLines[2].setColor('#999999');
      this.detailLines[3].setText(`"${entry.description}"`);
      this.detailLines[3].setColor('#8a7a6a');
      this.detailLines[4].setText('');
    } else {
      this.detailLines[0].setText('???');
      this.detailLines[0].setColor('#555555');
      this.detailLines[1].setText('Not yet discovered');
      this.detailLines[1].setColor('#666666');
      this.detailLines[2].setText('Keep exploring the dungeon depths');
      this.detailLines[2].setColor('#555555');
      this.detailLines[3].setText('to find this villager.');
      this.detailLines[3].setColor('#555555');
      this.detailLines[4].setText('');
    }
  }
}
