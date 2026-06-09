import Phaser from 'phaser';
import { gameState } from '../systems/GameState';
import { InventoryPanel } from '../ui/InventoryPanel';
import { CraftingPanel } from '../ui/CraftingPanel';
import { TradePanel } from '../ui/TradePanel';
import { ResearchPanel } from '../ui/ResearchPanel';
import { FarmPanel } from '../ui/FarmPanel';
import { canRestore, restoreBuilding, isRestored } from '../systems/BuildingSystem';
import { getBuilding } from '../systems/DataRegistry';
import { audio } from '../systems/AudioSystem';
import {
  gridToIso, isoToGrid, findPath,
  drawDiamond, drawDiamondAt, drawExtrudedAt, drawExtrudedTile,
  HALF_W, HALF_H, WALL_HEIGHT, worldWidth, worldHeight,
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
  { id: 'villager_house', label: 'Villager House', gx: 12, gy: 1, gw: 3, gh: 2, buildingId: 'housing',
    description: 'A cozy home. Increases max stamina when restored.', solid: true },
  { id: 'storage', label: 'Storage', gx: 12, gy: 4, gw: 3, gh: 2, buildingId: 'storage',
    description: 'Store and manage your collected resources.', solid: true },
  { id: 'laboratory', label: 'Laboratory', gx: 12, gy: 7, gw: 3, gh: 2, buildingId: 'laboratory',
    description: 'Research advanced upgrades and recipes.', solid: true },
  { id: 'gate', label: 'Expedition Gate', gx: 7, gy: 9, gw: 2, gh: 1, buildingId: '',
    description: 'Descend into the procedural dungeon to mine resources.', solid: false },
];

export class HomelandScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private playerLabel!: Phaser.GameObjects.Text;
  private playerGx: number = 7;
  private playerGy: number = 8;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private promptText!: Phaser.GameObjects.Text;
  private panelBg!: Phaser.GameObjects.Graphics;
  private panelText!: Phaser.GameObjects.Text;
  private panelVisible: boolean = false;
  private restoreMode: boolean = false;
  private restoreBuildingId: string = '';
  private gateMode: boolean = false;
  private pickaxeOptions: { id: string; tier: number }[] = [];
  private selectedPickaxeIdx: number = 0;
  private ringOptions: { id: string; name: string }[] = [];
  private selectedRing1Idx: number = -1;
  private selectedRing2Idx: number = -1;
  private bootOptions: { id: string; name: string; runs: number }[] = [];
  private selectedBootsIdx: number = -1;
  private lanternOptions: { id: string; name: string; runs: number }[] = [];
  private selectedLanternIdx: number = -1;
  private gateTab: number = 0;
  private currentBuilding: HubBuildingDef | null = null;
  private debugMode: boolean = false;
  private consumableTypes: { id: string; name: string }[] = [
    { id: 'stamina_potion', name: 'Stamina Potion' },
    { id: 'teleport_scroll', name: 'Teleport Scroll' },
    { id: 'mining_bomb', name: 'Mining Bomb' },
  ];
  private consumableLoadout: Record<string, number> = {};
  private consumableSelectionIdx: number = 0;
  private elevatorFloorOptions: number[] = [];
  private selectedElevatorFloor: number = 0;
  private resetConfirm: boolean = false;
  private maxTab: number = 8;
  private moveTimer: number = 0;
  private moveDelay: number = 150;
  private isMoving: boolean = false;
  private inventoryPanel!: InventoryPanel;
  private craftingPanel!: CraftingPanel;
  private tradePanel!: TradePanel;
  private researchPanel!: ResearchPanel;
  private farmPanel!: FarmPanel;
  private buildingsContainer!: Phaser.GameObjects.Container;
  private movePath: { x: number; y: number }[] = [];
  private analogDx: number = 0;
  private analogDy: number = 0;
  private analogActive: boolean = false;

  constructor() {
    super({ key: 'HomelandScene' });
  }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#0a0a0a');
    this.panelVisible = false;
    this.currentBuilding = null;
    this.moveTimer = 0;

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

    this.inventoryPanel = new InventoryPanel(this, gameState.inventory, null, (id) => this.trashItem(id), 'Storage');
    this.craftingPanel = new CraftingPanel(this);
    this.tradePanel = new TradePanel(this);
    this.researchPanel = new ResearchPanel(this);
    this.farmPanel = new FarmPanel(this);
  }

  private drawHubTerrain(): void {
    const g = this.add.graphics();
    const isPath = (x: number) => x === 7 || x === 8;

    for (let y = 0; y < HUB_ROWS; y++) {
      for (let x = 0; x < HUB_COLS; x++) {
        if (isPath(x)) {
          drawDiamondAt(g, x, y, 0x5a4a3a);
        } else {
          const checker = (x + y) % 2 === 0;
          drawDiamondAt(g, x, y, checker ? 0x3a5a2a : 0x4a6a3a);
        }
      }
    }
  }

  private drawHubBuildings(): void {
    this.buildingsContainer.removeAll(true);
    const buildingColors: Record<string, [number, number, number]> = {
      trading_post: [0x8a6a3a, 0x6a4a2a, 0x5a3a1a],
      crafting: [0x6a7a8a, 0x4a5a6a, 0x3a4a5a],
      farm: [0x5a7a3a, 0x3a5a2a, 0x2a4a1a],
      villager_house: [0x8a6a4a, 0x6a4a2a, 0x5a3a1a],
      storage: [0x6a5a4a, 0x4a3a2a, 0x3a2a1a],
      laboratory: [0x6a4a8a, 0x4a2a6a, 0x3a1a5a],
    };
    const unlocked = (b: HubBuildingDef) => !b.buildingId || isRestored(b.buildingId);

    for (const b of HUB_BUILDINGS) {
      if (b.id === 'gate') continue;
      const ul = unlocked(b);
      const [top, left, right] = buildingColors[b.id] ?? [0x7a6a4a, 0x5a4a2a, 0x4a3a1a];
      const alpha = ul ? 1 : 0.4;

      for (let dy = 0; dy < b.gh; dy++) {
        for (let dx = 0; dx < b.gw; dx++) {
          const p = gridToIso(b.gx + dx, b.gy + dy);
          const g = this.add.graphics().setAlpha(alpha);
          this.buildingsContainer.add(g);
          drawExtrudedTile(g, p.x, p.y, top, left, right, 24);
        }
      }

      const c = gridToIso(b.gx + b.gw / 2, b.gy + b.gh / 2);
      const label = this.add.text(c.x, c.y - 48, b.label, {
        fontSize: '11px', fontFamily: 'monospace', color: ul ? '#e8d5b7' : '#6a5a4a',
      }).setOrigin(0.5).setAlpha(alpha);
      this.buildingsContainer.add(label);
    }

    const rescued = gameState.villagersRescued;
    if (rescued > 0) {
      for (let i = 0; i < Math.min(rescued, 10); i++) {
        const nx = 12 + Math.floor(i / 3);
        const ny = 3 + (i % 3);
        const pp = gridToIso(nx, ny);
        const npc = this.add.graphics();
        npc.fillStyle(0x66bbee, 1);
        npc.fillCircle(pp.x, pp.y, 6);
        npc.fillStyle(0x88ddff, 1);
        npc.fillRect(pp.x - 3, pp.y - 8, 6, 3);
        npc.setDepth(9);
      }
    }
  }

  private drawHubGate(): void {
    for (let dy = 0; dy < 1; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const p = gridToIso(7 + dx, 9 + dy);
        const g = this.add.graphics();
        drawExtrudedTile(g, p.x, p.y, 0x3a2a5a, 0x2a1a4a, 0x1a0a3a, 36);
      }
    }

    const c = gridToIso(8, 9);
    const glow = this.add.graphics();
    glow.fillStyle(0x6a5a9a, 0.15);
    drawDiamond(glow, c.x, c.y - 36, 0x6a5a9a, 0.15);
    drawDiamond(glow, c.x, c.y - 36, 0x8a7aba, 0.1);

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

    this.add.text(c.x, c.y + 24, '[SPACE] Descend', {
      fontSize: '11px', fontFamily: 'monospace', color: '#8a7aba',
    }).setOrigin(0.5);
  }

  private drawPlayer(): void {
    const p = gridToIso(this.playerGx, this.playerGy);
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

    const pp = gridToIso(this.playerGx, this.playerGy);
    this.playerLabel = this.add.text(pp.x, pp.y - 30, 'You', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaddff',
    }).setOrigin(0.5);
  }

  private repositionPlayer(): void {
    const p = gridToIso(this.playerGx, this.playerGy);
    this.player.setPosition(p.x, p.y);
    this.playerLabel.setPosition(p.x, p.y - 30);
  }

  private createInteractionUI(): void {
    this.promptText = this.add.text(0, 0, '', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffdd88',
    }).setOrigin(0.5).setAlpha(0).setDepth(55);

    this.panelBg = this.add.graphics();
    this.panelBg.setDepth(90).setScrollFactor(0);
    this.panelBg.setAlpha(0);

    this.panelText = this.add.text(960 / 2, 640 / 2, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#e8d5b7',
      align: 'center', lineSpacing: 8,
    }).setOrigin(0.5).setDepth(91).setScrollFactor(0).setAlpha(0);
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

  private setupPointerInput(): void {
    let stickCenterX = 0;
    let stickCenterY = 0;
    let pointerDragged = false;
    const stickRadius = 40;
    const deadZone = 12;
    let analogGfx: Phaser.GameObjects.Graphics | null = null;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.panelVisible || this.restoreMode) return;
      if (this.craftingPanel.isVisible() || this.inventoryPanel.isVisible()) return;
      if (this.tradePanel.isVisible() || this.researchPanel.isVisible() || this.farmPanel.isVisible()) return;

      stickCenterX = pointer.x;
      stickCenterY = pointer.y;
      pointerDragged = false;
      this.analogActive = false;
      this.analogDx = 0;
      this.analogDy = 0;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      if (this.panelVisible || this.restoreMode) return;
      if (this.craftingPanel.isVisible() || this.inventoryPanel.isVisible()) return;
      if (this.tradePanel.isVisible() || this.researchPanel.isVisible() || this.farmPanel.isVisible()) return;

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

      if (!analogGfx) {
        analogGfx = this.add.graphics().setScrollFactor(0).setDepth(250);
      }
      analogGfx.clear();
      analogGfx.lineStyle(2, 0xffffff, 0.25);
      analogGfx.strokeCircle(stickCenterX, stickCenterY, stickRadius);
      analogGfx.fillStyle(0x000000, 0.2);
      analogGfx.fillCircle(stickCenterX, stickCenterY, stickRadius);

      const clamp = Math.min(dist, stickRadius);
      const angle = Math.atan2(dy, dx);
      const thumbX = stickCenterX + Math.cos(angle) * clamp;
      const thumbY = stickCenterY + Math.sin(angle) * clamp;
      analogGfx.fillStyle(0xffffff, 0.5);
      analogGfx.fillCircle(thumbX, thumbY, 12);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointerDragged) {
        this.doClickToMove(pointer.worldX, pointer.worldY);
      }

      this.analogActive = false;
      this.analogDx = 0;
      this.analogDy = 0;
      if (analogGfx) {
        analogGfx.destroy();
        analogGfx = null;
      }
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
      if (this.panelVisible || this.restoreMode ||
          this.tradePanel.isVisible() || this.researchPanel.isVisible() || this.farmPanel.isVisible()) return;
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

    if (this.panelVisible) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        this.closePanel();
        return;
      }
      if (this.gateMode) {
        const up = Phaser.Input.Keyboard.JustDown(this.keys.UP) || Phaser.Input.Keyboard.JustDown(this.keys.W);
        const down = Phaser.Input.Keyboard.JustDown(this.keys.DOWN) || Phaser.Input.Keyboard.JustDown(this.keys.S);
        const left = Phaser.Input.Keyboard.JustDown(this.keys.LEFT) || Phaser.Input.Keyboard.JustDown(this.keys.A);
        const right = Phaser.Input.Keyboard.JustDown(this.keys.RIGHT) || Phaser.Input.Keyboard.JustDown(this.keys.D);

        if (this.gateTab === 5) {
          if (up) {
            if (this.consumableSelectionIdx > 0) {
              this.consumableSelectionIdx--;
            } else {
              this.gateTab = 4;
            }
            this.renderGatePanel();
          } else if (down) {
            if (this.consumableSelectionIdx < this.consumableTypes.length - 1) {
              this.consumableSelectionIdx++;
            } else {
              this.gateTab = 6;
            }
            this.renderGatePanel();
          } else if (left) {
            const ct = this.consumableTypes[this.consumableSelectionIdx];
            this.consumableLoadout[ct.id] = Math.max(0, this.consumableLoadout[ct.id] - 1);
            this.renderGatePanel();
          } else if (right) {
            const ct = this.consumableTypes[this.consumableSelectionIdx];
            const available = gameState.inventory.count(ct.id);
            if (this.consumableLoadout[ct.id] < available) {
              this.consumableLoadout[ct.id]++;
              this.renderGatePanel();
            }
          }
        } else {
          if (up) {
            this.gateTab = Math.max(0, this.gateTab - 1);
            if (this.gateTab === 5) this.consumableSelectionIdx = this.consumableTypes.length - 1;
            this.renderGatePanel();
          }
          if (down) {
            this.gateTab = Math.min(this.maxTab, this.gateTab + 1);
            if (this.gateTab === 5) this.consumableSelectionIdx = 0;
            this.renderGatePanel();
          }
          if (left) {
            if (this.gateTab === 0 && this.selectedPickaxeIdx > 0) {
              this.selectedPickaxeIdx--;
              this.renderGatePanel();
            } else if (this.gateTab === 1 && this.selectedRing1Idx > -1) {
              this.selectedRing1Idx--;
              this.renderGatePanel();
            } else if (this.gateTab === 2 && this.selectedRing2Idx > -1) {
              this.selectedRing2Idx--;
              this.renderGatePanel();
            } else if (this.gateTab === 3 && this.selectedBootsIdx > -1) {
              this.selectedBootsIdx--;
              this.renderGatePanel();
            } else if (this.gateTab === 4 && this.selectedLanternIdx > -1) {
              this.selectedLanternIdx--;
              this.renderGatePanel();
            } else if (this.gateTab === 6) {
              this.debugMode = !this.debugMode;
              this.renderGatePanel();
            } else if (this.gateTab === 7 && this.elevatorFloorOptions.length > 0) {
              const idx = this.elevatorFloorOptions.indexOf(this.selectedElevatorFloor);
              if (idx > 0) {
                this.selectedElevatorFloor = this.elevatorFloorOptions[idx - 1];
                this.renderGatePanel();
              }
            }
          }
          if (right) {
            if (this.gateTab === 0 && this.selectedPickaxeIdx < this.pickaxeOptions.length - 1) {
              this.selectedPickaxeIdx++;
              this.renderGatePanel();
            } else if (this.gateTab === 1 && this.selectedRing1Idx < this.ringOptions.length - 1) {
              this.selectedRing1Idx++;
              this.renderGatePanel();
            } else if (this.gateTab === 2 && this.selectedRing2Idx < this.ringOptions.length - 1) {
              this.selectedRing2Idx++;
              this.renderGatePanel();
            } else if (this.gateTab === 3 && this.selectedBootsIdx < this.bootOptions.length - 1) {
              this.selectedBootsIdx++;
              this.renderGatePanel();
            } else if (this.gateTab === 4 && this.selectedLanternIdx < this.lanternOptions.length - 1) {
              this.selectedLanternIdx++;
              this.renderGatePanel();
            } else if (this.gateTab === 6) {
              this.debugMode = !this.debugMode;
              this.renderGatePanel();
            } else if (this.gateTab === 7 && this.elevatorFloorOptions.length > 0) {
              const idx = this.elevatorFloorOptions.indexOf(this.selectedElevatorFloor);
              if (idx < this.elevatorFloorOptions.length - 1) {
                this.selectedElevatorFloor = this.elevatorFloorOptions[idx + 1];
                this.renderGatePanel();
              }
            }
          }
        }
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        if (this.restoreMode) {
          this.tryRestore(this.restoreBuildingId);
        } else if (this.gateMode) {
          if (this.gateTab === 8) {
            if (this.resetConfirm) {
              gameState.resetProgress();
              this.closePanel();
              this.cameras.main.fadeOut(400, 0, 0, 0);
              this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('HomelandScene');
              });
            } else {
              this.resetConfirm = true;
              this.renderGatePanel();
            }
          } else {
            this.resetConfirm = false;
            this.startExpedition();
          }
        } else {
          this.closePanel();
        }
      }
      return;
    }

    this.moveTimer += delta;
    if (this.moveTimer >= this.moveDelay) {
      this.handleMovement(delta);
      this.moveTimer = 0;
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

    audio.playStep();

    this.playerGx = nx;
    this.playerGy = ny;

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
      else if (closest.id === 'villager_house') action = `Visit (${gameState.villagersRescued} rescued)`;
      else action = `Visit ${closest.label.split(' ')[0].toLowerCase()}`;

      this.promptText.setText(`[SPACE] ${action}`);
      this.promptText.setAlpha(1);
    } else {
      this.currentBuilding = null;
      this.promptText.setAlpha(0);
    }
  }

  private handleInteraction(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) return;
    if (!this.currentBuilding) return;
    this.movePath = [];
    this.analogActive = false;

    const b = this.currentBuilding;

    if (b.id === 'gate') {
      this.showGatePanel();
      return;
    }

    if (b.id === 'storage') {
      if (isRestored('storage')) {
        this.inventoryPanel.refresh();
        this.inventoryPanel.show();
      } else {
        this.showRestorePanel('storage');
        this.restoreBuildingId = 'storage';
      }
      return;
    }

    if (b.id === 'crafting') {
      if (isRestored('crafting_station')) {
        this.craftingPanel.refresh();
        this.craftingPanel.show();
      } else {
        this.showRestorePanel('crafting_station');
        this.restoreBuildingId = 'crafting_station';
      }
      return;
    }

    if (b.id === 'villager_house') {
      if (isRestored('housing')) {
        this.showBuildingPanel(b);
      } else {
        this.showRestorePanel('housing');
        this.restoreBuildingId = 'housing';
      }
      return;
    }

    if (b.id === 'trading_post') {
      if (isRestored('trading_post')) {
        this.showTradePanel();
      } else {
        this.showRestorePanel('trading_post');
        this.restoreBuildingId = 'trading_post';
      }
      return;
    }

    if (b.id === 'laboratory') {
      if (isRestored('laboratory')) {
        this.showResearchPanel();
      } else {
        this.showRestorePanel('laboratory');
        this.restoreBuildingId = 'laboratory';
      }
      return;
    }

    if (b.id === 'farm') {
      if (isRestored('farm')) {
        this.showFarmPanel();
      } else {
        this.showRestorePanel('farm');
        this.restoreBuildingId = 'farm';
      }
      return;
    }

    this.showBuildingPanel(b);
  }

  private showRestorePanel(buildingId: string): void {
    const building = getBuilding(buildingId);
    if (!building) return;

    this.restoreMode = true;
    this.panelVisible = true;

    const costLines = Object.entries(building.cost)
      .map(([id, qty]) => {
        const have = gameState.inventory.count(id);
        const color = have >= qty ? '#88dd88' : '#dd6666';
        return `  ${id.replace(/_/g, ' ')}: ${have}/${qty}`;
      })
      .join('\n');

    const canAfford = canRestore(buildingId);

    this.panelBg.clear();
    this.panelBg.fillStyle(0x0a0a1a, 0.85);
    this.panelBg.fillRoundedRect(960 / 2 - 200, 640 / 2 - 110, 400, 220, 10);
    this.panelBg.lineStyle(2, 0x6a5a8a, 1);
    this.panelBg.strokeRoundedRect(960 / 2 - 200, 640 / 2 - 110, 400, 220, 10);
    this.panelBg.setAlpha(1);

    this.panelText.setText(
      `${building.name}\n\nRequired Materials:\n${costLines}\n\n${
        canAfford ? '[SPACE] Restore  |  [ESC] cancel' : '[ESC] close'
      }`
    );
    this.panelText.setAlpha(1);
  }

  private tryRestore(buildingId: string): void {
    const building = getBuilding(buildingId);
    const success = restoreBuilding(buildingId);
    this.restoreMode = false;
    this.closePanel();

    if (success) {
      this.drawHubBuildings();

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
        onComplete: () => {
          popup.destroy();
        },
      });
    }
  }

  private showGatePanel(): void {
    this.gateMode = true;
    this.panelVisible = true;
    this.debugMode = false;
    this.pickaxeOptions = gameState.getAvailablePickaxes();
    this.ringOptions = gameState.getAvailableRings();
    this.bootOptions = gameState.getAvailableBoots();
    this.lanternOptions = gameState.getAvailableLanterns();

    const currentTier = gameState.currentPickaxeTier;
    this.selectedPickaxeIdx = this.pickaxeOptions.findIndex(o => o.tier === currentTier);
    if (this.selectedPickaxeIdx < 0) this.selectedPickaxeIdx = 0;

    this.selectedRing1Idx = this.ringOptions.findIndex(r => r.id === gameState.equippedRings.ring1);
    this.selectedRing2Idx = this.ringOptions.findIndex(r => r.id === gameState.equippedRings.ring2);

    this.selectedBootsIdx = this.bootOptions.findIndex(b => b.id === gameState.equippedBoots);
    this.selectedLanternIdx = this.lanternOptions.findIndex(l => l.id === gameState.equippedLantern);

    this.consumableLoadout = {};
    for (const ct of this.consumableTypes) {
      this.consumableLoadout[ct.id] = 0;
    }
    this.consumableSelectionIdx = 0;

    this.elevatorFloorOptions = gameState.getAvailableElevatorFloors();
    this.selectedElevatorFloor = this.elevatorFloorOptions.includes(0) ? 0 : (this.elevatorFloorOptions[0] ?? 0);
    this.resetConfirm = false;
    this.maxTab = 8;

    this.gateTab = 0;

    this.renderGatePanel();
  }

  private renderGatePanel(): void {
    const names: Record<number, string> = {
      1: 'Common Pickaxe',
      2: 'Bronze Pickaxe',
      3: 'Silver Pickaxe',
    };
    const maxStamina = this.debugMode ? 10000 : 100 + gameState.maxStaminaBonus;
    const invSlots = 16 + gameState.inventorySlotBonus;

    const pickaxeLines = this.pickaxeOptions
      .map((o, i) => {
        const marker = i === this.selectedPickaxeIdx && this.gateTab === 0 ? '▶' : ' ';
        if (o.tier === 1) {
          return `  ${marker} ${names[o.tier]}`;
        }
        const remaining = gameState.remainingPickaxeRuns(o.tier);
        const qty = gameState.inventory.count(`pickaxe_${o.tier}`);
        return `  ${marker} ${names[o.tier]} (${remaining}/5) [x${qty}]`;
      })
      .join('\n');

    const ring1Marker = this.gateTab === 1 ? '▶' : ' ';
    const ring2Marker = this.gateTab === 2 ? '▶' : ' ';
    const ring1Name = this.selectedRing1Idx >= 0 ? this.ringOptions[this.selectedRing1Idx]?.name ?? '(none)' : '(none)';
    const ring2Name = this.selectedRing2Idx >= 0 ? this.ringOptions[this.selectedRing2Idx]?.name ?? '(none)' : '(none)';

    const ringLines = [
      `  ${ring1Marker} Ring 1: ${ring1Name}`,
      `  ${ring2Marker} Ring 2: ${ring2Name}`,
    ].join('\n');

    const bootsMarker = this.gateTab === 3 ? '▶' : ' ';
    const bootsName = this.selectedBootsIdx >= 0 ? this.bootOptions[this.selectedBootsIdx]?.name ?? '(none)' : '(none)';
    const bootsRuns = this.selectedBootsIdx >= 0 ? this.bootOptions[this.selectedBootsIdx]?.runs ?? 0 : 0;
    const bootsRunsStr = bootsRuns === Infinity ? '' : ` (${bootsRuns}/5)`;
    const bootsLine = `  ${bootsMarker} Boots: ${bootsName}${bootsRunsStr}`;

    const lanternMarker = this.gateTab === 4 ? '▶' : ' ';
    const lanternName = this.selectedLanternIdx >= 0 ? this.lanternOptions[this.selectedLanternIdx]?.name ?? '(none)' : '(none)';
    const lanternRuns = this.selectedLanternIdx >= 0 ? this.lanternOptions[this.selectedLanternIdx]?.runs ?? 0 : 0;
    const lanternRunsStr = lanternRuns === Infinity ? '' : ` (${lanternRuns}/5)`;
    const lanternLine = `  ${lanternMarker} Lantern: ${lanternName}${lanternRunsStr}`;

    const consumableLines = this.consumableTypes
      .map((ct, i) => {
        const marker = this.gateTab === 5 && i === this.consumableSelectionIdx ? '▶' : ' ';
        const qty = this.consumableLoadout[ct.id];
        const available = gameState.inventory.count(ct.id);
        return `  ${marker} ${ct.name.padEnd(18)} ${qty} (have ${available})`;
      })
      .join('\n');

    const dbgMarker = this.gateTab === 6 ? '▶' : ' ';
    const dbgLine = `  ${dbgMarker} Debug Mode: ${this.debugMode ? 'ON' : 'OFF'}`;

    const elevMarker = this.gateTab === 7 ? '▶' : ' ';
    const elevFloorStr = this.selectedElevatorFloor === 0 ? '0 (Homeland)' : `${this.selectedElevatorFloor}`;
    const elevLine = `  ${elevMarker} Start Floor: ${elevFloorStr}`;

    const resetMarker = this.gateTab === 8 ? '▶' : ' ';
    const resetLine = `  ${resetMarker} Reset Game${this.resetConfirm ? '  [SPACE] confirm' : ''}`;

    this.panelBg.clear();
    this.panelBg.fillStyle(0x0a0a1a, 0.85);
    this.panelBg.fillRoundedRect(960 / 2 - 260, 640 / 2 - 240, 520, 480, 10);
    this.panelBg.lineStyle(2, 0x6a5a8a, 1);
    this.panelBg.strokeRoundedRect(960 / 2 - 260, 640 / 2 - 240, 520, 480, 10);
    this.panelBg.setAlpha(1);

    const foundRelics = gameState.getFoundRelics();
    const relicLine = foundRelics.length > 0 ? `\nRelics: ${foundRelics.length} found` : '';

    this.panelText.setText(
      `Expedition Loadout\n\n` +
      `${pickaxeLines}\n\n` +
      `${ringLines}\n\n` +
      `${bootsLine}\n` +
      `${lanternLine}\n\n` +
      `Consumables:\n${consumableLines}\n\n` +
      `${dbgLine}\n` +
      `${elevLine}\n` +
      `${resetLine}${relicLine}\n\n` +
      `   [↑/↓] select slot  [←/→] change\n\n` +
      `Max Stamina: ${maxStamina}\n` +
      `Inventory: ${invSlots} slots\n\n` +
      `[SPACE] Enter  |  [ESC] cancel`
    );
    this.panelText.setAlpha(1);
  }

  private startExpedition(): void {
    const selected = this.pickaxeOptions[this.selectedPickaxeIdx];
    if (selected) {
      gameState.equipPickaxe(selected.tier);
    }
    gameState.equippedRings.ring1 = this.selectedRing1Idx >= 0 ? this.ringOptions[this.selectedRing1Idx]?.id ?? null : null;
    gameState.equippedRings.ring2 = this.selectedRing2Idx >= 0 ? this.ringOptions[this.selectedRing2Idx]?.id ?? null : null;
    gameState.equippedBoots = this.selectedBootsIdx >= 0 ? this.bootOptions[this.selectedBootsIdx]?.id ?? null : null;
    gameState.equippedLantern = this.selectedLanternIdx >= 0 ? this.lanternOptions[this.selectedLanternIdx]?.id ?? null : null;

    const consumables: Record<string, number> = {};
    for (const ct of this.consumableTypes) {
      const qty = this.consumableLoadout[ct.id];
      if (qty > 0) {
        consumables[ct.id] = qty;
        gameState.inventory.removeItem(ct.id, qty);
      }
    }
    gameState.save();

    this.closePanel();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('ExpeditionScene', {
        debug: this.debugMode,
        consumables,
        startFloor: this.selectedElevatorFloor,
      });
    });
  }

  private showBuildingPanel(building: HubBuildingDef): void {
    this.panelVisible = true;
    this.restoreMode = false;

    this.panelBg.clear();
    this.panelBg.fillStyle(0x0a0a1a, 0.85);
    this.panelBg.fillRoundedRect(960 / 2 - 200, 640 / 2 - 90, 400, 180, 10);
    this.panelBg.lineStyle(2, 0x6a5a8a, 1);
    this.panelBg.strokeRoundedRect(960 / 2 - 200, 640 / 2 - 90, 400, 180, 10);
    this.panelBg.setAlpha(1);

    this.panelText.setText(
      `${building.label}\n\n${building.description}\n\n[SPACE/ESC] close`
    );
    this.panelText.setAlpha(1);
  }

  private closePanel(): void {
    this.panelVisible = false;
    this.restoreMode = false;
    this.gateMode = false;
    this.gateTab = 0;
    this.consumableLoadout = {};
    this.tradePanel.hide();
    this.researchPanel.hide();
    this.farmPanel.hide();
    this.panelBg.setAlpha(0);
    this.panelText.setAlpha(0);
  }

  private showTradePanel(): void {
    this.panelVisible = true;
    this.tradePanel.show();
  }

  private showResearchPanel(): void {
    this.panelVisible = true;
    this.researchPanel.show();
  }

  private showFarmPanel(): void {
    this.panelVisible = true;
    this.farmPanel.show();
  }

  private trashItem(itemId: string): void {
    if (gameState.inventory.count(itemId) <= 0) return;
    gameState.inventory.removeItem(itemId, 1);
    audio.playError();
    this.inventoryPanel.refresh();
  }
}
