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
import { audio } from '../systems/AudioSystem';
import { getSpriteConfig } from '../systems/SpriteConfig';
import {
  gridToIso, isoToGrid, findPath,
  tileSortKey, drawDiamondAt,
  HALF_W, HALF_H, worldWidth, worldHeight,
} from '../systems/IsoUtils';

const BIOMES = ['FOREST', 'CAVE', 'ICE', 'LAVA', 'RUINS'];

function getBiomeKey(depth: number): string {
  return BIOMES[Math.floor(depth / 5) % 5];
}

function getWallTextureKey(depth: number): string {
  return `wall_${getBiomeKey(depth)}`;
}

function playerDepth(x: number, y: number): number {
  return 6 + (x + y) * 0.001 + 0.0005;
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
  private staminaBar!: Phaser.GameObjects.Graphics;
  private inventoryGauge!: Phaser.GameObjects.Graphics;
  private staminaText!: Phaser.GameObjects.Text;
  private inventoryText!: Phaser.GameObjects.Text;
  private depthText!: Phaser.GameObjects.Text;
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
  private stairTargetX: number = -1;
  private stairTargetY: number = -1;
  private stairAction: 'ascend' | 'descend' | null = null;
  private stairPrompt: Phaser.GameObjects.Container | null = null;
  private floorEntry: boolean = false;
  private stairDismissCell: { x: number; y: number } | null = null;
  private exhausted: boolean = false;
  private stairsSpawned: boolean = false;
  private facingX: number = 0;
  private facingY: number = -1;
  private debugMode: boolean = false;
  private loadoutConsumables: Record<string, number> = {};
  private inventoryPanel!: InventoryPanel;
  private eventPanel!: EventPanel;
  private eventActive: boolean = false;
  private combatPanel!: CombatPanel;
  private combatActive: boolean = false;
  private minimapBg!: Phaser.GameObjects.Graphics;
  private minimapGfx!: Phaser.GameObjects.Graphics;
  private minimapDot!: Phaser.GameObjects.Rectangle;
  private interactPrompt!: Phaser.GameObjects.Text;
  private interactTarget: { x: number; y: number; id: string } | null = null;
  private darknessOverlay!: Phaser.GameObjects.Graphics;
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
  private analogDx: number = 0;
  private analogDy: number = 0;
  private analogActive: boolean = false;
  private analogGfx: Phaser.GameObjects.Graphics | null = null;

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

    this.exhausted = false;
    this.hasFinished = false;
    const bootStaminaBonus = gameState.getBootEffects().maxStaminaBonus;
    const staminaMax = this.debugMode ? 10000 : 100 + gameState.maxStaminaBonus + bootStaminaBonus;
    this.rocksBrokenThisRun = 0;
    this.stairsSpawned = false;
    this.floorEntry = true;
    this.stamina = new StaminaSystem(staminaMax);
    this.mining = new MiningSystem();
    this.mining.setPickaxeTier(gameState.currentPickaxeTier);
    this.inventory = new InventorySystem(this.debugMode ? 100 : 16 + gameState.inventorySlotBonus, false);
    for (const [id, qty] of Object.entries(this.loadoutConsumables)) {
      if (qty > 0) this.giveItem(id, qty);
    }
    if (this.debugMode) {
      this.giveItem('stamina_potion', 5);
      this.giveItem('mining_bomb', 5);
    }
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

    this.inventoryPanel = new InventoryPanel(
      this, this.inventory,
      (id) => this.tryUseConsumable(id),
      (id) => this.trashItem(id),
      'Run Inventory',
    );
    this.eventPanel = new EventPanel(this);
    this.eventActive = false;
    this.combatPanel = new CombatPanel(this);
    this.combatActive = false;
    this.interactTarget = null;

    this.minimapBg = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.HUD_BG);
    this.minimapGfx = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.HUD);
    this.minimapDot = this.add.rectangle(0, 0, 3, 3, 0x88ccff).setScrollFactor(0).setDepth(DEPTH.MINIMAP_DOT);

    this.interactPrompt = this.add.text(0, 0, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffdd88',
    }).setOrigin(0.5).setAlpha(0).setDepth(DEPTH.INTERACT_PROMPT);

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

    this.expeditionState.initExplored(floor.cols, floor.rows);
    this.revealSurroundings(8);
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
      this.floorSpriteObjects.push(img);

      if (!isCorridor && (x + y) % 2 === 0) {
        const check = this.add.image(p.x, p.y, `floor_${biome}_b`).setDepth(DEPTH.TERRAIN + 0.01).setScale(0.5);
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
      const depth = 6 + (x + y) * 0.001;

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
              img.setDepth(6 + (x + y + 3) * 0.001);
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
            .setTintFill(0xffffff)
            .setAlpha(alpha);
          if (s !== 1) img.setScale(s);
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
    const baseKey = isUpFacing ? 'player_top_right' : 'player_bottom_left';
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

  private revealSurroundings(radius: number = 10): void {
    const floor = this.currentFloor;
    if (!floor) return;
    this.expeditionState.reveal(this.playerX, this.playerY, radius);
    this.drawMinimap();
  }

  private createHUD(): void {
    const camW = this.cameras.main.width;

    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x0a0a1a, 0.75);
    hudBg.fillRoundedRect(8, 8, 280, 100, 6);
    hudBg.setScrollFactor(0);
    hudBg.setDepth(DEPTH.HUD_BG);

    this.staminaBar = this.add.graphics();
    this.staminaBar.setScrollFactor(0);
    this.staminaBar.setDepth(DEPTH.HUD);

    this.inventoryGauge = this.add.graphics();
    this.inventoryGauge.setScrollFactor(0);
    this.inventoryGauge.setDepth(DEPTH.HUD);

    this.staminaText = this.add.text(20, 14, 'Stamina', {
      fontSize: '12px', fontFamily: 'monospace', color: '#8a7a6a',
    }).setScrollFactor(0).setDepth(DEPTH.HUD);

    this.drawStaminaBar();

    this.depthText = this.add.text(20, 76, `Floor: ${this.expeditionState.depth}`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#7a8a9a',
    }).setScrollFactor(0).setDepth(DEPTH.HUD);

    this.inventoryText = this.add.text(20, 60, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#8a7a6a',
    }).setScrollFactor(0).setDepth(DEPTH.HUD);

    this.drawInventoryGauge();

    this.add.text(20, 92, '[TAB] Inventory', {
      fontSize: '11px', fontFamily: 'monospace', color: '#4a5a4a',
    }).setScrollFactor(0).setDepth(DEPTH.HUD);

    const infoBg = this.add.graphics();
    infoBg.fillStyle(0x0a0a1a, 0.75);
    infoBg.fillRoundedRect(camW - 228, 8, 220, 84, 6);
    infoBg.setScrollFactor(0);
    infoBg.setDepth(DEPTH.HUD_BG);

    const pickaxeNames: Record<number, string> = {
      1: 'Common Pickaxe',
      2: 'Bronze Pickaxe',
      3: 'Silver Pickaxe',
      4: 'Gold Pickaxe',
    };
    const pName = pickaxeNames[gameState.currentPickaxeTier] ?? `Tier ${gameState.currentPickaxeTier}`;

    this.add.text(camW - 218, 14, `Pickaxe: ${pName}`, {
      fontSize: '11px', fontFamily: 'monospace', color: '#6a8a6a',
    }).setScrollFactor(0).setDepth(DEPTH.HUD);

    const tier = gameState.currentPickaxeTier;
    const runsLeft = gameState.remainingPickaxeRuns(tier);
    if (tier > 1 && runsLeft >= 0) {
      const barW = 120;
      const barH = 6;
      const barX = camW - 218;
      const barY = 30;
      const maxRuns = 5;
      const ratio = runsLeft / maxRuns;

      this.add.graphics()
        .fillStyle(0x2a1a1a, 1)
        .fillRoundedRect(barX, barY, barW, barH, 2)
        .fillStyle(runsLeft > 2 ? 0x44cc66 : runsLeft > 1 ? 0xccaa44 : 0xcc4444, 1)
        .fillRoundedRect(barX + 1, barY + 1, (barW - 2) * ratio, barH - 2, 1)
        .setScrollFactor(0).setDepth(DEPTH.HUD);

      this.add.text(barX + barW + 6, barY - 2, `${runsLeft}/${maxRuns}`, {
        fontSize: '10px', fontFamily: 'monospace', color: '#6a8a6a',
      }).setScrollFactor(0).setDepth(DEPTH.HUD);
    }

    this.add.text(camW - 218, 40, '[ESC] Give Up  [SPACE] Mine', {
      fontSize: '11px', fontFamily: 'monospace', color: '#5a4a6a',
    }).setScrollFactor(0).setDepth(DEPTH.HUD);

    this.add.text(camW - 218, 56, '[Q] Potion  [E] Scroll  [F] Bomb', {
      fontSize: '11px', fontFamily: 'monospace', color: '#4a6a5a',
    }).setScrollFactor(0).setDepth(DEPTH.HUD);
  }

  private drawMinimap(): void {
    const floor = this.currentFloor;
    if (!floor) return;

    const cell = 2;
    const mapW = floor.cols * cell;
    const mapH = floor.rows * cell;
    const mapX = 960 - mapW - 8;
    const mapY = 640 - mapH - 8;

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
        this.minimapGfx.fillRect(px, py, cell, cell);
      }
    }

    this.minimapDot.setPosition(mapX + this.playerX * cell + cell / 2, mapY + this.playerY * cell + cell / 2);
  }

  private updateMinimapDot(): void {
    const floor = this.currentFloor;
    if (!floor) return;
    const cell = 2;
    const mapW = floor.cols * cell;
    const mapH = floor.rows * cell;
    const mapX = 960 - mapW - 8;
    const mapY = 640 - mapH - 8;
    this.minimapDot.setPosition(mapX + this.playerX * cell + cell / 2, mapY + this.playerY * cell + cell / 2);
  }

  private drawStaminaBar(): void {
    this.staminaBar.clear();

    const x = 20;
    const y = 30;
    const w = 200;
    const h = 14;
    const ratio = this.stamina.ratio;

    this.staminaBar.fillStyle(0x2a1a1a, 1);
    this.staminaBar.fillRoundedRect(x, y, w, h, 3);

    const color = ratio > 0.5 ? 0x44cc66 : ratio > 0.25 ? 0xccaa44 : 0xcc4444;
    this.staminaBar.fillStyle(color, 1);
    this.staminaBar.fillRoundedRect(x + 1, y + 1, (w - 2) * ratio, h - 2, 2);

    this.staminaText.setText(`${this.stamina.remaining}/${this.stamina.maxStamina}`);
  }

  private drawInventoryGauge(): void {
    this.inventoryGauge.clear();

    const x = 20;
    const y = 48;
    const w = 200;
    const h = 8;

    const used = this.inventory.capacityUsed();
    const max = this.inventory.capacityMax();
    const ratio = max > 0 ? used / max : 0;

    this.inventoryGauge.fillStyle(0x1a1a2a, 1);
    this.inventoryGauge.fillRoundedRect(x, y, w, h, 2);

    const color = ratio <= 0.5 ? 0x44cc66 : ratio <= 0.75 ? 0xccaa44 : 0xcc4444;
    this.inventoryGauge.fillStyle(color, 1);
    if (used > 0) {
      this.inventoryGauge.fillRoundedRect(x + 1, y + 1, (w - 2) * Math.min(ratio, 1), h - 2, 1);
    }

    this.inventoryText.setText(`${used}/${max}`);
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

  private setupPointerInput(): void {
    let stickCenterX = 0;
    let stickCenterY = 0;
    let pointerDragged = false;
    const stickRadius = 40;
    const deadZone = 12;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.inventoryPanel.isVisible()) return;
      if (this.combatActive) return;
      if (this.eventActive) return;
      if (this.stairAction) return;
      if (this.exhausted) return;

      stickCenterX = pointer.x;
      stickCenterY = pointer.y;
      pointerDragged = false;
      this.analogActive = false;
      this.analogDx = 0;
      this.analogDy = 0;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      if (this.inventoryPanel.isVisible()) return;
      if (this.combatActive) return;
      if (this.eventActive) return;
      if (this.stairAction) return;
      if (this.exhausted) return;

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
        this.analogGfx = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.ANALOG);
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
        const floor = this.currentFloor;
        if (floor) {
          const g = isoToGrid(pointer.worldX, pointer.worldY);
          if (g.x >= 0 && g.x < floor.cols && g.y >= 0 && g.y < floor.rows) {
            const tx = this.playerX + this.facingX;
            const ty = this.playerY + this.facingY;
            if (g.x === tx && g.y === ty) {
              const tile = floor.tiles[ty][tx];
    const interactive = this.isBlocked(tile)
      || tile.type === 'stairs_down' || tile.type === 'stairs_up' || tile.type === 'pressure_plate';
              
              if (interactive) {
                this.movePath = [];
                this.analogActive = false;
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
                  // Stairs will be handled by the existing prompt system or a direct call
                  // For now, just let the prompt show if adjacent
                  this.checkEventProximity();
                } else if (tile.type === 'pressure_plate') {
                  // Plate interaction is handled by tryMove's plate check
                  // but since we're just clicking, we should manually trigger a step if possible
                  this.tryMove(this.facingX, this.facingY);
                }
                return;
              }
            }
          }
          this.doClickToMove(pointer.worldX, pointer.worldY, floor);
        }
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
        this.inventoryPanel.show();
      }
      return;
    }

    if (this.combatActive) {
      this.combatPanel.updateStamina(this.stamina.remaining, this.stamina.maxStamina);

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
          }
        }
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        this.combatPanel.handleRetreat();
      }
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
      this.analogActive = false;
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

    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) { this.movePath = []; this.analogActive = false; this.tryUseConsumable('stamina_potion'); return; }
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) { this.movePath = []; this.analogActive = false; this.tryUseConsumable('teleport_scroll'); return; }
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) { this.movePath = []; this.analogActive = false; this.tryUseConsumable('mining_bomb'); return; }

    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.movePath = [];
      this.analogActive = false;
      this.emergencyExtract();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.movePath = [];
      this.analogActive = false;
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

    this.drawStaminaBar();
    this.drawInventoryGauge();
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

    this.eventPanel.show(config, () => {
      this.eventActive = false;
      tile.broken = true;
      this.interactTarget = null;
      this.interactPrompt.setAlpha(0);
      this.drawFloor();
      this.drawMinimap();
    });
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
                gameState.maxStaminaBonus += 2;
                gameState.save();
                this.createPopup(`Rescued: ${name}!`, this.cameras.main.width / 2, 300, '#44cc66');
              },
            },
            { label: 'Leave them', action: () => {} },
          ],
        };
      },

      gambling_goblin: () => {
        const cost = 5;
        const canGamble = stone() >= cost;
        return {
          title: 'Gambling Goblin',
          description: 'A goblin challenges you to a game of chance. Risk 5 Stone for a shot at 3 Silver Ore!',
          choices: [
            {
              label: `Gamble 5 Stone ${canGamble ? '(50% chance for 3 Silver Ore)' : '(not enough stone)'}`,
              action: () => {
                if (stone() >= cost) {
                  removeStone(cost);
                  if (Math.random() < 0.5) addItem('silver_ore', 3);
                }
              },
            },
            { label: 'Walk away', action: () => {} },
          ],
        };
      },

      midrun_shop: () => {
        const hasCarrots = (n: number) => this.inventory.count('carrot') >= n;
        return {
          title: 'Wandering Shop',
          description: 'A merchant has set up shop mid-dungeon. What catches your eye?',
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
    if (this.inventory.count('carrot') >= cost) {
      this.inventory.removeItem('carrot', cost);
      this.giveItem(itemId, 1);
    }
  }

  private showStairPrompt(): void {
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;
    const action = this.stairAction === 'ascend' ? 'Ascend' : 'Descend';

    const bg = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.OVERLAY);
    bg.fillStyle(0x0a0a1a, 0.9);
    bg.fillRect(0, 0, 960, 640);
    bg.lineStyle(2, 0x5a4a7a, 0.6);
    bg.strokeRoundedRect(cx - 140, cy - 40, 280, 100, 10);

    const text = this.add.text(cx, cy - 5, 'Use stairs?', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY_TEXT);
    const hint = this.add.text(cx, cy + 25, `[SPACE] ${action}  [ESC] Cancel`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.OVERLAY_TEXT);
    this.stairPrompt = this.add.container(0, 0, [bg, text, hint]).setDepth(DEPTH.OVERLAY).setScrollFactor(0);
  }

  private hideStairPrompt(): void {
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

    if (this.runSeed) this.dungeonGen.setSeed(`${this.runSeed}_depth_${this.expeditionState.depth}`);
    const floor = this.dungeonGen.generateFloor(this.expeditionState.depth);
    this.currentFloor = floor;
    this.playerX = floor.entryX;
    this.playerY = floor.entryY;
    this.rebuildFloor();
    this.expeditionState.initExplored(floor.cols, floor.rows);
    this.revealSurroundings(8);
  }

  private handleAscend(): void {
    audio.playStairs(true);
    if (this.expeditionState.depth % 5 === 0) {
      this.safeExtract();
    } else {
      this.expeditionState.ascend();
      if (this.runSeed) this.dungeonGen.setSeed(`${this.runSeed}_depth_${this.expeditionState.depth}`);
      const floor = this.dungeonGen.generateFloor(this.expeditionState.depth);
      this.currentFloor = floor;
      this.playerX = floor.stairsDownX;
      this.playerY = floor.stairsDownY;
      this.rebuildFloor();
      this.expeditionState.initExplored(floor.cols, floor.rows);
      this.revealSurroundings(8);
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

    this.depthText.setText(`Floor: ${this.expeditionState.depth}`);

    this.drawMinimap();
    this.rocksBrokenThisRun = 0;
    this.updateDarkness();
  }

  private tryMove(dx: number, dy: number): void {
    if (this.isMoving) return;

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
    const floor = this.currentFloor;
    if (!floor) return;

    const tx = this.playerX + this.facingX;
    const ty = this.playerY + this.facingY;
    if (tx < 0 || tx >= floor.cols || ty < 0 || ty >= floor.rows) return;

    const tile = floor.tiles[ty][tx];
    if (tile.type !== 'mineable' || tile.broken) return;

    console.log('dur 0: ', tile.durability);
    tile.durability -= this.mining.getDamage();
    audio.playMineHit(tile.maxDurability);
    this.cameras.main.shake(50, 0.006);
    console.log('dur 1: ', tile.durability);

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

    if (!this.stamina.consume(5)) {
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

      this.createHitEffect(tx, ty);
      this.createMiningParticles(tx, ty, minedResource);
      this.createItemPopup(tx, ty, minedResource);
      this.spawnItemSprite(tx, ty, minedResource);

      this.checkRecipeDiscovery(minedResource);

      this.cameras.main.shake(120, 0.015);

      // Shockwave ring
      const pp = gridToIso(tx, ty);
      const ring = this.add.circle(pp.x, pp.y, 5, 0xffffff, 0.4).setDepth(DEPTH.EFFECTS);
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
      p.y - 10,
      `+1 ${label}`,
      { fontSize: '13px', fontFamily: 'monospace', color: '#ffcc44', fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(DEPTH.ITEM_POPUP);

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
    this.darknessOverlay.fillRect(sx - pad, sy - pad, w + pad * 2, cy - r - sy + pad);
    this.darknessOverlay.fillRect(sx - pad, cy + r, w + pad * 2, sy + h + pad - (cy + r));
    this.darknessOverlay.fillRect(sx - pad, cy - r, cx - r - sx + pad, 2 * r);
    this.darknessOverlay.fillRect(cx + r, cy - r, sx + w + pad - (cx + r), 2 * r);
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

    this.add.text(
      cx, cy,
      'EXHAUSTED\nTeleporting home...',
      { fontSize: '24px', fontFamily: 'monospace', color: '#cc4444', align: 'center' }
    ).setOrigin(0.5).setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);

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

    this.add.text(
      cx, cy,
      'Returning to Homeland...',
      { fontSize: '20px', fontFamily: 'monospace', color: '#44cc66' }
    ).setOrigin(0.5).setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);

    const overlay = this.add.rectangle(
      cx, cy,
      this.cameras.main.width, this.cameras.main.height,
      0x000000, 0
    ).setDepth(DEPTH.OVERLAY).setScrollFactor(0);

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

    this.add.text(
      cx, cy,
      'Giving Up...\nLosing some items...',
      { fontSize: '18px', fontFamily: 'monospace', color: '#cc8844', align: 'center' }
    ).setOrigin(0.5).setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);

    const overlay = this.add.rectangle(
      cx, cy,
      this.cameras.main.width, this.cameras.main.height,
      0x000000, 0
    ).setDepth(DEPTH.OVERLAY).setScrollFactor(0);

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
    };

    this.combatActive = true;
    audio.playCombatStart();
    this.interactPrompt.setAlpha(0);
    this.interactTarget = null;

    this.combatPanel.show(
      config,
      (result: CombatResult, rewards: { id: string; quantity: number }[]) => {
        this.combatActive = false;
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
    this.stamina.remaining,
    this.stamina.maxStamina,
  );
  }

  private tryUseConsumable(itemId: string): void {
    if (this.exhausted) return;

    if (this.inventory.count(itemId) <= 0) return;

    switch (itemId) {
      case 'stamina_potion': {
        this.inventory.removeItem(itemId, 1);
        this.stamina.refill(30);
        this.showConsumableFeedback('+30 Stamina');
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
    const cx = this.cameras.main.width / 2;
    this.createPopup(text, cx, 180, '#44ff88', { duration: 1200, moveY: -30, scaleTo: 0.9 });
  }

  private giveItem(id: string, qty: number): void {
    this.inventory.addItem(id, qty);
    this.drawInventoryGauge();
    this.queueObtainPopup(id, qty);
  }

  private queueObtainPopup(id: string, qty: number): void {
    if (this.activeObtainPopups.length >= 8) return;

    const y = 116 + this.activeObtainPopups.length * 36;
    const container = this.add.container(20, y).setScrollFactor(0).setDepth(DEPTH.HUD + 2);

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
    const targetX = 100;
    const targetY = 50;
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
