import Phaser from 'phaser';
import { gameState, itemDisplayName, itemIconKey } from '../systems/GameState';
import { InventoryPanel } from '../ui/InventoryPanel';
import { CraftingPanel } from '../ui/CraftingPanel';
import { TradePanel } from '../ui/TradePanel';
import { ResearchPanel } from '../ui/ResearchPanel';
import { FarmPanel } from '../ui/FarmPanel';
import { BuildingInfoPanel } from '../ui/BuildingInfoPanel';
import { RestorePanel } from '../ui/RestorePanel';
import { GatePanel } from '../ui/GatePanel';
import { canRestore, restoreBuilding, isRestored } from '../systems/BuildingSystem';
import { getBuilding } from '../systems/DataRegistry';
import { audio } from '../systems/AudioSystem';
import { AnalogStickInput } from '../ui/AnalogStickInput';
import { getSpriteConfig } from '../systems/SpriteConfig';
import {
  gridToIso, isoToGrid, findPath,
  HALF_W, HALF_H, worldWidth, worldHeight,
} from '../systems/IsoUtils';

interface HubBuildingDef {
  id: string;
  label: string;
  gx: number;
  gy: number;
  gw: number;
  gh: number;
  buildingId: string;
  description: string;
  solid: boolean;
}

const HUB_COLS = 16;
const HUB_ROWS = 12;

const HUB_BUILDINGS: HubBuildingDef[] = [
  { id: 'trading_post', label: 'Trading Post', gx: 1, gy: 1, gw: 3, gh: 2, buildingId: 'trading_post',
    description: 'Trade resources with wandering merchants.', solid: true },
  { id: 'crafting', label: 'Crafting Station', gx: 1, gy: 4, gw: 3, gh: 2, buildingId: 'crafting_station',
    description: 'Craft tools and equipment from mined materials.', solid: true },
  { id: 'farm', label: 'Farm', gx: 1, gy: 7, gw: 3, gh: 2, buildingId: 'farm',
    description: 'Plant carrots and harvest more carrots.', solid: true },
  { id: 'tavern', label: 'Tavern', gx: 12, gy: 1, gw: 3, gh: 2, buildingId: 'housing',
    description: 'A warm gathering place for rescued villagers.', solid: true },
  { id: 'storage', label: 'Storage', gx: 12, gy: 4, gw: 3, gh: 2, buildingId: 'storage',
    description: 'Store and manage your collected resources.', solid: true },
  { id: 'laboratory', label: 'Laboratory', gx: 12, gy: 7, gw: 3, gh: 2, buildingId: 'laboratory',
    description: 'Research advanced upgrades and recipes.', solid: true },
  { id: 'gate', label: 'Expedition Gate', gx: 7, gy: 9, gw: 2, gh: 1, buildingId: '',
    description: 'Descend into the procedural dungeon to mine resources.', solid: false },
];

export class HomelandScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private playerLabel!: Phaser.GameObjects.Text;
  private facingX: number = 0;
  private facingY: number = -1;
  private playerGx: number = 7;
  private playerGy: number = 8;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private promptText!: Phaser.GameObjects.Text;
  private restoreBuildingId: string = '';
  private currentBuilding: HubBuildingDef | null = null;
  private moveTimer: number = 0;
  private moveDelay: number = 150;
  private isMoving: boolean = false;
  private buildingInfoPanel!: BuildingInfoPanel;
  private restorePanel!: RestorePanel;
  private gatePanel!: GatePanel;
  private inventoryPanel!: InventoryPanel;
  private craftingPanel!: CraftingPanel;
  private tradePanel!: TradePanel;
  private researchPanel!: ResearchPanel;
  private farmPanel!: FarmPanel;
  private buildingsContainer!: Phaser.GameObjects.Container;
  private buildingZones: Phaser.GameObjects.Rectangle[] = [];
  private movePath: { x: number; y: number }[] = [];
  private analog!: AnalogStickInput;
  private animFrame: number = 0;
  private animTimer: number = 0;
  private readonly ANIM_INTERVAL: number = 60;

  constructor() {
    super({ key: 'HomelandScene' });
  }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#0a0a0a');
    this.currentBuilding = null;
    this.moveTimer = 0;
    this.animFrame = 0;
    this.animTimer = 0;
    this.isMoving = false;

    this.buildingsContainer = this.add.container(0, 0).setDepth(5);
    this.drawHubTerrain();
    this.drawHubBuildings();
    this.drawHubGate();
    this.drawPlayer();
    this.createInteractionUI();
    this.setupInput();
    this.setupPointerInput();

    const xMin = -HUB_ROWS * HALF_W;
    const yMin = -HALF_H;
    this.cameras.main.startFollow(this.player, true, 0.5, 0.5);
    this.cameras.main.setBounds(xMin, yMin, worldWidth(HUB_COLS, HUB_ROWS), worldHeight(HUB_COLS, HUB_ROWS));

    this.buildingInfoPanel = new BuildingInfoPanel(this);
    this.restorePanel = new RestorePanel(this, () => { this.restoreBuildingId = ''; });
    this.gatePanel = new GatePanel(this);
    this.gatePanel.onEmbark = (config) => this.startExpedition(config);
    this.gatePanel.onCloseCb = () => {};
    this.inventoryPanel = new InventoryPanel(this, gameState.inventory, null, (id) => this.trashItem(id), 'Storage');
    this.craftingPanel = new CraftingPanel(this);
    this.tradePanel = new TradePanel(this);
    this.researchPanel = new ResearchPanel(this);
    this.farmPanel = new FarmPanel(this);
  }

  private drawHubTerrain(): void {
    const isPath = (x: number) => x === 7 || x === 8;

    for (let y = 0; y < HUB_ROWS; y++) {
      for (let x = 0; x < HUB_COLS; x++) {
        const p = gridToIso(x, y);
        const tile = this.add.image(p.x, p.y, 'terrain_diamond');
        tile.setDepth(4);
        if (isPath(x)) {
          tile.setTint(0x5a4a3a);
        } else {
          tile.setTint((x + y) % 2 === 0 ? 0x3a5a2a : 0x4a6a3a);
        }
      }
    }
  }

  private drawHubBuildings(): void {
    this.buildingsContainer.removeAll(true);
    this.buildingZones?.forEach(z => z.destroy());
    this.buildingZones = [];
    const buildingTextureKeys: Record<string, string> = {
      trading_post: 'building_trading_post',
      crafting: 'building_crafting',
      farm: 'building_farm',
      tavern: 'building_tavern',
      storage: 'building_storage',
      laboratory: 'building_laboratory',
    };
    const unlocked = (b: HubBuildingDef) => !b.buildingId || isRestored(b.buildingId);

    for (const b of HUB_BUILDINGS) {
      if (b.id === 'gate') continue;
      const ul = unlocked(b);
      const texKey = buildingTextureKeys[b.id] ?? 'building_trading_post';
      const alpha = ul ? 1 : 0.4;

      for (let dy = 0; dy < b.gh; dy++) {
        for (let dx = 0; dx < b.gw; dx++) {
          const p = gridToIso(b.gx + dx, b.gy + dy);
          const img = this.add.image(p.x, p.y, texKey).setAlpha(alpha);
          img.setData('bid', b.buildingId || b.id);
          this.buildingsContainer.add(img);
        }
      }

      const c = gridToIso(b.gx + b.gw / 2, b.gy + b.gh / 2);
      const label = this.add.text(c.x, c.y - 48, b.label, {
        fontSize: '11px', fontFamily: 'monospace', color: ul ? '#e8d5b7' : '#6a5a4a',
      }).setOrigin(0.5).setAlpha(alpha);
      this.buildingsContainer.add(label);

      const bRef = b;
      const zone = this.add.rectangle(c.x, c.y, 120, 72, ul ? 0xffffff : 0x000000, ul ? 0.08 : 0)
        .setInteractive({ useHandCursor: true }).setData('isUI', true)
        .setDepth(6);
      zone.on('pointerdown', () => this.activateBuilding(bRef));
      zone.on('pointerover', () => { if (ul) zone.setFillStyle(0xffffff, 0.15); });
      zone.on('pointerout', () => { if (ul) zone.setFillStyle(0xffffff, 0.08); });
      this.buildingZones.push(zone);
    }


  }

  private drawHubGate(): void {
    for (let dy = 0; dy < 1; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const p = gridToIso(7 + dx, 9 + dy);
        this.add.image(p.x, p.y, 'building_gate');
      }
    }

    const c = gridToIso(8, 9);
    const glow = this.add.image(c.x, c.y - 36, 'gate_glow');

    this.tweens.add({
      targets: glow,
      alpha: 0.4,
      yoyo: true,
      repeat: -1,
      duration: 1200,
      ease: 'Sine.easeInOut',
    });

    this.add.text(c.x, c.y - 60, 'FORGOTTEN DEPTHS', {
      fontSize: '10px', fontFamily: 'monospace', color: '#7a6a9a',
    }).setOrigin(0.5);

    const descendText = this.add.text(c.x, c.y + 24, '[SPACE] Descend', {
      fontSize: '11px', fontFamily: 'monospace', color: '#8a7aba',
    }).setOrigin(0.5);
    descendText.setInteractive({ useHandCursor: true }).setData('isUI', true);
    descendText.on('pointerdown', () => this.showGatePanel());

    const gateZone = this.add.rectangle(c.x, c.y, 140, 84, 0xffffff, 0.06)
      .setInteractive({ useHandCursor: true }).setData('isUI', true).setDepth(6);
    gateZone.on('pointerdown', () => this.showGatePanel());
    gateZone.on('pointerover', () => gateZone.setFillStyle(0xffffff, 0.12));
    gateZone.on('pointerout', () => gateZone.setFillStyle(0xffffff, 0.06));
  }

  private drawPlayer(): void {
    const p = gridToIso(this.playerGx, this.playerGy);
    const cfg = getSpriteConfig('player_bottom_left');
    this.player = this.add.image(
      p.x + (cfg.offsetX ?? 0),
      p.y + (cfg.offsetY ?? 0),
      'player_bottom_left',
    ).setDepth(6 + (this.playerGx + this.playerGy) * 0.001 + 0.0005);
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
    const p = gridToIso(this.playerGx, this.playerGy);
    const cfg = getSpriteConfig('player_bottom_left');
    this.player.setPosition(p.x + (cfg.offsetX ?? 0), p.y + (cfg.offsetY ?? 0));
    this.player.setDepth(6 + (this.playerGx + this.playerGy) * 0.001 + 0.0005);
    this.playerLabel.setPosition(p.x, p.y - 30);
  }

  private createInteractionUI(): void {
    this.promptText = this.add.text(0, 0, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffdd88',
    }).setOrigin(0.5).setAlpha(0).setDepth(55);
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
      TAB: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB),
      X: kb.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      Z: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
    };
  }

  private get isModalActive(): boolean {
    return this.buildingInfoPanel.isVisible() || this.restorePanel.isVisible() || this.gatePanel.isVisible()
      || this.craftingPanel.isVisible() || this.inventoryPanel.isVisible()
      || this.tradePanel.isVisible() || this.researchPanel.isVisible()
      || this.farmPanel.isVisible();
  }

  private setupPointerInput(): void {
    this.analog = new AnalogStickInput(this, {
      depth: 250,
      isModal: () => this.isModalActive,
      onDragStart: () => { this.movePath = []; },
      onClick: (worldX, worldY) => { this.doClickToMove(worldX, worldY); },
    });
  }

  private doClickToMove(worldX: number, worldY: number): void {
    const g = isoToGrid(worldX, worldY);
    if (g.x < 0 || g.x >= HUB_COLS || g.y < 0 || g.y >= HUB_ROWS) return;
    if (g.x === this.playerGx && g.y === this.playerGy) return;
    if (this.isSolid(g.x, g.y)) return;

    const path = findPath(
      this.playerGx, this.playerGy,
      g.x, g.y,
      HUB_COLS, HUB_ROWS,
      (x, y) => {
        if (x === this.playerGx && y === this.playerGy) return true;
        return !this.isSolid(x, y);
      },
    );

    if (path && path.length > 0) {
      this.movePath = path;
    }
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.TAB)) {
      if (this.isModalActive) return;
      this.inventoryPanel.toggle();
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
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        this.inventoryPanel.hide();
      }
      return;
    }

    if (this.craftingPanel.isVisible()) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.keys.UP)) {
        this.craftingPanel.navigateUp();
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.S) || Phaser.Input.Keyboard.JustDown(this.keys.DOWN)) {
        this.craftingPanel.navigateDown();
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        this.craftingPanel.craftSelected();
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        this.craftingPanel.hide();
      }
      return;
    }

    if (this.tradePanel.isVisible()) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.keys.UP)) {
        this.tradePanel.navigateUp();
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.S) || Phaser.Input.Keyboard.JustDown(this.keys.DOWN)) {
        this.tradePanel.navigateDown();
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        this.tradePanel.confirm();
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        this.tradePanel.hide();
        this.closePanel();
      }
      return;
    }

    if (this.researchPanel.isVisible()) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.keys.UP)) {
        this.researchPanel.navigateUp();
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.S) || Phaser.Input.Keyboard.JustDown(this.keys.DOWN)) {
        this.researchPanel.navigateDown();
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        this.researchPanel.confirm();
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        this.researchPanel.hide();
        this.closePanel();
      }
      return;
    }

    if (this.farmPanel.isVisible()) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        this.farmPanel.hide();
        this.closePanel();
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.Z)) {
        this.farmPanel.plant();
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.X)) {
        this.farmPanel.harvest();
      }
      return;
    }

    if (this.gatePanel.isVisible()) {
      if (this.gatePanel.gateTab === 9 && this.gatePanel.seedEditing) {
        if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
          this.gatePanel.seedEditing = false;
          this.gatePanel.render();
        }
      } else {
        if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
          this.gatePanel.hide();
        }
        const up = Phaser.Input.Keyboard.JustDown(this.keys.UP) || Phaser.Input.Keyboard.JustDown(this.keys.W);
        const down = Phaser.Input.Keyboard.JustDown(this.keys.DOWN) || Phaser.Input.Keyboard.JustDown(this.keys.S);
        const left = Phaser.Input.Keyboard.JustDown(this.keys.LEFT) || Phaser.Input.Keyboard.JustDown(this.keys.A);
        const right = Phaser.Input.Keyboard.JustDown(this.keys.RIGHT) || Phaser.Input.Keyboard.JustDown(this.keys.D);
        if (up) this.gatePanel.handleUp();
        else if (down) this.gatePanel.handleDown();
        else if (left) this.gatePanel.handleLeft();
        else if (right) this.gatePanel.handleRight();
        else if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.gatePanel.handleSpace();
      }
      return;
    }

    if (this.restorePanel.isVisible()) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        this.tryRestore(this.restoreBuildingId);
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        this.restorePanel.hide();
      }
      return;
    }

    if (this.buildingInfoPanel.isVisible()) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        this.buildingInfoPanel.hide();
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
    this.checkProximity();
    this.handleInteraction();
  }

  private isSolid(gx: number, gy: number): boolean {
    for (const b of HUB_BUILDINGS) {
      if (!b.solid) continue;
      if (gx >= b.gx && gx < b.gx + b.gw && gy >= b.gy && gy < b.gy + b.gh) {
        return true;
      }
    }
    return false;
  }

  private tryMove(dx: number, dy: number): void {
    if (this.isMoving) return;

    const nx = this.playerGx + dx;
    const ny = this.playerGy + dy;

    if (nx < 0 || nx >= HUB_COLS || ny < 0 || ny >= HUB_ROWS) return;
    if (this.isSolid(nx, ny)) return;

    this.facingX = dx;
    this.facingY = dy;
    this.updatePlayerSprite();

    audio.playStep();

    this.playerGx = nx;
    this.playerGy = ny;

    const target = gridToIso(nx, ny);
    const cfg = getSpriteConfig('player_bottom_left');
    this.isMoving = true;
    this.tweens.add({
      targets: this.player,
      x: target.x + (cfg.offsetX ?? 0),
      y: target.y + (cfg.offsetY ?? 0),
      depth: 6 + (nx + ny) * 0.001 + 0.0005,
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
      dx = next.x - this.playerGx;
      dy = next.y - this.playerGy;
    }

    if (dx !== 0 && dy !== 0) dy = 0;

    if (dx !== 0 || dy !== 0) {
      this.tryMove(dx, dy);
    }
  }

  private checkProximity(): void {
    let closest: HubBuildingDef | null = null;
    let closestDist = Infinity;

    for (const b of HUB_BUILDINGS) {
      const bLeft = b.gx - 1;
      const bRight = b.gx + b.gw;
      const bTop = b.gy - 1;
      const bBottom = b.gy + b.gh;

      if (this.playerGx >= bLeft && this.playerGx <= bRight &&
          this.playerGy >= bTop && this.playerGy <= bBottom) {
        const cx = this.playerGx - (b.gx + b.gw / 2);
        const cy = this.playerGy - (b.gy + b.gh / 2);
        const dist = Math.abs(cx) + Math.abs(cy);

        if (dist < closestDist) {
          closest = b;
          closestDist = dist;
        }
      }
    }

    if (closest) {
      this.currentBuilding = closest;
      const pp = gridToIso(this.playerGx, this.playerGy);
      this.promptText.setPosition(pp.x, pp.y - 32).setScrollFactor(1);

      let action = 'Interact';
      const restored = !closest.buildingId || isRestored(closest.buildingId);
      if (closest.id === 'gate') action = 'Begin expedition';
      else if (!restored) action = `Restore ${closest.label}`;
      else if (closest.id === 'tavern') action = `Enter Tavern (${gameState.rescuedVillagers.length}/20 inside)`;
      else action = `Visit ${closest.label.split(' ')[0].toLowerCase()}`;

      this.promptText.setText(`[SPACE] ${action}`);
      this.promptText.setAlpha(1);
    } else {
      this.currentBuilding = null;
      this.promptText.setAlpha(0);
    }
  }

  private activateBuilding(b: HubBuildingDef): void {
    if (this.isModalActive) return;
    this.movePath = [];
    this.analog.reset();

    if (b.id === 'gate') {
      this.showGatePanel();
      return;
    }

    const buildingActions: Record<string, { restoreId: string; show: () => void }> = {
      storage: { restoreId: 'storage', show: () => { this.inventoryPanel.refresh(); this.inventoryPanel.show(); } },
      crafting: { restoreId: 'crafting_station', show: () => { this.craftingPanel.refresh(); this.craftingPanel.show(); } },
      tavern: { restoreId: 'housing', show: () => { this.scene.start('TavernScene'); } },
      trading_post: { restoreId: 'trading_post', show: () => this.showTradePanel() },
      laboratory: { restoreId: 'laboratory', show: () => this.showResearchPanel() },
      farm: { restoreId: 'farm', show: () => this.showFarmPanel() },
    };

    const action = buildingActions[b.id];
    if (action) {
      if (isRestored(action.restoreId)) {
        action.show();
      } else {
        this.showRestorePanel(action.restoreId);
        this.restoreBuildingId = action.restoreId;
      }
      return;
    }

    this.showBuildingPanel(b);
  }

  private handleInteraction(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) return;
    if (!this.currentBuilding) return;
    this.activateBuilding(this.currentBuilding);
  }

  private showRestorePanel(buildingId: string): void {
    this.restorePanel.show(buildingId);
  }

  private tryRestore(buildingId: string): void {
    const building = getBuilding(buildingId);
    this.closePanel();

    const container = this.add.container(960 / 2, 640 / 2).setScrollFactor(0).setDepth(250);

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.85);
    bg.fillRoundedRect(-160, -60, 320, 120, 10);
    bg.lineStyle(2, 0x6a5a8a, 1);
    bg.strokeRoundedRect(-160, -60, 320, 120, 10);
    container.add(bg);

    const title = this.add.text(0, -40, `Constructing ${building?.name ?? ''}...`, {
      fontSize: '16px', fontFamily: 'monospace', color: '#e8d5b7',
    }).setOrigin(0.5);
    container.add(title);

    const barW = 240, barH = 16, barX = -barW / 2, barY = -8;

    const barBg = this.add.graphics();
    barBg.fillStyle(0x1a1a2a, 1);
    barBg.fillRoundedRect(barX, barY, barW, barH, 4);
    container.add(barBg);

    const barFill = this.add.graphics();
    container.add(barFill);

    const statusText = this.add.text(0, 20, 'Building... 0%', {
      fontSize: '12px', fontFamily: 'monospace', color: '#8a9aaa',
    }).setOrigin(0.5);
    container.add(statusText);

    const buildingTiles = this.buildingsContainer.getAll().filter(
      obj => (obj as Phaser.GameObjects.Image).getData?.('bid') === buildingId
    ) as Phaser.GameObjects.Image[];

    for (const img of buildingTiles) {
      this.tweens.add({
        targets: img,
        x: img.x + 3,
        duration: 60,
        yoyo: true,
        repeat: Math.floor(5000 / 120),
        ease: 'Sine.easeInOut',
      });
    }

    audio.playConstruction();

    this.tweens.addCounter({
      from: 0,
      to: barW - 4,
      duration: 5000,
      ease: 'Linear',
      onUpdate: (tween) => {
        const val = tween.getValue() ?? 0;
        barFill.clear();
        barFill.fillStyle(0x44cc66, 1);
        barFill.fillRoundedRect(barX + 2, barY + 2, val, barH - 4, 3);
        statusText.setText(`Building... ${Math.floor(val / (barW - 4) * 100)}%`);
      },
      onComplete: () => {
        container.destroy(true);

        const success = restoreBuilding(buildingId);
        if (success) {
          this.drawHubBuildings();
          audio.playBuildComplete();

          const name = building?.name ?? buildingId.replace(/_/g, ' ');
          const popup = this.add.text(960 / 2, 640 / 2, `${name} Restored!`, {
            fontSize: '18px', fontFamily: 'monospace', color: '#44cc66', fontStyle: 'bold', align: 'center',
          }).setOrigin(0.5).setScrollFactor(0).setDepth(250);

          this.tweens.add({
            targets: popup,
            y: popup.y - 50,
            alpha: 0,
            duration: 1500,
            ease: 'Quad.easeOut',
            onComplete: () => popup.destroy(),
          });
        }
      },
    });
  }

  private showGatePanel(): void {
    this.gatePanel.show();
  }

  private startExpedition(config: {
    pickaxeTier: number; ring1: string | null; ring2: string | null;
    boots: string | null; lantern: string | null;
    consumables: Record<string, number>; seed: string; debug: boolean; startFloor: number;
  }): void {
    gameState.equipPickaxe(config.pickaxeTier);
    gameState.equippedRings.ring1 = config.ring1;
    gameState.equippedRings.ring2 = config.ring2;
    gameState.equippedBoots = config.boots;
    gameState.equippedLantern = config.lantern;
    gameState.save();

    this.closePanel();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('ExpeditionScene', {
        debug: config.debug,
        consumables: config.consumables,
        startFloor: config.startFloor,
        seed: config.seed,
      });
    });
  }

  private showBuildingPanel(building: HubBuildingDef): void {
    this.buildingInfoPanel.show(building.label, building.description);
  }

  private closePanel(): void {
    this.buildingInfoPanel.hide();
    this.restorePanel.hide();
    this.gatePanel.hide();
    this.tradePanel.hide();
    this.researchPanel.hide();
    this.farmPanel.hide();
  }

  private showTradePanel(): void {
    this.tradePanel.show();
  }

  private showResearchPanel(): void {
    this.researchPanel.show();
  }

  private showFarmPanel(): void {
    this.farmPanel.show();
  }

  private trashItem(itemId: string): void {
    if (gameState.inventory.count(itemId) <= 0) return;
    gameState.inventory.removeItem(itemId, 1);
    audio.playError();
    this.inventoryPanel.refresh();
  }
}
