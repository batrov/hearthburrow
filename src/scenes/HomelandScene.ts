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
import { DeveloperPanel } from '../ui/DeveloperPanel';
import { canRestore, restoreBuilding, isRestored } from '../systems/BuildingSystem';
import { getBuilding } from '../systems/DataRegistry';
import { audio } from '../systems/AudioSystem';
import { AnalogStickInput } from '../ui/AnalogStickInput';
import { getSpriteConfig } from '../systems/SpriteConfig';
import { SCENES } from '../constants/scenes';
import {
  gridToIso, isoToGrid, findPath, interactiveDepth,
  HALF_W, HALF_H, worldWidth, worldHeight,
} from '../systems/IsoUtils';
import { VW, VH, CX, CY, actionButtonCenter, actionButtonGlowBoxTopLeft, ACTION_BTN_SIZE } from '../systems/Viewport';
import { viewportManager } from '../systems/ViewportManager';
import { textStyle, fs, createText } from '../systems/Font';
import { createAdaptiveText } from '../ui/AdaptiveText';
import { getInputMode } from '../systems/InputMode';

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

interface HubDecoration {
  key: string;
  gx: number;
  gy: number;
  solid: boolean;
}

const HUB_COLS = 26;
const HUB_ROWS = 22;

const HUB_BUILDINGS: HubBuildingDef[] = [
  { id: 'trading_post', label: 'Trading Post', gx: 6, gy: 2, gw: 3, gh: 3, buildingId: 'trading_post',
    description: 'Trade resources with wandering merchants.', solid: true },
  { id: 'crafting', label: 'Crafting Station', gx: 4, gy: 8, gw: 3, gh: 3, buildingId: 'crafting_station',
    description: 'Craft tools and equipment from mined materials.', solid: true },
  { id: 'farm', label: 'Farm', gx: 4, gy: 14, gw: 3, gh: 3, buildingId: 'farm',
    description: 'Plant carrots and harvest more carrots.', solid: true },
  { id: 'tavern', label: 'Tavern', gx: 18, gy: 2, gw: 3, gh: 3, buildingId: 'housing',
    description: 'A warm gathering place for rescued villagers.', solid: true },
  { id: 'storage', label: 'Storage', gx: 19, gy: 8, gw: 3, gh: 3, buildingId: 'storage',
    description: 'Store and manage your collected resources.', solid: true },
  { id: 'laboratory', label: 'Laboratory', gx: 18, gy: 14, gw: 3, gh: 3, buildingId: 'laboratory',
    description: 'Research advanced upgrades and recipes.', solid: true },
  { id: 'gate', label: 'Expedition Gate', gx: 12, gy: 20, gw: 2, gh: 1, buildingId: '',
    description: 'Descend into the procedural dungeon to mine resources.', solid: false },
];

const BUILDING_TEXTURE_KEYS: Record<string, string> = {
  trading_post: 'building_trading_post',
  crafting: 'building_crafting',
  farm: 'building_farm',
  tavern: 'building_tavern',
  storage: 'building_storage',
  laboratory: 'building_laboratory',
  gate: 'building_gate',
};

function buildPathSet(): Set<string> {
  const s = new Set<string>();
  for (let y = 0; y < HUB_ROWS; y++) {
    if (y >= 6 && y <= 7) continue;
    s.add(`12,${y}`); s.add(`13,${y}`);
  }
  for (let y = 2; y <= 4; y++) s.add(`11,${y}`);
  for (let y = 8; y <= 10; y++) for (let x = 7; x <= 11; x++) s.add(`${x},${y}`);
  for (let y = 14; y <= 16; y++) for (let x = 7; x <= 11; x++) s.add(`${x},${y}`);
  for (let y = 2; y <= 4; y++) for (let x = 14; x <= 16; x++) s.add(`${x},${y}`);
  for (let y = 8; y <= 10; y++) for (let x = 14; x <= 18; x++) s.add(`${x},${y}`);
  for (let y = 14; y <= 16; y++) for (let x = 14; x <= 16; x++) s.add(`${x},${y}`);
  s.add('12,19'); s.add('13,19');
  return s;
}

const BRIDGE_COORDS = new Set<string>(['12,6', '13,6', '12,7', '13,7']);

function buildWaterSet(): Set<string> {
  const s = new Set<string>();
  for (let x = 0; x < HUB_COLS; x++) {
    if (x >= 12 && x <= 13) continue;
    s.add(`${x},6`); s.add(`${x},7`);
  }
  const pond = [[1,16],[2,16],[3,16],[1,17],[2,17],[3,17],[1,18],[2,18],[2,15]];
  for (const [x, y] of pond) s.add(`${x},${y}`);
  return s;
}

const PATH_COORDS = buildPathSet();
const WATER_COORDS = buildWaterSet();

const HUB_DECORATIONS: HubDecoration[] = [
  { key: 'decoration_tree_pine', gx: 0, gy: 0, solid: true },
  { key: 'decoration_tree_oak', gx: 25, gy: 0, solid: true },
  { key: 'decoration_tree_pine', gx: 3, gy: 1, solid: true },
  { key: 'decoration_tree_oak', gx: 22, gy: 1, solid: true },
  { key: 'decoration_tree_pine', gx: 4, gy: 5, solid: true },
  { key: 'decoration_tree_oak', gx: 21, gy: 5, solid: true },
  { key: 'decoration_tree_pine', gx: 0, gy: 8, solid: true },
  { key: 'decoration_tree_oak', gx: 25, gy: 8, solid: true },
  { key: 'decoration_tree_oak', gx: 10, gy: 1, solid: true },
  { key: 'decoration_tree_pine', gx: 15, gy: 1, solid: true },
  { key: 'decoration_tree_oak', gx: 1, gy: 4, solid: true },
  { key: 'decoration_tree_pine', gx: 24, gy: 4, solid: true },
  { key: 'decoration_tree_pine', gx: 9, gy: 5, solid: true },
  { key: 'decoration_tree_oak', gx: 16, gy: 5, solid: true },
  { key: 'decoration_tree_oak', gx: 2, gy: 11, solid: true },
  { key: 'decoration_tree_pine', gx: 23, gy: 11, solid: true },
  { key: 'decoration_tree_pine', gx: 0, gy: 13, solid: true },
  { key: 'decoration_tree_oak', gx: 25, gy: 13, solid: true },
  { key: 'decoration_tree_pine', gx: 9, gy: 11, solid: true },
  { key: 'decoration_tree_oak', gx: 16, gy: 11, solid: true },
  { key: 'decoration_tree_pine', gx: 2, gy: 17, solid: true },
  { key: 'decoration_tree_oak', gx: 23, gy: 17, solid: true },
  { key: 'decoration_tree_pine', gx: 0, gy: 19, solid: true },
  { key: 'decoration_tree_oak', gx: 25, gy: 19, solid: true },
  { key: 'decoration_tree_pine', gx: 3, gy: 21, solid: true },
  { key: 'decoration_tree_oak', gx: 22, gy: 21, solid: true },
  { key: 'decoration_lantern_post', gx: 11, gy: 1, solid: true },
  { key: 'decoration_lantern_post', gx: 14, gy: 1, solid: true },
  { key: 'decoration_lantern_post', gx: 14, gy: 5, solid: true },
  { key: 'decoration_lantern_post', gx: 11, gy: 5, solid: true },
  { key: 'decoration_lantern_post', gx: 11, gy: 11, solid: true },
  { key: 'decoration_lantern_post', gx: 14, gy: 11, solid: true },
  { key: 'decoration_lantern_post', gx: 11, gy: 17, solid: true },
  { key: 'decoration_lantern_post', gx: 14, gy: 17, solid: true },
  { key: 'decoration_lantern_post', gx: 11, gy: 19, solid: true },
  { key: 'decoration_lantern_post', gx: 14, gy: 19, solid: true },
  { key: 'decoration_bush', gx: 2, gy: 2, solid: false },
  { key: 'decoration_bush', gx: 5, gy: 1, solid: false },
  { key: 'decoration_bush', gx: 20, gy: 1, solid: false },
  { key: 'decoration_bush', gx: 23, gy: 2, solid: false },
  { key: 'decoration_bush', gx: 1, gy: 5, solid: false },
  { key: 'decoration_bush', gx: 5, gy: 5, solid: false },
  { key: 'decoration_bush', gx: 20, gy: 5, solid: false },
  { key: 'decoration_bush', gx: 24, gy: 5, solid: false },
  { key: 'decoration_bush', gx: 0, gy: 11, solid: false },
  { key: 'decoration_bush', gx: 1, gy: 12, solid: false },
  { key: 'decoration_bush', gx: 24, gy: 11, solid: false },
  { key: 'decoration_bush', gx: 23, gy: 12, solid: false },
  { key: 'decoration_bush', gx: 7, gy: 12, solid: false },
  { key: 'decoration_bush', gx: 10, gy: 12, solid: false },
  { key: 'decoration_bush', gx: 15, gy: 12, solid: false },
  { key: 'decoration_bush', gx: 18, gy: 12, solid: false },
  { key: 'decoration_bush', gx: 7, gy: 17, solid: false },
  { key: 'decoration_bush', gx: 18, gy: 17, solid: false },
  { key: 'decoration_bush', gx: 0, gy: 20, solid: false },
  { key: 'decoration_bush', gx: 25, gy: 20, solid: false },
  { key: 'decoration_rock', gx: 5, gy: 0, solid: true },
  { key: 'decoration_rock', gx: 20, gy: 0, solid: true },
  { key: 'decoration_rock', gx: 9, gy: 0, solid: true },
  { key: 'decoration_rock', gx: 16, gy: 0, solid: true },
  { key: 'decoration_rock', gx: 0, gy: 2, solid: true },
  { key: 'decoration_rock', gx: 25, gy: 3, solid: true },
  { key: 'decoration_rock', gx: 0, gy: 14, solid: true },
  { key: 'decoration_rock', gx: 25, gy: 14, solid: true },
  { key: 'decoration_rock', gx: 5, gy: 19, solid: true },
  { key: 'decoration_rock', gx: 20, gy: 19, solid: true },
  { key: 'decoration_rock', gx: 3, gy: 12, solid: true },
  { key: 'decoration_rock', gx: 22, gy: 12, solid: true },
  { key: 'decoration_flower_red', gx: 11, gy: 2, solid: false },
  { key: 'decoration_flower_yellow', gx: 14, gy: 2, solid: false },
  { key: 'decoration_flower_red', gx: 10, gy: 5, solid: false },
  { key: 'decoration_flower_yellow', gx: 15, gy: 5, solid: false },
  { key: 'decoration_flower_red', gx: 11, gy: 8, solid: false },
  { key: 'decoration_flower_yellow', gx: 14, gy: 8, solid: false },
  { key: 'decoration_flower_red', gx: 11, gy: 12, solid: false },
  { key: 'decoration_flower_yellow', gx: 14, gy: 12, solid: false },
  { key: 'decoration_flower_red', gx: 11, gy: 14, solid: false },
  { key: 'decoration_flower_yellow', gx: 14, gy: 14, solid: false },
  { key: 'decoration_flower_red', gx: 10, gy: 17, solid: false },
  { key: 'decoration_flower_yellow', gx: 15, gy: 17, solid: false },
  { key: 'decoration_flower_red', gx: 4, gy: 3, solid: false },
  { key: 'decoration_flower_yellow', gx: 21, gy: 3, solid: false },
  { key: 'decoration_flower_red', gx: 8, gy: 4, solid: false },
  { key: 'decoration_flower_yellow', gx: 17, gy: 4, solid: false },
  { key: 'decoration_flower_red', gx: 4, gy: 11, solid: false },
  { key: 'decoration_flower_yellow', gx: 21, gy: 11, solid: false },
  { key: 'decoration_flower_red', gx: 4, gy: 12, solid: false },
  { key: 'decoration_flower_yellow', gx: 21, gy: 12, solid: false },
  { key: 'decoration_fence', gx: 11, gy: 5, solid: true },
  { key: 'decoration_fence', gx: 14, gy: 5, solid: true },
  { key: 'decoration_fence', gx: 11, gy: 8, solid: true },
  { key: 'decoration_fence', gx: 14, gy: 8, solid: true },
  { key: 'decoration_well', gx: 7, gy: 11, solid: true },
  { key: 'decoration_signpost', gx: 11, gy: 19, solid: false },
];

export class HomelandScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private playerLabel!: Phaser.GameObjects.Text;
  private facingX: number = 0;
  private facingY: number = 1;
  private playerGx: number = 12;
  private playerGy: number = 19;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private actionBubbleGfx!: Phaser.GameObjects.Graphics;
  private actionBubbleText!: Phaser.GameObjects.Text;
  private restoreBuildingId: string = '';
  private currentBuilding: HubBuildingDef | null = null;
  private pendingBuilding: HubBuildingDef | null = null;
  private facingOutlineImages: Phaser.GameObjects.Image[] = [];
  private isMoving: boolean = false;
  private isConstructing: boolean = false;
  private actionBtnBg!: Phaser.GameObjects.Graphics;
  private actionBtnText!: Phaser.GameObjects.Text;
  private actionBtnHit!: Phaser.GameObjects.Rectangle;
  private _onViewportResize?: () => void;
  private buildingInfoPanel!: BuildingInfoPanel;
  private restorePanel!: RestorePanel;
  private gatePanel!: GatePanel;
  private developerPanel!: DeveloperPanel;
  private inventoryPanel!: InventoryPanel;
  private craftingPanel!: CraftingPanel;
  private tradePanel!: TradePanel;
  private researchPanel!: ResearchPanel;
  private farmPanel!: FarmPanel;
  private buildingImages: Map<string, Phaser.GameObjects.Image> = new Map();
  private buildingLabels: Phaser.GameObjects.Text[] = [];

  private movePath: { x: number; y: number }[] = [];
  private decorationImages: Phaser.GameObjects.Image[] = [];
  private analog!: AnalogStickInput;
  private hudCam!: Phaser.Cameras.Scene2D.Camera;
  private carrotCountText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private animFrame: number = 0;
  private animTimer: number = 0;
  private readonly ANIM_INTERVAL: number = 60;

  constructor() {
    super({ key: SCENES.HOMELAND });
  }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#334621');

    this.hudCam = this.cameras.add(0, 0, VW(), VH(), false, 'hud');
    this.hudCam.setZoom(1);

    this.currentBuilding = null;
    this.pendingBuilding = null;
    this.animFrame = 0;
    this.animTimer = 0;
    this.isMoving = false;
    this.isConstructing = false;

    this.decorationImages.forEach(img => img.destroy());
    this.decorationImages = [];
    this.drawHubTerrain();
    this.drawHubBuildings();
    this.drawHubGate();
    this.drawHubDecorations();
    this.drawPlayer();
    this.createInteractionUI();
    this.createActionButton();
    this.setupInput();
    this.setupPointerInput();

    const xMin = -(HUB_ROWS + 4) * HALF_W;
    const yMin = -HALF_H * 3;
    this.cameras.main.startFollow(this.player, true, 0.5, 0.5);
    this.cameras.main.setBounds(xMin, yMin, worldWidth(HUB_COLS, HUB_ROWS) + HALF_W * 4, worldHeight(HUB_COLS, HUB_ROWS) + HALF_H * 4);
    this.cameras.main.setZoom(1.3);

    this.buildingInfoPanel = new BuildingInfoPanel(this);
    this.restorePanel = new RestorePanel(this, () => { this.restoreBuildingId = ''; }, (id) => this.tryRestore(id));
    this.gatePanel = new GatePanel(this);
    this.gatePanel.onEmbark = (config) => this.startExpedition(config);
    this.gatePanel.onCloseCb = () => {};
    this.gatePanel.onDeveloperMenu = () => {
      this.developerPanel.show(this.gatePanel.debugMode, this.gatePanel.gateSeed);
    };
    this.developerPanel = new DeveloperPanel(this);
    this.developerPanel.onChange = (config) => {
      this.gatePanel.debugMode = config.debugMode;
      this.gatePanel.gateSeed = config.gateSeed;
      this.gatePanel.settingsDirty = true;
    };
    this.inventoryPanel = new InventoryPanel(this, gameState.inventory, null, (id) => this.trashItem(id), 'Storage');
    this.craftingPanel = new CraftingPanel(this);
    this.tradePanel = new TradePanel(this, () => this.updateCarrotCounter());
    this.researchPanel = new ResearchPanel(this);
    this.farmPanel = new FarmPanel(this, () => this.updateCarrotCounter());
    this.cameras.main.ignore(this.buildingInfoPanel.container);
    this.cameras.main.ignore(this.restorePanel.container);
    this.cameras.main.ignore(this.gatePanel.container);
    this.cameras.main.ignore(this.inventoryPanel.container);
    this.cameras.main.ignore(this.craftingPanel.container);
    this.cameras.main.ignore(this.tradePanel.container);
    this.cameras.main.ignore(this.researchPanel.container);
    this.cameras.main.ignore(this.farmPanel.container);
    this.cameras.main.ignore(this.developerPanel.container);

    this.carrotCountText = createText(this, VW() - 12, 12, '', {
      fontSize: fs(14), fontFamily: 'Inter', resolution: 4, color: '#ff8833', fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(55);
    this.cameras.main.ignore(this.carrotCountText);
    this.updateCarrotCounter();

    this.levelText = createText(this, 4, 4, `Lv.${gameState.playerLevel}`, {
      fontSize: fs(9), fontFamily: 'Inter', resolution: 4, color: '#88aacc', stroke: '#000000', strokeThickness: 2
    }).setScrollFactor(0).setDepth(55);
    this.cameras.main.ignore(this.levelText);

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
    this.carrotCountText.setPosition(VW() - 12, 12);

    const { x, y } = actionButtonCenter();
    this.actionBtnText.setPosition(x, y);
    this.actionBtnHit?.setPosition(x, y);
    this.updateActionButton();

    this.buildingInfoPanel?.onViewportResize();
    this.restorePanel?.onViewportResize();
    this.gatePanel?.onViewportResize();
    this.inventoryPanel?.onViewportResize();
    this.craftingPanel?.onViewportResize();
    this.tradePanel?.onViewportResize();
    this.researchPanel?.onViewportResize();
    this.farmPanel?.onViewportResize();
    this.developerPanel?.onViewportResize();
  }

  private updateCarrotCounter(): void {
    this.carrotCountText.setText(`🥕 ${gameState.inventory.count('carrot')}`);
  }

  private drawHubTerrain(): void {
    for (let y = 0; y < HUB_ROWS; y++) {
      for (let x = 0; x < HUB_COLS; x++) {
        const p = gridToIso(x, y);
        const coord = `${x},${y}`;
        let key: string;
        if (WATER_COORDS.has(coord)) {
          key = 'terrain_water';
        } else if (BRIDGE_COORDS.has(coord)) {
          key = 'terrain_bridge';
        } else if (PATH_COORDS.has(coord)) {
          key = 'terrain_path';
        } else {
          key = (x + y) % 2 === 0 ? 'terrain_grass_a' : 'terrain_grass_b';
        }
        const tile = this.add.image(p.x, p.y, key);
        tile.setDepth(4);
        this.hudCam.ignore(tile);
      }
    }
  }

  private drawHubBuildings(): void {
    this.facingOutlineImages.forEach(img => img.destroy());
    this.facingOutlineImages = [];
    this.buildingImages.forEach(img => img.destroy());
    this.buildingImages.clear();
    this.buildingLabels.forEach(l => l.destroy());
    this.buildingLabels = [];

    const unlocked = (b: HubBuildingDef) => !b.buildingId || isRestored(b.buildingId);

    for (const b of HUB_BUILDINGS) {
      if (b.id === 'gate') continue;
      const ul = unlocked(b);
      const texKey = BUILDING_TEXTURE_KEYS[b.id] ?? 'building_trading_post';
      const alpha = ul ? 1 : 0.5;

      const c = gridToIso(b.gx + b.gw / 2, b.gy + b.gh / 2);
      const cfg = getSpriteConfig(texKey);
      const img = this.add.image(
        c.x + (cfg.offsetX ?? 0),
        c.y + (cfg.offsetY ?? 0),
        texKey,
      ).setAlpha(alpha);
      img.setData('bid', b.buildingId || b.id);
      img.setDepth(interactiveDepth(b.gx + b.gw - 1, b.gy));
      this.hudCam.ignore(img);
      this.buildingImages.set(b.buildingId || b.id, img);

      const label = createText(this, c.x, b.id === 'storage' ? c.y - 100 : c.y - 200, b.label, {
        fontSize: fs(16), fontFamily: 'Inter', resolution: 4, color: ul ? '#e8d5b7' : '#6a5a4a',
      }).setOrigin(0.5).setAlpha(alpha).setDepth(7);
      this.hudCam.ignore(label);
      this.buildingLabels.push(label);

      img.setInteractive({ useHandCursor: true }).setData('isUI', true);
      img.on('pointerdown', () => this.handleBuildingClick(b));
      if (ul) {
        img.on('pointerover', () => img.setScale(1.05));
        img.on('pointerout', () => img.setScale(1));
      }
    }


  }

  private drawHubGate(): void {
    const c = gridToIso(13, 20.5);
    const cfg = getSpriteConfig('building_gate');
    const gateImg = this.add.image(
      c.x + (cfg.offsetX ?? 0),
      c.y + (cfg.offsetY ?? 0),
      'building_gate',
    ).setDepth(interactiveDepth(13, 20));
    this.hudCam.ignore(gateImg);

    const glow = this.add.image(c.x, c.y - 36, 'gate_glow').setDepth(interactiveDepth(13, 20, 0.001));
    this.hudCam.ignore(glow);

    this.tweens.add({
      targets: glow,
      alpha: 0.4,
      yoyo: true,
      repeat: -1,
      duration: 1200,
      ease: 'Sine.easeInOut',
    });

    const gateLabel = createText(this, c.x, c.y - 70, 'Forgotten Depths', {
      fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#7a6a9a', stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(7);
    this.hudCam.ignore(gateLabel);

    const gateDef = HUB_BUILDINGS.find(b => b.id === 'gate')!;

    gateImg.setInteractive({ useHandCursor: true }).setData('isUI', true);
    gateImg.on('pointerdown', () => this.handleBuildingClick(gateDef));
    gateImg.on('pointerover', () => gateImg.setScale(1.05));
    gateImg.on('pointerout', () => gateImg.setScale(1));
  }

  private drawHubDecorations(): void {
    for (const d of HUB_DECORATIONS) {
      const p = gridToIso(d.gx, d.gy);
      const cfg = getSpriteConfig(d.key);
      const img = this.add.image(
        p.x + (cfg.offsetX ?? 0),
        p.y + (cfg.offsetY ?? 0),
        d.key,
      );
      if (cfg.originX !== undefined || cfg.originY !== undefined) {
        img.setOrigin(cfg.originX ?? 0.5, cfg.originY ?? 0.5);
      }
      if (cfg.scale !== undefined) img.setScale(cfg.scale);
      img.setDepth(interactiveDepth(d.gx, d.gy));
      this.hudCam.ignore(img);
      this.decorationImages.push(img);
    }

  }

  private drawPlayer(): void {
    const p = gridToIso(this.playerGx, this.playerGy);
    const cfg = getSpriteConfig('player_bottom_left');
    this.player = this.add.image(
      p.x + (cfg.offsetX ?? 0),
      p.y + (cfg.offsetY ?? 0),
      'player_bottom_left',
    ).setDepth(interactiveDepth(this.playerGx, this.playerGy, 0.0005));
    this.hudCam.ignore(this.player);
    if (cfg.originX !== undefined || cfg.originY !== undefined) {
      this.player.setOrigin(cfg.originX ?? 0.5, cfg.originY ?? 0.5);
    }
    if (cfg.scale !== undefined) this.player.setScale(cfg.scale);
    this.playerLabel = createText(this, p.x, p.y - 30, 'You', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#aaddff',
    }).setOrigin(0.5);
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
    const p = gridToIso(this.playerGx, this.playerGy);
    const cfg = getSpriteConfig('player_bottom_left');
    this.player.setPosition(p.x + (cfg.offsetX ?? 0), p.y + (cfg.offsetY ?? 0));
    this.player.setDepth(interactiveDepth(this.playerGx, this.playerGy, 0.0005));
    this.playerLabel.setPosition(p.x, p.y - 30);
  }

  private createInteractionUI(): void {
    this.actionBubbleGfx = this.add.graphics().setDepth(54).setAlpha(0);
    this.hudCam.ignore(this.actionBubbleGfx);
    this.actionBubbleText = createText(this, 0, 0, '', {
      fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#ffdd88',
    }).setOrigin(0.5).setAlpha(0).setDepth(55);
    this.hudCam.ignore(this.actionBubbleText);
  }

  private createActionButton(): void {
    const { x, y } = actionButtonCenter(), size = ACTION_BTN_SIZE;
    this.actionBtnBg = this.add.graphics().setScrollFactor(0).setDepth(50);
    this.cameras.main.ignore(this.actionBtnBg);
    this.actionBtnText = createText(this, x, y, '', {
      fontSize: fs(24), fontFamily: 'Inter', resolution: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.cameras.main.ignore(this.actionBtnText);

    const hit = this.add.rectangle(x, y, size, size, 0x000000, 0)
      .setScrollFactor(0).setDepth(52).setData('isUI', true);
    this.cameras.main.ignore(hit);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.handleActionButton());
    this.actionBtnHit = hit;
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
      F2: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F2),
      Z: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
    };
  }

  private get isModalActive(): boolean {
    return this.isConstructing
      || this.buildingInfoPanel.isVisible() || this.restorePanel.isVisible() || this.gatePanel.isVisible()
      || this.craftingPanel.isVisible() || this.inventoryPanel.isVisible()
      || this.tradePanel.isVisible() || this.researchPanel.isVisible()
      || this.farmPanel.isVisible() || this.developerPanel.isVisible();
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
    if (this.isConstructing) return;
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

    if (Phaser.Input.Keyboard.JustDown(this.keys.F2)) {
      if (this.developerPanel.isVisible()) {
        this.developerPanel.hide();
      } else {
        this.developerPanel.show(this.gatePanel.debugMode, this.gatePanel.gateSeed);
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
      if (this.researchPanel.isPromptActive()) return;
      if (Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.keys.UP)) {
        this.researchPanel.navigateUp();
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.S) || Phaser.Input.Keyboard.JustDown(this.keys.DOWN)) {
        this.researchPanel.navigateDown();
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.A) || Phaser.Input.Keyboard.JustDown(this.keys.LEFT)) {
        this.researchPanel.navigateLeft();
      } else if (Phaser.Input.Keyboard.JustDown(this.keys.D) || Phaser.Input.Keyboard.JustDown(this.keys.RIGHT)) {
        this.researchPanel.navigateRight();
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
      if (this.gatePanel.isPickerOpen()) return;
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        if (!this.gatePanel.handleESC()) this.gatePanel.hide();
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
      return;
    }

    if (this.developerPanel.isVisible()) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        this.developerPanel.hide();
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
    this.checkProximity();
    this.handleInteraction();
    this.updateActionButton();
  }

  private isSolid(gx: number, gy: number): boolean {
    for (const b of HUB_BUILDINGS) {
      if (!b.solid) continue;
      if (gx >= b.gx && gx < b.gx + b.gw && gy >= b.gy && gy < b.gy + b.gh) {
        return true;
      }
    }
    for (const d of HUB_DECORATIONS) {
      if (!d.solid) continue;
      if (d.gx === gx && d.gy === gy) return true;
    }
    if (WATER_COORDS.has(`${gx},${gy}`)) return true;
    return false;
  }

  private findAdjacentTile(b: HubBuildingDef): { x: number; y: number } | null {
    const left = b.gx - 1;
    const right = b.gx + b.gw;
    const top = b.gy - 1;
    const bottom = b.gy + b.gh;
    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        if (x >= b.gx && x < b.gx + b.gw && y >= b.gy && y < b.gy + b.gh) continue;
        if (x < 0 || x >= HUB_COLS || y < 0 || y >= HUB_ROWS) continue;
        if (this.isSolid(x, y)) continue;
        const dist = Math.abs(x - this.playerGx) + Math.abs(y - this.playerGy);
        if (dist < bestDist) {
          bestDist = dist;
          best = { x, y };
        }
      }
    }
    return best;
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
      depth: interactiveDepth(nx, ny, 0.0005),
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
    if (this.isConstructing) return;
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

      let action = 'Interact';
      const restored = !closest.buildingId || isRestored(closest.buildingId);
      if (closest.id === 'gate') action = 'Begin expedition';
      else if (!restored) action = `Restore ${closest.label}`;
      else if (closest.id === 'tavern') action = `Enter Tavern (${gameState.rescuedVillagers.length}/20 inside)`;
      else action = `Visit ${closest.label.split(' ')[0].toLowerCase()}`;

      this.showActionBubble(`[SPACE] ${action}`, pp.x, pp.y - 55);

      if (this.pendingBuilding === closest) {
        this.pendingBuilding = null;
        this.activateBuilding(closest);
      }
    } else {
      this.currentBuilding = null;
      this.hideActionBubble();
    }
    this.updateFacingHighlight();
  }

  private showActionBubble(msg: string, cx: number, topY: number): void {
    const displayMsg = getInputMode() !== 'keyboard' ? msg.replace(/^\[SPACE\] /, '') : msg;
    this.drawChatBubble(this.actionBubbleGfx, this.actionBubbleText, displayMsg, cx, topY);
    this.actionBubbleGfx.setAlpha(1);
    this.actionBubbleText.setAlpha(1);
  }

  private hideActionBubble(): void {
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

  private updateFacingHighlight(): void {
    this.facingOutlineImages.forEach(img => img.destroy());
    this.facingOutlineImages = [];
    const b = this.currentBuilding;
    if (!b) return;
    const texKey = BUILDING_TEXTURE_KEYS[b.id];
    if (!texKey || !this.textures.exists(texKey)) return;
    const c = gridToIso(b.gx + b.gw / 2, b.gy + b.gh / 2);
    const cfg = getSpriteConfig(texKey);
    const px = c.x + (cfg.offsetX ?? 0);
    const py = c.y + (cfg.offsetY ?? 0);
    const depth = interactiveDepth(b.gx + b.gw - 1, b.gy, -0.005);
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
  }

  private handleBuildingClick(b: HubBuildingDef): void {
    if (this.analog.active) return;
    if (this.isModalActive) return;
    const bLeft = b.gx - 1, bRight = b.gx + b.gw;
    const bTop = b.gy - 1, bBottom = b.gy + b.gh;
    if (this.playerGx >= bLeft && this.playerGx <= bRight &&
        this.playerGy >= bTop && this.playerGy <= bBottom) {
      this.activateBuilding(b);
    } else {
      this.movePath = [];
      this.analog.reset();
      const dst = this.findAdjacentTile(b);
      if (dst) {
        const path = findPath(
          this.playerGx, this.playerGy,
          dst.x, dst.y,
          HUB_COLS, HUB_ROWS,
          (x, y) => {
            if (x === this.playerGx && y === this.playerGy) return true;
            return !this.isSolid(x, y);
          },
        );
        if (path && path.length > 0) {
          this.movePath = path;
          this.pendingBuilding = b;
        }
      }
    }
  }

  private activateBuilding(b: HubBuildingDef): void {
    if (this.analog.active) return;
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
      tavern: { restoreId: 'housing', show: () => { this.scene.start(SCENES.TAVERN); } },
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

  private updateActionButton(): void {
    const { x: bx, y: by } = actionButtonGlowBoxTopLeft();
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

    if (this.isModalActive) { hide(); return; }

    const b = this.currentBuilding;
    if (!b) { hide(); return; }

    const restored = !b.buildingId || isRestored(b.buildingId);
    if (b.id === 'gate') { show('🚪', '#8866cc'); return; }
    if (!restored) { show('🔨', '#ffcc44'); return; }
    if (b.id === 'tavern') { show('🍺', '#88ccff'); return; }
    show('🏛', '#44cc66');
  }

  private handleActionButton(): void {
    if (this.isModalActive) return;
    if (!this.currentBuilding) return;
    this.activateBuilding(this.currentBuilding);
  }

  private showRestorePanel(buildingId: string): void {
    this.restorePanel.show(buildingId);
  }

  private tryRestore(buildingId: string): void {
    if (!canRestore(buildingId)) return;
    const building = getBuilding(buildingId);
    this.closePanel();

    const container = this.add.container(CX(), CY()).setScrollFactor(0).setDepth(250);
    this.cameras.main.ignore(container);

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1a, 0.85);
    bg.fillRoundedRect(-160, -60, 320, 120, 10);
    bg.lineStyle(2, 0x6a5a8a, 1);
    bg.strokeRoundedRect(-160, -60, 320, 120, 10);
    container.add(bg);

    const title = createText(this, 0, -40, `Constructing ${building?.name ?? ''}...`, {
      fontSize: fs(16), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7',
    }).setOrigin(0.5);
    container.add(title);

    const barW = 240, barH = 16, barX = -barW / 2, barY = -8;

    const barBg = this.add.graphics();
    barBg.fillStyle(0x1a1a2a, 1);
    barBg.fillRoundedRect(barX, barY, barW, barH, 4);
    container.add(barBg);

    const barFill = this.add.graphics();
    container.add(barFill);

    const statusText = createText(this, 0, 20, 'Building... 0%', {
      fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: '#8a9aaa',
    }).setOrigin(0.5);
    container.add(statusText);

    const buildingImg = this.buildingImages.get(buildingId);

    if (buildingImg) {
      this.tweens.add({
        targets: buildingImg,
        x: buildingImg.x + 3,
        duration: 60,
        yoyo: true,
        repeat: Math.floor(5000 / 120),
        ease: 'Sine.easeInOut',
      });
    }

    audio.playConstruction();
    this.isConstructing = true;

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
        this.isConstructing = false;

        const success = restoreBuilding(buildingId);
        if (success) {
          this.drawHubBuildings();
          audio.playBuildComplete();
          this.updateCarrotCounter();

          const name = building?.name ?? buildingId.replace(/_/g, ' ');
          const popup = createText(this, CX(), CY(), `${name} Restored!`, {
            fontSize: fs(18), fontFamily: 'Inter', resolution: 4, color: '#44cc66', fontStyle: 'bold', align: 'center',
          }).setOrigin(0.5).setScrollFactor(0).setDepth(250);
          this.cameras.main.ignore(popup);

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
    this.time.delayedCall(0, () => {
      this.gatePanel.show();
    });
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
      this.scene.start(SCENES.EXPEDITION, {
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
    if (itemId === 'carrot' || gameState.inventory.count(itemId) <= 0) return;
    gameState.inventory.removeItem(itemId, 1);
    audio.playError();
    this.inventoryPanel.refresh();
  }
}
