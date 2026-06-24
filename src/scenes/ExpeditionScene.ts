import Phaser from 'phaser';
import { StaminaSystem } from '../systems/StaminaSystem';
import { MiningSystem } from '../systems/MiningSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { DungeonGenerator, DungeonFloor, DungeonTile } from '../systems/DungeonGenerator';
import { ExpeditionState } from '../systems/ExpeditionState';
import { gameState, itemDisplayName, itemIconKey, NPC_PERSONALITIES } from '../systems/GameState';
import { InventoryPanel } from '../ui/InventoryPanel';
import { EventPanel, EventChoice, EventConfig } from '../ui/EventPanel';
import { CombatPanel, CombatResult, EnemyConfig } from '../ui/CombatPanel';
import { GamblePanel, RouletteSegment } from '../ui/GamblePanel';
import { AnalogStickInput } from '../ui/AnalogStickInput';
import { audio } from '../systems/AudioSystem';
import { getSpriteConfig } from '../systems/SpriteConfig';
import {
  gridToIso, isoToGrid, findPath,
  tileSortKey, drawDiamondAt,
  HALF_W, HALF_H, worldWidth, worldHeight,
} from '../systems/IsoUtils';
import { VW, VH, CX, CY } from '../systems/Viewport';

const BIOMES = ['FOREST', 'CAVE', 'ICE', 'LAVA', 'RUINS'];

function getBiomeKey(depth: number): string {
  return BIOMES[Math.floor(depth / 5) % 5];
}

function getWallTextureKey(depth: number): string {
  return `wall_${getBiomeKey(depth)}`;
}

function playerDepth(x: number, y: number): number {
  return 6 + y * 0.002 + x * 0.001 + 0.0005;
}

const DEPTH = {
  TERRAIN: 4, INTERACTIVE_BASE: 6, SELECTED_BACKDROP: 7, PREVIEW_TILE: 7.1,
  FACING_HIGHLIGHT: 12, EFFECTS: 14, PARTICLES: 15, BOMB: 20,
  ITEM_POPUP: 25, ITEM_SPRITE: 26, DARKNESS: 48, HUD_BG: 50, HUD: 51, MINIMAP_DOT: 52,
  INTERACT_PROMPT: 55, OVERLAY: 100, OVERLAY_TEXT: 101,
  POPUP: 200, CLICK_ZONES: 210, ANALOG: 250,
};

export class ExpeditionScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private playerX: number = 1;
  private playerY: number = 1;
  private stamina: StaminaSystem;
  private mining: MiningSystem;
  private inventory: InventorySystem;
  private dungeonGen: DungeonGenerator;
  private expeditionState: ExpeditionState;
  private currentFloor: DungeonFloor | null = null;
  private floorSpriteObjects: Phaser.GameObjects.Image[] = [];
  private tileObjects: Phaser.GameObjects.Image[] = [];
  private selectedObject!: Phaser.GameObjects.Graphics;
  private facingHighlight!: Phaser.GameObjects.Graphics;
  private portraitSprite!: Phaser.GameObjects.Image;
  private staminaBg!: Phaser.GameObjects.Graphics;
  private staminaBarGfx!: Phaser.GameObjects.Graphics;
  private staminaValueText!: Phaser.GameObjects.Text;
  private depthTextCentered!: Phaser.GameObjects.Text;
  private pickaxeSprite!: Phaser.GameObjects.Image;
  private pickaxeRing!: Phaser.GameObjects.Graphics;
  private pickaxeUsesText!: Phaser.GameObjects.Text;
  private invBtnSprite!: Phaser.GameObjects.Image;
  private invBtnRing!: Phaser.GameObjects.Graphics;
  private invSlotText!: Phaser.GameObjects.Text;
  private minimapX: number = 0;
  private minimapY: number = 0;
  private minimapW: number = 0;
  private minimapH: number = 0;
  private potionImg!: Phaser.GameObjects.Image;
  private bombImg!: Phaser.GameObjects.Image;
  private potionCountText!: Phaser.GameObjects.Text;
  private bombCountText!: Phaser.GameObjects.Text;
  private escapeSprite!: Phaser.GameObjects.Image;
  private escapeLabel!: Phaser.GameObjects.Text;
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    UP: Phaser.Input.Keyboard.Key;
    DOWN: Phaser.Input.Keyboard.Key;
    LEFT: Phaser.Input.Keyboard.Key;
    RIGHT: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
    ESC: Phaser.Input.Keyboard.Key;
    TAB: Phaser.Input.Keyboard.Key;
    Q: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    F: Phaser.Input.Keyboard.Key;
    Z: Phaser.Input.Keyboard.Key;
  };
  private moveTimer: number = 0;
  private moveDelay: number = 150;
  private isMoving: boolean = false;
  private isMining: boolean = false;
  private pendingMineTx: number = -1;
  private pendingMineTy: number = -1;
  private stairTargetX: number = -1;
  private stairTargetY: number = -1;
  private stairAction: 'ascend' | 'descend' | null = null;
  private stairPrompt: Phaser.GameObjects.Container | null = null;
  private _stairProceedBtn?: Phaser.GameObjects.Text;
  private _stairCancelBtn?: Phaser.GameObjects.Text;
  private _stairPointerHandler?: (pointer: Phaser.Input.Pointer) => void;
  private _stairMoveHandler?: (pointer: Phaser.Input.Pointer) => void;
  private floorEntry: boolean = false;
  private stairDismissCell: { x: number; y: number } | null = null;
  private exhausted: boolean = false;
  private stairsSpawned: boolean = false;
  private facingX: number = 0;
  private facingY: number = 1;
  private debugMode: boolean = false;
  private loadoutConsumables: Record<string, number> = {};
  private inventoryPanel!: InventoryPanel;
  private eventPanel!: EventPanel;
  private eventActive: boolean = false;
  private combatPanel!: CombatPanel;
  private combatActive: boolean = false;
  private gamblePanel!: GamblePanel;
  private minimapBg!: Phaser.GameObjects.Graphics;
  private minimapGfx!: Phaser.GameObjects.Graphics;
  private minimapDot!: Phaser.GameObjects.Rectangle;
  private interactPrompt!: Phaser.GameObjects.Text;
  private interactTarget: { x: number; y: number; id: string } | null = null;
  private darknessOverlay!: Phaser.GameObjects.Graphics;
  private darknessMaskGfx!: Phaser.GameObjects.Graphics;
  private playerSprite: Phaser.GameObjects.Image | null = null;
  private previewTile: Phaser.GameObjects.Image | null = null;
  private facingOutlineImages: Phaser.GameObjects.Image[] = [];
  private oreImageMap: Map<string, Phaser.GameObjects.Image> = new Map();
  private rocksBrokenThisRun: number = 0;
  private itemFlyQueue: Array<{ sprite: Phaser.GameObjects.Image; resource: string }> = [];
  private itemFlyBusy: boolean = false;
  private activeObtainPopups: Phaser.GameObjects.Container[] = [];
  private animFrame: number = 0;
  private animTimer: number = 0;
  private readonly ANIM_INTERVAL: number = 60;
  private startFloor: number = 0;
  private runSeed: string = '';
  private movePath: { x: number; y: number }[] = [];
  private analog!: AnalogStickInput;
  private actionBtnBg!: Phaser.GameObjects.Graphics;
  private actionBtnText!: Phaser.GameObjects.Text;
  private hudCam!: Phaser.Cameras.Scene2D.Camera;

  constructor() {
    super({ key: 'ExpeditionScene' });
    this.stamina = new StaminaSystem(100);
    this.mining = new MiningSystem();
    this.inventory = new InventorySystem(16, false);
    this.dungeonGen = new DungeonGenerator();
    this.expeditionState = new ExpeditionState();
  }

  private isBlocked(tile: DungeonTile): boolean {
    return tile.type === 'wall' || tile.type === 'blocked' || tile.type === 'boss_body'
      || (tile.type === 'mineable' && !tile.broken)
      || ((tile.type === 'enemy' || tile.type === 'event_boss') && !tile.broken)
      || (tile.type.startsWith('event_') && !tile.broken);
  }

  private getDamageTint(tile: DungeonTile): number | null {
    if (tile.maxDurability <= 0) return null;
    const ratio = tile.durability / tile.maxDurability;
    if (ratio <= 0.33) return 0x777777;
    if (ratio <= 0.66) return 0xaaaaaa;
    return null;
  }

  private createPopup(text: string, x: number, y: number, color: string, opts?: { duration?: number; moveY?: number; scaleFrom?: number; scaleTo?: number }): void {
    const popup = this.add.text(x, y, text, {
      fontSize: '16px', fontFamily: 'monospace', color, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(DEPTH.POPUP).setScrollFactor(0);
    this.cameras.main.ignore(popup);
    const tween: any = { targets: popup, y: y + (opts?.moveY ?? -40), alpha: 0, duration: opts?.duration ?? 1200, ease: 'Quad.easeOut', onComplete: () => popup.destroy() };
    if (opts?.scaleFrom || opts?.scaleTo) tween.scale = { from: opts?.scaleFrom ?? 1.2, to: opts?.scaleTo ?? 0.9 };
    this.tweens.add(tween);
  }

  init(data: { debug?: boolean; consumables?: Record<string, number>; startFloor?: number; seed?: string }): void {
    this.debugMode = data?.debug ?? false;
    this.loadoutConsumables = data?.consumables ?? {};
    this.startFloor = data?.startFloor ?? 0;
    this.runSeed = data?.seed ?? '';
  }

  create(): void {
    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#0a0a0a');

    this.hudCam = this.cameras.add(0, 0, VW, VH, false, 'hud');
    this.hudCam.setZoom(1);

    this.exhausted = false;
    this.hasFinished = false;
    this.activeObtainPopups = [];
    const bootStaminaBonus = gameState.getBootEffects().maxStaminaBonus;
    const staminaMax = this.debugMode ? 10000 : Math.floor((100 + gameState.maxStaminaBonus + bootStaminaBonus) * (1 + gameState.staminaPercentBonus / 100));
    this.rocksBrokenThisRun = 0;
    this.stairsSpawned = false;
    this.floorEntry = true;
    this.stamina = new StaminaSystem(staminaMax);
    if (gameState.getResearchLevel('second_wind') >= 1) this.stamina.refill(5);
    this.mining = new MiningSystem();
    this.mining.setPickaxeTier(gameState.currentPickaxeTier);
    this.inventory = new InventorySystem(this.debugMode ? 100 : 16 + gameState.inventorySlotBonus, false);
    gameState.runVillagersRescued = [];
    gameState.runRecipesDiscovered = [];
    this.expeditionState.reset();
    this.expeditionState.depth = this.startFloor;
    this.moveTimer = 0;
    this.animFrame = 0;
    this.animTimer = 0;
    this.facingHighlight = this.add.graphics().setDepth(DEPTH.FACING_HIGHLIGHT);
    this.selectedObject = this.add.graphics().setDepth(DEPTH.SELECTED_BACKDROP);
    this.darknessOverlay = this.add.graphics().setDepth(DEPTH.DARKNESS);
    this.darknessMaskGfx = this.add.graphics().setVisible(false);
    this.darknessOverlay.enableFilters().filters!.internal.addMask(this.darknessMaskGfx, true);
    this.hudCam.ignore(this.facingHighlight);
    this.hudCam.ignore(this.selectedObject);
    this.hudCam.ignore(this.darknessOverlay);
    this.hudCam.ignore(this.darknessMaskGfx);

    this.inventoryPanel = new InventoryPanel(
      this, this.inventory,
      (id) => this.tryUseConsumable(id),
      (id) => this.trashItem(id),
      'Run Inventory',
    );
    this.cameras.main.ignore(this.inventoryPanel.container);
    this.eventPanel = new EventPanel(this);
    this.eventActive = false;
    this.cameras.main.ignore(this.eventPanel.container);
    this.combatPanel = new CombatPanel(this);
    this.combatActive = false;
    this.cameras.main.ignore(this.combatPanel.container);
    this.gamblePanel = new GamblePanel(this);
    this.cameras.main.ignore(this.gamblePanel.container);
    this.interactTarget = null;

    this.minimapBg = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.HUD_BG);
    this.minimapGfx = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.HUD);
    this.minimapDot = this.add.rectangle(0, 0, 3, 3, 0x88ccff).setScrollFactor(0).setDepth(DEPTH.MINIMAP_DOT);
    this.cameras.main.ignore(this.minimapBg);
    this.cameras.main.ignore(this.minimapGfx);
    this.cameras.main.ignore(this.minimapDot);

    this.interactPrompt = this.add.text(0, 0, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffdd88',
    }).setOrigin(0.5).setAlpha(0).setDepth(DEPTH.INTERACT_PROMPT);
    this.hudCam.ignore(this.interactPrompt);

    if (this.runSeed) this.dungeonGen.setSeed(`${this.runSeed}_depth_${this.startFloor}`);
    this.currentFloor = this.dungeonGen.generateFloor(this.startFloor);

    const floor = this.currentFloor;
    this.playerX = floor.entryX;
    this.playerY = floor.entryY;

    this.drawFloor();
    this.createPlayer();
    this.createHUD();
    this.setupInput();
    this.setupPointerInput();

    const xMin = -floor.rows * HALF_W;
    const yMin = -HALF_H;
    this.cameras.main.startFollow(this.player, true, 0.5, 0.5);
    this.cameras.main.setBounds(xMin, yMin, worldWidth(floor.cols, floor.rows), worldHeight(floor.cols, floor.rows));
    this.cameras.main.setZoom(1.2);

    this.expeditionState.initExplored(floor.cols, floor.rows);
    this.revealSurroundings();
    this.updateDarkness();
  }

  private drawFloor(): void {
    this.floorSpriteObjects.forEach(o => o.destroy());
    this.floorSpriteObjects = [];
    this.tileObjects.forEach(o => o.destroy());
    this.tileObjects = [];
    this.oreImageMap.clear();
    if (this.previewTile) { this.previewTile.destroy(); this.previewTile = null; }
    this.facingHighlight.clear();
    this.selectedObject.clear();

    const floor = this.currentFloor;
    if (!floor) return;

    const biome = getBiomeKey(floor.depth);

    const tiles: { x: number; y: number }[] = [];
    for (let y = 0; y < floor.rows; y++) {
      for (let x = 0; x < floor.cols; x++) {
        tiles.push({ x, y });
      }
    }
    tiles.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.x - b.x);

    for (const { x, y } of tiles) {
      const tile = floor.tiles[y][x];
      if (tile.type === 'wall') continue;

      const p = gridToIso(x, y);
      const isCorridor = tile.type === 'corridor';
      const key = isCorridor ? `corridor_${biome}` : `floor_${biome}_a`;

      const img = this.add.image(p.x, p.y, key).setDepth(DEPTH.TERRAIN).setScale(0.5);
      this.hudCam.ignore(img);
      this.floorSpriteObjects.push(img);

      if (!isCorridor && (x + y) % 2 === 0) {
        const check = this.add.image(p.x, p.y, `floor_${biome}_b`).setDepth(DEPTH.TERRAIN + 0.01).setScale(0.5);
        this.hudCam.ignore(check);
        this.floorSpriteObjects.push(check);
      }
    }

    this.drawInteractiveTiles();
    this.updateFacingHighlight();
  }

  private drawInteractiveTiles(): void {
    this.tileObjects.forEach(o => o.destroy());
    this.tileObjects = [];
    const floor = this.currentFloor;
    if (!floor) return;
    const wallKey = getWallTextureKey(floor.depth);
    const hasWallTex = this.textures.exists(wallKey);

    const tiles: { x: number; y: number }[] = [];
    for (let y = 0; y < floor.rows; y++) {
      for (let x = 0; x < floor.cols; x++) {
        tiles.push({ x, y });
      }
    }
    tiles.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.x - b.x);

    for (const { x, y } of tiles) {
      const tile = floor.tiles[y][x];
      const p = gridToIso(x, y);
      const depth = 6 + y * 0.002 + x * 0.001;

      const makeImg = (key: string) => {
        const cfg = getSpriteConfig(key);
        const img = this.add.image(
          p.x + (cfg.offsetX ?? 0),
          p.y + (cfg.offsetY ?? 0),
          key,
        ).setDepth(depth);
        img.setData('gx', x).setData('gy', y);
        if (cfg.originX !== undefined || cfg.originY !== undefined) {
          img.setOrigin(cfg.originX ?? 0.5, cfg.originY ?? 0.5);
        }
        if (cfg.scale !== undefined) img.setScale(cfg.scale);
        this.hudCam.ignore(img);
        this.tileObjects.push(img);
        return img;
      };

      switch (tile.type) {
        case 'wall':
          if (hasWallTex) {
            makeImg(wallKey);
          }
          break;
        case 'mineable':
          if (!tile.broken && this.textures.exists('ore_' + tile.resource)) {
            const img = makeImg('ore_' + tile.resource);
            this.oreImageMap.set(`${x},${y}`, img);
            const tint = this.getDamageTint(tile);
            if (tint !== null) img.setTint(tint);
          }
          break;
        case 'stairs_up':
          if (this.textures.exists('stairs_up')) makeImg('stairs_up');
          break;
        case 'stairs_down':
          if (this.textures.exists('stairs_down')) makeImg('stairs_down');
          break;
        case 'pressure_plate':
          if (!tile.broken && this.textures.exists('pressure_plate')) makeImg('pressure_plate');
          break;
        case 'blocked':
          if (this.textures.exists('blocked')) makeImg('blocked');
          break;
        default:
          if (tile.type === 'event_villager' && !tile.broken) {
            const npcKey = 'npc_' + tile.resource;
            if (this.textures.exists(npcKey)) makeImg(npcKey);
          } else if (tile.type.startsWith('event_') && tile.type !== 'event_boss' && !tile.broken) {
            if (this.textures.exists(tile.type)) makeImg(tile.type);
          } else if (tile.type === 'enemy' && !tile.broken) {
            if (this.textures.exists('enemy_' + tile.resource)) makeImg('enemy_' + tile.resource);
          } else if (tile.type === 'event_boss' && !tile.broken) {
            if (this.textures.exists('enemy_boss')) {
              const img = makeImg('enemy_boss');
              img.setDepth(6 + y * 0.002 + x * 0.001 + 0.003);
            }
          }
          break;
      }
    }
  }

  private updateFacingHighlight(): void {
    this.facingHighlight.clear();
    this.selectedObject.clear();
    if (this.previewTile) { this.previewTile.destroy(); this.previewTile = null; }
    this.facingOutlineImages.forEach(img => img.destroy());
    this.facingOutlineImages = [];
    const floor = this.currentFloor;
    if (!floor) return;
    const tx = this.playerX + this.facingX;
    const ty = this.playerY + this.facingY;
    if (tx < 0 || tx >= floor.cols || ty < 0 || ty >= floor.rows) return;
    const tile = floor.tiles[ty][tx];
    if (tile.type === 'floor' || tile.type === 'corridor' || tile.type === 'wall') return;
    if (tile.broken) return;
    const p = gridToIso(tx, ty);

    drawDiamondAt(this.selectedObject, tx, ty, 0xffffff, 0.3);

    let texKey = '';
    switch (tile.type) {
      case 'mineable': texKey = 'ore_' + tile.resource; break;
      case 'stairs_up': texKey = 'stairs_up'; break;
      case 'stairs_down': texKey = 'stairs_down'; break;
      case 'pressure_plate': texKey = 'pressure_plate'; break;
      case 'blocked': texKey = 'blocked'; break;
      case 'enemy': texKey = 'enemy_' + tile.resource; break;
      case 'event_boss':
      case 'boss_body': texKey = 'enemy_boss'; break;
      case 'event_villager': texKey = 'npc_' + tile.resource; break;
      default:
        if (tile.type.startsWith('event_')) texKey = tile.type;
        break;
    }

    if (texKey && this.textures.exists(texKey)) {
      let previewX = p.x;
      let previewY = p.y;
      if (tile.type === 'boss_body') {
        const center = this.findBossCenter(tx, ty);
        if (center) {
          const cp = gridToIso(center.x, center.y);
          previewX = cp.x;
          previewY = cp.y;
        }
      }
      const previewCfg = getSpriteConfig(texKey);
      previewX += previewCfg.offsetX ?? 0;
      previewY += previewCfg.offsetY ?? 0;
      this.previewTile = this.add.image(previewX, previewY, texKey).setDepth(DEPTH.PREVIEW_TILE);
      this.hudCam.ignore(this.previewTile);
      if (previewCfg.originX !== undefined || previewCfg.originY !== undefined) {
        this.previewTile.setOrigin(previewCfg.originX ?? 0.5, previewCfg.originY ?? 0.5);
      }
      if (previewCfg.scale !== undefined) this.previewTile.setScale(previewCfg.scale);
      if (tile.type === 'mineable') {
        if (tile.maxDurability > 0) {
          const ratio = tile.durability / tile.maxDurability;
          if (ratio <= 0.33) {
            this.previewTile.setTint(0x777777);
          } else if (ratio <= 0.66) {
            this.previewTile.setTint(0xaaaaaa);
          }
        }
      }

      const dirs: [number, number][] = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
      const s = this.previewTile.scaleX;
      for (let t = 1; t <= 3; t++) {
        const alpha = t === 1 ? 0.85 : t === 2 ? 0.4 : 0.12;
        for (const [dx, dy] of dirs) {
          const img = this.add.image(previewX + dx * t, previewY + dy * t, texKey)
            .setDepth(DEPTH.PREVIEW_TILE - 0.05)
            .setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
            .setAlpha(alpha);
          if (s !== 1) img.setScale(s);
          this.hudCam.ignore(img);
          this.facingOutlineImages.push(img);
        }
      }
    }
  }


  private createPlayer(): void {
    const p = gridToIso(this.playerX, this.playerY);
    const cfg = getSpriteConfig('player_bottom_left');
    this.playerSprite = this.add.image(
      p.x + (cfg.offsetX ?? 0),
      p.y + (cfg.offsetY ?? 0),
      'player_bottom_left',
    ).setDepth(playerDepth(this.playerX, this.playerY));
    this.hudCam.ignore(this.playerSprite);
    if (cfg.originX !== undefined || cfg.originY !== undefined) {
      this.playerSprite.setOrigin(cfg.originX ?? 0.5, cfg.originY ?? 0.5);
    }
    if (cfg.scale !== undefined) this.playerSprite.setScale(cfg.scale);
    this.player = this.playerSprite as unknown as Phaser.GameObjects.Container;
    this.updatePlayerSprite();
  }

  private updatePlayerSprite(): void {
    if (!this.playerSprite) return;
    const isUpFacing = this.facingY < 0 || (this.facingY === 0 && this.facingX < 0);

    let baseKey: string;
    if (this.isMining) {
      baseKey = isUpFacing ? 'player_top_right_mining' : 'player_bottom_left_mining';
    } else {
      baseKey = isUpFacing ? 'player_top_right' : 'player_bottom_left';
    }

    const key = `${baseKey}_${this.animFrame}`;
    const flipX = this.facingX !== 0 && this.facingY === 0;
    if (this.textures.exists(key)) {
      this.playerSprite.setTexture(key);
      this.playerSprite.setFlipX(flipX);
    }
  }

  private repositionPlayer(): void {
    const p = gridToIso(this.playerX, this.playerY);
    const cfg = getSpriteConfig('player_bottom_left');
    this.player.setPosition(p.x + (cfg.offsetX ?? 0), p.y + (cfg.offsetY ?? 0));
    this.player.setDepth(playerDepth(this.playerX, this.playerY));
  }

  private revealSurroundings(): void {
    const floor = this.currentFloor;
    if (!floor) return;
    const depth = this.expeditionState.depth;
    const isDarkFloor = depth > 0 && depth % 5 === 3;
    let radius = 8;
    if (isDarkFloor) {
      const px = gameState.getLanternRange(depth);
      radius = Math.floor(px / 45) || 1;
    }
    this.expeditionState.reveal(this.playerX, this.playerY, radius);
    this.drawMinimap();
  }

  private createHUD(): void {
    // === TOP-LEFT: Stamina Block (portrait + bar + value) ===
    this.staminaBg = this.add.graphics();
    this.staminaBg.fillStyle(0x0a0a1a, 0.75);
    this.staminaBg.fillRoundedRect(4, 4, VW - 8, 68, 6);
    this.staminaBg.setScrollFactor(0).setDepth(211);
    this.cameras.main.ignore(this.staminaBg);

    this.portraitSprite = this.add.image(42, VH, 'portrait')
      .setScrollFactor(0).setDepth(213);
    this.cameras.main.ignore(this.portraitSprite);
    this.portraitSprite.setCrop(54, 0, 108, 108);
    this.portraitSprite.setDisplaySize(200, 200);
    this.portraitSprite.setFlipX(true);
    this.portraitSprite.setY(88);

    this.staminaBarGfx = this.add.graphics().setScrollFactor(0).setDepth(212);
    this.cameras.main.ignore(this.staminaBarGfx);

    this.staminaValueText = this.add.text(VW - 8, 10, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(211);
    this.cameras.main.ignore(this.staminaValueText);

    this.drawStaminaBar();

    // === BOTTOM-CENTER: Depth ===
    this.depthTextCentered = this.add.text(CX, VH - 36, `Depth: ${this.expeditionState.depth}`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD);
    this.cameras.main.ignore(this.depthTextCentered);

    // === LEFT-TOP: Pickaxe Block (below stamina) ===
    const pickBg = this.add.graphics();
    pickBg.fillStyle(0x0a0a1a, 0.75);
    pickBg.fillRoundedRect(4, 78, 80, 42, 4);
    pickBg.setScrollFactor(0).setDepth(DEPTH.HUD_BG);
    this.cameras.main.ignore(pickBg);

    const tier = gameState.currentPickaxeTier;
    this.pickaxeSprite = this.add.image(30, 99, `item_pickaxe_${tier}`)
      .setScrollFactor(0).setDepth(DEPTH.HUD);
    this.cameras.main.ignore(this.pickaxeSprite);
    this.pickaxeRing = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.HUD + 1);
    this.cameras.main.ignore(this.pickaxeRing);
    this.pickaxeUsesText = this.add.text(66, 99, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#cccccc', align: 'center',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH.HUD);
    this.cameras.main.ignore(this.pickaxeUsesText);

    this.drawPickaxeRing();

    // === BOTTOM-LEFT: Inventory Button ===
    const invBg = this.add.graphics();
    invBg.fillStyle(0x0a0a1a, 0.75);
    invBg.fillRoundedRect(6, VH - 78, 68, 72, 6);
    invBg.setScrollFactor(0).setDepth(DEPTH.HUD_BG);
    this.cameras.main.ignore(invBg);

    const invCx = 40;
    const invCy = VH - 42;
    this.invBtnSprite = this.add.image(invCx, invCy - 4, 'item_inventory_bag')
      .setScrollFactor(0).setDepth(DEPTH.HUD);
    this.cameras.main.ignore(this.invBtnSprite);
    this.invBtnRing = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.HUD + 1);
    this.cameras.main.ignore(this.invBtnRing);
    this.invSlotText = this.add.text(invCx, invCy + 16, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#cccccc', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD);
    this.cameras.main.ignore(this.invSlotText);

    const invZone = this.add.rectangle(invCx, invCy, 64, 52, 0x000000, 0)
      .setScrollFactor(0).setDepth(DEPTH.CLICK_ZONES).setInteractive({ useHandCursor: true }).setData('isUI', true);
    this.cameras.main.ignore(invZone);
    invZone.on('pointerdown', () => {
      if (this.isModalActive) return;
      this.inventoryPanel.refresh();
      this.analog.reset();
      this.inventoryPanel.toggle();
    });

    this.drawInventoryButton();

    // === BOTTOM-RIGHT: Action Buttons ===

    // Escape (above minimap)
    this.escapeSprite = this.add.image(0, 0, 'item_teleport_scroll')
      .setScrollFactor(0).setDepth(DEPTH.HUD).setInteractive({ useHandCursor: true }).setData('isUI', true);
    this.cameras.main.ignore(this.escapeSprite);
    this.escapeSprite.on('pointerdown', () => {
      if (this.isModalActive) return;
      if (this.inventory.count('teleport_scroll') > 0) {
        this.tryUseConsumable('teleport_scroll');
      } else {
        this.emergencyExtract();
      }
    });
    this.escapeLabel = this.add.text(0, 0, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#cccccc',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD);
    this.cameras.main.ignore(this.escapeLabel);

    // Potion
    this.potionImg = this.add.image(0, 0, 'item_stamina_potion')
      .setScrollFactor(0).setDepth(DEPTH.HUD).setInteractive({ useHandCursor: true }).setData('isUI', true);
    this.cameras.main.ignore(this.potionImg);
    this.potionImg.on('pointerdown', () => {
      if (this.isModalActive) return;
      this.tryUseConsumable('stamina_potion');
    });
    this.potionCountText = this.add.text(0, 0, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffdd88',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.HUD);
    this.cameras.main.ignore(this.potionCountText);

    // Bomb
    this.bombImg = this.add.image(0, 0, 'item_mining_bomb')
      .setScrollFactor(0).setDepth(DEPTH.HUD).setInteractive({ useHandCursor: true }).setData('isUI', true);
    this.cameras.main.ignore(this.bombImg);
    this.bombImg.on('pointerdown', () => {
      if (this.isModalActive) return;
      this.tryUseConsumable('mining_bomb');
    });
    this.bombCountText = this.add.text(0, 0, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffdd88',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(DEPTH.HUD);
    this.cameras.main.ignore(this.bombCountText);

    // Loadout consumables
    for (const [id, qty] of Object.entries(this.loadoutConsumables)) {
      if (qty > 0) this.giveItem(id, qty);
    }
    if (this.debugMode) {
      this.giveItem('stamina_potion', 5);
      this.giveItem('mining_bomb', 5);
    }

    this.updateActionButtons();
    this.createActionButton();
  }

  private createActionButton(): void {
    const x = CX, y = VH - 90, size = 64;
    this.actionBtnBg = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.HUD);
    this.cameras.main.ignore(this.actionBtnBg);
    this.actionBtnText = this.add.text(x, y, '', {
      fontSize: '24px', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.HUD + 1);
    this.cameras.main.ignore(this.actionBtnText);

    const hit = this.add.rectangle(x, y, size, size, 0x000000, 0)
      .setScrollFactor(0).setDepth(DEPTH.HUD + 2).setData('isUI', true);
    this.cameras.main.ignore(hit);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.handleActionButton());
  }

  private updateActionButton(): void {
    const bx = CX - 32, by = VH - 122;
    const show = (icon: string, color: string) => {
      this.actionBtnBg.clear();
      this.actionBtnBg.fillStyle(0x0a0a1a, 0.75);
      this.actionBtnBg.fillRoundedRect(bx, by, 64, 64, 10);
      this.actionBtnBg.lineStyle(2, Phaser.Display.Color.HexStringToColor(color).color, 0.6);
      this.actionBtnBg.strokeRoundedRect(bx, by, 64, 64, 10);
      this.actionBtnText.setText(icon).setColor(color);
    };
    const hide = () => {
      this.actionBtnBg.clear();
      this.actionBtnText.setText('');
    };

    // Combat — strike or collect (allowed even though isModalActive is true)
    if (this.combatActive) {
      if (this.combatPanel.getResult() === 'victory') {
        show('↓', '#44cc66');
      } else {
        show('⚔', '#ff6644');
      }
      return;
    }

    // Other modals active — hide button
    if (this.isModalActive) { hide(); return; }

    // Interact target (stairs, enemies, events)
    if (this.interactTarget) {
      const floor = this.currentFloor;
      const tile = floor?.tiles[this.interactTarget.y]?.[this.interactTarget.x];
      if (this.interactTarget.id === 'ascend') { show('↑', '#44cc66'); return; }
      if (this.interactTarget.id === 'descend') { show('↓', '#8866cc'); return; }
      if (tile && (tile.type === 'enemy' || tile.type === 'event_boss') && !tile.broken) { show('⚔', '#ff6644'); return; }
      if (tile?.type === 'event_villager') { show('✨', '#ffdd88'); return; }
      show('💬', '#88ccff');
      return;
    }

    // Facing mineable
    const floor2 = this.currentFloor;
    if (floor2) {
      const tx = this.playerX + this.facingX;
      const ty = this.playerY + this.facingY;
      if (tx >= 0 && tx < floor2.cols && ty >= 0 && ty < floor2.rows) {
        const tile = floor2.tiles[ty][tx];
        if (tile.type === 'mineable' && !tile.broken) { show('⛏', '#ffcc44'); return; }
      }
    }

    hide();
  }

  private handleActionButton(): void {
    // Combat: strike or collect (allowed even though isModalActive is true)
    if (this.combatActive) {
      if (this.combatPanel.getResult() === 'victory') {
        this.combatPanel.handleCollect();
      } else {
        const result = this.combatPanel.handleStrike();
        if (result === 'miss') {
          this.stamina.consume(10);
          this.tweens.add({
            targets: [this.staminaBg, this.portraitSprite, this.staminaBarGfx, this.staminaValueText],
            x: { value: '+=' + 5 },
            duration: 25, yoyo: true, repeat: 3, ease: 'Sine.easeInOut',
          });
        }
      }
      return;
    }

    // Other modals (event, gamble, stair, exhaustion) — button hidden, ignore taps
    if (this.isModalActive) return;

    // Interact target (same logic as update() lines 1118-1135)
    if (this.interactTarget) {
      this.movePath = [];
      this.analog.reset();
      if (this.interactTarget.id === 'ascend') { this.handleAscend(); return; }
      if (this.interactTarget.id === 'descend') { this.handleDescend(); return; }
      const tile = this.currentFloor?.tiles[this.interactTarget.y]?.[this.interactTarget.x];
      if (tile && (tile.type === 'enemy' || tile.type === 'event_boss') && !tile.broken) {
        if (this.stamina.remaining > 10) this.startCombat(this.interactTarget.x, this.interactTarget.y, tile);
      } else {
        this.triggerTileEvent(this.interactTarget.x, this.interactTarget.y, this.interactTarget.id);
      }
      return;
    }

    // Facing tile: try mine
    this.tryMine();
  }

  private drawMinimap(): void {
    const floor = this.currentFloor;
    if (!floor) return;

    const cell = 1.5;
    const mapW = floor.cols * cell;
    const mapH = floor.rows * cell;
    const mapX = VW - mapW - 6;
    const mapY = 80;

    this.minimapBg.clear();
    this.minimapGfx.clear();

    this.minimapBg.fillStyle(0x0a0a1a, 0.6);
    this.minimapBg.fillRoundedRect(mapX - 2, mapY - 2, mapW + 4, mapH + 4, 3);

    for (let y = 0; y < floor.rows; y++) {
      for (let x = 0; x < floor.cols; x++) {
        if (!this.expeditionState.explored[y]?.[x]) continue;
        const tile = floor.tiles[y][x];
        const px = mapX + x * cell;
        const py = mapY + y * cell;

        switch (tile.type) {
          case 'wall':
            this.minimapGfx.fillStyle(0x3a3a4a, 1);
            break;
          case 'mineable':
            if (!tile.broken) {
              this.minimapGfx.fillStyle(0x6a5a3a, 1);
            } else {
              this.minimapGfx.fillStyle(0x1a1a2a, 1);
            }
            break;
          case 'stairs_up':
            this.minimapGfx.fillStyle(0x44cc66, 1);
            break;
          case 'stairs_down':
            this.minimapGfx.fillStyle(0x8866cc, 1);
            break;
          default:
            if ((tile.type === 'enemy' || tile.type === 'event_boss' || tile.type === 'boss_body') && !tile.broken) {
              this.minimapGfx.fillStyle(0xcc4444, 1);
            } else if (tile.type.startsWith('event_') && !tile.broken) {
              this.minimapGfx.fillStyle(0xccaa44, 1);
            } else {
              this.minimapGfx.fillStyle(0x1a1a2a, 1);
            }
            break;
        }
        if (this.expeditionState.depth % 5 === 3 && !this.expeditionState.visible[y]?.[x]) {
          this.minimapGfx.fillStyle(0x0a0a1a, 0.35);
        }
        this.minimapGfx.fillRect(px, py, cell, cell);
      }
    }

    this.minimapDot.setPosition(mapX + this.playerX * cell + cell / 2, mapY + this.playerY * cell + cell / 2);

    this.minimapX = mapX;
    this.minimapY = mapY;
    this.minimapW = mapW;
    this.minimapH = mapH;
    this.repositionActionButtons();
  }

  private updateMinimapDot(): void {
    const floor = this.currentFloor;
    if (!floor) return;
    const cell = 1.5;
    const mapW = floor.cols * cell;
    const mapH = floor.rows * cell;
    const mapX = VW - mapW - 6;
    const mapY = 80;
    this.minimapDot.setPosition(mapX + this.playerX * cell + cell / 2, mapY + this.playerY * cell + cell / 2);
  }

  private drawStaminaBar(): void {
    this.staminaBarGfx.clear();

    const x = 80;
    const y = 32;
    const w = VW - 100;
    const h = 24;
    const ratio = this.stamina.ratio;

    this.staminaBarGfx.fillStyle(0x2a1a1a, 1);
    this.staminaBarGfx.fillRoundedRect(x, y, w, h, 3);

    const color = ratio > 0.5 ? 0x44cc66 : ratio > 0.25 ? 0xccaa44 : 0xcc4444;
    this.staminaBarGfx.fillStyle(color, 1);
    this.staminaBarGfx.fillRoundedRect(x + 1, y + 1, (w - 2) * ratio, h - 2, 2);

    this.staminaValueText.setText(`${this.stamina.remaining}/${this.stamina.maxStamina}`);
  }

  private drawInventoryButton(): void {
    this.invBtnRing.clear();

    const used = this.inventory.capacityUsed();
    const max = this.inventory.capacityMax();
    const ratio = max > 0 ? used / max : 0;

    const cx = 40;
    const cy = VH - 42;
    const radius = 16;
    const color = ratio <= 0.75 ? 0x44cc66 : ratio <= 0.9 ? 0xccaa44 : 0xcc4444;

    this.invBtnRing.lineStyle(2, color, 1);
    this.invBtnRing.beginPath();
    this.invBtnRing.arc(cx, cy, radius, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * Math.min(ratio, 1), false);
    this.invBtnRing.strokePath();

    this.invSlotText.setText(`${used}/${max}`);
  }

  private drawPickaxeRing(): void {
    this.pickaxeRing.clear();

    const pickCx = 30;
    const pickCy = 99;
    const radius = 14;
    const tier = gameState.currentPickaxeTier;
    const runsLeft = gameState.remainingPickaxeRuns(tier);
    const maxRuns = 5;
    const ratio = tier > 1 && runsLeft >= 0 ? runsLeft / maxRuns : 1;
    const color = ratio > 0.4 ? 0x44cc66 : ratio > 0.2 ? 0xccaa44 : 0xcc4444;

    this.pickaxeRing.lineStyle(2, color, 1);
    this.pickaxeRing.beginPath();
    this.pickaxeRing.arc(pickCx, pickCy, radius, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * Math.min(ratio, 1), false);
    this.pickaxeRing.strokePath();

    this.pickaxeUsesText.setText(tier > 1 && runsLeft >= 0 ? `${runsLeft}/${maxRuns}` : '∞');
  }

  private updateActionButtons(): void {
    const potionCount = this.inventory.count('stamina_potion');
    const bombCount = this.inventory.count('mining_bomb');
    const hasScroll = this.inventory.count('teleport_scroll') > 0;

    this.potionCountText.setText(potionCount > 0 ? `${potionCount}` : '');
    this.bombCountText.setText(bombCount > 0 ? `${bombCount}` : '');

    if (hasScroll) {
      this.escapeSprite.setTexture('item_teleport_scroll');
      this.escapeSprite.setTint(0xffffff);
      this.escapeLabel.setText('Teleport');
      this.escapeLabel.setColor('#88ccff');
    } else {
      this.escapeSprite.setTexture('item_teleport_scroll');
      this.escapeSprite.setTint(0xff4444);
      this.escapeLabel.setText('Give Up');
      this.escapeLabel.setColor('#cc6666');
    }

    const dimmed = this.isModalActive ? 0.3 : 1;
    this.potionImg.setAlpha(dimmed);
    this.bombImg.setAlpha(dimmed);
    this.escapeSprite.setAlpha(dimmed);
    this.potionCountText.setAlpha(dimmed);
    this.bombCountText.setAlpha(dimmed);
    this.escapeLabel.setAlpha(dimmed);
  }

  private repositionActionButtons(): void {
    // Bottom-right vertical stack: potion → bomb → escape
    const cx = VW - 40;
    this.potionImg.setPosition(cx, VH - 130);
    this.potionCountText.setPosition(this.potionImg.x + 14, this.potionImg.y - 14);

    this.bombImg.setPosition(cx, VH - 88);
    this.bombCountText.setPosition(this.bombImg.x + 14, this.bombImg.y - 14);

    this.escapeSprite.setPosition(cx, VH - 46);
    this.escapeLabel.setPosition(this.escapeSprite.x, this.escapeSprite.y + 16);
  }

  private setupInput(): void {
    this.keys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      UP: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      DOWN: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      LEFT: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      RIGHT: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      SPACE: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      ESC: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      TAB: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TAB),
      Q: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      E: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      F: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      Z: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
    };
  }

  private get isModalActive(): boolean {
    return this.combatActive || this.eventActive
      || this.inventoryPanel.isVisible() || this.gamblePanel.isVisible()
      || !!this.stairAction || this.exhausted;
  }

  private isPointerOverUI(pointer: Phaser.Input.Pointer): boolean {
    const hits = this.input.hitTestPointer(pointer);
    return hits.some(obj => (obj as Phaser.GameObjects.GameObject).getData?.('isUI'));
  }

  private setupPointerInput(): void {
    this.analog = new AnalogStickInput(this, {
      depth: DEPTH.ANALOG,
      isModal: () => this.isModalActive,
      isPointerOverUI: (p) => this.isPointerOverUI(p),
      onDragStart: () => { this.movePath = []; },
      onGfxCreated: (gfx) => this.cameras.main.ignore(gfx),
      onClick: (worldX, worldY) => {
        const floor = this.currentFloor;
        if (floor) {
          const g = isoToGrid(worldX, worldY);
          if (g.x >= 0 && g.x < floor.cols && g.y >= 0 && g.y < floor.rows) {
            const tx = this.playerX + this.facingX;
            const ty = this.playerY + this.facingY;
            if (g.x === tx && g.y === ty) {
              const tile = floor.tiles[ty][tx];
    const interactive = this.isBlocked(tile)
      || tile.type === 'stairs_down' || tile.type === 'stairs_up' || tile.type === 'pressure_plate';
              
              if (interactive) {
                this.movePath = [];
                this.analog.reset();
                if (tile.type === 'mineable' && !tile.broken) {
                  this.tryMine();
                } else if (tile.type === 'enemy' || tile.type === 'event_boss') {
                  if (!tile.broken && this.stamina.remaining > 10) {
                    this.startCombat(tx, ty, tile);
                  }
                } else if (tile.type === 'boss_body') {
                  const center = this.findBossCenter(tx, ty);
                  if (center) {
                    const bossTile = floor.tiles[center.y][center.x];
                    if (!bossTile.broken && this.stamina.remaining > 10) {
                      this.startCombat(center.x, center.y, bossTile);
                    }
                  }
                } else if (tile.type.startsWith('event_')) {
                  if (!tile.broken) {
                    this.triggerTileEvent(tx, ty, tile.eventId);
                  }
                } else if (tile.type === 'stairs_down' || tile.type === 'stairs_up') {
                  this.checkEventProximity();
                } else if (tile.type === 'pressure_plate') {
                  this.tryMove(this.facingX, this.facingY);
                }
                return;
              }
            }
          }
          this.doClickToMove(worldX, worldY, floor);
        }
      },
    });
  }

  private doClickToMove(worldX: number, worldY: number, floor: DungeonFloor): void {
    const g = isoToGrid(worldX, worldY);
    if (g.x < 0 || g.x >= floor.cols || g.y < 0 || g.y >= floor.rows) return;
    if (g.x === this.playerX && g.y === this.playerY) return;

    const tile = floor.tiles[g.y][g.x];
    const blocked = this.isBlocked(tile);

    const interactive = blocked || tile.type === 'stairs_down' || tile.type === 'stairs_up' || tile.type === 'pressure_plate';

    const fdx = Math.sign(g.x - this.playerX);
    const fdy = Math.sign(g.y - this.playerY);
    let faceX = fdx;
    let faceY = fdy;
    if (fdx !== 0 && fdy !== 0) {
      if (Math.abs(g.x - this.playerX) > Math.abs(g.y - this.playerY)) {
        faceY = 0;
      } else {
        faceX = 0;
      }
    }
    this.facingX = faceX;
    this.facingY = faceY;
    this.updatePlayerSprite();
    this.updateFacingHighlight();

    if (interactive) {
      const walkable = (x: number, y: number) => {
        if (x === this.playerX && y === this.playerY) return true;
        const t = floor.tiles[y][x];
        if (t.type === 'wall' || t.type === 'blocked' || t.type === 'boss_body') return false;
        if (t.type === 'mineable' && !t.broken) return false;
        if ((t.type === 'enemy' || t.type === 'event_boss') && !t.broken) return false;
        if (t.type.startsWith('event_') && !t.broken) return false;
        return true;
      };
      let bestPath = findPath(this.playerX, this.playerY, g.x, g.y, floor.cols, floor.rows, walkable);
      if (!bestPath) {
        const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dx, dy] of dirs) {
          const ax = g.x + dx, ay = g.y + dy;
          if (ax < 0 || ax >= floor.cols || ay < 0 || ay >= floor.rows) continue;
          if (!walkable(ax, ay)) continue;
          const p = findPath(this.playerX, this.playerY, ax, ay, floor.cols, floor.rows, walkable);
          if (p && (!bestPath || p.length < bestPath.length)) bestPath = p;
        }
      }
      if (bestPath && bestPath.length > 0) this.movePath = bestPath;
      return;
    }

    const path = findPath(
      this.playerX, this.playerY,
      g.x, g.y,
      floor.cols, floor.rows,
      (x, y) => {
        if (x === this.playerX && y === this.playerY) return true;
        const t = floor.tiles[y][x];
        if (t.type === 'wall' || t.type === 'blocked' || t.type === 'boss_body') return false;
        if (t.type === 'mineable' && !t.broken) return false;
        if ((t.type === 'enemy' || t.type === 'event_boss') && !t.broken) return false;
        if (t.type.startsWith('event_') && !t.broken) return false;
        return true;
      },
    );

    if (path && path.length > 0) {
      this.movePath = path;
    }
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.TAB)) {
      this.inventoryPanel.refresh();
      if (this.inventoryPanel.isVisible()) {
        this.inventoryPanel.hide();
      } else {
        this.analog.reset();
        this.inventoryPanel.show();
      }
      return;
    }

    if (this.inventoryPanel.isVisible()) {
      this.inventoryPanel.draw();
      if (Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.keys.UP)) {
        this.inventoryPanel.handleInput('UP');
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.S) || Phaser.Input.Keyboard.JustDown(this.keys.DOWN)) {
        this.inventoryPanel.handleInput('DOWN');
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.Z)) {
        this.inventoryPanel.handleInput('Z');
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        this.inventoryPanel.handleInput('SPACE');
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.ESC) || Phaser.Input.Keyboard.JustDown(this.keys.TAB)) {
        if (!this.inventory.overCapacity()) {
          this.inventoryPanel.hide();
        }
      }
      return;
    }

    if (this.inventory.overCapacity()) {
      if (!this.inventoryPanel.isVisible()) {
        this.inventoryPanel.refresh();
        this.analog.reset();
        this.inventoryPanel.show();
      }
      return;
    }

    if (this.combatActive) {
      if (this.stamina.remaining <= 10 && this.combatPanel.getResult() !== 'victory') {
        this.combatPanel.handleRetreat();
        return;
      }

      if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        if (this.combatPanel.getResult() === 'victory') {
          this.combatPanel.handleCollect();
        } else {
          const result = this.combatPanel.handleStrike();
          if (result === 'miss') {
            this.stamina.consume(10);
            this.tweens.add({
              targets: [this.staminaBg, this.portraitSprite, this.staminaBarGfx, this.staminaValueText],
              x: { value: '+=' + 5 },
              duration: 25,
              yoyo: true,
              repeat: 3,
              ease: 'Sine.easeInOut',
            });
          }
        }
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        this.combatPanel.handleRetreat();
      }
      this.drawStaminaBar();
      return;
    }

    if (this.eventActive) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.keys.UP)) {
        this.eventPanel.navigateUp();
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.S) || Phaser.Input.Keyboard.JustDown(this.keys.DOWN)) {
        this.eventPanel.navigateDown();
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        this.eventPanel.confirm();
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC) || Phaser.Input.Keyboard.JustDown(this.keys.TAB)) {
        this.eventPanel.hide();
        this.eventActive = false;
      }
      return;
    }

    if (this.gamblePanel.isVisible()) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        this.gamblePanel.onPress();
      }
      return;
    }

    if (this.stairAction) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        const action = this.stairAction;
        this.hideStairPrompt();
        this.stairAction = null;
        this.playerX = this.stairTargetX;
        this.playerY = this.stairTargetY;
        if (action === 'ascend') {
          this.handleAscend();
        } else {
          this.handleDescend();
        }
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        this.hideStairPrompt();
        this.stairAction = null;
        this.interactTarget = null;
        this.interactPrompt.setAlpha(0);
        this.stairDismissCell = { x: this.playerX, y: this.playerY };
      }
      return;
    }

    this.moveTimer += delta;

    if (this.exhausted) return;

    this.checkEventProximity();

    if (this.interactTarget && Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.movePath = [];
      this.analog.reset();
      if (this.interactTarget.id === 'ascend') {
        this.handleAscend();
        return;
      } else if (this.interactTarget.id === 'descend') {
        this.handleDescend();
        return;
      }
      const tile = this.currentFloor?.tiles[this.interactTarget.y]?.[this.interactTarget.x];
      if (tile && (tile.type === 'enemy' || tile.type === 'event_boss') && !tile.broken) {
        if (this.stamina.remaining > 10) {
          this.startCombat(this.interactTarget.x, this.interactTarget.y, tile);
        }
      } else {
        this.triggerTileEvent(this.interactTarget.x, this.interactTarget.y, this.interactTarget.id);
      }
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) { this.movePath = []; this.analog.reset(); this.tryUseConsumable('stamina_potion'); return; }
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) { this.movePath = []; this.analog.reset(); this.tryUseConsumable('teleport_scroll'); return; }
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) { this.movePath = []; this.analog.reset(); this.tryUseConsumable('mining_bomb'); return; }

    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.movePath = [];
      this.analog.reset();
      this.emergencyExtract();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      if (this.isMining) return;
      this.movePath = [];
      this.analog.reset();
      this.tryMine();
      return;
    }

    if (this.moveTimer >= this.moveDelay) {
      let dx = 0;
      let dy = 0;

      const kbA = this.keys.A.isDown || this.keys.LEFT.isDown;
      const kbD = this.keys.D.isDown || this.keys.RIGHT.isDown;
      const kbW = this.keys.W.isDown || this.keys.UP.isDown;
      const kbS = this.keys.S.isDown || this.keys.DOWN.isDown;

      if (kbA || kbD || kbW || kbS) {
        this.movePath = [];
        this.analog.reset();
        if (kbA) dx = -1;
        else if (kbD) dx = 1;
        if (kbW) dy = -1;
        else if (kbS) dy = 1;
      } else if (this.analog.active && (this.analog.dx !== 0 || this.analog.dy !== 0)) {
        dx = this.analog.dx;
        dy = this.analog.dy;
      } else if (this.movePath.length > 0) {
        const next = this.movePath.shift()!;
        dx = next.x - this.playerX;
        dy = next.y - this.playerY;
      }

      if (dx !== 0 && dy !== 0) dy = 0;

      if (dx !== 0 || dy !== 0) {
        this.facingX = dx;
        this.facingY = dy;
        this.updatePlayerSprite();
        this.tryMove(dx, dy);
        this.updateFacingHighlight();
        this.moveTimer = 0;
      }
    }

    if (this.isMining) {
      this.animTimer += delta;
      const mineInterval = gameState.getResearchLevel('excavation_mastery') >= 1 ? 40 : 80;
      if (this.animTimer >= mineInterval) {
        this.animTimer = 0;
        this.animFrame++;
        if (this.animFrame > 2) {
          this.animFrame = 0;
          this.isMining = false;
          if (this.pendingMineTx >= 0) {
            this.executeMine(this.pendingMineTx, this.pendingMineTy);
            this.pendingMineTx = -1;
            this.pendingMineTy = -1;
          }
        }
        this.updatePlayerSprite();
      }
    } else if (this.isMoving) {
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

    this.drawStaminaBar();
    this.drawInventoryButton();
    this.updateActionButtons();
    this.updateActionButton();
    this.drawPickaxeRing();
    this.updateDarkness();
  }

  private checkEventProximity(): void {
    const floor = this.currentFloor;
    if (!floor) return;

    const curTile = floor.tiles[this.playerY][this.playerX];
    const onStairs = (curTile.type === 'stairs_up' || curTile.type === 'stairs_down') && !curTile.broken;

    if (!onStairs) {
      this.stairDismissCell = null;
    }

    if (onStairs && !this.stairAction && !this.floorEntry) {
      const dismissed = this.stairDismissCell && this.stairDismissCell.x === this.playerX && this.stairDismissCell.y === this.playerY;
      if (!dismissed) {
        this.interactTarget = null;
        this.interactPrompt.setAlpha(0);
        this.stairTargetX = this.playerX;
        this.stairTargetY = this.playerY;
        this.stairAction = curTile.type === 'stairs_up' ? 'ascend' : 'descend';
        this.showStairPrompt();
        return;
      }
    }

    const tx = this.playerX + this.facingX;
    const ty = this.playerY + this.facingY;
    if (tx < 0 || tx >= floor.cols || ty < 0 || ty >= floor.rows) {
      this.interactTarget = null;
      this.interactPrompt.setAlpha(0);
      return;
    }

    const tile = floor.tiles[ty][tx];
    if (tile.type === 'enemy' && !tile.broken) {
      this.interactTarget = { x: tx, y: ty, id: tile.eventId };
      if (this.stamina.remaining <= 10) {
        this.interactPrompt.setText('Not enough stamina!');
      } else {
        this.interactPrompt.setText('[SPACE] Fight!');
      }
      this.interactPrompt.setPosition(this.player.x, this.player.y - 30);
      this.interactPrompt.setAlpha(1);
      return;
    }
    if ((tile.type === 'event_boss' || tile.type === 'boss_body') && !tile.broken) {
      let bossX = tx;
      let bossY = ty;
      if (tile.type === 'boss_body') {
        const center = this.findBossCenter(tx, ty);
        if (!center) { this.interactTarget = null; this.interactPrompt.setAlpha(0); return; }
        bossX = center.x;
        bossY = center.y;
      }
      this.interactTarget = { x: bossX, y: bossY, id: 'boss' };
      if (this.stamina.remaining <= 10) {
        this.interactPrompt.setText('Not enough stamina!');
      } else {
        this.interactPrompt.setText('[SPACE] Face the Boss!');
      }
      this.interactPrompt.setPosition(this.player.x, this.player.y - 30);
      this.interactPrompt.setAlpha(1);
      return;
    }
    if (tile.type.startsWith('event_') && !tile.broken) {
      this.interactTarget = { x: tx, y: ty, id: tile.eventId };
      const labels: Record<string, string> = {
        event_chest: '[SPACE] Open chest',
        event_merchant: '[SPACE] Talk to merchant',
        event_goblin: '[SPACE] Talk to goblin',
        event_villager: '[SPACE] Rescue villager',
        event_fountain: '[SPACE] Drink from fountain',
        event_shop: '[SPACE] Browse wares',
        event_treasure_vault: '[SPACE] Open vault',
        event_relic: '[SPACE] Claim Relic',
      };
      this.interactPrompt.setText(labels[tile.type] ?? '[SPACE] Interact');
      this.interactPrompt.setPosition(this.player.x, this.player.y - 30);
      this.interactPrompt.setAlpha(1);
      return;
    }

    this.interactTarget = null;
    this.interactPrompt.setAlpha(0);
  }

  private triggerTileEvent(tx: number, ty: number, eventId: string): void {
    const floor = this.currentFloor;
    if (!floor) return;

    const tile = floor.tiles[ty][tx];
    if (!tile.type.startsWith('event_') || tile.broken) return;

    this.eventActive = true;

    const config = this.buildEventConfig(eventId);
    if (!config) {
      this.eventActive = false;
      return;
    }

    this.analog.reset();
    this.eventPanel.show(config, () => {
      this.eventActive = false;
      tile.broken = true;
      this.interactTarget = null;
      this.interactPrompt.setAlpha(0);
      this.drawFloor();
      this.drawMinimap();
    });
  }

  private getGambleSegments(depth: number): RouletteSegment[] {
    if (depth <= 4) {
      return [
        { label: 'Stone ×12', weight: 2, color: 0x888888, reward: { id: 'stone', quantity: 12 } },
        { label: 'Stone ×20', weight: 1, color: 0x777777, reward: { id: 'stone', quantity: 20 } },
        { label: 'Bronze ×3', weight: 2, color: 0xcd7f32, reward: { id: 'bronze_ore', quantity: 3 } },
        { label: 'Bronze ×6', weight: 1, color: 0xcc8844, reward: { id: 'bronze_ore', quantity: 6 } },
        { label: 'Silver ×1', weight: 0.5, color: 0xcccccc, reward: { id: 'silver_ore', quantity: 1 } },
        { label: 'Better Luck', weight: 1.5, color: 0x444444 },
        { label: 'Goat!', weight: 1, color: 0x664422 },
      ];
    }
    if (depth <= 9) {
      return [
        { label: 'Bronze ×5', weight: 2, color: 0xcd7f32, reward: { id: 'bronze_ore', quantity: 5 } },
        { label: 'Bronze ×9', weight: 1, color: 0xcc8844, reward: { id: 'bronze_ore', quantity: 9 } },
        { label: 'Silver ×3', weight: 2, color: 0xcccccc, reward: { id: 'silver_ore', quantity: 3 } },
        { label: 'Silver ×6', weight: 1, color: 0xbbbbbb, reward: { id: 'silver_ore', quantity: 6 } },
        { label: 'Better Luck', weight: 1.5, color: 0x444444 },
        { label: 'Goat!', weight: 1.5, color: 0x664422 },
      ];
    }
    return [
      { label: 'Silver ×5', weight: 2, color: 0xcccccc, reward: { id: 'silver_ore', quantity: 5 } },
      { label: 'Silver ×10', weight: 1, color: 0xbbbbbb, reward: { id: 'silver_ore', quantity: 10 } },
      { label: 'Gold ×2', weight: 1.5, color: 0xffd700, reward: { id: 'gold_ore', quantity: 2 } },
      { label: 'Gold ×4', weight: 0.5, color: 0xffaa00, reward: { id: 'gold_ore', quantity: 4 } },
      { label: 'Better Luck', weight: 2, color: 0x444444 },
      { label: 'Goat!', weight: 1, color: 0x664422 },
    ];
  }

  private buildEventConfig(id: string): EventConfig | null {
    const stone = () => this.inventory.count('stone');
    const removeStone = (n: number) => this.inventory.removeItem('stone', n);
    const addItem = (id: string, qty: number) => {
      this.giveItem(id, qty);
      audio.playItemPickup();
    };

    const events: Record<string, () => EventConfig | null> = {
      hidden_treasure: () => {
        const depth = this.expeditionState.depth;
        const pool = ['stone', 'bronze_ore', 'silver_ore', 'gold_ore'];
        const idx = Math.min(depth, pool.length - 1);
        const reward = pool[idx];
        return {
          title: 'Hidden Treasure',
          description: 'You find a hidden cache of resources!',
          choices: [{ label: `Take +3 ${itemDisplayName(reward)}`, action: () => { addItem(reward, 3); } }],
        };
      },

      blessing_fountain: () => ({
        title: 'Blessing Fountain',
        description: 'A mystical fountain pulses with energy. Drinking from it could restore your stamina.',
        choices: [
          { label: 'Drink (+30 Stamina)', action: () => { this.stamina.refill(30); } },
          { label: 'Skip', action: () => {} },
        ],
      }),

      wandering_trader: () => {
        const cost = 5;
        const canTrade = stone() >= cost;
        const knowsScroll = gameState.crafting.isDiscovered('teleport_scroll');
        return {
          title: 'Wandering Trader',
          description: 'A hooded figure offers to trade: 5 Stone for 3 Bronze Ore.',
          choices: [
            {
              label: `Trade 5 Stone → 3 Bronze Ore ${canTrade ? '' : '(not enough stone)'}`,
              action: () => {
                if (stone() >= cost) {
                  removeStone(cost);
                  addItem('bronze_ore', 3);
                  if (!knowsScroll) {
                    gameState.crafting.discover('teleport_scroll');
                    this.showRecipeDiscovery('Teleport Scroll');
                  }
                }
              },
            },
            { label: 'Decline', action: () => {} },
          ],
        };
      },

      trapped_villager: () => {
        const variant = gameState.rescuedVillagers.length;
        const personality = NPC_PERSONALITIES[variant];
        const name = personality?.name ?? `Villager ${variant + 1}`;
        const line = personality?.rescueLine ?? 'Please, help me!';
            const alreadyDiscovered = gameState.crafting.isDiscovered('stamina_potion');
            return {
              title: `Trapped: ${name}`,
              description: `"${line}"`,
              choices: [
                {
                  label: alreadyDiscovered ? 'Rescue (already know recipe)' : 'Rescue (learn Stamina Potion recipe)',
                  action: () => {
                    if (!alreadyDiscovered) {
                      gameState.crafting.discover('stamina_potion');
                      this.showRecipeDiscovery('Stamina Potion');
                    }
                    const depth = this.expeditionState.depth;
                    gameState.rescuedVillagers.push({ variant, rescuedAtDepth: depth, name, talkCount: 0 });
                    gameState.villagerRescueFloors.add(depth);
                    gameState.villagersRescued++;
                    gameState.runVillagersRescued.push({ variant, name });
                gameState.save();
                this.createPopup(`Rescued: ${name}!`, this.cameras.main.width / 2, 300, '#44cc66');
              },
            },
            { label: 'Leave them', action: () => {} },
          ],
        };
      },

      gambling_goblin: () => {
        const depth = this.expeditionState.depth;
        const cost = 5 + Math.floor(depth / 5);
        const canGamble = stone() >= cost;
        const segments = this.getGambleSegments(depth);
        return {
          title: 'Gambling Goblin',
          description: `A goblin challenges you to a game of chance. Risk ${cost} Stone for a spin!`,
          choices: [
            {
              label: `Gamble ${cost} Stone ${canGamble ? '' : '(not enough stone)'}`,
              action: () => {
                if (stone() >= cost) {
                  removeStone(cost);
                  this.analog.reset();
                  this.gamblePanel.show(segments, cost, (reward) => {
                    if (reward) {
                      this.giveItem(reward.id, reward.quantity);
                    }
                  });
                }
              },
            },
            { label: 'Walk away', action: () => {} },
          ],
        };
      },

      midrun_shop: () => {
        const hasCarrots = (n: number) => gameState.inventory.count('carrot') >= n;
        return {
          title: 'Wandering Shop',
          description: `A merchant has set up shop mid-dungeon. You have ${gameState.inventory.count('carrot')} carrots in storage. What catches your eye?`,
          choices: [
            { label: `Stamina Potion — 5 carrots ${hasCarrots(5) ? '' : '(not enough)'}`, action: () => this.buyAtShop('stamina_potion', 5) },
            { label: `Teleport Scroll — 8 carrots ${hasCarrots(8) ? '' : '(not enough)'}`, action: () => this.buyAtShop('teleport_scroll', 8) },
            { label: `Mining Bomb — 6 carrots ${hasCarrots(6) ? '' : '(not enough)'}`, action: () => this.buyAtShop('mining_bomb', 6) },
            { label: 'Leave', action: () => {} },
          ],
        };
      },

      treasure_vault: () => {
        const depth = this.expeditionState.depth;
        const goldAmt = 3 + Math.floor(depth / 3);
        const crystalAmt = 3 + Math.floor(depth / 4);
        return {
          title: 'Treasure Vault',
          description: 'A glittering stash of precious resources!',
          choices: [{ label: `Claim +${goldAmt} Gold Ore, +${crystalAmt} Crystal`, action: () => { addItem('gold_ore', goldAmt); addItem('crystal', crystalAmt); } }],
        };
      },

      relic_chamber: () => {
        const relicIds = ['relic_stamina', 'relic_inventory', 'relic_luck'];
        const available = relicIds.filter(r => !gameState.hasFoundRelic(r));
        if (available.length === 0) {
          return {
            title: 'Ancient Relic',
            description: 'The pedestal is empty — you have already claimed all relics.',
            choices: [{ label: 'Leave', action: () => {} }],
          };
        }
        const relicId = available[Math.floor(Math.random() * available.length)];
        const relicNames: Record<string, string> = {
          relic_stamina: 'Heart of the Mountain',
          relic_inventory: 'Pouch of Holding',
          relic_luck: 'Four-Leaf Clover',
        };
        const relicDescs: Record<string, string> = {
          relic_stamina: 'Permanently increases max stamina.',
          relic_inventory: 'Permanently expands inventory capacity.',
          relic_luck: 'Permanently increases luck.',
        };
        return {
          title: 'Ancient Relic',
          description: relicDescs[relicId] ?? 'A glowing artifact radiates ancient power...',
          choices: [
            { label: `Claim the ${relicNames[relicId] ?? 'Relic'}`, action: () => { gameState.addFoundRelic(relicId); this.showRecipeDiscovery(relicNames[relicId] ?? 'Relic'); } },
            { label: 'Leave it', action: () => {} },
          ],
        };
      },
    };

    return events[id]?.() ?? null;
  }

  private buyAtShop(itemId: string, cost: number): void {
    if (gameState.inventory.count('carrot') >= cost) {
      gameState.inventory.removeItem('carrot', cost);
      gameState.save();
      this.giveItem(itemId, 1);
    }
  }

  private showStairPrompt(): void {
    const cx = CX;
    const cy = CY;
    const action = this.stairAction === 'ascend' ? 'Ascend' : 'Descend';

    const bg = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.OVERLAY);
    bg.fillStyle(0x0a0a1a, 0.9);
    bg.fillRect(0, 0, VW, VH);
    bg.lineStyle(2, 0x5a4a7a, 0.6);
    bg.strokeRoundedRect(cx - 180, cy - 55, 360, 145, 10);
    this.cameras.main.ignore(bg);

    const text = this.add.text(cx, cy - 20, 'Use stairs?', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY_TEXT);
    this.cameras.main.ignore(text);

    const hint = this.add.text(cx, cy + 10, `[SPACE] ${action}  [ESC] Cancel`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY_TEXT);
    this.cameras.main.ignore(hint);

    const proceedBtn = this.add.text(cx - 70, cy + 48, `[ ${action} ]`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#66dd66',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY_TEXT);
    this.cameras.main.ignore(proceedBtn);

    const cancelBtn = this.add.text(cx + 70, cy + 48, '[ Cancel ]', {
      fontSize: '14px', fontFamily: 'monospace', color: '#cc6666',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY_TEXT);
    this.cameras.main.ignore(cancelBtn);

    this._stairProceedBtn = proceedBtn;
    this._stairCancelBtn = cancelBtn;

    const handler = (p: Phaser.Input.Pointer) => {
      if (!proceedBtn.active || !cancelBtn.active) return;
      if (proceedBtn.getBounds().contains(p.x, p.y)) {
        this.hideStairPrompt();
        const a = this.stairAction;
        this.stairAction = null;
        this.playerX = this.stairTargetX;
        this.playerY = this.stairTargetY;
        if (a === 'ascend') this.handleAscend();
        else this.handleDescend();
      } else if (cancelBtn.getBounds().contains(p.x, p.y)) {
        this.hideStairPrompt();
        this.stairAction = null;
        this.interactTarget = null;
        this.interactPrompt.setAlpha(0);
        this.stairDismissCell = { x: this.playerX, y: this.playerY };
      }
    };
    this._stairPointerHandler = handler;
    this.input.on('pointerdown', handler);

    const moveHandler = (p: Phaser.Input.Pointer) => {
      if (!proceedBtn.active || !cancelBtn.active) {
        this.input.setDefaultCursor('default');
        return;
      }
      if (proceedBtn.getBounds().contains(p.x, p.y) || cancelBtn.getBounds().contains(p.x, p.y)) {
        this.input.setDefaultCursor('pointer');
      } else {
        this.input.setDefaultCursor('default');
      }
    };
    this._stairMoveHandler = moveHandler;
    this.input.on('pointermove', moveHandler);

    this.stairPrompt = this.add.container(0, 0, [bg, text, hint, proceedBtn, cancelBtn])
      .setDepth(DEPTH.OVERLAY).setScrollFactor(0);
    this.cameras.main.ignore(this.stairPrompt);
  }

  private hideStairPrompt(): void {
    if (this._stairPointerHandler) {
      this.input.off('pointerdown', this._stairPointerHandler);
      this._stairPointerHandler = undefined;
    }
    if (this._stairMoveHandler) {
      this.input.off('pointermove', this._stairMoveHandler);
      this._stairMoveHandler = undefined;
    }
    this.input.setDefaultCursor('default');
    this._stairProceedBtn = undefined;
    this._stairCancelBtn = undefined;
    if (this.stairPrompt) {
      this.stairPrompt.destroy();
      this.stairPrompt = null;
    }
  }

  private handleDescend(): void {
    this.expeditionState.descend();
    audio.playStairs();

    if (this.expeditionState.depth >= 2 && !gameState.crafting.isDiscovered('mining_bomb')) {
      gameState.crafting.discover('mining_bomb');
      this.showRecipeDiscovery('Mining Bomb');
    }

    if (this.expeditionState.depth === 3 && !gameState.crafting.isDiscovered('lantern_bronze')) {
      gameState.crafting.discover('lantern_bronze');
      this.showRecipeDiscovery('Bronze Lantern');
    }
    if (this.expeditionState.depth === 8 && !gameState.crafting.isDiscovered('lantern_silver')) {
      gameState.crafting.discover('lantern_silver');
      this.showRecipeDiscovery('Silver Lantern');
    }
    if (this.expeditionState.depth === 13 && !gameState.crafting.isDiscovered('lantern_gold')) {
      gameState.crafting.discover('lantern_gold');
      this.showRecipeDiscovery('Gold Lantern');
    }

    if (gameState.getResearchLevel('second_wind') >= 1) this.stamina.refill(5);
    if (this.runSeed) this.dungeonGen.setSeed(`${this.runSeed}_depth_${this.expeditionState.depth}`);
    const floor = this.dungeonGen.generateFloor(this.expeditionState.depth);
    this.currentFloor = floor;
    this.playerX = floor.entryX;
    this.playerY = floor.entryY;
    this.rebuildFloor();
    this.expeditionState.initExplored(floor.cols, floor.rows);
    this.revealSurroundings();
  }

  private handleAscend(): void {
    audio.playStairs(true);
    if (this.expeditionState.depth % 5 === 0) {
      this.safeExtract();
    } else {
      this.expeditionState.ascend();
      if (gameState.getResearchLevel('second_wind') >= 1) this.stamina.refill(5);
      if (this.runSeed) this.dungeonGen.setSeed(`${this.runSeed}_depth_${this.expeditionState.depth}`);
      const floor = this.dungeonGen.generateFloor(this.expeditionState.depth);
      this.currentFloor = floor;
      this.playerX = floor.stairsDownX;
      this.playerY = floor.stairsDownY;
      this.rebuildFloor();
      this.expeditionState.initExplored(floor.cols, floor.rows);
      this.revealSurroundings();
    }
  }

  private checkRecipeDiscovery(resource: string): void {
    if (resource === 'silver_ore' && !gameState.crafting.isDiscovered('pickaxe_3')) {
      gameState.crafting.discover('pickaxe_3');
      this.showRecipeDiscovery('Silver Pickaxe');
    }

    if (resource === 'gold_ore' && !gameState.crafting.isDiscovered('pickaxe_4')) {
      gameState.crafting.discover('pickaxe_4');
      this.showRecipeDiscovery('Gold Pickaxe');
    }
  }

  private checkRingDiscovery(): void {
    const k = gameState.monsterKills;
    if (k.slime >= 3 && !gameState.crafting.isDiscovered('ring_critical')) {
      gameState.crafting.discover('ring_critical');
      this.showRecipeDiscovery('Critical Ring');
    }
    if (k.rat >= 3 && !gameState.crafting.isDiscovered('ring_damage')) {
      gameState.crafting.discover('ring_damage');
      this.showRecipeDiscovery('Damage Ring');
    }
    if (k.bat >= 3 && !gameState.crafting.isDiscovered('ring_precision')) {
      gameState.crafting.discover('ring_precision');
      this.showRecipeDiscovery('Precision Ring');
    }
    if (k.slime >= 3 && k.rat >= 3 && k.bat >= 3 && !gameState.crafting.isDiscovered('ring_hunter')) {
      gameState.crafting.discover('ring_hunter');
      this.showRecipeDiscovery('Hunter Ring');
    }
  }

  private showRecipeDiscovery(name: string): void {
    gameState.runRecipesDiscovered.push(name);
    const cx = this.cameras.main.width / 2;
    this.createPopup(`New Recipe: ${name}!`, cx, 130, '#44ccff', { duration: 2000, moveY: -40, scaleFrom: 1.1, scaleTo: 0.9 });
  }

  private rebuildFloor(): void {
    const floor = this.currentFloor;
    if (!floor) return;

    this.stairsSpawned = false;
    this.floorEntry = true;
    this.interactTarget = null;
    this.interactPrompt.setAlpha(0);

    this.drawFloor();
    this.repositionPlayer();
    this.cameras.main.stopFollow();
    const xMin = -floor.rows * HALF_W;
    const yMin = -HALF_H;
    this.cameras.main.startFollow(this.player, true, 0.5, 0.5);
    this.cameras.main.setBounds(xMin, yMin, worldWidth(floor.cols, floor.rows), worldHeight(floor.cols, floor.rows));

    this.depthTextCentered.setText(`Depth: ${this.expeditionState.depth}`);

    this.drawMinimap();
    this.rocksBrokenThisRun = 0;
    this.updateDarkness();
  }

  private tryMove(dx: number, dy: number): void {
    if (this.combatActive) return;
    if (this.eventActive) return;
    if (this.stairAction) return;
    if (this.isMoving) return;
    if (this.isMining) return;

    const floor = this.currentFloor;
    if (!floor) return;

    const nx = this.playerX + dx;
    const ny = this.playerY + dy;

    if (nx < 0 || nx >= floor.cols || ny < 0 || ny >= floor.rows) return;

    const tile = floor.tiles[ny][nx];
    if (this.isBlocked(tile)) return;

    this.playerX = nx;
    this.playerY = ny;
    this.floorEntry = false;

    const target = gridToIso(nx, ny);
    const cfg = getSpriteConfig('player_bottom_left');
    this.isMoving = true;
    this.tweens.add({
      targets: this.player,
      x: target.x + (cfg.offsetX ?? 0),
      y: target.y + (cfg.offsetY ?? 0),
      depth: playerDepth(nx, ny),
      duration: 100,
      ease: 'Linear',
      onComplete: () => { this.isMoving = false; },
    });

    this.updateMinimapDot();

    this.activatePressurePlate(nx, ny);

    audio.playStep();
    this.revealSurroundings();
  }

  private activatePressurePlate(x: number, y: number): void {
    const floor = this.currentFloor;
    if (!floor) return;
    const tile = floor.tiles[y][x];
    if (tile.type !== 'pressure_plate' || tile.broken) return;
    tile.broken = true;
    audio.playPlatePress();
    if (floor.puzzle) {
      floor.puzzle.pressedPlates++;
      if (floor.puzzle.pressedPlates >= floor.puzzle.totalPlates) {
        audio.playPuzzleComplete();
        this.completePuzzle(floor);
      }
    }
    this.drawFloor();
  }

  private completePuzzle(floor: DungeonFloor): void {
    const room = floor.puzzle!.room;
    const candidates: { x: number; y: number }[] = [];
    for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
        if (floor.tiles[y][x].type === 'floor' || floor.tiles[y][x].type === 'pressure_plate') {
          candidates.push({ x, y });
        }
      }
    }
    let pos: { x: number; y: number };
    if (candidates.length > 0) {
      pos = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      console.warn('completePuzzle: no floor/plate tiles available, using room center');
      pos = { x: Math.floor(room.x + room.w / 2), y: Math.floor(room.y + room.h / 2) };
    }
    const t = floor.tiles[pos.y][pos.x];
    t.type = 'stairs_down';
    t.resource = '';
    t.broken = false;
    floor.stairsDownX = pos.x;
    floor.stairsDownY = pos.y;
    this.stairsSpawned = true;
  }

  private tryMine(): void {
    if (this.isMining) return;

    const floor = this.currentFloor;
    if (!floor) return;

    const tx = this.playerX + this.facingX;
    const ty = this.playerY + this.facingY;

    // Always play the swing animation (even empty swings)
    this.isMining = true;
    this.animFrame = 0;
    this.animTimer = 0;
    this.updatePlayerSprite();

    // Store target for delayed execution on animation completion
    this.pendingMineTx = -1;
    this.pendingMineTy = -1;
    if (tx >= 0 && tx < floor.cols && ty >= 0 && ty < floor.rows) {
      const tile = floor.tiles[ty][tx];
      if (tile.type === 'mineable' && !tile.broken) {
        this.pendingMineTx = tx;
        this.pendingMineTy = ty;
      }
    }
  }

  private executeMine(tx: number, ty: number): void {
    const floor = this.currentFloor;
    if (!floor) return;

    const tile = floor.tiles[ty][tx];
    if (tile.type !== 'mineable' || tile.broken) return;

    let mineDmg = this.mining.getDamage();
    if (gameState.getResearchLevel('deep_core_mining') >= 1) mineDmg++;
    tile.durability -= mineDmg;
    audio.playMineHit(tile.maxDurability);
    this.cameras.main.shake(50, 0.006);

    // Update damage appearance on the existing ore image
    const hitImg = this.oreImageMap.get(`${tx},${ty}`);
    if (hitImg && tile.maxDurability > 0) {
      const ratio = tile.durability / tile.maxDurability;
      if (ratio <= 0.33) {
        hitImg.setTint(0x777777);
      } else if (ratio <= 0.66) {
        hitImg.setTint(0xaaaaaa);
      }
    }

    // Sync preview tile tint if player is facing this tile
    if (this.previewTile && tile.maxDurability > 0) {
      const ratio = tile.durability / tile.maxDurability;
      if (ratio <= 0.33) {
        this.previewTile.setTint(0x777777);
      } else if (ratio <= 0.66) {
        this.previewTile.setTint(0xaaaaaa);
      }
    }

    let staminaCost = 5;
    if (gameState.getResearchLevel('efficient_mining') >= 1) staminaCost--;
    if (!this.stamina.consume(staminaCost)) {
      this.handleExhaustion();
    }

    if (tile.durability <= 0) {
      tile.broken = true;
      const minedResource = tile.resource;
      floor.mineableCount--;
      this.spawnStairsOnBreak(tx, ty);

      this.rocksBrokenThisRun++;
      this.checkRegenBoots();

      const luckBonus = gameState.getBootEffects().luckBonus;
      if (Math.random() < luckBonus) {
        this.createItemPopup(tx, ty, minedResource);
        this.spawnItemSprite(tx, ty, minedResource);
      }

      if (gameState.getResearchLevel('ore_magnet') >= 1 && Math.random() < 0.15) {
        this.createItemPopup(tx, ty, minedResource);
        this.spawnItemSprite(tx, ty, minedResource);
      }

      this.createHitEffect(tx, ty);
      this.createMiningParticles(tx, ty, minedResource);
      this.createItemPopup(tx, ty, minedResource);
      this.spawnItemSprite(tx, ty, minedResource);

      this.checkRecipeDiscovery(minedResource);

      this.cameras.main.shake(120, 0.015);

      // Shockwave ring
      const pp = gridToIso(tx, ty);
      const ring = this.add.circle(pp.x, pp.y, 5, 0xffffff, 0.4).setDepth(DEPTH.EFFECTS);
      this.hudCam.ignore(ring);
      this.tweens.add({
        targets: ring,
        radius: HALF_W * 1.5,
        alpha: 0,
        duration: 350,
        ease: 'Quad.easeOut',
        onComplete: () => ring.destroy(),
      });

      const oreImg = this.oreImageMap.get(`${tx},${ty}`);
      if (oreImg) {
        this.tweens.add({
          targets: oreImg,
          scaleX: 2.0, scaleY: 2.0,
          alpha: 0,
          angle: Phaser.Math.Between(-15, 15),
          duration: 250,
          ease: 'Quad.easeOut',
          onComplete: () => {
            this.drawFloor();
            this.drawMinimap();
          },
        });
      } else {
        this.drawFloor();
        this.drawMinimap();
      }
    } else {
      this.createHitEffect(tx, ty);
    }
  }

  private createMiningParticles(tx: number, ty: number, resource: string): void {
    const p = gridToIso(tx, ty);
    const cx = p.x;
    const cy = p.y;

    const colors: Record<string, number> = {
      stone: 0x6a6a7a,
      bronze_ore: 0xaa8a4a,
      silver_ore: 0x9aaabc,
      gold_ore: 0xccaa44,
      crystal: 0x9a6acc,
      monster_drop: 0x8a3a3a,
    };
    const color = colors[resource] ?? 0xaa8844;

    // Large core chunks
    for (let i = 0; i < 4; i++) {
      const radius = Phaser.Math.FloatBetween(4, 7);
      const p = this.add.circle(cx, cy, radius, color, 0.9).setDepth(DEPTH.PARTICLES);
      this.hudCam.ignore(p);

      this.tweens.add({
        targets: p,
        x: cx + Phaser.Math.Between(-20, 20),
        y: cy + Phaser.Math.Between(-20, 20),
        alpha: 0,
        scale: 0.3,
        duration: 450,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }

    // Small debris burst
    for (let i = 0; i < 10; i++) {
      const radius = Phaser.Math.FloatBetween(1.5, 3.5);
      const p = this.add.circle(cx, cy, radius, color, 0.7).setDepth(DEPTH.PARTICLES);
      this.hudCam.ignore(p);

      this.tweens.add({
        targets: p,
        x: cx + Phaser.Math.Between(-55, 55),
        y: cy + Phaser.Math.Between(-55, 55),
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(350, 550),
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  private createHitEffect(tx: number, ty: number): void {
    const p = gridToIso(tx, ty);
    const cx = p.x;
    const cy = p.y;

    // Radial burst
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 / 8) * i + Phaser.Math.FloatBetween(-0.2, 0.2);
      const dist = Phaser.Math.Between(8, 22);
      const radius = Phaser.Math.FloatBetween(2, 4);
      const particle = this.add.circle(cx, cy, radius, 0xffffff, 0.7).setDepth(DEPTH.PARTICLES);
      this.hudCam.ignore(particle);

      this.tweens.add({
        targets: particle,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0,
        duration: 180,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      });
    }

    // Central flash
    const flash = this.add.circle(cx, cy, HALF_W * 0.8, 0xffffff, 0.25).setDepth(DEPTH.EFFECTS);
    this.hudCam.ignore(flash);
    this.tweens.add({
      targets: flash,
      scale: 1.5,
      alpha: 0,
      duration: 120,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  private createItemPopup(tx: number, ty: number, resource: string): void {
    const label = resource.replace(/_/g, ' ');
    const p = gridToIso(tx, ty);
    const popup = this.add.text(
      p.x,
      p.y - 24,
      `+1 ${label}`,
      { fontSize: '13px', fontFamily: 'monospace', color: '#ffcc44', fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(DEPTH.ITEM_POPUP);
    this.hudCam.ignore(popup);

    this.tweens.add({
      targets: popup,
      y: popup.y - 40,
      alpha: 0,
      scale: { from: 1.2, to: 0.8 },
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }

  private hasFinished: boolean = false;

  private finishRun(extractType: 'safe' | 'emergency', lossRate: number = 0.5): void {
    if (this.hasFinished) return;
    this.hasFinished = true;
    this.exhausted = true;

    const slots = this.inventory.getItems();
    const obtained: { id: string; quantity: number }[] = [];
    const lost: { id: string; quantity: number }[] = [];

    const itemList: { id: string }[] = [];
    for (const slot of slots) {
      if (!slot) continue;
      obtained.push({ id: slot.itemId, quantity: slot.quantity });
      for (let n = 0; n < slot.quantity; n++) {
        itemList.push({ id: slot.itemId });
      }
    }



    let toLose = extractType === 'emergency' && lossRate > 0 ? Math.round(itemList.length * lossRate) : 0;
    const lostMap = new Map<string, number>();

    while (toLose > 0 && itemList.length > 0) {
      const idx = Math.floor(Math.random() * itemList.length);
      const item = itemList.splice(idx, 1)[0];
      lostMap.set(item.id, (lostMap.get(item.id) ?? 0) + 1);
      toLose--;
    }

    for (const item of itemList) {
      gameState.inventory.addItem(item.id, 1);
    }

    for (const [id, qty] of lostMap) {
      lost.push({ id, quantity: qty });
    }

    gameState.consumePickaxeRun();
    gameState.consumeEquipmentRun(gameState.equippedBoots);
    gameState.consumeEquipmentRun(gameState.equippedLantern);
    if (this.expeditionState.depth > gameState.maxDepthReached) {
      gameState.maxDepthReached = this.expeditionState.depth;
    }
    gameState.save();

    gameState.lastRunResult = { itemsObtained: obtained, itemsLost: lost, extractType, depth: this.expeditionState.depth, villagersRescued: gameState.runVillagersRescued, recipesDiscovered: gameState.runRecipesDiscovered };

    if (extractType === 'emergency') {
      gameState.exhaustionCount++;
      if (gameState.exhaustionCount >= 3 && !gameState.crafting.isDiscovered('teleport_scroll')) {
        gameState.crafting.discover('teleport_scroll');
        this.showRecipeDiscovery('Teleport Scroll');
      }
    }

    this.time.delayedCall(800, () => {
      this.scene.start('ExpeditionRecapScene');
    });
  }

  private updateDarkness(): void {
    this.darknessOverlay.clear();
    this.darknessMaskGfx.clear();
    const depth = this.expeditionState.depth;
    const isDarkFloor = depth > 0 && depth % 5 === 3;
    if (!isDarkFloor) return;
    const range = gameState.getLanternRange(depth);
    if (range <= 0) return;
    const r = range;
    const cx = this.player.x;
    const cy = this.player.y;
    const cam = this.cameras.main;
    const sx = cam.scrollX;
    const sy = cam.scrollY;
    const w = cam.width;
    const h = cam.height;
    const pad = 2000;
    this.darknessOverlay.fillStyle(0x000000, 1);
    this.darknessOverlay.fillRect(sx - pad, sy - pad, w + pad * 2, h + pad * 2);
    this.darknessMaskGfx.fillStyle(0xffffff);
    this.darknessMaskGfx.fillCircle(cx, cy, r);
  }

  private checkRegenBoots(): void {
    if (gameState.equippedBoots === 'boots_regen' && this.rocksBrokenThisRun % 5 === 0) {
      this.stamina.refill(1);
    }
  }

  private handleExhaustion(): void {
    if (this.exhausted) return;
    this.exhausted = true;
    this.cameras.main.shake(300, 0.01);
    audio.playExhaustion();

    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;

    const overlay = this.add.rectangle(
      cx, cy,
      this.cameras.main.width, this.cameras.main.height,
      0x000000, 0
    ).setDepth(DEPTH.OVERLAY).setScrollFactor(0);
    this.cameras.main.ignore(overlay);

    const exhaustionText = this.add.text(
      cx, cy,
      'EXHAUSTED\nTeleporting home...',
      { fontSize: '24px', fontFamily: 'monospace', color: '#cc4444', align: 'center' }
    ).setOrigin(0.5).setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);
    this.cameras.main.ignore(exhaustionText);

    this.tweens.add({
      targets: overlay,
      alpha: 0.6,
      duration: 1000,
      onComplete: () => {
        this.finishRun('emergency', 0.3);
      },
    });
  }

  private safeExtract(): void {
    if (this.exhausted) return;
    this.exhausted = true;
    audio.playExtraction('safe');

    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;

    const safeExtractText = this.add.text(
      cx, cy,
      'Returning to Homeland...',
      { fontSize: '20px', fontFamily: 'monospace', color: '#44cc66' }
    ).setOrigin(0.5).setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);
    this.cameras.main.ignore(safeExtractText);

    const overlay = this.add.rectangle(
      cx, cy,
      this.cameras.main.width, this.cameras.main.height,
      0x000000, 0
    ).setDepth(DEPTH.OVERLAY).setScrollFactor(0);
    this.cameras.main.ignore(overlay);

    this.tweens.add({
      targets: overlay,
      alpha: 0.6,
      duration: 600,
      onComplete: () => {
        this.finishRun('safe');
      },
    });
  }

  private emergencyExtract(): void {
    if (this.exhausted) return;
    this.exhausted = true;
    audio.playExtraction('emergency');

    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;

    const emergencyText = this.add.text(
      cx, cy,
      'Giving Up...\nLosing some items...',
      { fontSize: '18px', fontFamily: 'monospace', color: '#cc8844', align: 'center' }
    ).setOrigin(0.5).setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);
    this.cameras.main.ignore(emergencyText);

    const overlay = this.add.rectangle(
      cx, cy,
      this.cameras.main.width, this.cameras.main.height,
      0x000000, 0
    ).setDepth(DEPTH.OVERLAY).setScrollFactor(0);
    this.cameras.main.ignore(overlay);

    this.tweens.add({
      targets: overlay,
      alpha: 0.6,
      duration: 600,
      onComplete: () => {
        this.finishRun('emergency', 0.3);
      },
    });
  }

  private findBossCenter(tx: number, ty: number): { x: number; y: number } | null {
    const floor = this.currentFloor;
    if (!floor) return null;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx >= 0 && nx < floor.cols && ny >= 0 && ny < floor.rows) {
          if (floor.tiles[ny][nx].type === 'event_boss') return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  private startCombat(tx: number, ty: number, tile: any): void {
    const isBoss = tile.type === 'event_boss';
    const enemyType = tile.eventId || 'slime';

    const enemyData: Record<string, { name: string; hp: number; speed: number; zoneWidth: number; rewards: { id: string; quantity: number }[] }> = {
      slime: { name: 'Slime', hp: 1, speed: 800, zoneWidth: 80, rewards: [{ id: 'monster_drop', quantity: 1 }] },
      rat: { name: 'Giant Rat', hp: 2, speed: 600, zoneWidth: 60, rewards: [{ id: 'monster_drop', quantity: 1 }, { id: 'stone', quantity: 1 }] },
      bat: { name: 'Cave Bat', hp: 1, speed: 400, zoneWidth: 50, rewards: [{ id: 'monster_drop', quantity: 1 }, { id: 'crystal', quantity: 1 }] },
      boss: { name: 'Forest Guardian', hp: 5, speed: 700, zoneWidth: 60, rewards: [{ id: 'gold_ore', quantity: 3 }, { id: 'crystal', quantity: 2 }] },
    };

    const data = enemyData[enemyType] ?? enemyData.slime;
    const ringEffects = gameState.getRingEffects();

    const config: EnemyConfig = {
      name: data.name,
      hp: data.hp,
      timingSpeed: data.speed,
      hitZoneWidth: Math.round(data.zoneWidth * ringEffects.precisionMult),
      spriteKey: isBoss ? 'enemy_boss' : `enemy_${enemyType}`,
      rewards: data.rewards,
      ringBonusDamage: ringEffects.bonusDamage,
      ringCritChance: ringEffects.critChance,
      researchBonusDamage: gameState.getResearchLevel('combat_training') >= 1 ? 1 : 0,
      researchCritChance: gameState.getResearchLevel('critical_strikes') >= 1 ? 0.1 : 0,
      bossDamageMult: isBoss && gameState.getResearchLevel('boss_slayer') >= 1 ? 1.5 : 1,
    };

    this.movePath = [];
    this.isMoving = false;
    this.analog.reset();
    this.combatActive = true;
    audio.playCombatStart();
    this.interactPrompt.setAlpha(0);
    this.interactTarget = null;

    this.combatPanel.show(
      config,
      (result: CombatResult, rewards: { id: string; quantity: number }[]) => {
        this.combatActive = false;
        this.movePath = [];
        this.isMoving = false;
        this.analog.reset();
        this.drawStaminaBar();

        if (result === 'victory') {
          const lootMult = ringEffects.doubleLoot ? 2 : 1;
        for (const r of rewards) {
          this.giveItem(r.id, r.quantity * lootMult);
          this.createItemPopup(tx, ty, r.id);
          audio.playItemPickup();
        }

        if (!isBoss && (enemyType === 'slime' || enemyType === 'rat' || enemyType === 'bat')) {
          gameState.monsterKills[enemyType as 'slime' | 'rat' | 'bat']++;
          this.checkRingDiscovery();
        }

        if (isBoss) {
          const floor = this.currentFloor;
          if (floor) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = tx + dx;
                const ny = ty + dy;
                if (nx >= 0 && nx < floor.cols && ny >= 0 && ny < floor.rows) {
                  const bt = floor.tiles[ny][nx];
                  if (bt.type === 'boss_body' || (bt.type === 'event_boss' && !bt.broken)) {
                    bt.type = 'floor';
                    bt.resource = '';
                    bt.broken = false;
                  }
                }
              }
            }
          }
          const st = floor!.tiles[ty][tx];
          st.type = 'stairs_down';
          st.resource = '';
          st.broken = false;
          this.drawFloor();
          this.drawMinimap();

          if (!gameState.crafting.isDiscovered('stamina_potion')) {
            gameState.crafting.discover('stamina_potion');
            this.showRecipeDiscovery('Stamina Potion');
          }
        } else {
          tile.broken = true;
          this.drawFloor();
          this.drawMinimap();
        }
      }
    },
    () => {
      this.stamina.consume(10);
      this.tweens.add({
        targets: [this.staminaBg, this.portraitSprite, this.staminaBarGfx, this.staminaValueText],
        x: { value: '+=' + 5 },
        duration: 25,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.easeInOut',
      });
    },
  );
  }

  private tryUseConsumable(itemId: string): void {
    if (this.exhausted) return;

    if (this.inventory.count(itemId) <= 0) return;

    switch (itemId) {
      case 'stamina_potion': {
        this.inventory.removeItem(itemId, 1);
        const restore = Math.floor(30 * (gameState.getResearchLevel('trail_rations') >= 1 ? 1.25 : 1));
        this.stamina.refill(restore);
        this.showConsumableFeedback(`+${restore} Stamina`);
        audio.playPotion();
        break;
      }
      case 'teleport_scroll': {
        this.inventory.removeItem(itemId, 1);
        this.safeExtract();
        break;
      }
      case 'mining_bomb': {
        this.inventory.removeItem(itemId, 1);
        this.detonateMiningBomb();
        break;
      }
    }

    this.inventoryPanel.refresh();
  }

  private spawnStairsOnBreak(x: number, y: number): void {
    if (this.stairsSpawned) return;
    if (this.expeditionState.depth % 5 === 4) return;
    const floor = this.currentFloor;
    if (!floor) return;
    if (floor.puzzle) return;
    const stairMult = gameState.getBootEffects().stairMultiplier;
    const chance = (0.1 + (1 - (0.9 * (floor.mineableCount / floor.initialMineableCount)))) * stairMult;
    const rd = Math.random()
    if (rd < chance) {
      const tile = floor.tiles[y][x];
      tile.type = 'stairs_down';
      tile.resource = '';
      tile.broken = false;
      this.stairsSpawned = true;
      this.drawFloor();
    }
  }

  private detonateMiningBomb(): void {
    const floor = this.currentFloor;
    if (!floor) return;

    audio.playExplosion();
    this.cameras.main.shake(200, 0.02);

    const pp = gridToIso(this.playerX, this.playerY);

    // Expansion ring
    const ring = this.add.circle(pp.x, pp.y, 5, 0xff6600, 0.3).setDepth(DEPTH.EFFECTS);
    this.tweens.add({
      targets: ring,
      radius: HALF_W * 2,
      alpha: 0,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    // Inner flash
    const flash = this.add.circle(pp.x, pp.y, HALF_W, 0xffffff, 0.4).setDepth(DEPTH.BOMB);
    this.tweens.add({
      targets: flash,
      scale: 2,
      alpha: 0,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    // Debris burst
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 / 8) * i + Phaser.Math.FloatBetween(-0.3, 0.3);
      const radius = Phaser.Math.FloatBetween(3, 6);
      const debris = this.add.circle(pp.x, pp.y, radius, 0xff6600, 0.6).setDepth(DEPTH.BOMB);
      this.tweens.add({
        targets: debris,
        x: pp.x + Math.cos(angle) * Phaser.Math.Between(30, 60),
        y: pp.y + Math.sin(angle) * Phaser.Math.Between(30, 60),
        alpha: 0,
        scale: 0,
        duration: 400,
        ease: 'Quad.easeOut',
        onComplete: () => debris.destroy(),
      });
    }

    const damage = this.mining.getDamage();
    const dirs = [
      { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
      { x: -1, y: 0 },                     { x: 1, y: 0 },
      { x: -1, y: 1 },  { x: 0, y: 1 },  { x: 1, y: 1 },
    ];
    let changed = false;

    let stairsChecked = false;
    for (const d of dirs) {
      const tx = this.playerX + d.x;
      const ty = this.playerY + d.y;
      if (tx < 0 || tx >= floor.cols || ty < 0 || ty >= floor.rows) continue;
      const tile = floor.tiles[ty][tx];
      if (tile.type !== 'mineable' || tile.broken) continue;
      tile.durability -= damage;
      this.createHitEffect(tx, ty);
      if (tile.durability <= 0) {
        tile.broken = true;
        this.createMiningParticles(tx, ty, tile.resource);
        this.createItemPopup(tx, ty, tile.resource);
        this.spawnItemSprite(tx, ty, tile.resource);
        this.checkRecipeDiscovery(tile.resource);

          this.rocksBrokenThisRun++;
          this.checkRegenBoots();

          const luckBonus = gameState.getBootEffects().luckBonus;
          if (Math.random() < luckBonus) {
            this.createItemPopup(tx, ty, tile.resource);
            this.spawnItemSprite(tx, ty, tile.resource);
          }
        if (!stairsChecked) {
          this.spawnStairsOnBreak(tx, ty);
          stairsChecked = true;
        }
      }
      changed = true;
    }

    if (changed) {
      this.drawFloor();
      this.drawMinimap();
    }
  }

  private showConsumableFeedback(text: string): void {
    if (text === '+30 Stamina') {
      this.queueObtainPopup('stamina_potion', 1);
    }
  }

  private giveItem(id: string, qty: number): void {
    this.inventory.addItem(id, qty);
    this.drawInventoryButton();
    this.queueObtainPopup(id, qty);
  }

  private queueObtainPopup(id: string, qty: number): void {
    if (this.activeObtainPopups.length >= 3) return;

    const anchorX = 18;
    const anchorY = VH - 90;
    const popY = anchorY - this.activeObtainPopups.length * 36;
    const container = this.add.container(anchorX, popY).setScrollFactor(0).setDepth(DEPTH.HUD + 2);
    this.cameras.main.ignore(container);

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

    const label = this.add.text(38, 10, itemDisplayName(id), {
      fontSize: '14px', fontFamily: 'monospace', color: '#e8d5b7',
    });
    container.add(label);

    this.activeObtainPopups.push(container);
    container.setAlpha(0);

    this.tweens.add({ targets: container, alpha: 1, duration: 100, ease: 'Quad.easeOut' });

    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: container, alpha: 0, duration: 200, ease: 'Quad.easeIn',
        onComplete: () => {
          const idx = this.activeObtainPopups.indexOf(container);
          if (idx >= 0) this.activeObtainPopups.splice(idx, 1);
          container.destroy();
        },
      });
    });
  }

  private trashItem(itemId: string): void {
    if (this.inventory.count(itemId) <= 0) return;
    this.inventory.removeItem(itemId, 1);
    audio.playError();
    this.inventoryPanel.refresh();
  }

  private countItems(): number {
    return this.inventory.getItems().reduce((sum, slot) => {
      return sum + (slot ? slot.quantity : 0);
    }, 0);
  }

  private spawnItemSprite(tx: number, ty: number, resource: string): void {
    const textureKey = `ore_${resource}`;
    if (!this.textures.exists(textureKey)) return;
    const p = gridToIso(tx, ty);
    const sprite = this.add.image(p.x, p.y, textureKey)
      .setDepth(DEPTH.ITEM_SPRITE)
      .setScale(0);
    this.hudCam.ignore(sprite);
    this.tweens.add({
      targets: sprite,
      scale: 1.2,
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: sprite,
          scale: 1,
          duration: 80,
          ease: 'Quad.easeIn',
          onComplete: () => {
            this.time.delayedCall(200, () => {
              this.queueItemFly(sprite, resource);
            });
          }
        });
      }
    });
  }

  private queueItemFly(sprite: Phaser.GameObjects.Image, resource: string): void {
    this.itemFlyQueue.push({ sprite, resource });
    if (!this.itemFlyBusy) this.processItemFlyQueue();
  }

  private processItemFlyQueue(): void {
    if (this.itemFlyQueue.length === 0) {
      this.itemFlyBusy = false;
      return;
    }
    this.itemFlyBusy = true;
    const { sprite, resource } = this.itemFlyQueue.shift()!;
    this.flySpriteToBackpack(sprite, resource);
  }

  private flySpriteToBackpack(sprite: Phaser.GameObjects.Image, resource: string): void {
    const cam = this.cameras.main;
    const screenX = sprite.x - cam.scrollX;
    const screenY = sprite.y - cam.scrollY;
    sprite.setScrollFactor(0).setPosition(screenX, screenY);
    sprite.cameraFilter &= ~this.hudCam.id;
    this.cameras.main.ignore(sprite);
    const targetX = 40;
    const targetY = VH - 42;
    this.tweens.add({
      targets: sprite,
      x: targetX,
      y: targetY,
      scale: 0.35,
      alpha: 0.7,
      duration: 500,
      ease: 'Quad.easeIn',
      onComplete: () => {
        audio.playResourcePickup(resource);
        this.giveItem(resource, 1);
        sprite.destroy();
        this.time.delayedCall(100, () => this.processItemFlyQueue());
      }
    });
  }
}
