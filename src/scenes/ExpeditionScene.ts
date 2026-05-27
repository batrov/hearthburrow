import Phaser from 'phaser';
import { StaminaSystem } from '../systems/StaminaSystem';
import { MiningSystem, TileData } from '../systems/MiningSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { gameState } from '../systems/GameState';
import { InventoryPanel } from '../ui/InventoryPanel';

const TILE = 40;
const COLS = 25;
const ROWS = 18;

interface RoomTile {
  type: 'floor' | 'wall' | 'mineable';
  resource?: string;
  durability?: number;
  broken?: boolean;
  sprite?: Phaser.GameObjects.Rectangle;
}

export class ExpeditionScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private playerX: number = 1;
  private playerY: number = 1;
  private stamina: StaminaSystem;
  private mining: MiningSystem;
  private inventory: InventorySystem;
  private grid: RoomTile[][] = [];
  private tileSprites!: Phaser.GameObjects.Graphics;
  private staminaBar!: Phaser.GameObjects.Graphics;
  private staminaText!: Phaser.GameObjects.Text;
  private inventoryText!: Phaser.GameObjects.Text;
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
  };
  private moveTimer: number = 0;
  private moveDelay: number = 150;
  private exhausted: boolean = false;
  private facingX: number = 0;
  private facingY: number = -1;
  private inventoryPanel!: InventoryPanel;

  constructor() {
    super({ key: 'ExpeditionScene' });
    this.stamina = new StaminaSystem(100);
    this.mining = new MiningSystem();
    this.inventory = new InventorySystem(16);
  }

  create(): void {
    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#0a0a0a');

    this.exhausted = false;
    this.stamina = new StaminaSystem(100);
    this.mining = new MiningSystem();
    this.inventory = new InventorySystem(16);
    this.playerX = 1;
    this.playerY = 1;
    this.moveTimer = 0;
    this.tileSprites = this.add.graphics();

    this.inventoryPanel = new InventoryPanel(this, this.inventory, 'Run Inventory');

    this.generateRoom();
    this.drawRoom();
    this.createPlayer();
    this.createHUD();
    this.setupInput();

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    const worldW = COLS * TILE;
    const worldH = ROWS * TILE;
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    this.drawMinimap();
  }

  private generateRoom(): void {
    this.grid = [];

    for (let y = 0; y < ROWS; y++) {
      this.grid[y] = [];
      for (let x = 0; x < COLS; x++) {
        if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
          this.grid[y][x] = { type: 'wall' };
        } else {
          const roll = Math.random();
          if (roll < 0.15) {
            const resources = ['stone', 'stone', 'stone', 'copper_ore'];
            const r = resources[Math.floor(Math.random() * resources.length)];
            this.grid[y][x] = {
              type: 'mineable',
              resource: r,
              durability: r === 'stone' ? 2 : 3,
              broken: false,
            };
          } else {
            this.grid[y][x] = { type: 'floor' };
          }
        }
      }
    }

    this.grid[1][1] = { type: 'floor' };
    this.grid[1][2] = { type: 'floor' };
    this.grid[2][1] = { type: 'floor' };
  }

  private drawRoom(): void {
    this.tileSprites.clear();

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tile = this.grid[y][x];
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
          case 'mineable':
            this.tileSprites.fillStyle(0x1a1a2a, 1);
            this.tileSprites.fillRect(px, py, TILE, TILE);
            if (!tile.broken) {
              if (tile.resource === 'stone') {
                this.tileSprites.fillStyle(0x5a5a6a, 1);
                this.tileSprites.fillRoundedRect(px + 4, py + 4, TILE - 8, TILE - 8, 4);
                this.tileSprites.fillStyle(0x6a6a7a, 1);
                this.tileSprites.fillRoundedRect(px + 8, py + 6, 6, 6, 2);
              } else {
                this.tileSprites.fillStyle(0x8a6a3a, 1);
                this.tileSprites.fillRoundedRect(px + 4, py + 4, TILE - 8, TILE - 8, 4);
                this.tileSprites.fillStyle(0xaa8a4a, 1);
                this.tileSprites.fillRect(px + 10, py + 10, 8, 8);
              }
              this.tileSprites.lineStyle(1, 0x3a3a4a, 0.5);
              this.tileSprites.strokeRect(px, py, TILE, TILE);
            } else {
              if ((x + y) % 2 === 0) {
                this.tileSprites.fillStyle(0x1e1e30, 0.5);
                this.tileSprites.fillRect(px, py, TILE, TILE);
              }
            }
            break;
        }
      }
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
    hudBg.fillRoundedRect(8, 8, 240, 86, 6);
    hudBg.setScrollFactor(0);
    hudBg.setDepth(50);

    this.staminaBar = this.add.graphics();
    this.staminaBar.setScrollFactor(0);
    this.staminaBar.setDepth(51);
    this.drawStaminaBar();

    this.staminaText = this.add.text(20, 14, 'Stamina', {
      fontSize: '12px', fontFamily: 'monospace', color: '#8a7a6a',
    }).setScrollFactor(0).setDepth(51);

    this.inventoryText = this.add.text(20, 56, 'Items: 0', {
      fontSize: '12px', fontFamily: 'monospace', color: '#6a5a4a',
    }).setScrollFactor(0).setDepth(51);

    this.add.text(20, 76, '[TAB] Inventory', {
      fontSize: '11px', fontFamily: 'monospace', color: '#4a5a4a',
    }).setScrollFactor(0).setDepth(51);

    const infoBg = this.add.graphics();
    infoBg.fillStyle(0x0a0a1a, 0.75);
    infoBg.fillRoundedRect(camW - 208, 8, 200, 44, 6);
    infoBg.setScrollFactor(0);
    infoBg.setDepth(50);

    this.add.text(camW - 198, 16, '[ESC] Extract & Return', {
      fontSize: '12px', fontFamily: 'monospace', color: '#5a4a6a',
    }).setScrollFactor(0).setDepth(51);

    this.add.text(camW - 198, 34, '[SPACE] Mine', {
      fontSize: '12px', fontFamily: 'monospace', color: '#4a5a5a',
    }).setScrollFactor(0).setDepth(51);
  }

  private drawMinimap(): void {
    const mapX = 960 - 120;
    const mapY = 640 - 100;
    const cell = 4;

    const mapBg = this.add.graphics();
    mapBg.fillStyle(0x0a0a1a, 0.6);
    mapBg.fillRoundedRect(mapX - 4, mapY - 4, COLS * cell + 8, ROWS * cell + 8, 4);
    mapBg.setScrollFactor(0);
    mapBg.setDepth(50);

    const mapGfx = this.add.graphics();
    mapGfx.setScrollFactor(0);
    mapGfx.setDepth(51);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tile = this.grid[y][x];
        const px = mapX + x * cell;
        const py = mapY + y * cell;

        if (tile.type === 'wall') {
          mapGfx.fillStyle(0x3a3a4a, 1);
        } else if (tile.type === 'mineable' && !tile.broken) {
          mapGfx.fillStyle(0x6a5a3a, 1);
        } else {
          mapGfx.fillStyle(0x1a1a2a, 1);
        }
        mapGfx.fillRect(px, py, cell, cell);
      }
    }

    mapGfx.fillStyle(0x88ccff, 1);
    mapGfx.fillRect(mapX + this.playerX * cell, mapY + this.playerY * cell, cell, cell);
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

    this.moveTimer += delta;

    if (this.exhausted) return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.extract();
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

  private tryMove(dx: number, dy: number): void {
    const nx = this.playerX + dx;
    const ny = this.playerY + dy;

    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;

    const tile = this.grid[ny][nx];
    if (tile.type === 'wall') return;
    if (tile.type === 'mineable' && !tile.broken) return;

    if (!this.stamina.consume(2)) {
      this.handleExhaustion();
      return;
    }

    this.playerX = nx;
    this.playerY = ny;
    this.player.setPosition(nx * TILE + TILE / 2, ny * TILE + TILE / 2);
  }

  private tryMine(): void {
    const tx = this.playerX + this.facingX;
    const ty = this.playerY + this.facingY;
    if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return;

    const tile = this.grid[ty][tx];
    if (tile.type !== 'mineable' || tile.broken) return;

    if (!this.stamina.consume(5)) {
      this.handleExhaustion();
      return;
    }

    tile.durability! -= this.mining.getDamage();

    if (tile.durability! <= 0) {
      tile.broken = true;
      this.inventory.addItem(tile.resource!, 1);

      this.createMiningParticles(tx, ty);
      this.createItemPopup(tx, ty, tile.resource!);

      this.tileSprites.clear();
      this.drawRoom();
    } else {
      this.createHitEffect(tx, ty);
    }
  }

  private createMiningParticles(tx: number, ty: number): void {
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;

    for (let i = 0; i < 6; i++) {
      const p = this.add.rectangle(
        cx, cy,
        Phaser.Math.Between(3, 6), Phaser.Math.Between(3, 6),
        0xaa8844
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

  private finishRun(extractType: 'safe' | 'emergency'): void {
    this.exhausted = true;

    const slots = this.inventory.getItems();
    const obtained: { id: string; quantity: number }[] = [];
    const lost: { id: string; quantity: number }[] = [];

    for (const slot of slots) {
      if (!slot) continue;
      obtained.push({ id: slot.itemId, quantity: slot.quantity });

      if (extractType === 'emergency') {
        const lostQty = Math.round(slot.quantity * 0.3);
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

    gameState.lastRunResult = { itemsObtained: obtained, itemsLost: lost, extractType };

    this.time.delayedCall(800, () => {
      this.scene.start('ExpeditionRecapScene');
    });
  }

  private handleExhaustion(): void {
    this.cameras.main.shake(300, 0.01);

    const overlay = this.add.rectangle(
      this.cameras.main.scrollX + this.cameras.main.width / 2,
      this.cameras.main.scrollY + this.cameras.main.height / 2,
      this.cameras.main.width, this.cameras.main.height,
      0x000000, 0
    ).setDepth(100).setScrollFactor(0);

    this.add.text(
      this.cameras.main.scrollX + this.cameras.main.width / 2,
      this.cameras.main.scrollY + this.cameras.main.height / 2,
      'EXHAUSTED\nTeleporting home...',
      { fontSize: '24px', fontFamily: 'monospace', color: '#cc4444', align: 'center' }
    ).setOrigin(0.5).setDepth(101).setScrollFactor(0);

    this.tweens.add({
      targets: overlay,
      alpha: 0.6,
      duration: 1000,
      onComplete: () => {
        this.finishRun('emergency');
      },
    });
  }

  private extract(): void {
    this.add.text(
      this.cameras.main.scrollX + this.cameras.main.width / 2,
      this.cameras.main.scrollY + this.cameras.main.height / 2,
      'Returning to Homeland...',
      { fontSize: '20px', fontFamily: 'monospace', color: '#88ccff' }
    ).setOrigin(0.5).setDepth(101).setScrollFactor(0);

    const overlay = this.add.rectangle(
      this.cameras.main.scrollX + this.cameras.main.width / 2,
      this.cameras.main.scrollY + this.cameras.main.height / 2,
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

  private countItems(): number {
    return this.inventory.getItems().reduce((sum, slot) => {
      return sum + (slot ? slot.quantity : 0);
    }, 0);
  }
}
