import Phaser from 'phaser';
import { StaminaSystem } from '../systems/StaminaSystem';
import { MiningSystem } from '../systems/MiningSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { DungeonGenerator, DungeonFloor } from '../systems/DungeonGenerator';
import { ExpeditionState } from '../systems/ExpeditionState';
import { gameState, itemDisplayName } from '../systems/GameState';
import { InventoryPanel } from '../ui/InventoryPanel';
import { EventPanel, EventChoice, EventConfig } from '../ui/EventPanel';

const TILE = 40;

export class ExpeditionScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
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
  };
  private moveTimer: number = 0;
  private moveDelay: number = 150;
  private exhausted: boolean = false;
  private facingX: number = 0;
  private facingY: number = -1;
  private debugMode: boolean = false;
  private inventoryPanel!: InventoryPanel;
  private eventPanel!: EventPanel;
  private eventActive: boolean = false;
  private minimapBg!: Phaser.GameObjects.Graphics;
  private minimapGfx!: Phaser.GameObjects.Graphics;
  private minimapDot!: Phaser.GameObjects.Rectangle;
  private interactPrompt!: Phaser.GameObjects.Text;
  private interactTarget: { x: number; y: number; id: string } | null = null;

  constructor() {
    super({ key: 'ExpeditionScene' });
    this.stamina = new StaminaSystem(100);
    this.mining = new MiningSystem();
    this.inventory = new InventorySystem(16);
    this.dungeonGen = new DungeonGenerator();
    this.expeditionState = new ExpeditionState();
  }

  init(data: { debug?: boolean }): void {
    this.debugMode = data?.debug ?? false;
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
    this.inventory = new InventorySystem(16 + gameState.inventorySlotBonus);
    if (this.debugMode) {
      this.inventory.addItem('stamina_potion', 5);
      this.inventory.addItem('mining_bomb', 5);
    }
    this.expeditionState.reset();
    this.moveTimer = 0;
    this.tileSprites = this.add.graphics();

    this.inventoryPanel = new InventoryPanel(this, this.inventory, 'Run Inventory');
    this.eventPanel = new EventPanel(this);
    this.eventActive = false;
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

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, floor.cols * TILE, floor.rows * TILE);

    this.drawMinimap();
  }

  private drawFloor(): void {
    this.tileSprites.clear();

    const floor = this.currentFloor;
    if (!floor) return;

    for (let y = 0; y < floor.rows; y++) {
      for (let x = 0; x < floor.cols; x++) {
        const tile = floor.tiles[y][x];
        const px = x * TILE;
        const py = y * TILE;

        switch (tile.type) {
          case 'wall':
            this.tileSprites.fillStyle(0x2a2a3a, 1);
            this.tileSprites.fillRect(px, py, TILE, TILE);
            this.tileSprites.lineStyle(1, 0x3a3a4a, 0.5);
            this.tileSprites.strokeRect(px, py, TILE, TILE);
            break;
          case 'floor':
            this.tileSprites.fillStyle(0x1a1a2a, 1);
            this.tileSprites.fillRect(px, py, TILE, TILE);
            if ((x + y) % 2 === 0) {
              this.tileSprites.fillStyle(0x1e1e30, 0.5);
              this.tileSprites.fillRect(px, py, TILE, TILE);
            }
            break;
          case 'corridor':
            this.tileSprites.fillStyle(0x151520, 1);
            this.tileSprites.fillRect(px, py, TILE, TILE);
            this.tileSprites.lineStyle(1, 0x252535, 0.3);
            this.tileSprites.strokeRect(px, py, TILE, TILE);
            break;
          case 'mineable':
            this.tileSprites.fillStyle(0x1a1a2a, 1);
            this.tileSprites.fillRect(px, py, TILE, TILE);
            if (!tile.broken) {
              this.drawOre(px, py, tile.resource, tile.durability, tile.maxDurability);
              this.tileSprites.lineStyle(1, 0x3a3a4a, 0.5);
              this.tileSprites.strokeRect(px, py, TILE, TILE);
            } else {
              if ((x + y) % 2 === 0) {
                this.tileSprites.fillStyle(0x1e1e30, 0.5);
                this.tileSprites.fillRect(px, py, TILE, TILE);
              }
            }
            break;
          case 'stairs_up':
            this.tileSprites.fillStyle(0x1a2a1a, 1);
            this.tileSprites.fillRect(px, py, TILE, TILE);
            this.tileSprites.fillStyle(0x44cc66, 0.4);
            this.tileSprites.fillTriangle(px + 4, py + TILE - 4, px + TILE / 2, py + 4, px + TILE - 4, py + TILE - 4);
            this.tileSprites.fillStyle(0x44cc66, 0.7);
            this.tileSprites.fillTriangle(px + 10, py + TILE - 8, px + TILE / 2, py + 10, px + TILE - 10, py + TILE - 8);
            break;
          case 'stairs_down':
            this.tileSprites.fillStyle(0x1a1a2e, 1);
            this.tileSprites.fillRect(px, py, TILE, TILE);
            this.tileSprites.fillStyle(0x8866cc, 0.4);
            this.tileSprites.fillTriangle(px + 4, py + 4, px + TILE / 2, py + TILE - 4, px + TILE - 4, py + 4);
            this.tileSprites.fillStyle(0x8866cc, 0.7);
            this.tileSprites.fillTriangle(px + 10, py + 10, px + TILE / 2, py + TILE - 8, px + TILE - 10, py + 10);
            break;
          default:
            if (tile.type.startsWith('event_')) {
              this.drawEventTile(px, py, tile.type, tile.broken);
            }
            break;
        }
      }
    }
  }

  private drawEventTile(px: number, py: number, type: string, used: boolean): void {
    this.tileSprites.fillStyle(0x1a1a2a, 1);
    this.tileSprites.fillRect(px, py, TILE, TILE);
    if ((px / TILE + py / TILE) % 2 === 0) {
      this.tileSprites.fillStyle(0x1e1e30, 0.5);
      this.tileSprites.fillRect(px, py, TILE, TILE);
    }
    if (used) return;

    switch (type) {
      case 'event_chest':
        this.tileSprites.fillStyle(0x8a6a3a, 1);
        this.tileSprites.fillRoundedRect(px + 6, py + 10, TILE - 12, TILE - 14, 3);
        this.tileSprites.fillStyle(0xccaa44, 1);
        this.tileSprites.fillRect(px + TILE / 2 - 4, py + 16, 8, 4);
        break;
      case 'event_merchant':
        this.tileSprites.fillStyle(0x3a5a8a, 1);
        this.tileSprites.fillCircle(px + TILE / 2, py + 10, 6);
        this.tileSprites.fillRect(px + 8, py + 16, TILE - 16, TILE - 20);
        break;
      case 'event_goblin':
        this.tileSprites.fillStyle(0x5a8a3a, 1);
        this.tileSprites.fillCircle(px + TILE / 2, py + 10, 6);
        this.tileSprites.fillRect(px + 8, py + 16, TILE - 16, TILE - 20);
        break;
      case 'event_villager':
        this.tileSprites.fillStyle(0xcc8844, 1);
        this.tileSprites.fillCircle(px + TILE / 2, py + 10, 6);
        this.tileSprites.fillRect(px + 8, py + 16, TILE - 16, TILE - 20);
        break;
      case 'event_fountain':
        this.tileSprites.fillStyle(0x3a5a8a, 1);
        this.tileSprites.fillRoundedRect(px + 6, py + 10, TILE - 12, TILE - 14, 6);
        this.tileSprites.fillStyle(0x5a8acc, 0.6);
        this.tileSprites.fillRoundedRect(px + 10, py + 14, TILE - 20, TILE - 22, 4);
        break;
    }
  }

  private drawOre(px: number, py: number, resource: string, durability: number, maxDurability: number): void {
    const ratio = maxDurability > 0 ? durability / maxDurability : 1;

    switch (resource) {
      case 'stone':
        this.tileSprites.fillStyle(0x5a5a6a, 1);
        this.tileSprites.fillRoundedRect(px + 4, py + 4, TILE - 8, TILE - 8, 4);
        this.tileSprites.fillStyle(0x6a6a7a, 1);
        this.tileSprites.fillRoundedRect(px + 8, py + 6, 6, 6, 2);
        break;
      case 'copper_ore':
        this.tileSprites.fillStyle(0x8a6a3a, 1);
        this.tileSprites.fillRoundedRect(px + 4, py + 4, TILE - 8, TILE - 8, 4);
        this.tileSprites.fillStyle(0xaa8a4a, 1);
        this.tileSprites.fillRect(px + 10, py + 10, 8, 8);
        break;
      case 'silver_ore':
        this.tileSprites.fillStyle(0x7a8a9a, 1);
        this.tileSprites.fillRoundedRect(px + 4, py + 4, TILE - 8, TILE - 8, 4);
        this.tileSprites.fillStyle(0x9aaabc, 1);
        this.tileSprites.fillRect(px + 10, py + 10, 8, 8);
        break;
      case 'gold_ore':
        this.tileSprites.fillStyle(0x8a7a2a, 1);
        this.tileSprites.fillRoundedRect(px + 4, py + 4, TILE - 8, TILE - 8, 4);
        this.tileSprites.fillStyle(0xccaa44, 1);
        this.tileSprites.fillRect(px + 10, py + 10, 8, 8);
        break;
      case 'crystal':
        this.tileSprites.fillStyle(0x6a4a8a, 1);
        this.tileSprites.fillRoundedRect(px + 4, py + 4, TILE - 8, TILE - 8, 4);
        this.tileSprites.fillStyle(0x9a6acc, 1);
        this.tileSprites.fillRect(px + 10, py + 10, 8, 8);
        break;
      case 'monster_drop':
        this.tileSprites.fillStyle(0x8a3a3a, 1);
        this.tileSprites.fillRoundedRect(px + 4, py + 4, TILE - 8, TILE - 8, 4);
        break;
    }

    if (ratio <= 0.66) {
      const darken = ratio <= 0.33 ? 0.45 : 0.25;
      this.tileSprites.fillStyle(0x000000, darken);
      this.tileSprites.fillRoundedRect(px + 4, py + 4, TILE - 8, TILE - 8, 4);
    }

    if (ratio <= 0.33) {
      this.tileSprites.lineStyle(1, 0x000000, 0.5);
      this.tileSprites.lineBetween(px + 8, py + 6, px + TILE - 8, py + TILE - 6);
      this.tileSprites.lineBetween(px + TILE - 8, py + 6, px + 8, py + TILE - 6);
    }
  }

  private createPlayer(): void {
    this.player = this.add.rectangle(
      this.playerX * TILE + TILE / 2,
      this.playerY * TILE + TILE / 2,
      20, 24, 0x88ccff
    );
    this.player.setDepth(10);
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
    this.drawStaminaBar();

    this.staminaText = this.add.text(20, 14, 'Stamina', {
      fontSize: '12px', fontFamily: 'monospace', color: '#8a7a6a',
    }).setScrollFactor(0).setDepth(51);

    this.depthText = this.add.text(20, 76, 'Floor: 0', {
      fontSize: '12px', fontFamily: 'monospace', color: '#7a8a9a',
    }).setScrollFactor(0).setDepth(51);

    this.inventoryText = this.add.text(20, 56, 'Items: 0', {
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
      2: 'Copper Pickaxe',
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
            if (tile.type.startsWith('event_') && !tile.broken) {
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
    };
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.TAB)) {
      this.inventoryPanel.refresh();
      this.inventoryPanel.toggle();
      return;
    }

    if (this.inventoryPanel.isVisible()) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        this.inventoryPanel.hide();
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

    this.moveTimer += delta;

    if (this.exhausted) return;

    this.checkEventProximity();

    if (this.interactTarget && Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.triggerTileEvent(this.interactTarget.x, this.interactTarget.y, this.interactTarget.id);
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
    this.inventoryText.setText(`Items: ${this.countItems()}`);
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
      if (tile.type.startsWith('event_') && !tile.broken) {
        this.interactTarget = { x: pos.x, y: pos.y, id: tile.eventId };
        const labels: Record<string, string> = {
          event_chest: '[SPACE] Open chest',
          event_merchant: '[SPACE] Talk to merchant',
          event_goblin: '[SPACE] Talk to goblin',
          event_villager: '[SPACE] Rescue villager',
          event_fountain: '[SPACE] Drink from fountain',
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
        const pool = ['stone', 'copper_ore', 'silver_ore', 'gold_ore'];
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
          description: 'A hooded figure offers to trade: 5 Stone for 3 Copper Ore.',
          choices: [
            {
              label: `Trade 5 Stone → 3 Copper Ore ${canTrade ? '' : '(not enough stone)'}`,
              action: () => {
                if (stone() >= cost) {
                  removeStone(cost);
                  addItem('copper_ore', 3);
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

      default:
        return null;
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
    if (this.expeditionState.depth === 0) {
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
    this.player.setPosition(this.playerX * TILE + TILE / 2, this.playerY * TILE + TILE / 2);
    this.cameras.main.stopFollow();
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, floor.cols * TILE, floor.rows * TILE);

    this.depthText.setText(`Floor: ${this.expeditionState.depth}`);

    this.drawMinimap();
  }

  private tryMove(dx: number, dy: number): void {
    const floor = this.currentFloor;
    if (!floor) return;

    const nx = this.playerX + dx;
    const ny = this.playerY + dy;

    if (nx < 0 || nx >= floor.cols || ny < 0 || ny >= floor.rows) return;

    const tile = floor.tiles[ny][nx];
    if (tile.type === 'wall') return;
    if (tile.type === 'mineable' && !tile.broken) return;
    if (tile.type.startsWith('event_') && !tile.broken) return;

    this.playerX = nx;
    this.playerY = ny;
    this.player.setPosition(nx * TILE + TILE / 2, ny * TILE + TILE / 2);
    this.updateMinimapDot();

    if (!this.stamina.consume(2)) {
      this.handleExhaustion();
    }

    if (tile.type === 'stairs_up') {
      this.handleAscend();
    } else if (tile.type === 'stairs_down') {
      this.handleDescend();
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
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;

    const colors: Record<string, number> = {
      stone: 0x6a6a7a,
      copper_ore: 0xaa8a4a,
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
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;

    const flash = this.add.rectangle(cx, cy, TILE, TILE, 0xffffff, 0.3).setDepth(15);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy(),
    });
  }

  private createItemPopup(tx: number, ty: number, resource: string): void {
    const label = resource.replace(/_/g, ' ');
    const popup = this.add.text(
      tx * TILE + TILE / 2,
      ty * TILE + TILE / 2 - 10,
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

    for (const slot of slots) {
      if (!slot) continue;
      obtained.push({ id: slot.itemId, quantity: slot.quantity });

      if (extractType === 'emergency' && lossRate > 0) {
        const lostQty = Math.round(slot.quantity * lossRate);
        if (lostQty > 0) {
          lost.push({ id: slot.itemId, quantity: lostQty });
          gameState.inventory.addItem(slot.itemId, slot.quantity - lostQty);
        } else {
          gameState.inventory.addItem(slot.itemId, slot.quantity);
        }
      } else {
        gameState.inventory.addItem(slot.itemId, slot.quantity);
      }
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

  private countItems(): number {
    return this.inventory.getItems().reduce((sum, slot) => {
      return sum + (slot ? slot.quantity : 0);
    }, 0);
  }
}
