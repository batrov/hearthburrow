import Phaser from 'phaser';
import { gameState, itemDisplayName, itemIconKey } from '../systems/GameState';
import { InventoryPanel } from '../ui/InventoryPanel';
import { CraftingPanel } from '../ui/CraftingPanel';
import { TradePanel } from '../ui/TradePanel';
import { ResearchPanel } from '../ui/ResearchPanel';
import { FarmPanel } from '../ui/FarmPanel';
import { canRestore, restoreBuilding, isRestored } from '../systems/BuildingSystem';
import { getBuilding } from '../systems/DataRegistry';
import { audio } from '../systems/AudioSystem';
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
  private seedKeyHandler: ((event: KeyboardEvent) => void) | null = null;
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
  private gateSeed: string = '';
  private seedEditing: boolean = false;
  private restoreContent: Phaser.GameObjects.Container | null = null;
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
  private animFrame: number = 0;
  private animTimer: number = 0;
  private readonly ANIM_INTERVAL: number = 60;

  // Gate panel container-based UI
  private gateContainer!: Phaser.GameObjects.Container;
  private gateBg!: Phaser.GameObjects.Graphics;
  private gatePortrait!: Phaser.GameObjects.Image;
  private gateTitle!: Phaser.GameObjects.Text;
  private gateEquipMarkers: Phaser.GameObjects.Text[] = [];
  private gateEquipIcons: Phaser.GameObjects.Image[] = [];
  private gateEquipLabels: Phaser.GameObjects.Text[] = [];
  private gateEquipArrowsL: Phaser.GameObjects.Image[] = [];
  private gateEquipArrowsR: Phaser.GameObjects.Image[] = [];
  private gateConsumableIcons: Phaser.GameObjects.Image[] = [];
  private gateConsumableTexts: Phaser.GameObjects.Text[] = [];
  private gateConsumableHeader!: Phaser.GameObjects.Text;
  private gateBottomMarkers: Phaser.GameObjects.Text[] = [];
  private gateBottomTexts: Phaser.GameObjects.Text[] = [];
  private gateFooter!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'HomelandScene' });
  }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#0a0a0a');
    this.panelVisible = false;
    this.currentBuilding = null;
    this.moveTimer = 0;
    this.animFrame = 0;
    this.animTimer = 0;

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
          this.buildingsContainer.add(img);
        }
      }

      const c = gridToIso(b.gx + b.gw / 2, b.gy + b.gh / 2);
      const label = this.add.text(c.x, c.y - 48, b.label, {
        fontSize: '11px', fontFamily: 'monospace', color: ul ? '#e8d5b7' : '#6a5a4a',
      }).setOrigin(0.5).setAlpha(alpha);
      this.buildingsContainer.add(label);
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

    this.add.text(c.x, c.y + 24, '[SPACE] Descend', {
      fontSize: '11px', fontFamily: 'monospace', color: '#8a7aba',
    }).setOrigin(0.5);
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

    this.panelBg = this.add.graphics();
    this.panelBg.setDepth(90).setScrollFactor(0);
    this.panelBg.setAlpha(0);

    this.panelText = this.add.text(960 / 2, 640 / 2, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#e8d5b7',
      align: 'center', lineSpacing: 8,
    }).setOrigin(0.5).setDepth(91).setScrollFactor(0).setAlpha(0);

    this.buildGateUI();
  }

  private buildGateUI(): void {
    if (this.gateContainer) {
      this.gateContainer.destroy(true);
      this.gateContainer = null!;
    }
    this.gateEquipMarkers = [];
    this.gateEquipIcons = [];
    this.gateEquipLabels = [];
    this.gateEquipArrowsL = [];
    this.gateEquipArrowsR = [];
    this.gateConsumableIcons = [];
    this.gateConsumableTexts = [];
    this.gateBottomMarkers = [];
    this.gateBottomTexts = [];

    const PL = 130, PT = 40, PW = 700, PH = 560;
    const CX = 395;
    const TEXT_STYLE = { fontSize: '14px', fontFamily: 'monospace', color: '#e8d5b7' };
    const ROW_YS = [114, 152, 190, 228, 266];
    const CONS_YS = [324, 356, 388];
    const BOTTOM_YS = [440, 470, 500, 530];

    this.gateContainer = this.add.container(0, 0).setDepth(90).setScrollFactor(0);
    this.gateContainer.setVisible(false);

    this.gateBg = this.add.graphics();
    this.gateContainer.add(this.gateBg);

    this.gatePortrait = this.add.image(258, 180, 'portrait');
    this.gateContainer.add(this.gatePortrait);

    this.gateTitle = this.add.text(480, 58, 'Expedition Loadout', {
      fontSize: '20px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.gateContainer.add(this.gateTitle);

    for (let i = 0; i < 5; i++) {
      const ry = ROW_YS[i];
      const marker = this.add.text(CX, ry + 6, ' ', TEXT_STYLE);
      this.gateContainer.add(marker);
      this.gateEquipMarkers.push(marker);

      const icon = this.add.image(CX + 18, ry, 'item_pickaxe_1');
      this.gateContainer.add(icon);
      this.gateEquipIcons.push(icon);

      const label = this.add.text(CX + 40, ry + 6, '', TEXT_STYLE);
      this.gateContainer.add(label);
      this.gateEquipLabels.push(label);

      const arrL = this.add.image(722, ry, 'item_arrow_left').setInteractive({ useHandCursor: true });
      arrL.setData('row', i).setData('dir', -1);
      arrL.on('pointerdown', () => this.handleArrowClick(i, -1));
      this.gateContainer.add(arrL);
      this.gateEquipArrowsL.push(arrL);

      const arrR = this.add.image(756, ry, 'item_arrow_right').setInteractive({ useHandCursor: true });
      arrR.setData('row', i).setData('dir', 1);
      arrR.on('pointerdown', () => this.handleArrowClick(i, 1));
      this.gateContainer.add(arrR);
      this.gateEquipArrowsR.push(arrR);
    }

    this.gateConsumableHeader = this.add.text(CX, 304, 'Consumables:', {
      fontSize: '14px', fontFamily: 'monospace', color: '#b8a898',
    });
    this.gateContainer.add(this.gateConsumableHeader);

    for (let i = 0; i < 3; i++) {
      const cy = CONS_YS[i];
      const icon = this.add.image(CX + 18, cy, 'item_stamina_potion');
      this.gateContainer.add(icon);
      this.gateConsumableIcons.push(icon);

      const text = this.add.text(CX + 40, cy + 6, '', TEXT_STYLE);
      this.gateContainer.add(text);
      this.gateConsumableTexts.push(text);
    }

    for (let i = 0; i < 4; i++) {
      const by = BOTTOM_YS[i];
      const marker = this.add.text(CX, by + 6, ' ', TEXT_STYLE);
      this.gateContainer.add(marker);
      this.gateBottomMarkers.push(marker);

      const text = this.add.text(CX + 18, by + 6, '', TEXT_STYLE);
      this.gateContainer.add(text);
      this.gateBottomTexts.push(text);
    }

    this.gateFooter = this.add.text(480, 564, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#8a7a9a', align: 'center',
    }).setOrigin(0.5);
    this.gateContainer.add(this.gateFooter);
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
        if (this.seedEditing) {
          this.seedEditing = false;
          this.renderGatePanel();
          return;
        }
        this.closePanel();
        return;
      }
      if (this.gateMode) {
        if (this.gateTab === 9 && this.seedEditing) {
          // block navigation while typing seed
        } else {
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
          } else if (this.gateTab === 9) {
            this.seedEditing = !this.seedEditing;
            this.renderGatePanel();
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
      else if (closest.id === 'tavern') action = `Enter Tavern (${gameState.rescuedVillagers.length}/20 inside)`;
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

  private showRestorePanel(buildingId: string): void {
    const building = getBuilding(buildingId);
    if (!building) return;

    this.restoreMode = true;
    this.panelVisible = true;

    if (this.restoreContent) { this.restoreContent.destroy(true); this.restoreContent = null; }

    const costEntries = Object.entries(building.cost);
    const canAfford = canRestore(buildingId);

    this.panelBg.clear();
    this.panelBg.fillStyle(0x0a0a1a, 0.85);
    this.panelBg.fillRoundedRect(960 / 2 - 200, 640 / 2 - 110, 400, 220, 10);
    this.panelBg.lineStyle(2, 0x6a5a8a, 1);
    this.panelBg.strokeRoundedRect(960 / 2 - 200, 640 / 2 - 110, 400, 220, 10);
    this.panelBg.setAlpha(1);

    this.panelText.setAlpha(0);

    const lineH = 28;
    const totalLines = 5 + costEntries.length;
    const totalTextH = totalLines * lineH;
    const textTop = 640 / 2 - totalTextH / 2;

    this.restoreContent = this.add.container(0, 0).setDepth(210).setScrollFactor(0);

    this.restoreContent.add(
      this.add.text(480, textTop + 0 * lineH + lineH / 2, building.name, {
        fontSize: '16px', fontFamily: 'monospace', color: '#e8d5b7',
      }).setOrigin(0.5)
    );

    this.restoreContent.add(
      this.add.text(480, textTop + 2 * lineH + lineH / 2, 'Required Materials:', {
        fontSize: '16px', fontFamily: 'monospace', color: '#e8d5b7',
      }).setOrigin(0.5)
    );

    const spriteX = 420;
    const textX = 435;

    for (let i = 0; i < costEntries.length; i++) {
      const [id, qty] = costEntries[i];
      const have = gameState.inventory.count(id);
      const color = have >= qty ? '#88dd88' : '#dd6666';
      const y = textTop + (3 + i) * lineH + lineH / 2;

      const iconKey = itemIconKey(id);
      if (this.textures.exists(iconKey)) {
        this.restoreContent.add(
          this.add.image(spriteX, y, iconKey).setScale(0.7)
        );
      }

      this.restoreContent.add(
        this.add.text(textX, y, `${itemDisplayName(id)}: ${have}/${qty}`, {
          fontSize: '16px', fontFamily: 'monospace', color,
        }).setOrigin(0, 0.5)
      );
    }

    this.restoreContent.add(
      this.add.text(480, textTop + (4 + costEntries.length) * lineH + lineH / 2,
        canAfford ? '[SPACE] Restore  |  [ESC] cancel' : '[ESC] close', {
        fontSize: '16px', fontFamily: 'monospace', color: '#e8d5b7',
      }).setOrigin(0.5)
    );
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
    this.maxTab = 9;
    this.gateSeed = gameState.currentRunSeed;
    this.seedEditing = false;

    this.gateTab = 0;

    this.seedKeyHandler = (event: KeyboardEvent) => {
      if (this.gateTab !== 9 || !this.gateMode || !this.seedEditing) return;
      if (event.key === 'Backspace') {
        this.gateSeed = this.gateSeed.slice(0, -1);
        this.renderGatePanel();
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (this.gateSeed.length < 24) {
          this.gateSeed += event.key;
          this.renderGatePanel();
        }
      }
    };
    this.input.keyboard!.on('keydown', this.seedKeyHandler);

    this.gateContainer.setVisible(true);
    this.renderGatePanel();
  }

  private renderGatePanel(): void {
    const PL = 130, PT = 40, PW = 700, PH = 560;
    const names: Record<number, string> = {
      1: 'Common Pickaxe',
      2: 'Bronze Pickaxe',
      3: 'Silver Pickaxe',
      4: 'Gold Pickaxe',
    };
    const maxStamina = this.debugMode ? 10000 : 100 + gameState.maxStaminaBonus;
    const invSlots = 16 + gameState.inventorySlotBonus;
    const foundRelics = gameState.getFoundRelics();

    this.gateBg.clear();
    this.gateBg.fillStyle(0x0a0a1a, 0.85);
    this.gateBg.fillRoundedRect(PL, PT, PW, PH, 12);
    this.gateBg.lineStyle(2, 0x6a5a8a, 1);
    this.gateBg.strokeRoundedRect(PL, PT, PW, PH, 12);

    // Equipment rows
    for (let i = 0; i < 5; i++) {
      const marker = this.gateEquipMarkers[i];
      const icon = this.gateEquipIcons[i];
      const label = this.gateEquipLabels[i];

      let selected = false;
      let hasOpt = false;
      let iconKey = '';
      let text = '(none)';

      switch (i) {
        case 0: {
          selected = this.gateTab === 0;
          const opt = this.pickaxeOptions[this.selectedPickaxeIdx];
          if (opt) {
            hasOpt = true;
            iconKey = `item_pickaxe_${opt.tier}`;
            const n = names[opt.tier];
            if (opt.tier === 1) {
              text = n;
            } else {
              const remaining = gameState.remainingPickaxeRuns(opt.tier);
              const qty = gameState.inventory.count(`pickaxe_${opt.tier}`);
              text = `${n} (${remaining}/5) [x${qty}]`;
            }
          }
          break;
        }
        case 1: {
          selected = this.gateTab === 1;
          const opt = this.selectedRing1Idx >= 0 ? this.ringOptions[this.selectedRing1Idx] : null;
          if (opt) {
            hasOpt = true;
            iconKey = `item_${opt.id}`;
            text = `Ring 1: ${opt.name}`;
          } else {
            text = 'Ring 1: (none)';
          }
          break;
        }
        case 2: {
          selected = this.gateTab === 2;
          const opt = this.selectedRing2Idx >= 0 ? this.ringOptions[this.selectedRing2Idx] : null;
          if (opt) {
            hasOpt = true;
            iconKey = `item_${opt.id}`;
            text = `Ring 2: ${opt.name}`;
          } else {
            text = 'Ring 2: (none)';
          }
          break;
        }
        case 3: {
          selected = this.gateTab === 3;
          const opt = this.selectedBootsIdx >= 0 ? this.bootOptions[this.selectedBootsIdx] : null;
          if (opt) {
            hasOpt = true;
            iconKey = `item_${opt.id}`;
            const runsStr = opt.runs === Infinity ? '' : ` (${opt.runs}/5)`;
            text = `Boots: ${opt.name}${runsStr}`;
          } else {
            text = 'Boots: (none)';
          }
          break;
        }
        case 4: {
          selected = this.gateTab === 4;
          const opt = this.selectedLanternIdx >= 0 ? this.lanternOptions[this.selectedLanternIdx] : null;
          if (opt) {
            hasOpt = true;
            iconKey = `item_${opt.id}`;
            const runsStr = opt.runs === Infinity ? '' : ` (${opt.runs}/5)`;
            text = `Lantern: ${opt.name}${runsStr}`;
          } else {
            text = 'Lantern: (none)';
          }
          break;
        }
      }

      marker.setText(selected ? '▶' : ' ');
      if (hasOpt && iconKey && this.textures.exists(iconKey)) {
        icon.setTexture(iconKey);
      }
      icon.setVisible(hasOpt);
      label.setText(text);
    }

    // Consumables
    for (let i = 0; i < 3; i++) {
      const ct = this.consumableTypes[i];
      const icon = this.gateConsumableIcons[i];
      const text = this.gateConsumableTexts[i];
      const qty = this.consumableLoadout[ct.id];
      const available = gameState.inventory.count(ct.id);
      const selected = this.gateTab === 5 && i === this.consumableSelectionIdx;

      const iconKey = `item_${ct.id}`;
      if (this.textures.exists(iconKey)) {
        icon.setTexture(iconKey);
      }
      icon.setVisible(true);
      text.setText(`${selected ? '▶' : ' '} ${ct.name}  ${qty} (have ${available})`);
    }

    // Bottom rows: 0=debug, 1=floor, 2=seed, 3=reset
    this.gateBottomMarkers[0].setText(this.gateTab === 6 ? '▶' : ' ');
    this.gateBottomTexts[0].setText(`Debug Mode: ${this.debugMode ? 'ON' : 'OFF'}`);

    this.gateBottomMarkers[1].setText(this.gateTab === 7 ? '▶' : ' ');
    const elevStr = this.selectedElevatorFloor === 0 ? '0 (Homeland)' : `${this.selectedElevatorFloor}`;
    this.gateBottomTexts[1].setText(`Start Floor: ${elevStr}`);

    this.gateBottomMarkers[2].setText(this.gateTab === 9 ? '▶' : ' ');
    const seedDisplay = this.gateSeed || '(none - random)';
    const seedStatus = this.seedEditing ? ' [EDITING]' : '';
    this.gateBottomTexts[2].setText(`Seed: ${seedDisplay}${seedStatus}`);

    this.gateBottomMarkers[3].setText(this.gateTab === 8 ? '▶' : ' ');
    this.gateBottomTexts[3].setText(`Reset Game${this.resetConfirm ? '  [SPACE] confirm' : ''}`);

    // Footer
    let footer = `[↑/↓] select  [←/→] change  [SPACE] Enter  [ESC] cancel\n`;
    footer += `Max Stamina: ${maxStamina}  |  Inventory: ${invSlots} slots`;
    if (foundRelics.length > 0) {
      footer += `  |  Relics: ${foundRelics.length}`;
    }
    this.gateFooter.setText(footer);
    this.gateFooter.setAlpha(1);
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

    gameState.currentRunSeed = this.gateSeed;
    gameState.save();

    this.closePanel();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('ExpeditionScene', {
        debug: this.debugMode,
        consumables,
        startFloor: this.selectedElevatorFloor,
        seed: this.gateSeed,
      });
    });
  }

  private handleArrowClick(row: number, dir: number): void {
    const tabMap = [0, 1, 2, 3, 4];
    this.gateTab = tabMap[row];
    switch (row) {
      case 0: {
        const idx = this.selectedPickaxeIdx + dir;
        if (idx >= 0 && idx < this.pickaxeOptions.length) this.selectedPickaxeIdx = idx;
        break;
      }
      case 1: {
        const idx = this.selectedRing1Idx + dir;
        if (idx >= -1 && idx < this.ringOptions.length) this.selectedRing1Idx = idx;
        break;
      }
      case 2: {
        const idx = this.selectedRing2Idx + dir;
        if (idx >= -1 && idx < this.ringOptions.length) this.selectedRing2Idx = idx;
        break;
      }
      case 3: {
        const idx = this.selectedBootsIdx + dir;
        if (idx >= -1 && idx < this.bootOptions.length) this.selectedBootsIdx = idx;
        break;
      }
      case 4: {
        const idx = this.selectedLanternIdx + dir;
        if (idx >= -1 && idx < this.lanternOptions.length) this.selectedLanternIdx = idx;
        break;
      }
    }
    this.renderGatePanel();
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
    this.seedEditing = false;
    if (this.restoreContent) { this.restoreContent.destroy(true); this.restoreContent = null; }
    if (this.seedKeyHandler) {
      this.input.keyboard!.off('keydown', this.seedKeyHandler);
      this.seedKeyHandler = null;
    }
    this.consumableLoadout = {};
    this.tradePanel.hide();
    this.researchPanel.hide();
    this.farmPanel.hide();
    this.panelBg.setAlpha(0);
    this.panelText.setAlpha(0);
    this.gateContainer.setVisible(false);
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
