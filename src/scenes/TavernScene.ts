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
import { SCENES } from '../constants/scenes';
import { AnalogStickInput } from '../ui/AnalogStickInput';
import { getInputMode } from '../systems/InputMode';
import { VW, VH, CX, CY, actionButtonCenter, actionButtonGlowBoxTopLeft, ACTION_BTN_SIZE } from '../systems/Viewport';
import { viewportManager } from '../systems/ViewportManager';
import { textStyle, fs, createText } from '../systems/Font';
import { createAdaptiveText } from '../ui/AdaptiveText';
import { NineSliceBg } from '../ui/NineSliceBg';

const TAVERN_COLS = 12;
const TAVERN_ROWS = 10;

const OFFSET_Y = 220;

const TAVERN_MAP: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,2,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,3,0,3,0,0,3,0,3,4,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,3,0,0,0,0,0,0,3,0,1],
  [1,0,0,0,0,3,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,3,0,0,0,0,0,0,3,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
];

const NPC_SEATS: { x: number; y: number }[] = [
  { x: 2, y: 2 }, { x: 4, y: 2 }, { x: 7, y: 2 }, { x: 10, y: 2 },
  { x: 3, y: 3 }, { x: 6, y: 3 },
  { x: 1, y: 4 }, { x: 4, y: 4 }, { x: 8, y: 4 },
  { x: 4, y: 5 }, { x: 7, y: 5 }, { x: 11, y: 5 },
  { x: 2, y: 6 }, { x: 6, y: 6 }, { x: 8, y: 6 },
  { x: 2, y: 7 }, { x: 5, y: 7 }, { x: 9, y: 7 },
  { x: 4, y: 8 }, { x: 7, y: 8 },
];

function gridToScreen(gx: number, gy: number): { x: number; y: number } {
  const iso = gridToIso(gx, gy);
  return { x: iso.x, y: iso.y + OFFSET_Y };
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
  private actionBubbleGfx!: Phaser.GameObjects.Graphics;
  private actionBubbleText!: Phaser.GameObjects.Text;
  private greetingActive = false;
  private closeGreeting: (() => void) | null = null;
  private greetingFullText: string = '';
  private greetingRevealedChars: number = 0;
  private greetingTimer: Phaser.Time.TimerEvent | null = null;
  private greetingTypingComplete: boolean = false;

  private analog!: AnalogStickInput;
  private photobook!: NPCPhotobookPanel;
  private hudCam!: Phaser.Cameras.Scene2D.Camera;
  private animFrame: number = 0;
  private animTimer: number = 0;
  private readonly ANIM_INTERVAL: number = 60;
  private npcCells: Set<string> = new Set();
  private facingOutlineImages: Phaser.GameObjects.Image[] = [];
  private highlightedNPC: number = -1;
  private adjacentNPC: { variant: number; rescuedAtDepth: number; name: string; talkCount: number } | null = null;
  private pendingNPCIdx: number = -1;
  private bgm: Phaser.Sound.BaseSound | null = null;
  private actionBtnBg!: Phaser.GameObjects.Graphics;
  private actionBtnText!: Phaser.GameObjects.Text;
  private actionBtnHit!: Phaser.GameObjects.Rectangle;
  private carrotCountText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private countText!: Phaser.GameObjects.Text;
  private exitBtn!: Phaser.GameObjects.Text;
  private photobookBtn!: Phaser.GameObjects.Text;
  private npcSpriteRefs: Phaser.GameObjects.Image[] = [];
  private npcBaseFlip: boolean[] = [];
  private npcLabelTexts: Phaser.GameObjects.Text[] = [];
  private npcSeats: { x: number; y: number }[] = [];
  private _onViewportResize?: () => void;

  constructor() {
    super({ key: SCENES.TAVERN });
  }

  create(): void {
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#211304');

    this.hudCam = this.cameras.add(0, 0, VW(), VH(), false, 'hud');
    this.hudCam.setZoom(1);

    this.greetingActive = false;
    this.isMoving = false;
    this.movePath = [];
    this.animFrame = 0;
    this.animTimer = 0;
    this.playerGx = 5;
    this.playerGy = 7;
    this.facingX = 0;
    this.facingY = 1;
    this.npcCells.clear();
    this.highlightedNPC = -1;
    this.adjacentNPC = null;
    this.pendingNPCIdx = -1;
    this.npcSpriteRefs = [];
    this.npcBaseFlip = [];
    this.npcLabelTexts = [];
    this.npcSeats = [];

    this.drawTavern();
    this.createPlayer();
    this.createNPCs();
    this.createUI();
    this.photobook = new NPCPhotobookPanel(this);
    this.cameras.main.ignore(this.photobook.container);
    this.createActionButton();
    this.setupInput();
    this.setupPointerInput();
    this.cameras.main.setZoom(1.1);
    this.cameras.main.startFollow(this.player, true, 0.09, 0.5);
    this.cameras.main.setBounds(-400, -100, 900, 1000);

    this.bgm = this.sound.add('music_tavern', { loop: true, volume: 0.3 });
    this.bgm.play();

    this.relayout();
    this._onViewportResize = () => this.relayout();
    viewportManager.onResize(this._onViewportResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this._onViewportResize) viewportManager.offResize(this._onViewportResize);
    });
  }

  /**
   * Re-applies position/size to already-created HUD objects using the current
   * live viewport. Called once at the end of create() and again on every live
   * resize. Must only reposition — never create/destroy objects.
   */
  private relayout(): void {
    this.titleText.setPosition(CX(), 12);
    this.countText.setPosition(CX(), VH() - 32);
    this.exitBtn.setPosition(VW() - 12, VH() - 12);
    this.photobookBtn.setPosition(12, VH() - 12);
    this.carrotCountText.setPosition(VW() - 12, 12);

    const { x, y } = actionButtonCenter();
    this.actionBtnText.setPosition(x, y);
    this.actionBtnHit?.setPosition(x, y);
    this.updateActionButton();

    this.photobook?.onViewportResize();
  }

  private drawTavern(): void {
    for (let y = 0; y < TAVERN_ROWS; y++) {
      for (let x = 0; x < TAVERN_COLS; x++) {
        const cell = TAVERN_MAP[y][x];
        const pos = gridToScreen(x, y);

        const tileImg = this.add.image(pos.x, pos.y, 'terrain_diamond')
          .setTint(cell === 1 ? 0x2a1a0a : 0x3a2a1a)
          .setDepth(4);
        this.hudCam.ignore(tileImg);
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
          this.hudCam.ignore(g);
        } else if (cell === 2) {
          const g = this.add.graphics().setDepth(depth);
          drawExtrudedTile(g, pos.x, pos.y, 0x5a3a1a, 0x4a2a10, 0x3a1a0a, 12);
          this.hudCam.ignore(g);
        } else if (cell === 3) {
          const g = this.add.graphics().setDepth(depth);
          drawExtrudedTile(g, pos.x, pos.y, 0x6a4a2a, 0x5a3a1a, 0x4a2a0a, 8);
          this.hudCam.ignore(g);
        } else if (cell === 4) {
          const g = this.add.graphics().setDepth(depth);
          drawDiamond(g, pos.x, pos.y, 0x4a3a2a);
          drawExtrudedTile(g, pos.x, pos.y, 0x5a4a2a, 0x4a3a1a, 0x3a2a0a, 10);
          this.hudCam.ignore(g);
          const exitLabel = createText(this, pos.x, pos.y - 28, 'EXIT', {
            fontSize: fs(9), fontFamily: 'Inter', resolution: 4, color: '#6a5a3a',
          }).setOrigin(0.5).setDepth(15);
          this.hudCam.ignore(exitLabel);
          const glow = this.add.image(pos.x, pos.y - 14, 'terrain_diamond')
            .setTint(0x8a7a5a).setAlpha(0.3).setDepth(depth + 0.1);
          this.hudCam.ignore(glow);
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
    this.playerLabel = createText(this, p.x, p.y - 30, 'You', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#aaddff',
    }).setOrigin(0.5);
    this.hudCam.ignore(this.player);
    this.hudCam.ignore(this.playerLabel);
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
    this.npcCells.clear();
    this.facingOutlineImages.forEach(img => img.destroy());
    this.facingOutlineImages = [];
    this.npcSpriteRefs = [];
    this.npcBaseFlip = [];
    this.npcLabelTexts.forEach(t => t.destroy());
    this.npcLabelTexts = [];
    this.npcSeats = [];

    const seats = Phaser.Utils.Array.Shuffle([...NPC_SEATS]);
    this.npcSeats = seats;

    for (let i = 0; i < Math.min(rescued.length, 20); i++) {
      const npc = rescued[i];
      const gpos = seats[i];
      this.npcCells.add(`${gpos.x},${gpos.y}`);
      const pos = gridToScreen(gpos.x, gpos.y);
      const depth = 6 + (gpos.x + gpos.y) * 0.01 + 0.003;

      const npcCfg = getSpriteConfig(`npc_${npc.variant}`);
      const container = this.add.container(
        pos.x + (npcCfg.offsetX ?? 0),
        pos.y + (npcCfg.offsetY ?? 0),
      ).setDepth(depth);
      this.hudCam.ignore(container);

      const sprite = this.add.image(0, 0, `npc_${npc.variant}`);
      if (npcCfg.originX !== undefined || npcCfg.originY !== undefined) {
        sprite.setOrigin(npcCfg.originX ?? 0.5, npcCfg.originY ?? 0.5);
      }
      if (npcCfg.scale !== undefined) sprite.setScale(npcCfg.scale);
      sprite.setFlipX(Math.random() > 0.5);
      container.add(sprite);

      this.npcSpriteRefs.push(sprite);
      this.npcBaseFlip.push(sprite.flipX);

      const label = createText(this, pos.x, pos.y - 60, npc.name, {
        fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7',
      }).setOrigin(0.5).setDepth(50);
      this.hudCam.ignore(label);
      this.npcLabelTexts.push(label);

      container.setSize(30, 40);
      container.setInteractive(
        new Phaser.Geom.Rectangle(-35, -30, 70, 60),
        Phaser.Geom.Rectangle.Contains,
      ).setData('isUI', true);

      const npcRef = npc;
      container.on('pointerdown', () => {
        const gpos = seats[i];
        const dx = Math.abs(this.playerGx - gpos.x);
        const dy = Math.abs(this.playerGy - gpos.y);
        if (dx + dy === 1) {
          this.showGreeting(npcRef);
          return;
        }
        const adj = this.findAdjacentTile(gpos.x, gpos.y);
        if (adj) {
          const path = findPath(
            this.playerGx, this.playerGy,
            adj.x, adj.y,
            TAVERN_COLS, TAVERN_ROWS,
            (x, y) => !this.isSolid(x, y),
          );
          if (path && path.length > 0) {
            this.movePath = path;
            this.pendingNPCIdx = i;
          }
        }
      });

      // Idle bob animation
      this.tweens.add({
        targets: container,
        y: container.y - 3,
        yoyo: true,
        repeat: -1,
        duration: 600 + Math.random() * 400,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 1000,
      });
    }
  }

  private createUI(): void {
    this.titleText = createText(this, CX(), 12, 'THE COZY TAVERN', {
      fontSize: fs(16), fontFamily: 'Inter', resolution: 4, color: '#cc8844', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50).setScrollFactor(0);
    this.cameras.main.ignore(this.titleText);

    const rescued = gameState.rescuedVillagers;
    this.countText = createText(this, CX(), VH() - 32, `${rescued.length} / 20 villagers resting here  [P] Photobook`, {
      fontSize: fs(9), fontFamily: 'Inter', resolution: 4, color: '#7a6a5a',
    }).setOrigin(0.5).setDepth(50).setScrollFactor(0);
    this.cameras.main.ignore(this.countText);

    this.exitBtn = createText(this, VW() - 12, VH() - 12, '[EXIT]', {
      fontSize: fs(14), fontFamily: 'Inter', resolution: 4, color: '#ff8844',
    }).setOrigin(1, 1).setDepth(50).setInteractive({ useHandCursor: true }).setScrollFactor(0)
      .on('pointerdown', () => this.leave());
    this.cameras.main.ignore(this.exitBtn);

    this.photobookBtn = createText(this, 12, VH() - 12, '[PHOTOBOOK]', {
      fontSize: fs(14), fontFamily: 'Inter', resolution: 4, color: '#7a6a5a',
    }).setOrigin(0, 1).setDepth(50).setInteractive({ useHandCursor: true }).setScrollFactor(0)
      .on('pointerdown', () => this.photobook.toggle());
    this.cameras.main.ignore(this.photobookBtn);

    this.carrotCountText = createText(this, VW() - 12, 12, '', {
      fontSize: fs(14), fontFamily: 'Inter', resolution: 4, color: '#ff8833', fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(50);
    this.cameras.main.ignore(this.carrotCountText);
    this.updateCarrotCounter();

    this.actionBubbleGfx = this.add.graphics().setDepth(99).setAlpha(0);
    this.hudCam.ignore(this.actionBubbleGfx);
    this.actionBubbleText = createText(this, 0, 0, '', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#ffdd88',
    }).setOrigin(0.5).setDepth(100).setAlpha(0);
    this.hudCam.ignore(this.actionBubbleText);
  }

  private updateCarrotCounter(): void {
    this.carrotCountText.setText(`🥕 ${gameState.inventory.count('carrot')}`);
  }

  private createActionButton(): void {
    this.actionBtnBg = this.add.graphics().setScrollFactor(0).setDepth(50);
    this.cameras.main.ignore(this.actionBtnBg);
    const { x, y } = actionButtonCenter();
    this.actionBtnText = createText(this, x, y, '', {
      fontSize: fs(28), fontFamily: 'Inter', resolution: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.cameras.main.ignore(this.actionBtnText);
    const hit = this.add.rectangle(x, y, ACTION_BTN_SIZE, ACTION_BTN_SIZE, 0x000000, 0)
      .setScrollFactor(0).setDepth(52).setData('isUI', true);
    this.cameras.main.ignore(hit);
    this.actionBtnHit = hit;
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      if (this.greetingActive) {
        this.closeGreeting?.();
        return;
      }
      if (this.adjacentNPC) {
        const rescued = gameState.rescuedVillagers;
        for (let i = 0; i < Math.min(rescued.length, 20); i++) {
          if (rescued[i] === this.adjacentNPC) {
            const gpos = this.npcSeats[i];
            this.facingX = Math.sign(gpos.x - this.playerGx);
            this.facingY = Math.sign(gpos.y - this.playerGy);
            this.updatePlayerSprite();
            break;
          }
        }
        this.showGreeting(this.adjacentNPC);
      }
    });
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
      if (this.adjacentNPC) {
        this.showGreeting(this.adjacentNPC);
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

  private get isModalActive(): boolean {
    return this.greetingActive || this.photobook.isVisible();
  }

  private isPointerOverUI(pointer: Phaser.Input.Pointer): boolean {
    const hits = this.input.hitTestPointer(pointer);
    return hits.some(obj => (obj as Phaser.GameObjects.GameObject).getData?.('isUI'));
  }

  private setupPointerInput(): void {
    this.analog = new AnalogStickInput(this, {
      depth: 250,
      isModal: () => this.isModalActive,
      isPointerOverUI: (p) => this.isPointerOverUI(p),
      onDragStart: () => { this.movePath = []; },
      onClick: (worldX, worldY) => { this.doClickToMove(worldX, worldY); },
      onGfxCreated: (gfx) => this.cameras.main.ignore(gfx),
    });
  }

  private doClickToMove(worldX: number, worldY: number): void {
    const isoX = worldX;
    const isoY = worldY - OFFSET_Y;
    const g = isoToGrid(isoX, isoY);

    if (g.x < 0 || g.x >= TAVERN_COLS || g.y < 0 || g.y >= TAVERN_ROWS) return;
    if (g.x === this.playerGx && g.y === this.playerGy) return;

    this.pendingNPCIdx = -1;

    if (this.npcCells.has(`${g.x},${g.y}`)) {
      const adj = this.findAdjacentTile(g.x, g.y);
      if (adj) {
        const path = findPath(
          this.playerGx, this.playerGy,
          adj.x, adj.y,
          TAVERN_COLS, TAVERN_ROWS,
          (x, y) => !this.isSolid(x, y),
        );
        if (path && path.length > 0) {
          for (let i = 0; i < Math.min(gameState.rescuedVillagers.length, 20); i++) {
            if (this.npcSeats[i].x === g.x && this.npcSeats[i].y === g.y) {
              this.pendingNPCIdx = i;
              break;
            }
          }
          this.movePath = path;
        }
      }
      return;
    }

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

    this.handleMovement(delta);
    if (this.isMoving) {
      this.animTimer += delta;
      if (this.animTimer >= this.ANIM_INTERVAL) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame % 5) + 1;
        this.updatePlayerSprite();
      }
    } else {
      this.animTimer += delta;
      if (this.animTimer > 250 && this.animFrame !== 0) {
        this.animFrame = 0;
        this.animTimer = 0;
        this.updatePlayerSprite();
      }
    }

    if (this.pendingNPCIdx >= 0 && !this.isMoving && this.movePath.length === 0) {
      const rescued = gameState.rescuedVillagers;
      if (this.pendingNPCIdx < rescued.length) {
        const npcGpos = this.npcSeats[this.pendingNPCIdx];
        const dx = Math.abs(this.playerGx - npcGpos.x);
        const dy = Math.abs(this.playerGy - npcGpos.y);
        if (dx + dy === 1) {
          this.facingX = Math.sign(npcGpos.x - this.playerGx);
          this.facingY = Math.sign(npcGpos.y - this.playerGy);
          this.updatePlayerSprite();
          this.showGreeting(rescued[this.pendingNPCIdx]);
        }
      }
      this.pendingNPCIdx = -1;
    }

    const rescued = gameState.rescuedVillagers;
    let foundNPC: { variant: number; rescuedAtDepth: number; name: string; talkCount: number } | null = null;
    let foundIdx = -1;
    for (let i = 0; i < Math.min(rescued.length, 20); i++) {
      const gpos = this.npcSeats[i];
      const dx = Math.abs(this.playerGx - gpos.x);
      const dy = Math.abs(this.playerGy - gpos.y);
      if (dx + dy === 1) {
        const relX = gpos.x - this.playerGx;
        const relY = gpos.y - this.playerGy;
        if (relX === this.facingX && relY === this.facingY) {
          foundNPC = rescued[i];
          foundIdx = i;
          break;
        }
      }
    }
    this.adjacentNPC = foundNPC;

    // Reset all NPC flips to their random base, then face the one toward player
    for (let i = 0; i < this.npcSpriteRefs.length; i++) {
      this.npcSpriteRefs[i].setFlipX(this.npcBaseFlip[i]);
    }
    if (foundIdx >= 0 && foundIdx < this.npcSpriteRefs.length) {
      const npcGx = this.npcSeats[foundIdx].x;
      const npcGy = this.npcSeats[foundIdx].y;
      if (npcGx < this.playerGx || (npcGx === this.playerGx && npcGy > this.playerGy)) {
        this.npcSpriteRefs[foundIdx].setFlipX(true);
      } else if (npcGx > this.playerGx || (npcGx === this.playerGx && npcGy < this.playerGy)) {
        this.npcSpriteRefs[foundIdx].setFlipX(false);
      }
    }

    if (foundNPC) {
      this.showActionPrompt(`[SPACE] Talk to ${foundNPC.name}`);
    } else {
      const doorCell = this.findDoorCell();
      if (doorCell) {
        const dx = Math.abs(this.playerGx - doorCell.x);
        const dy = Math.abs(this.playerGy - doorCell.y);
        if (dx + dy === 1) {
          this.showActionPrompt('[SPACE] Exit');
        } else {
          this.hideActionPrompt();
        }
      } else {
        this.hideActionPrompt();
      }
    }

    this.updateFacingHighlight(foundIdx);
    this.updateActionButton();
  }

  private isSolid(gx: number, gy: number): boolean {
    if (gx < 0 || gx >= TAVERN_COLS || gy < 0 || gy >= TAVERN_ROWS) return true;
    const cell = TAVERN_MAP[gy][gx];
    if (cell === 1 || cell === 2 || cell === 3) return true;
    if (this.npcCells.has(`${gx},${gy}`)) return true;
    return false;
  }

  private tryMove(dx: number, dy: number): void {
    if (this.isMoving) return;

    this.facingX = dx;
    this.facingY = dy;
    this.updatePlayerSprite();

    const nx = this.playerGx + dx;
    const ny = this.playerGy + dy;

    if (nx < 0 || nx >= TAVERN_COLS || ny < 0 || ny >= TAVERN_ROWS) return;
    if (this.isSolid(nx, ny)) return;

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
      ease: 'Quad.easeOut',
      onComplete: () => { this.isMoving = false; },
    });
    this.tweens.add({
      targets: this.playerLabel,
      x: target.x,
      y: target.y - 30,
      duration: 100,
      ease: 'Quad.easeOut',
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
      this.pendingNPCIdx = -1;
      this.analog.reset();
      if (kbA) dx = -1;
      else if (kbD) dx = 1;
      if (kbW) dy = -1;
      else if (kbS) dy = 1;
    } else if (this.analog.active && (this.analog.dx !== 0 || this.analog.dy !== 0)) {
      dx = this.analog.dx;
      dy = this.analog.dy;
    } else if (!this.isMoving && this.movePath.length > 0) {
      const next = this.movePath.shift()!;
      dx = next.x - this.playerGx;
      dy = next.y - this.playerGy;
    }

    if (dx !== 0 && dy !== 0) dy = 0;

    if (dx !== 0 || dy !== 0) {
      this.tryMove(dx, dy);
    }
  }

  private showActionPrompt(text: string): void {
    const displayText = getInputMode() !== 'keyboard' ? text.replace(/^\[SPACE\] /, '') : text;
    const pp = gridToScreen(this.playerGx, this.playerGy);
    this.drawChatBubble(this.actionBubbleGfx, this.actionBubbleText, displayText, pp.x, pp.y - 55);
    this.actionBubbleGfx.setAlpha(1);
    this.actionBubbleText.setAlpha(1);
  }

  private hideActionPrompt(): void {
    this.actionBubbleGfx.setAlpha(0);
    this.actionBubbleText.setAlpha(0);
  }

  private drawChatBubble(
    gfx: Phaser.GameObjects.Graphics, text: Phaser.GameObjects.Text,
    msg: string, cx: number, topY: number,
  ): void {
    gfx.clear();
    text.setText(msg);
    const padX = 12, padY = 6, tailH = 5, radius = 6;
    const bw = text.width + padX * 2;
    const bh = text.height + padY * 2;
    const bx = cx - bw / 2;
    const by = topY - bh - tailH;
    gfx.fillStyle(0x1a1410, 0.9);
    gfx.fillRoundedRect(bx, by, bw, bh, radius);
    gfx.fillTriangle(
      cx - 5, by + bh,
      cx + 5, by + bh,
      cx, by + bh + tailH,
    );
    text.setPosition(cx, by + bh / 2);
  }

  private showGreeting(npc: { variant: number; rescuedAtDepth: number; name: string; talkCount: number }): void {
    const personality = NPC_PERSONALITIES[npc.variant];
    if (!personality) return;

    const greeting = personality.greetings[(npc.talkCount ?? 0) % personality.greetings.length];
    const isFirstTalk = npc.talkCount === 0;
    npc.talkCount++;

    gameState.save();

    this.greetingActive = true;

    const overlayBg = NineSliceBg.modal(this, CX(), CY(), 340, 130);
    overlayBg.setDepth(200).setScrollFactor(0).setAlpha(0.85);
    this.cameras.main.ignore(overlayBg);

    const overlayText = createText(this, CX() - 155, CY() - 30, `${npc.name}`, {
      fontSize: fs(13), fontFamily: 'Inter', resolution: 4, color: '#ccaa66', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(201).setScrollFactor(0);
    this.cameras.main.ignore(overlayText);

    const speechText = createText(this, CX() - 155, CY() + 2, '', {
      fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7', align: 'left',
      wordWrap: { width: 310 },
    }).setOrigin(0, 0.5).setDepth(201).setScrollFactor(0);
    this.cameras.main.ignore(speechText);

    const closeHint = createAdaptiveText(this, CX(), CY() + 48, '[SPACE] skip', 'skip', {
      fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#6a5a4a',
    }).setOrigin(0.5).setDepth(201).setScrollFactor(0);
    this.cameras.main.ignore(closeHint);

    this.greetingFullText = greeting;
    this.greetingRevealedChars = 0;
    this.greetingTypingComplete = false;

    const typingSpeed = 35;
    this.greetingTimer = this.time.addEvent({
      delay: typingSpeed,
      callback: () => {
        this.greetingRevealedChars++;
        speechText.setText(this.greetingFullText.substring(0, this.greetingRevealedChars));
        if (this.greetingRevealedChars >= this.greetingFullText.length) {
          this.greetingTypingComplete = true;
          if (this.greetingTimer) {
            this.greetingTimer.remove();
            this.greetingTimer = null;
          }
          closeHint.setText(getInputMode() !== 'keyboard' ? 'close' : '[SPACE / ESC] close');
        }
      },
      loop: true,
    });

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

    const close = () => {
      if (this.greetingTimer) {
        this.greetingTimer.remove();
        this.greetingTimer = null;
      }
      overlayBg.destroy();
      overlayText.destroy();
      speechText.destroy();
      closeHint.destroy();
      this.greetingActive = false;
      this.closeGreeting = null;
      this.input.off('pointerdown', advance);
      this.input.keyboard!.off('keydown-SPACE', advance);
      this.input.keyboard!.off('keydown-ESC', close);
    };

    const advance = () => {
      if (!this.greetingTypingComplete) {
        if (this.greetingTimer) {
          this.greetingTimer.remove();
          this.greetingTimer = null;
        }
        this.greetingRevealedChars = this.greetingFullText.length;
        speechText.setText(this.greetingFullText);
        this.greetingTypingComplete = true;
        closeHint.setText(getInputMode() !== 'keyboard' ? 'close' : '[SPACE / ESC] close');
      } else {
        close();
      }
    };

    this.closeGreeting = advance;

    this.time.delayedCall(0, () => {
      this.input.on('pointerdown', advance);
      this.input.keyboard!.on('keydown-SPACE', advance);
      this.input.keyboard!.on('keydown-ESC', close);
    });
  }

  private showObtainPopup(id: string, qty: number, prefix?: string, stackIndex: number = 0): void {
    const y = 116 + stackIndex * 36;
    const container = this.add.container(12, y).setScrollFactor(0).setDepth(250);
    this.cameras.main.ignore(container);

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.8);
    bg.fillRoundedRect(0, 0, 200, 36, 4);
    container.add(bg);

    const texKey = itemIconKey(id);
    const sprite = this.add.image(18, 18, this.textures.exists(texKey) ? texKey : '__DEFAULT');
    sprite.setScale(0.7);
    container.add(sprite);

    if (qty > 1) {
      const badge = createText(this, 30, 26, `x${qty}`, {
        fontSize: fs(9), fontFamily: 'Inter', resolution: 4, color: '#ffdd88',
      }).setOrigin(1, 1);
      container.add(badge);
    }

    const labelText = prefix ? `${prefix}: ${itemDisplayName(id)}` : itemDisplayName(id);
    const label = createText(this, 38, 10, labelText, {
      fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7',
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

  private updateFacingHighlight(npcIdx: number): void {
    if (npcIdx === this.highlightedNPC) return;
    this.facingOutlineImages.forEach(img => img.destroy());
    this.facingOutlineImages = [];
    this.highlightedNPC = npcIdx;
    if (npcIdx < 0) return;
    const rescued = gameState.rescuedVillagers;
    if (npcIdx >= rescued.length) return;
    const gpos = this.npcSeats[npcIdx];
    const texKey = `npc_${rescued[npcIdx].variant}`;
    if (!this.textures.exists(texKey)) return;
    const pos = gridToScreen(gpos.x, gpos.y);
    const cfg = getSpriteConfig(texKey);
    const px = pos.x + (cfg.offsetX ?? 0);
    const py = pos.y + (cfg.offsetY ?? 0);
    const depth = 6 + (gpos.x + gpos.y) * 0.01 + 0.001;
    const dirs: [number, number][] = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
    for (let t = 1; t <= 3; t++) {
      const alpha = t === 1 ? 0.85 : t === 2 ? 0.4 : 0.12;
      for (const [dx, dy] of dirs) {
        const img = this.add.image(px + dx * t, py + dy * t, texKey)
          .setDepth(depth)
          .setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
          .setAlpha(alpha);
        this.hudCam.ignore(img);
        this.facingOutlineImages.push(img);
      }
    }
    // Sync highlight flip with the actual NPC sprite
    if (npcIdx < this.npcSpriteRefs.length) {
      const flip = this.npcSpriteRefs[npcIdx].flipX;
      this.facingOutlineImages.forEach(img => img.setFlipX(flip));
    }
  }

  private updateActionButton(): void {
    const { x: bx, y: by } = actionButtonGlowBoxTopLeft();
    if (this.adjacentNPC && !this.isModalActive) {
      this.actionBtnBg.clear();
      this.actionBtnBg.fillStyle(0x0a0a1a, 0.75);
      this.actionBtnBg.fillRoundedRect(bx, by, 64, 64, 10);
      this.actionBtnBg.lineStyle(2, 0x4488cc, 0.6);
      this.actionBtnBg.strokeRoundedRect(bx, by, 64, 64, 10);
      this.actionBtnText.setText('💬').setColor('#88ccff');
    } else {
      this.actionBtnBg.clear();
      this.actionBtnText.setText('');
    }
  }

  private findAdjacentTile(gx: number, gy: number): { x: number; y: number } | null {
    const dirs: [number, number][] = [[0, -1], [-1, 0], [1, 0], [0, 1]];
    for (const [dx, dy] of dirs) {
      const nx = gx + dx, ny = gy + dy;
      if (!this.isSolid(nx, ny)) return { x: nx, y: ny };
    }
    return null;
  }

  private leave(): void {
    if (this.bgm) this.bgm.stop();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.HOMELAND);
    });
  }
}
