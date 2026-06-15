import Phaser from 'phaser';
import { gameState, NPC_PERSONALITIES, itemDisplayName, itemIconKey } from '../systems/GameState';
import { audio } from '../systems/AudioSystem';
import { getSpriteConfig } from '../systems/SpriteConfig';
import {
  gridToIso, isoToGrid, findPath,
  drawDiamond, drawExtrudedTile,
  HALF_W, HALF_H,
} from '../systems/IsoUtils';
import { NPCPhotobookPanel } from '../ui/NPCPhotobookPanel';

const TAVERN_COLS = 10;
const TAVERN_ROWS = 8;

const OFFSET_X = 480;
const OFFSET_Y = 160;

// 0=floor, 1=wall, 2=bar, 3=table, 4=door
const TAVERN_MAP: number[][] = [
  [1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1],
  [1,0,0,0,0,0,0,0,0,1],
  [1,0,3,0,3,0,0,3,0,4],
  [1,0,0,0,0,0,3,0,0,1],
  [1,0,3,0,0,0,0,0,3,1],
  [1,0,0,0,0,3,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1],
];

const NPC_GRID: { x: number; y: number }[] = [
  // Bar patrons (line at the bar counter)
  { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 },
  // Table cluster left
  { x: 1, y: 3 }, { x: 1, y: 4 }, { x: 3, y: 4 }, { x: 5, y: 3 },
  { x: 5, y: 4 }, { x: 7, y: 3 },
  // Bottom tables
  { x: 1, y: 5 }, { x: 1, y: 6 }, { x: 3, y: 6 },
  { x: 8, y: 4 }, { x: 8, y: 5 },
  // Floor loungers
  { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 2, y: 7 },
  { x: 4, y: 7 }, { x: 6, y: 7 }, { x: 8, y: 7 },
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
  private photobook!: NPCPhotobookPanel;
  private animFrame: number = 0;
  private animTimer: number = 0;
  private readonly ANIM_INTERVAL: number = 60;

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
    this.animFrame = 0;
    this.animTimer = 0;
    this.playerGx = 8;
    this.playerGy = 3;
    this.facingX = 0;
    this.facingY = 1;

    this.drawTavern();
    this.createPlayer();
    this.createNPCs();
    this.createUI();
    this.photobook = new NPCPhotobookPanel(this);
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
          const glow = this.add.image(pos.x, pos.y - 14, 'terrain_diamond')
            .setTint(0x8a7a5a).setAlpha(0.3).setDepth(depth + 0.1);
          this.tweens.add({
            targets: glow, alpha: 0.6, yoyo: true, repeat: -1,
            duration: 1000, ease: 'Sine.easeInOut',
          });
        }
      }
    }
  }

  private createPlayer(): void {
    const p = gridToScreen(this.playerGx, this.playerGy);
    const cfg = getSpriteConfig('player_bottom_left');
    this.player = this.add.image(
      p.x + (cfg.offsetX ?? 0),
      p.y + (cfg.offsetY ?? 0),
      'player_bottom_left',
    ).setDepth(6 + (this.playerGx + this.playerGy) * 0.01 + 0.005);
    if (cfg.originX !== undefined || cfg.originY !== undefined) {
      this.player.setOrigin(cfg.originX ?? 0.5, cfg.originY ?? 0.5);
    }
    if (cfg.scale !== undefined) this.player.setScale(cfg.scale);
    this.playerLabel = this.add.text(p.x, p.y - 30, 'You', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaddff',
    }).setOrigin(0.5);
    this.updatePlayerSprite();
  }

  private updatePlayerSprite(): void {
    const isUpFacing = this.facingY < 0 || (this.facingY === 0 && this.facingX < 0);
    const baseKey = isUpFacing ? 'player_top_right' : 'player_bottom_left';
    const key = `${baseKey}_${this.animFrame}`;
    const flipX = this.facingX !== 0 && this.facingY === 0;
    if (this.textures.exists(key)) {
      this.player.setTexture(key);
      this.player.setFlipX(flipX);
    }
  }

  private repositionPlayer(): void {
    const p = gridToScreen(this.playerGx, this.playerGy);
    const cfg = getSpriteConfig('player_bottom_left');
    this.player.setPosition(p.x + (cfg.offsetX ?? 0), p.y + (cfg.offsetY ?? 0));
    this.player.setDepth(6 + (this.playerGx + this.playerGy) * 0.01 + 0.005);
    this.playerLabel.setPosition(p.x, p.y - 30);
  }

  private createNPCs(): void {
    const rescued = gameState.rescuedVillagers;

    for (let i = 0; i < Math.min(rescued.length, 20); i++) {
      const npc = rescued[i];
      const gpos = NPC_GRID[i];
      const pos = gridToScreen(gpos.x, gpos.y);
      const depth = 6 + (gpos.x + gpos.y) * 0.01 + 0.003;

      const npcCfg = getSpriteConfig(`npc_${npc.variant}`);
      const container = this.add.container(
        pos.x + (npcCfg.offsetX ?? 0),
        pos.y + (npcCfg.offsetY ?? 0),
      ).setDepth(depth);

      const sprite = this.add.image(0, 0, `npc_${npc.variant}`);
      if (npcCfg.originX !== undefined || npcCfg.originY !== undefined) {
        sprite.setOrigin(npcCfg.originX ?? 0.5, npcCfg.originY ?? 0.5);
      }
      if (npcCfg.scale !== undefined) sprite.setScale(npcCfg.scale);
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
    this.add.text(cx, 620, `${rescued.length} / 20 villagers resting here    [P] Photobook`, {
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
      P: kb.addKey(Phaser.Input.Keyboard.KeyCodes.P),
      TAB: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB),
    };

    this.keys.ESC.on('down', () => {
      if (this.photobook.isVisible()) {
        this.photobook.hide();
        return;
      }
      if (!this.greetingActive) {
        this.leave();
      }
    });

    this.keys.TAB.on('down', () => {
      if (this.photobook.isVisible()) {
        this.photobook.hide();
      }
    });

    this.keys.P.on('down', () => {
      if (this.greetingActive) return;
      this.photobook.toggle();
    });

    this.keys.SPACE.on('down', () => {
      if (this.greetingActive) return;
      if (this.photobook.isVisible()) {
        this.photobook.hide();
        return;
      }
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

    if (this.photobook.isVisible()) {
      this.photobook.draw();
      const keys = this.keys;
      if (Phaser.Input.Keyboard.JustDown(keys.W) || Phaser.Input.Keyboard.JustDown(keys.UP)) {
        this.photobook.handleInput('W');
      }
      if (Phaser.Input.Keyboard.JustDown(keys.S) || Phaser.Input.Keyboard.JustDown(keys.DOWN)) {
        this.photobook.handleInput('S');
      }
      return;
    }

    this.moveTimer += delta;
    if (this.moveTimer >= this.moveDelay) {
      this.handleMovement(delta);
      this.moveTimer = 0;
    }
    if (this.isMoving) {
      this.animTimer += delta;
      if (this.animTimer >= this.ANIM_INTERVAL) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 6;
        this.updatePlayerSprite();
      }
    } else if (this.animFrame !== 0) {
      this.animFrame = 0;
      this.animTimer = 0;
      this.updatePlayerSprite();
    }
    const doorCell = this.findDoorCell();
    if (doorCell) {
      const dx = Math.abs(this.playerGx - doorCell.x);
      const dy = Math.abs(this.playerGy - doorCell.y);
      if (dx + dy === 1) {
        const doorIso = gridToIso(doorCell.x, doorCell.y);
        this.showPrompt('[SPACE] Exit', doorIso.x, doorIso.y - 48);
      } else {
        this.hidePrompt();
      }
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
    const cfg = getSpriteConfig('player_bottom_left');
    this.isMoving = true;
    this.tweens.add({
      targets: this.player,
      x: target.x + (cfg.offsetX ?? 0),
      y: target.y + (cfg.offsetY ?? 0),
      depth: 6 + (nx + ny) * 0.01 + 0.005,
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

  private showGreeting(npc: { variant: number; rescuedAtDepth: number; name: string; talkCount: number }): void {
    const personality = NPC_PERSONALITIES[npc.variant];
    if (!personality) return;

    const greeting = personality.greetings[(npc.talkCount ?? 0) % personality.greetings.length];
    const isFirstTalk = npc.talkCount === 0;
    npc.talkCount++;

    gameState.save();

    this.greetingActive = true;

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

    if (isFirstTalk) {
      const recipeWasNew = !gameState.crafting.isDiscovered('miners_potion');
      gameState.inventory.addItem('miners_spirit', 1);
      if (recipeWasNew) {
        gameState.crafting.discover('miners_potion');
      }
      gameState.save();

      this.showObtainPopup('miners_spirit', 1, undefined, 0);
      if (recipeWasNew) {
        this.showObtainPopup('miners_potion', 1, 'New Recipe', 1);
      }
      audio.playItemPickup();
      if (recipeWasNew) {
        audio.playPuzzleComplete();
      }
    }

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

  private showObtainPopup(id: string, qty: number, prefix?: string, stackIndex: number = 0): void {
    const y = 116 + stackIndex * 36;
    const container = this.add.container(20, y).setScrollFactor(0).setDepth(250);

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.8);
    bg.fillRoundedRect(0, 0, 220, 36, 4);
    container.add(bg);

    const texKey = itemIconKey(id);
    const sprite = this.add.image(18, 18, this.textures.exists(texKey) ? texKey : '__DEFAULT');
    sprite.setScale(0.7);
    container.add(sprite);

    if (qty > 1) {
      const badge = this.add.text(30, 26, `x${qty}`, {
        fontSize: '9px', fontFamily: 'monospace', color: '#ffdd88',
      }).setOrigin(1, 1);
      container.add(badge);
    }

    const labelText = prefix ? `${prefix}: ${itemDisplayName(id)}` : itemDisplayName(id);
    const label = this.add.text(38, 10, labelText, {
      fontSize: '14px', fontFamily: 'monospace', color: '#e8d5b7',
    });
    container.add(label);

    container.setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: 100, ease: 'Quad.easeOut' });
    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: container, alpha: 0, duration: 200, ease: 'Quad.easeIn',
        onComplete: () => container.destroy(),
      });
    });
  }

  private leave(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HomelandScene');
    });
  }
}
