import Phaser from 'phaser';
import { StaminaSystem } from '../systems/StaminaSystem';
import { MiningSystem } from '../systems/MiningSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { DungeonGenerator, DungeonFloor } from '../systems/DungeonGenerator';
import { ExpeditionState } from '../systems/ExpeditionState';
import { gameState, itemDisplayName } from '../systems/GameState';
import { InventoryPanel } from '../ui/InventoryPanel';
import { EventPanel, EventChoice, EventConfig } from '../ui/EventPanel';
import { CombatPanel, CombatResult, EnemyConfig } from '../ui/CombatPanel';
import {
  gridToIso, tileSortKey, drawDiamond, drawDiamondAt,
  drawExtrudedAt,
  HALF_W, HALF_H, WALL_HEIGHT, worldWidth, worldHeight,
} from '../systems/IsoUtils';

interface Palette {
  wall: [number, number, number];
  floor: [number, number];
  corridor: number;
}

function getDepthPalette(depth: number): Palette {
  if (depth <= 4) {
    return {
      wall: [0x3a3a4a, 0x2a2a3a, 0x222230],
      floor: [0x1a1a2a, 0x1e1e30],
      corridor: 0x151520,
    };
  }
  if (depth <= 9) {
    return {
      wall: [0x4a3a2a, 0x3a2a1a, 0x302218],
      floor: [0x2a1a12, 0x30201a],
      corridor: 0x221510,
    };
  }
  if (depth <= 14) {
    return {
      wall: [0x4a6a8a, 0x3a5a7a, 0x2a4a6a],
      floor: [0x8a9aaa, 0x7a8a9a],
      corridor: 0x6a7a8a,
    };
  }
  if (depth <= 19) {
    return {
      wall: [0x5a2a1a, 0x4a1a12, 0x3a120a],
      floor: [0x2a1a0a, 0x3a2010],
      corridor: 0x1a0a08,
    };
  }
  return {
    wall: [0x3a2a4a, 0x2a1a3a, 0x20122a],
    floor: [0x1a0e22, 0x22122a],
    corridor: 0x140a1a,
  };
}

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
  private tileSprites!: Phaser.GameObjects.Graphics;
  private staminaBar!: Phaser.GameObjects.Graphics;
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
  private exhausted: boolean = false;
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

  constructor() {
    super({ key: 'ExpeditionScene' });
    this.stamina = new StaminaSystem(100);
    this.mining = new MiningSystem();
    this.inventory = new InventorySystem(16, false);
    this.dungeonGen = new DungeonGenerator();
    this.expeditionState = new ExpeditionState();
  }

  init(data: { debug?: boolean; consumables?: Record<string, number> }): void {
    this.debugMode = data?.debug ?? false;
    this.loadoutConsumables = data?.consumables ?? {};
  }

  create(): void {
    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#0a0a0a');

    this.exhausted = false;
    this.hasFinished = false;
    const staminaMax = this.debugMode ? 10000 : 100 + gameState.maxStaminaBonus;
    this.stamina = new StaminaSystem(staminaMax);
    this.mining = new MiningSystem();
    this.mining.setPickaxeTier(gameState.currentPickaxeTier);
    this.inventory = new InventorySystem(16 + gameState.inventorySlotBonus, false);
    for (const [id, qty] of Object.entries(this.loadoutConsumables)) {
      if (qty > 0) this.inventory.addItem(id, qty);
    }
    if (this.debugMode) {
      this.inventory.addItem('stamina_potion', 5);
      this.inventory.addItem('mining_bomb', 5);
    }
    this.expeditionState.reset();
    this.moveTimer = 0;
    this.tileSprites = this.add.graphics();

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

    this.minimapBg = this.add.graphics().setScrollFactor(0).setDepth(50);
    this.minimapGfx = this.add.graphics().setScrollFactor(0).setDepth(51);
    this.minimapDot = this.add.rectangle(0, 0, 3, 3, 0x88ccff).setScrollFactor(0).setDepth(52);

    this.interactPrompt = this.add.text(0, 0, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffdd88',
    }).setOrigin(0.5).setAlpha(0).setDepth(55);

    this.currentFloor = this.dungeonGen.generateFloor(0);

    const floor = this.currentFloor;
    this.playerX = floor.entryX;
    this.playerY = floor.entryY;

    this.drawFloor();
    this.createPlayer();
    this.createHUD();
    this.setupInput();

    const xMin = -floor.rows * HALF_W;
    const yMin = -HALF_H;
    this.cameras.main.startFollow(this.player, true, 0.5, 0.5);
    this.cameras.main.setBounds(xMin, yMin, worldWidth(floor.cols, floor.rows), worldHeight(floor.cols, floor.rows));

    this.drawMinimap();
  }

  private drawFloor(): void {
    this.tileSprites.clear();

    const floor = this.currentFloor;
    if (!floor) return;

    const pal = getDepthPalette(floor.depth);

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
      const checker = (x + y) % 2 === 0;

      switch (tile.type) {
        case 'wall':
          drawExtrudedAt(this.tileSprites, x, y, pal.wall[0], pal.wall[1], pal.wall[2], 12);
          break;
        case 'floor':
          drawDiamondAt(this.tileSprites, x, y, pal.floor[0]);
          if (checker) drawDiamondAt(this.tileSprites, x, y, pal.floor[1], 0.5);
          break;
        case 'corridor':
          drawDiamondAt(this.tileSprites, x, y, pal.corridor);
          break;
        case 'mineable':
          drawDiamondAt(this.tileSprites, x, y, pal.floor[0]);
          if (checker) drawDiamondAt(this.tileSprites, x, y, pal.floor[1], 0.5);
          if (!tile.broken) {
            this.drawOreIso(p.x, p.y, tile.resource, tile.durability, tile.maxDurability);
          }
          break;
        case 'stairs_up':
          drawDiamondAt(this.tileSprites, x, y, 0x1a2a1a);
          this.tileSprites.fillStyle(0x44cc66, 0.7);
          this.tileSprites.fillTriangle(p.x - 10, p.y + 8, p.x, p.y - 12, p.x + 10, p.y + 8);
          break;
        case 'stairs_down':
          drawDiamondAt(this.tileSprites, x, y, 0x1a1a2e);
          this.tileSprites.fillStyle(0x8866cc, 0.7);
          this.tileSprites.fillTriangle(p.x - 10, p.y - 8, p.x, p.y + 12, p.x + 10, p.y - 8);
          break;
        default:
          if (tile.type.startsWith('event_')) {
            this.drawEventTileIso(p.x, p.y, tile.type, tile.broken);
          } else if (tile.type === 'enemy' && !tile.broken) {
            this.drawEnemyTileIso(p.x, p.y, tile.resource);
          } else if (tile.type === 'event_boss' && !tile.broken) {
            this.drawBossTileIso(p.x, p.y);
          } else if ((tile.type === 'enemy' || tile.type === 'event_boss') && tile.broken) {
            drawDiamondAt(this.tileSprites, x, y, pal.floor[0]);
            if (checker) drawDiamondAt(this.tileSprites, x, y, pal.floor[1], 0.5);
          }
          break;
      }
    }
  }

  private drawEventTileIso(cx: number, cy: number, type: string, used: boolean): void {
    drawDiamond(this.tileSprites, cx, cy, 0x1a1a2a);
    if (used) return;

    switch (type) {
      case 'event_chest':
        this.tileSprites.fillStyle(0x8a6a3a, 1);
        this.tileSprites.fillRoundedRect(cx - 14, cy - 12, 28, 20, 3);
        this.tileSprites.fillStyle(0xccaa44, 1);
        this.tileSprites.fillRect(cx - 4, cy - 6, 8, 4);
        break;
      case 'event_merchant':
        this.tileSprites.fillStyle(0x3a5a8a, 1);
        this.tileSprites.fillCircle(cx, cy - 10, 6);
        this.tileSprites.fillRect(cx - 10, cy - 4, 20, 16);
        break;
      case 'event_goblin':
        this.tileSprites.fillStyle(0x5a8a3a, 1);
        this.tileSprites.fillCircle(cx, cy - 10, 6);
        this.tileSprites.fillRect(cx - 10, cy - 4, 20, 16);
        break;
      case 'event_villager':
        this.tileSprites.fillStyle(0xcc8844, 1);
        this.tileSprites.fillCircle(cx, cy - 10, 6);
        this.tileSprites.fillRect(cx - 10, cy - 4, 20, 16);
        break;
      case 'event_fountain':
        this.tileSprites.fillStyle(0x3a5a8a, 1);
        this.tileSprites.fillRoundedRect(cx - 14, cy - 12, 28, 20, 6);
        this.tileSprites.fillStyle(0x5a8acc, 0.6);
        this.tileSprites.fillRoundedRect(cx - 10, cy - 8, 20, 12, 4);
        break;
      case 'event_shop':
        this.tileSprites.fillStyle(0x8a6a3a, 1);
        this.tileSprites.fillRect(cx - 14, cy - 4, 28, 16);
        this.tileSprites.fillStyle(0xccaa44, 1);
        this.tileSprites.fillTriangle(cx - 6, cy + 8, cx + 6, cy + 8, cx, cy - 8);
        break;
      case 'event_treasure_vault':
        this.tileSprites.fillStyle(0xccaa44, 1);
        this.tileSprites.fillRoundedRect(cx - 14, cy - 10, 28, 20, 4);
        this.tileSprites.fillStyle(0xffdd66, 1);
        this.tileSprites.fillRect(cx - 4, cy - 4, 8, 8);
        this.tileSprites.fillStyle(0x88ccff, 0.7);
        this.tileSprites.fillRect(cx - 2, cy - 2, 4, 4);
        break;
    }
  }

  private drawEnemyTileIso(cx: number, cy: number, type: string): void {
    drawDiamond(this.tileSprites, cx, cy, 0x1a1a2a);

    const colors: Record<string, number> = {
      slime: 0x44aa44,
      rat: 0x8a6a3a,
      bat: 0x6a4a7a,
    };
    const color = colors[type] ?? 0xaa4444;

    this.tileSprites.fillStyle(0x000000, 0.3);
    this.tileSprites.fillCircle(cx - 3, cy + 5, 10);

    this.tileSprites.fillStyle(color, 0.7);
    this.tileSprites.fillCircle(cx - 3, cy - 3, 9);
  }

  private drawBossTileIso(cx: number, cy: number): void {
    drawDiamond(this.tileSprites, cx, cy, 0x1a1a2a);

    this.tileSprites.fillStyle(0xcc4444, 1);
    this.tileSprites.fillCircle(cx, cy, 14);

    this.tileSprites.fillStyle(0xaa2222, 0.5);
    this.tileSprites.fillCircle(cx, cy, 10);

    this.tileSprites.lineStyle(2, 0xff6644, 0.8);
    this.tileSprites.strokeCircle(cx, cy, 14);

    this.tileSprites.fillStyle(0xffff00, 0.6);
    this.tileSprites.fillTriangle(cx - 4, cy - 8, cx, cy - 14, cx + 4, cy - 8);
  }

  private drawOreIso(cx: number, cy: number, resource: string, durability: number, maxDurability: number): void {
    const ratio = maxDurability > 0 ? durability / maxDurability : 1;

    drawDiamond(this.tileSprites, cx, cy, 0x000000, 0.2);

    switch (resource) {
      case 'stone':
        this.tileSprites.fillStyle(0x5a5a6a, 1);
        this.tileSprites.fillRoundedRect(cx - 14, cy - 14, 28, 28, 4);
        this.tileSprites.fillStyle(0x6a6a7a, 1);
        this.tileSprites.fillRoundedRect(cx - 8, cy - 8, 10, 10, 2);
        break;
      case 'bronze_ore':
        this.tileSprites.fillStyle(0x8a6a3a, 1);
        this.tileSprites.fillRoundedRect(cx - 14, cy - 14, 28, 28, 4);
        this.tileSprites.fillStyle(0xaa8a4a, 1);
        this.tileSprites.fillRect(cx - 6, cy - 6, 12, 12);
        break;
      case 'silver_ore':
        this.tileSprites.fillStyle(0x7a8a9a, 1);
        this.tileSprites.fillRoundedRect(cx - 14, cy - 14, 28, 28, 4);
        this.tileSprites.fillStyle(0x9aaabc, 1);
        this.tileSprites.fillRect(cx - 6, cy - 6, 12, 12);
        break;
      case 'gold_ore':
        this.tileSprites.fillStyle(0x8a7a2a, 1);
        this.tileSprites.fillRoundedRect(cx - 14, cy - 14, 28, 28, 4);
        this.tileSprites.fillStyle(0xccaa44, 1);
        this.tileSprites.fillRect(cx - 6, cy - 6, 12, 12);
        break;
      case 'crystal':
        this.tileSprites.fillStyle(0x6a4a8a, 1);
        this.tileSprites.fillRoundedRect(cx - 14, cy - 14, 28, 28, 4);
        this.tileSprites.fillStyle(0x9a6acc, 1);
        this.tileSprites.fillRect(cx - 6, cy - 6, 12, 12);
        break;
      case 'monster_drop':
        this.tileSprites.fillStyle(0x8a3a3a, 1);
        this.tileSprites.fillRoundedRect(cx - 14, cy - 14, 28, 28, 4);
        break;
    }

    if (ratio <= 0.66) {
      const darken = ratio <= 0.33 ? 0.45 : 0.25;
      this.tileSprites.fillStyle(0x000000, darken);
      this.tileSprites.fillRoundedRect(cx - 14, cy - 14, 28, 28, 4);
    }

    if (ratio <= 0.33) {
      this.tileSprites.lineStyle(1, 0x000000, 0.5);
      this.tileSprites.lineBetween(cx - 10, cy - 12, cx + 10, cy + 12);
      this.tileSprites.lineBetween(cx + 10, cy - 12, cx - 10, cy + 12);
    }
  }

  private createPlayer(): void {
    const p = gridToIso(this.playerX, this.playerY);
    const container = this.add.container(p.x, p.y);

    const base = this.add.graphics();
    base.fillStyle(0x6699cc, 1);
    base.beginPath();
    base.moveTo(0, -10);
    base.lineTo(14, 0);
    base.lineTo(0, 10);
    base.lineTo(-14, 0);
    base.closePath();
    base.fill();
    container.add(base);

    const body = this.add.rectangle(0, -20, 12, 20, 0x88ccff);
    container.add(body);

    container.setDepth(10);
    this.player = container;
  }

  private repositionPlayer(): void {
    const p = gridToIso(this.playerX, this.playerY);
    this.player.setPosition(p.x, p.y);
  }

  private createHUD(): void {
    const camW = this.cameras.main.width;

    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x0a0a1a, 0.75);
    hudBg.fillRoundedRect(8, 8, 280, 100, 6);
    hudBg.setScrollFactor(0);
    hudBg.setDepth(50);

    this.staminaBar = this.add.graphics();
    this.staminaBar.setScrollFactor(0);
    this.staminaBar.setDepth(51);

    this.staminaText = this.add.text(20, 14, 'Stamina', {
      fontSize: '12px', fontFamily: 'monospace', color: '#8a7a6a',
    }).setScrollFactor(0).setDepth(51);

    this.drawStaminaBar();

    this.depthText = this.add.text(20, 76, 'Floor: 0', {
      fontSize: '12px', fontFamily: 'monospace', color: '#7a8a9a',
    }).setScrollFactor(0).setDepth(51);

    this.inventoryText = this.add.text(20, 56, 'Slots: 0/0', {
      fontSize: '12px', fontFamily: 'monospace', color: '#6a5a4a',
    }).setScrollFactor(0).setDepth(51);

    this.add.text(20, 92, '[TAB] Inventory', {
      fontSize: '11px', fontFamily: 'monospace', color: '#4a5a4a',
    }).setScrollFactor(0).setDepth(51);

    const infoBg = this.add.graphics();
    infoBg.fillStyle(0x0a0a1a, 0.75);
    infoBg.fillRoundedRect(camW - 228, 8, 220, 84, 6);
    infoBg.setScrollFactor(0);
    infoBg.setDepth(50);

    const pickaxeNames: Record<number, string> = {
      1: 'Common Pickaxe',
      2: 'Bronze Pickaxe',
      3: 'Silver Pickaxe',
    };
    const pName = pickaxeNames[gameState.currentPickaxeTier] ?? `Tier ${gameState.currentPickaxeTier}`;

    this.add.text(camW - 218, 14, `Pickaxe: ${pName}`, {
      fontSize: '11px', fontFamily: 'monospace', color: '#6a8a6a',
    }).setScrollFactor(0).setDepth(51);

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
        .setScrollFactor(0).setDepth(51);

      this.add.text(barX + barW + 6, barY - 2, `${runsLeft}/${maxRuns}`, {
        fontSize: '10px', fontFamily: 'monospace', color: '#6a8a6a',
      }).setScrollFactor(0).setDepth(51);
    }

    this.add.text(camW - 218, 40, '[ESC] Give Up  [SPACE] Mine', {
      fontSize: '11px', fontFamily: 'monospace', color: '#5a4a6a',
    }).setScrollFactor(0).setDepth(51);

    this.add.text(camW - 218, 56, '[Q] Potion  [E] Scroll  [F] Bomb', {
      fontSize: '11px', fontFamily: 'monospace', color: '#4a6a5a',
    }).setScrollFactor(0).setDepth(51);
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
            if ((tile.type === 'enemy' || tile.type === 'event_boss') && !tile.broken) {
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
      }
      return;
    }

    this.moveTimer += delta;

    if (this.exhausted) return;

    this.checkEventProximity();

    if (this.interactTarget && Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
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

    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) { this.tryUseConsumable('stamina_potion'); return; }
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) { this.tryUseConsumable('teleport_scroll'); return; }
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) { this.tryUseConsumable('mining_bomb'); return; }

    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.emergencyExtract();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.tryMine();
      return;
    }

    if (this.moveTimer >= this.moveDelay) {
      let dx = 0;
      let dy = 0;

      if (this.keys.A.isDown || this.keys.LEFT.isDown) dx = -1;
      else if (this.keys.D.isDown || this.keys.RIGHT.isDown) dx = 1;
      if (this.keys.W.isDown || this.keys.UP.isDown) dy = -1;
      else if (this.keys.S.isDown || this.keys.DOWN.isDown) dy = 1;

      if (dx !== 0 && dy !== 0) dy = 0;

      if (dx !== 0 || dy !== 0) {
        this.facingX = dx;
        this.facingY = dy;
        this.tryMove(dx, dy);
        this.moveTimer = 0;
      }
    }

    this.drawStaminaBar();
    const slots = this.inventory.getItems();
    const used = slots.filter(s => s !== null).length;
    this.inventoryText.setText(`Slots: ${used}/${slots.length}`);
  }

  private checkEventProximity(): void {
    const floor = this.currentFloor;
    if (!floor) return;

    const checkPositions = [
      { x: this.playerX, y: this.playerY },
      { x: this.playerX + 1, y: this.playerY },
      { x: this.playerX - 1, y: this.playerY },
      { x: this.playerX, y: this.playerY + 1 },
      { x: this.playerX, y: this.playerY - 1 },
    ];

    for (const pos of checkPositions) {
      if (pos.x < 0 || pos.x >= floor.cols || pos.y < 0 || pos.y >= floor.rows) continue;
      const tile = floor.tiles[pos.y][pos.x];
      if (tile.type === 'enemy' && !tile.broken) {
        this.interactTarget = { x: pos.x, y: pos.y, id: tile.eventId };
        if (this.stamina.remaining <= 10) {
          this.interactPrompt.setText('Not enough stamina!');
        } else {
          this.interactPrompt.setText('[SPACE] Fight!');
        }
        this.interactPrompt.setPosition(this.player.x, this.player.y - 30);
        this.interactPrompt.setAlpha(1);
        return;
      }
      if (tile.type === 'event_boss' && !tile.broken) {
        this.interactTarget = { x: pos.x, y: pos.y, id: 'boss' };
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
        this.interactTarget = { x: pos.x, y: pos.y, id: tile.eventId };
        const labels: Record<string, string> = {
          event_chest: '[SPACE] Open chest',
          event_merchant: '[SPACE] Talk to merchant',
          event_goblin: '[SPACE] Talk to goblin',
          event_villager: '[SPACE] Rescue villager',
          event_fountain: '[SPACE] Drink from fountain',
          event_shop: '[SPACE] Browse wares',
          event_treasure_vault: '[SPACE] Open vault',
        };
        this.interactPrompt.setText(labels[tile.type] ?? '[SPACE] Interact');
        this.interactPrompt.setPosition(this.player.x, this.player.y - 30);
        this.interactPrompt.setAlpha(1);
        return;
      }
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
      this.tileSprites.clear();
      this.drawFloor();
      this.drawMinimap();
    });
  }

  private buildEventConfig(id: string): EventConfig | null {
    const stone = () => gameState.inventory.count('stone');
    const removeStone = (n: number) => gameState.inventory.removeItem('stone', n);
    const addItem = (id: string, qty: number) => gameState.inventory.addItem(id, qty);

    switch (id) {
      case 'hidden_treasure': {
        const depth = this.expeditionState.depth;
        const pool = ['stone', 'bronze_ore', 'silver_ore', 'gold_ore'];
        const idx = Math.min(depth, pool.length - 1);
        const reward = pool[idx];
        return {
          title: 'Hidden Treasure',
          description: 'You find a hidden cache of resources!',
          choices: [
            {
              label: `Take +3 ${itemDisplayName(reward)}`,
              action: () => { addItem(reward, 3); },
            },
          ],
        };
      }

      case 'blessing_fountain': {
        return {
          title: 'Blessing Fountain',
          description: 'A mystical fountain pulses with energy. Drinking from it could restore your stamina.',
          choices: [
            {
              label: 'Drink (+30 Stamina)',
              action: () => { this.stamina.refill(30); },
            },
            {
              label: 'Skip',
              action: () => {},
            },
          ],
        };
      }

      case 'wandering_trader': {
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
            {
              label: 'Decline',
              action: () => {},
            },
          ],
        };
      }

      case 'trapped_villager': {
        const alreadyDiscovered = gameState.crafting.isDiscovered('stamina_potion');
        return {
          title: 'Trapped Villager',
          description: 'A frightened villager is trapped in the dungeon! Rescue them and they will share knowledge.',
          choices: [
            {
              label: alreadyDiscovered ? 'Rescue (already know recipe)' : 'Rescue (learn Stamina Potion recipe)',
              action: () => {
                if (!alreadyDiscovered) {
                  gameState.crafting.discover('stamina_potion');
                  this.showRecipeDiscovery('Stamina Potion');
                }
                gameState.villagersRescued++;
                gameState.maxStaminaBonus += 2;
                gameState.save();
              },
            },
            {
              label: 'Leave them',
              action: () => {},
            },
          ],
        };
      }

      case 'gambling_goblin': {
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
                  if (Math.random() < 0.5) {
                    addItem('silver_ore', 3);
                  }
                }
              },
            },
            {
              label: 'Walk away',
              action: () => {},
            },
          ],
        };
      }

      case 'midrun_shop': {
        const hasCarrots = (n: number) => gameState.inventory.count('carrot') >= n;
        return {
          title: 'Wandering Shop',
          description: 'A merchant has set up shop mid-dungeon. What catches your eye?',
          choices: [
            {
              label: `Stamina Potion — 5 carrots ${hasCarrots(5) ? '' : '(not enough)'}`,
              action: () => this.buyAtShop('stamina_potion', 5),
            },
            {
              label: `Teleport Scroll — 8 carrots ${hasCarrots(8) ? '' : '(not enough)'}`,
              action: () => this.buyAtShop('teleport_scroll', 8),
            },
            {
              label: `Mining Bomb — 6 carrots ${hasCarrots(6) ? '' : '(not enough)'}`,
              action: () => this.buyAtShop('mining_bomb', 6),
            },
            {
              label: 'Leave',
              action: () => {},
            },
          ],
        };
      }

      case 'treasure_vault': {
        const depth = this.expeditionState.depth;
        const goldAmt = 3 + Math.floor(depth / 3);
        const crystalAmt = 3 + Math.floor(depth / 4);
        return {
          title: 'Treasure Vault',
          description: 'A glittering stash of precious resources!',
          choices: [
            {
              label: `Claim +${goldAmt} Gold Ore, +${crystalAmt} Crystal`,
              action: () => {
                addItem('gold_ore', goldAmt);
                addItem('crystal', crystalAmt);
              },
            },
          ],
        };
      }

      default:
        return null;
    }
  }

  private buyAtShop(itemId: string, cost: number): void {
    if (gameState.inventory.count('carrot') >= cost) {
      gameState.inventory.removeItem('carrot', cost);
      gameState.inventory.addItem(itemId, 1);
    }
  }

  private showStairPrompt(): void {
    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;

    const bg = this.add.graphics().setScrollFactor(0).setDepth(100);
    bg.fillStyle(0x0a0a1a, 0.85);
    bg.fillRoundedRect(cx - 160, cy - 50, 320, 100, 8);
    bg.lineStyle(1, 0x5a4a7a, 0.5);
    bg.strokeRoundedRect(cx - 160, cy - 50, 320, 100, 8);

    let label: string;
    if (this.stairAction === 'ascend' && this.expeditionState.depth % 5 === 0) {
      label = 'Return to homeland?';
    } else {
      const dir = this.stairAction === 'ascend' ? 'Ascend' : 'Descend';
      const next = this.stairAction === 'ascend' ? this.expeditionState.depth - 1 : this.expeditionState.depth + 1;
      label = `${dir} to floor ${next}?`;
    }
    const text = this.add.text(cx, cy - 20, label, {
      fontSize: '16px', fontFamily: 'monospace', color: '#e8d5b7',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    const hint = this.add.text(cx, cy + 15, '[SPACE] Confirm  |  [ESC] Cancel', {
      fontSize: '12px', fontFamily: 'monospace', color: '#7a6a5a',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    this.stairPrompt = this.add.container(0, 0, [bg, text, hint]).setDepth(100).setScrollFactor(0);
  }

  private hideStairPrompt(): void {
    if (this.stairPrompt) {
      this.stairPrompt.destroy();
      this.stairPrompt = null;
    }
  }

  private handleDescend(): void {
    this.expeditionState.descend();

    if (this.expeditionState.depth >= 2 && !gameState.crafting.isDiscovered('mining_bomb')) {
      gameState.crafting.discover('mining_bomb');
      this.showRecipeDiscovery('Mining Bomb');
    }

    const floor = this.dungeonGen.generateFloor(this.expeditionState.depth);
    this.currentFloor = floor;
    this.playerX = floor.entryX;
    this.playerY = floor.entryY;
    this.rebuildFloor();
  }

  private handleAscend(): void {
    if (this.expeditionState.depth % 5 === 0) {
      this.safeExtract();
    } else {
      this.expeditionState.ascend();
      const floor = this.dungeonGen.generateFloor(this.expeditionState.depth);
      this.currentFloor = floor;
      this.playerX = floor.stairsDownX;
      this.playerY = floor.stairsDownY;
      this.rebuildFloor();
    }
  }

  private checkRecipeDiscovery(resource: string): void {
    if (resource === 'silver_ore' && !gameState.crafting.isDiscovered('pickaxe_3')) {
      gameState.crafting.discover('pickaxe_3');
      this.showRecipeDiscovery('Silver Pickaxe');
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
    const cx = this.cameras.main.width / 2;

    const popup = this.add.text(
      cx, 130,
      `New Recipe: ${name}!`,
      { fontSize: '16px', fontFamily: 'monospace', color: '#44ccff', fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(200).setScrollFactor(0);

    this.tweens.add({
      targets: popup,
      y: popup.y - 40,
      alpha: 0,
      scale: { from: 1.1, to: 0.9 },
      duration: 2000,
      ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }

  private rebuildFloor(): void {
    const floor = this.currentFloor;
    if (!floor) return;

    this.interactTarget = null;
    this.interactPrompt.setAlpha(0);

    this.tileSprites.clear();
    this.drawFloor();
    this.repositionPlayer();
    this.cameras.main.stopFollow();
    const xMin = -floor.rows * HALF_W;
    const yMin = -HALF_H;
    this.cameras.main.startFollow(this.player, true, 0.5, 0.5);
    this.cameras.main.setBounds(xMin, yMin, worldWidth(floor.cols, floor.rows), worldHeight(floor.cols, floor.rows));

    this.depthText.setText(`Floor: ${this.expeditionState.depth}`);

    this.drawMinimap();
  }

  private tryMove(dx: number, dy: number): void {
    if (this.isMoving) return;

    const floor = this.currentFloor;
    if (!floor) return;

    const nx = this.playerX + dx;
    const ny = this.playerY + dy;

    if (nx < 0 || nx >= floor.cols || ny < 0 || ny >= floor.rows) return;

    const tile = floor.tiles[ny][nx];
    if (tile.type === 'wall') return;
    if (tile.type === 'mineable' && !tile.broken) return;
    if ((tile.type === 'enemy' || tile.type === 'event_boss') && !tile.broken) return;
    if (tile.type.startsWith('event_') && !tile.broken) return;
    if (tile.type === 'stairs_up') {
      this.stairTargetX = nx;
      this.stairTargetY = ny;
      this.stairAction = 'ascend';
      this.showStairPrompt();
      return;
    } else if (tile.type === 'stairs_down') {
      this.stairTargetX = nx;
      this.stairTargetY = ny;
      this.stairAction = 'descend';
      this.showStairPrompt();
      return;
    }

    this.playerX = nx;
    this.playerY = ny;

    const target = gridToIso(nx, ny);
    this.isMoving = true;
    this.tweens.add({
      targets: this.player,
      x: target.x,
      y: target.y,
      duration: 100,
      ease: 'Linear',
      onComplete: () => { this.isMoving = false; },
    });

    this.updateMinimapDot();

    if (!this.stamina.consume(2)) {
      this.handleExhaustion();
    }
  }

  private tryMine(): void {
    const floor = this.currentFloor;
    if (!floor) return;

    const tx = this.playerX + this.facingX;
    const ty = this.playerY + this.facingY;
    if (tx < 0 || tx >= floor.cols || ty < 0 || ty >= floor.rows) return;

    const tile = floor.tiles[ty][tx];
    if (tile.type !== 'mineable' || tile.broken) return;

    tile.durability -= this.mining.getDamage();

    if (!this.stamina.consume(5)) {
      this.handleExhaustion();
    }

    if (tile.durability <= 0) {
      tile.broken = true;
      this.inventory.addItem(tile.resource, 1);

      this.createHitEffect(tx, ty);
      this.createMiningParticles(tx, ty, tile.resource);
      this.createItemPopup(tx, ty, tile.resource);

      this.checkRecipeDiscovery(tile.resource);

      this.tileSprites.clear();
      this.drawFloor();
      this.drawMinimap();
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

    for (let i = 0; i < 6; i++) {
      const p = this.add.rectangle(
        cx, cy,
        Phaser.Math.Between(3, 6), Phaser.Math.Between(3, 6),
        color
      ).setDepth(15);

      this.tweens.add({
        targets: p,
        x: cx + Phaser.Math.Between(-30, 30),
        y: cy + Phaser.Math.Between(-30, 30),
        alpha: 0,
        scale: 0,
        duration: 400,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  private createHitEffect(tx: number, ty: number): void {
    const p = gridToIso(tx, ty);
    const cx = p.x;
    const cy = p.y;

    const flash = this.add.rectangle(cx, cy, HALF_W * 2, HALF_H * 2, 0xffffff, 0.3).setDepth(15);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 150,
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
    ).setOrigin(0.5).setDepth(25);

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
    gameState.save();

    gameState.lastRunResult = { itemsObtained: obtained, itemsLost: lost, extractType, depth: this.expeditionState.depth };

    this.time.delayedCall(800, () => {
      this.scene.start('ExpeditionRecapScene');
    });
  }

  private handleExhaustion(): void {
    if (this.exhausted) return;
    this.exhausted = true;
    this.cameras.main.shake(300, 0.01);

    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;

    const overlay = this.add.rectangle(
      cx, cy,
      this.cameras.main.width, this.cameras.main.height,
      0x000000, 0
    ).setDepth(100).setScrollFactor(0);

    this.add.text(
      cx, cy,
      'EXHAUSTED\nTeleporting home...',
      { fontSize: '24px', fontFamily: 'monospace', color: '#cc4444', align: 'center' }
    ).setOrigin(0.5).setDepth(101).setScrollFactor(0);

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

    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;

    this.add.text(
      cx, cy,
      'Returning to Homeland...',
      { fontSize: '20px', fontFamily: 'monospace', color: '#44cc66' }
    ).setOrigin(0.5).setDepth(101).setScrollFactor(0);

    const overlay = this.add.rectangle(
      cx, cy,
      this.cameras.main.width, this.cameras.main.height,
      0x000000, 0
    ).setDepth(100).setScrollFactor(0);

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

    const cx = this.cameras.main.width / 2;
    const cy = this.cameras.main.height / 2;

    this.add.text(
      cx, cy,
      'Giving Up...\nLosing some items...',
      { fontSize: '18px', fontFamily: 'monospace', color: '#cc8844', align: 'center' }
    ).setOrigin(0.5).setDepth(101).setScrollFactor(0);

    const overlay = this.add.rectangle(
      cx, cy,
      this.cameras.main.width, this.cameras.main.height,
      0x000000, 0
    ).setDepth(100).setScrollFactor(0);

    this.tweens.add({
      targets: overlay,
      alpha: 0.6,
      duration: 600,
      onComplete: () => {
        this.finishRun('emergency', 0.3);
      },
    });
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
      rewards: data.rewards,
      ringBonusDamage: ringEffects.bonusDamage,
      ringCritChance: ringEffects.critChance,
    };

    this.combatActive = true;
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
          this.inventory.addItem(r.id, r.quantity * lootMult);
          this.createItemPopup(tx, ty, r.id);
        }

        if (!isBoss && (enemyType === 'slime' || enemyType === 'rat' || enemyType === 'bat')) {
          gameState.monsterKills[enemyType as 'slime' | 'rat' | 'bat']++;
          this.checkRingDiscovery();
        }

        if (isBoss) {
          tile.type = 'stairs_down';
          tile.resource = '';
          tile.broken = false;
          this.tileSprites.clear();
          this.drawFloor();
          this.drawMinimap();

          if (!gameState.crafting.isDiscovered('stamina_potion')) {
            gameState.crafting.discover('stamina_potion');
            this.showRecipeDiscovery('Stamina Potion');
          }
        } else {
          tile.broken = true;
          this.tileSprites.clear();
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

  private detonateMiningBomb(): void {
    const floor = this.currentFloor;
    if (!floor) return;

    const damage = this.mining.getDamage();
    const dirs = [
      { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
      { x: -1, y: 0 },                     { x: 1, y: 0 },
      { x: -1, y: 1 },  { x: 0, y: 1 },  { x: 1, y: 1 },
    ];
    let changed = false;

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
        this.inventory.addItem(tile.resource, 1);
        this.createMiningParticles(tx, ty, tile.resource);
        this.createItemPopup(tx, ty, tile.resource);
        this.checkRecipeDiscovery(tile.resource);
      }
      changed = true;
    }

    if (changed) {
      this.tileSprites.clear();
      this.drawFloor();
      this.drawMinimap();
    }
  }

  private showConsumableFeedback(text: string): void {
    const cx = this.cameras.main.width / 2;
    const popup = this.add.text(cx, 180, text, {
      fontSize: '16px', fontFamily: 'monospace', color: '#44ff88', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(200).setScrollFactor(0);

    this.tweens.add({
      targets: popup,
      y: popup.y - 30,
      alpha: 0,
      duration: 1200,
      ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }

  private trashItem(itemId: string): void {
    if (this.inventory.count(itemId) <= 0) return;
    this.inventory.removeItem(itemId, 1);
    this.inventoryPanel.refresh();
  }

  private countItems(): number {
    return this.inventory.getItems().reduce((sum, slot) => {
      return sum + (slot ? slot.quantity : 0);
    }, 0);
  }
}
