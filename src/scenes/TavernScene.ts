import Phaser from 'phaser';
import { gameState, NPC_NAMES } from '../systems/GameState';
import { audio } from '../systems/AudioSystem';
import {
  gridToIso, isoToGrid, findPath,
  drawDiamond, drawExtrudedTile,
  HALF_W, HALF_H,
} from '../systems/IsoUtils';

const TAVERN_COLS = 8;
const TAVERN_ROWS = 7;

const OFFSET_X = 480;
const OFFSET_Y = 200;

// 0=floor, 1=wall, 2=bar, 3=table, 4=door
const TAVERN_MAP: number[][] = [
  [1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,1],
  [1,0,0,0,0,0,0,1],
  [1,0,3,0,3,0,3,4],
  [1,0,0,0,0,0,0,1],
  [1,0,0,0,3,0,0,1],
  [1,0,0,0,0,0,0,1],
];

const NPC_GRID: { x: number; y: number }[] = [
  { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },
  { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 2 },
  { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 },
  { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 },
  { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 4, y: 6 },
  { x: 5, y: 6 }, { x: 6, y: 6 },
  { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 3 },
];

function gridToScreen(gx: number, gy: number): { x: number; y: number } {
  const iso = gridToIso(gx, gy);
  return { x: iso.x + OFFSET_X, y: iso.y + OFFSET_Y };
}

export class TavernScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private playerLabel!: Phaser.GameObjects.Text;
  private playerGx = 3;
  private playerGy = 6;
  private facingX = 0;
  private facingY = -1;
  private isMoving = false;
  private movePath: { x: number; y: number }[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private promptText!: Phaser.GameObjects.Text;
  private greetingActive = false;
  private moveTimer: number = 0;
  private moveDelay: number = 150;
  private analogDx: number = 0;
  private analogDy: number = 0;
  private analogActive: boolean = false;
  private analogGfx: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super({ key: 'TavernScene' });
  }

  create(): void {
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#0a0500');

    this.greetingActive = false;
    this.isMoving = false;
    this.movePath = [];
    this.analogActive = false;
    this.analogDx = 0;
    this.analogDy = 0;
    this.analogGfx = null;
    this.playerGx = 3;
    this.playerGy = 6;
    this.facingX = 0;
    this.facingY = -1;

    this.drawTavern();
    this.createPlayer();
    this.createNPCs();
    this.createUI();
    this.setupInput();
    this.setupPointerInput();
  }

  private drawTavern(): void {
    for (let y = 0; y < TAVERN_ROWS; y++) {
      for (let x = 0; x < TAVERN_COLS; x++) {
        const cell = TAVERN_MAP[y][x];
        const pos = gridToScreen(x, y);

        this.add.image(pos.x, pos.y, 'terrain_diamond')
          .setTint(cell === 1 ? 0x2a1a0a : 0x3a2a1a)
          .setDepth(4);
      }
    }

    for (let y = 0; y < TAVERN_ROWS; y++) {
      for (let x = 0; x < TAVERN_COLS; x++) {
        const cell = TAVERN_MAP[y][x];
        const pos = gridToScreen(x, y);
        const depth = 6 + (x + y) * 0.01;

        if (cell === 1) {
          const g = this.add.graphics().setDepth(depth);
          drawExtrudedTile(g, pos.x, pos.y, 0x4a2a10, 0x3a1a0a, 0x2a1000, 20);
        } else if (cell === 2) {
          const g = this.add.graphics().setDepth(depth);
          drawExtrudedTile(g, pos.x, pos.y, 0x5a3a1a, 0x4a2a10, 0x3a1a0a, 12);
        } else if (cell === 3) {
          const g = this.add.graphics().setDepth(depth);
          drawExtrudedTile(g, pos.x, pos.y, 0x6a4a2a, 0x5a3a1a, 0x4a2a0a, 8);
        } else if (cell === 4) {
          const g = this.add.graphics().setDepth(depth);
          drawDiamond(g, pos.x, pos.y, 0x4a3a2a);
          drawExtrudedTile(g, pos.x, pos.y, 0x5a4a2a, 0x4a3a1a, 0x3a2a0a, 10);
          this.add.text(pos.x, pos.y - 28, 'EXIT', {
            fontSize: '9px', fontFamily: 'monospace', color: '#6a5a3a',
          }).setOrigin(0.5).setDepth(15);
        }
      }
    }
  }

  private createPlayer(): void {
    const p = gridToScreen(this.playerGx, this.playerGy);
    this.player = this.add.image(p.x, p.y, 'player_bottom_left')
      .setDepth(10 + (this.playerGx + this.playerGy) * 0.01);
    this.playerLabel = this.add.text(p.x, p.y - 30, 'You', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaddff',
    }).setOrigin(0.5);
    this.updatePlayerSprite();
  }

  private updatePlayerSprite(): void {
    const isUpFacing = this.facingY < 0 || (this.facingY === 0 && this.facingX < 0);
    const key = isUpFacing ? 'player_top_right' : 'player_bottom_left';
    const flipX = this.facingX !== 0 && this.facingY === 0;
    if (this.textures.exists(key)) {
      this.player.setTexture(key);
      this.player.setFlipX(flipX);
    }
  }

  private repositionPlayer(): void {
    const p = gridToScreen(this.playerGx, this.playerGy);
    this.player.setPosition(p.x, p.y);
    this.player.setDepth(10 + (this.playerGx + this.playerGy) * 0.01);
    this.playerLabel.setPosition(p.x, p.y - 30);
  }

  private createNPCs(): void {
    const rescued = gameState.rescuedVillagers;

    for (let i = 0; i < Math.min(rescued.length, 20); i++) {
      const npc = rescued[i];
      const gpos = NPC_GRID[i];
      const pos = gridToScreen(gpos.x, gpos.y);
      const depth = 8 + (gpos.x + gpos.y) * 0.01;

      const container = this.add.container(pos.x, pos.y).setDepth(depth);

      const sprite = this.add.image(0, 0, `npc_${npc.variant}`);
      container.add(sprite);

      const label = this.add.text(0, 16, npc.name, {
        fontSize: '10px', fontFamily: 'monospace', color: '#e8d5b7',
      }).setOrigin(0.5);
      container.add(label);

      container.setSize(30, 40);
      container.setInteractive({ cursor: 'pointer' });

      const npcRef = npc;
      container.on('pointerover', () => {
        this.showPrompt(npcRef.name, pos.x, pos.y - 30);
      });
      container.on('pointerout', () => {
        this.hidePrompt();
      });
      container.on('pointerdown', () => {
        this.showGreeting(npcRef);
      });
    }
  }

  private createUI(): void {
    const cx = 960 / 2;

    this.add.text(cx, 12, 'THE COZY TAVERN', {
      fontSize: '18px', fontFamily: 'monospace', color: '#cc8844', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);

    const rescued = gameState.rescuedVillagers;
    this.add.text(cx, 620, `${rescued.length} / 20 villagers resting here`, {
      fontSize: '11px', fontFamily: 'monospace', color: '#7a6a5a',
    }).setOrigin(0.5).setDepth(50);

    this.promptText = this.add.text(0, 0, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffdd88',
    }).setOrigin(0.5).setDepth(100).setAlpha(0);
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
    kb.addCapture(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keys = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      UP: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      DOWN: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      LEFT: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      RIGHT: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      SPACE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      ESC: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    };

    this.keys.ESC.on('down', () => {
      if (!this.greetingActive) {
        this.leave();
      }
    });

    this.keys.SPACE.on('down', () => {
      if (this.greetingActive) return;
      const doorCell = this.findDoorCell();
      if (doorCell) {
        const dx = Math.abs(this.playerGx - doorCell.x);
        const dy = Math.abs(this.playerGy - doorCell.y);
        if (dx + dy === 1) {
          this.leave();
        }
      }
    });
  }

  private findDoorCell(): { x: number; y: number } | null {
    for (let y = 0; y < TAVERN_ROWS; y++) {
      for (let x = 0; x < TAVERN_COLS; x++) {
        if (TAVERN_MAP[y][x] === 4) return { x, y };
      }
    }
    return null;
  }

  private setupPointerInput(): void {
    let stickCenterX = 0;
    let stickCenterY = 0;
    let pointerDragged = false;
    const stickRadius = 40;
    const deadZone = 12;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.greetingActive) return;

      stickCenterX = pointer.x;
      stickCenterY = pointer.y;
      pointerDragged = false;
      this.analogActive = false;
      this.analogDx = 0;
      this.analogDy = 0;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      if (this.greetingActive) return;

      const dx = pointer.x - stickCenterX;
      const dy = pointer.y - stickCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < deadZone) {
        if (this.analogActive) {
          this.analogActive = false;
          this.analogDx = 0;
          this.analogDy = 0;
        }
        return;
      }

      pointerDragged = true;

      let adx = 0;
      let ady = 0;
      if (dx > 0 && dy < 0) {
        ady = -1;
      } else if (dx < 0 && dy < 0) {
        adx = -1;
      } else if (dx > 0 && dy > 0) {
        adx = 1;
      } else if (dx < 0 && dy > 0) {
        ady = 1;
      } else if (dx !== 0) {
        adx = dx > 0 ? 1 : -1;
      } else if (dy !== 0) {
        ady = dy > 0 ? 1 : -1;
      }

      if (adx !== this.analogDx || ady !== this.analogDy) {
        this.analogDx = adx;
        this.analogDy = ady;
      }
      this.analogActive = true;
      this.movePath = [];

      if (!this.analogGfx) {
        this.analogGfx = this.add.graphics().setScrollFactor(0).setDepth(250);
      }
      this.analogGfx.clear();
      this.analogGfx.lineStyle(2, 0xffffff, 0.25);
      this.analogGfx.strokeCircle(stickCenterX, stickCenterY, stickRadius);
      this.analogGfx.fillStyle(0x000000, 0.2);
      this.analogGfx.fillCircle(stickCenterX, stickCenterY, stickRadius);

      const clamp = Math.min(dist, stickRadius);
      const angle = Math.atan2(dy, dx);
      const thumbX = stickCenterX + Math.cos(angle) * clamp;
      const thumbY = stickCenterY + Math.sin(angle) * clamp;
      this.analogGfx.fillStyle(0xffffff, 0.5);
      this.analogGfx.fillCircle(thumbX, thumbY, 12);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointerDragged) {
        this.doClickToMove(pointer.worldX, pointer.worldY);
      }

      this.analogActive = false;
      this.analogDx = 0;
      this.analogDy = 0;
      if (this.analogGfx) {
        this.analogGfx.destroy();
        this.analogGfx = null;
      }
    });
  }

  private doClickToMove(worldX: number, worldY: number): void {
    const isoX = worldX - OFFSET_X;
    const isoY = worldY - OFFSET_Y;
    const g = isoToGrid(isoX, isoY);

    if (g.x < 0 || g.x >= TAVERN_COLS || g.y < 0 || g.y >= TAVERN_ROWS) return;
    if (g.x === this.playerGx && g.y === this.playerGy) return;
    if (this.isSolid(g.x, g.y)) return;

    const path = findPath(
      this.playerGx, this.playerGy,
      g.x, g.y,
      TAVERN_COLS, TAVERN_ROWS,
      (x, y) => !this.isSolid(x, y),
    );

    if (path && path.length > 0) {
      this.movePath = path;
    }
  }

  update(_time: number, delta: number): void {
    if (this.greetingActive) return;
    this.moveTimer += delta;
    if (this.moveTimer >= this.moveDelay) {
      this.handleMovement(delta);
      this.moveTimer = 0;
    }
  }

  private isSolid(gx: number, gy: number): boolean {
    if (gx < 0 || gx >= TAVERN_COLS || gy < 0 || gy >= TAVERN_ROWS) return true;
    const cell = TAVERN_MAP[gy][gx];
    return cell === 1 || cell === 2 || cell === 3;
  }

  private tryMove(dx: number, dy: number): void {
    if (this.isMoving) return;

    const nx = this.playerGx + dx;
    const ny = this.playerGy + dy;

    if (nx < 0 || nx >= TAVERN_COLS || ny < 0 || ny >= TAVERN_ROWS) return;
    if (this.isSolid(nx, ny)) return;

    this.facingX = dx;
    this.facingY = dy;
    this.updatePlayerSprite();
    audio.playStep();

    this.playerGx = nx;
    this.playerGy = ny;

    const target = gridToScreen(nx, ny);
    this.isMoving = true;
    this.tweens.add({
      targets: this.player,
      x: target.x,
      y: target.y,
      duration: 100,
      ease: 'Linear',
      onComplete: () => { this.isMoving = false; },
    });
    this.tweens.add({
      targets: this.playerLabel,
      x: target.x,
      y: target.y - 30,
      duration: 100,
      ease: 'Linear',
    });
  }

  private handleMovement(_delta: number): void {
    let dx = 0;
    let dy = 0;

    const kbA = this.keys.A.isDown || this.keys.LEFT.isDown;
    const kbD = this.keys.D.isDown || this.keys.RIGHT.isDown;
    const kbW = this.keys.W.isDown || this.keys.UP.isDown;
    const kbS = this.keys.S.isDown || this.keys.DOWN.isDown;

    if (kbA || kbD || kbW || kbS) {
      this.movePath = [];
      this.analogActive = false;
      if (kbA) dx = -1;
      else if (kbD) dx = 1;
      if (kbW) dy = -1;
      else if (kbS) dy = 1;
    } else if (this.analogActive && (this.analogDx !== 0 || this.analogDy !== 0)) {
      dx = this.analogDx;
      dy = this.analogDy;
    } else if (this.movePath.length > 0) {
      const next = this.movePath.shift()!;
      dx = next.x - this.playerGx;
      dy = next.y - this.playerGy;
    }

    if (dx !== 0 && dy !== 0) dy = 0;

    if (dx !== 0 || dy !== 0) {
      this.tryMove(dx, dy);
    }
  }

  private showPrompt(text: string, x: number, y: number): void {
    this.promptText.setPosition(x, y);
    this.promptText.setText(text);
    this.promptText.setAlpha(1);
  }

  private hidePrompt(): void {
    this.promptText.setAlpha(0);
  }

  private showGreeting(npc: { variant: number; rescuedAtDepth: number; name: string }): void {
    const greetings = [
      'Ah, a friendly face! Pull up a chair.',
      'The warmth of this place does wonders.',
      'I never thought I\'d be rescued. Thank you.',
      'These floors are deadly, but this tavern is paradise.',
      'Have you tried the mead? It\'s excellent.',
      'The dungeon is no place for the faint of heart.',
      'I still have nightmares about those slimes.',
      'I owe you my life, friend.',
      'This place feels like home already.',
      'The adventurers tell the best stories here.',
      'I\'ve been helping in the kitchen.',
      'Cheers to another day above ground!',
      'The fire keeps us warm through the night.',
      'Have you seen the cellar? It\'s full of supplies.',
      'I\'m crafting something special for you.',
      'The walls have ears, but here we are safe.',
      'I heard there are even more trapped souls down there.',
      'Rest easy, friend. You\'ve earned it.',
      'The bard should be here any day now.',
      'To new beginnings!',
    ];

    this.greetingActive = true;

    const greeting = greetings[npc.variant % greetings.length];
    const overlayBg = this.add.graphics().setDepth(200);
    overlayBg.fillStyle(0x0a0a1a, 0.85);
    overlayBg.fillRoundedRect(960 / 2 - 250, 640 / 2 - 60, 500, 120, 10);
    overlayBg.lineStyle(1, 0x6a5a8a, 0.5);
    overlayBg.strokeRoundedRect(960 / 2 - 250, 640 / 2 - 60, 500, 120, 10);

    const overlayText = this.add.text(960 / 2, 640 / 2 - 30, `${npc.name} says:`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#ccaa66', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(201);

    const speechText = this.add.text(960 / 2, 640 / 2 + 5, `"${greeting}"`, {
      fontSize: '13px', fontFamily: 'monospace', color: '#e8d5b7', align: 'center',
    }).setOrigin(0.5).setDepth(201);

    const closeHint = this.add.text(960 / 2, 640 / 2 + 40, '[SPACE / ESC] close', {
      fontSize: '11px', fontFamily: 'monospace', color: '#6a5a4a',
    }).setOrigin(0.5).setDepth(201);

    const close = () => {
      overlayBg.destroy();
      overlayText.destroy();
      speechText.destroy();
      closeHint.destroy();
      this.greetingActive = false;
      this.input.keyboard!.off('keydown-SPACE', close);
      this.input.keyboard!.off('keydown-ESC', close);
    };

    this.input.keyboard!.on('keydown-SPACE', close);
    this.input.keyboard!.on('keydown-ESC', close);
  }

  private leave(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HomelandScene');
    });
  }
}
