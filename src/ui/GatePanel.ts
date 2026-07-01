import Phaser from 'phaser';
import { BasePanel } from './BasePanel';
import { gameState } from '../systems/GameState';
import { EquipmentPicker, PickerOption } from './EquipmentPicker';
import { ConsumablePicker } from './ConsumablePicker';
import { FloorPicker } from './FloorPicker';
import { SeedEntryPopup } from './SeedEntryPopup';
import { ConfirmPopup } from './ConfirmPopup';
import { VW, VH, CX } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';

const NAMES: Record<number, string> = {
  1: 'Common Pickaxe', 2: 'Bronze Pickaxe', 3: 'Silver Pickaxe', 4: 'Gold Pickaxe',
};

const CONSUMABLE_TYPES = [
  { id: 'stamina_potion', name: 'Stamina Potion' },
  { id: 'teleport_scroll', name: 'Teleport Scroll' },
  { id: 'mining_bomb', name: 'Mining Bomb' },
];

const CONSUMABLE_DESC: Record<string, string> = {
  stamina_potion: 'Restores +30 stamina during expedition.',
  teleport_scroll: 'Teleports home safely — keeps all items.',
  mining_bomb: 'Breaks all minable tiles in an 8-tile area.',
};

export class GatePanel extends BasePanel {
  onEmbark!: (config: {
    pickaxeTier: number; ring1: string | null; ring2: string | null;
    boots: string | null; lantern: string | null;
    consumables: Record<string, number>; seed: string; debug: boolean; startFloor: number;
  }) => void;
  onCloseCb!: () => void;

  gateTab = 0;
  maxTab = 12;

  private pickaxeOptions: { id: string; tier: number }[] = [];
  private selectedPickaxeIdx = -1;
  private ringOptions: { id: string; name: string }[] = [];
  private selectedRing1Idx = -1;
  private selectedRing2Idx = -1;
  private bootOptions: { id: string; name: string; runs: number }[] = [];
  private selectedBootsIdx = -1;
  private lanternOptions: { id: string; name: string; runs: number }[] = [];
  private selectedLanternIdx = -1;
  private consumableLoadout: Record<string, number> = {};
  private debugMode = false;
  private selectedElevatorFloor = 0;
  private elevatorFloorOptions: number[] = [];
  private gateSeed = '';
  private resetConfirm = false;

  private bg!: Phaser.GameObjects.Graphics;
  private panelBlocker!: Phaser.GameObjects.Rectangle;
  private title!: Phaser.GameObjects.Text;
  private portraitSprite!: Phaser.GameObjects.Image;
  private statTexts: Phaser.GameObjects.Text[] = [];

  private equipSlots: {
    bg: Phaser.GameObjects.Graphics;
    icon: Phaser.GameObjects.Image;
    badge: Phaser.GameObjects.Text;
    zone: Phaser.GameObjects.Rectangle;
  }[] = [];

  private consSlots: {
    bg: Phaser.GameObjects.Graphics;
    icon: Phaser.GameObjects.Image;
    badge: Phaser.GameObjects.Text;
    zone: Phaser.GameObjects.Rectangle;
  }[] = [];

  private settingsTexts: Phaser.GameObjects.Text[] = [];
  private settingsZones: Phaser.GameObjects.Rectangle[] = [];
  private descBg!: Phaser.GameObjects.Graphics;
  private descLines: Phaser.GameObjects.Text[] = [];
  private footerText!: Phaser.GameObjects.Text;
  private embarkBtn!: Phaser.GameObjects.Text;
  private embarkBtnZone!: Phaser.GameObjects.Rectangle;

  private equipPicker: EquipmentPicker;
  private consumablePicker: ConsumablePicker;
  private floorPicker: FloorPicker;
  private seedPopup: SeedEntryPopup;
  private confirmPopup: ConfirmPopup;
  private clickHandler: ((p: Phaser.Input.Pointer) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.equipPicker = new EquipmentPicker(scene);
    this.consumablePicker = new ConsumablePicker(scene);
    this.floorPicker = new FloorPicker(scene);
    this.seedPopup = new SeedEntryPopup(scene);
    this.confirmPopup = new ConfirmPopup(scene);
    this.buildUI();
  }

  private buildUI(): void {
    this.bg = this.scene.add.graphics();
    this.container.add(this.bg);

    this.panelBlocker = this.scene.add.rectangle(CX, VH / 2, VW, VH, 0x000000, 0)
      .setScrollFactor(0).setData('isUI', true).setInteractive();
    this.panelBlocker.on('pointerdown', () => {});
    this.container.add(this.panelBlocker);

    this.title = createText(this.scene, CX, 20, 'Expedition Loadout', {
      fontSize: fs(16), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.title);

    this.portraitSprite = this.scene.add.image(100, 150, 'portrait')
      .setDisplaySize(256, 256).setFlipX(false);
    this.container.add(this.portraitSprite);

    for (let i = 0; i < 5; i++) {
      const t = createText(this.scene, 200, 48 + i * 14, '', {
        fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#b8a898',
      });
      this.container.add(t);
      this.statTexts.push(t);
    }

    const equipYX: { x: number; y: number }[] = [
      { x: 190, y: 205 },
      { x: 285, y: 179 },
      { x: 352, y: 179 },
      { x: 285, y: 231 },
      { x: 352, y: 231 },
    ];
    for (let i = 0; i < 5; i++) {
      const bg = this.scene.add.graphics();
      this.container.add(bg);
      const iconScale = i === 0 ? 1.6 : 0.8;
      const icon = this.scene.add.image(equipYX[i].x, equipYX[i].y, 'item_pickaxe_1').setScale(iconScale);
      icon.setVisible(false);
      this.container.add(icon);
      const badge = createText(this.scene, equipYX[i].x, equipYX[i].y + 26, '', {
        fontSize: fs(9), fontFamily: 'Inter', resolution: 4, color: '#999999',
      }).setOrigin(0.5);
      badge.setVisible(false);
      this.container.add(badge);
      const zoneSize = i === 0 ? 104 : 52;
      const zone = this.scene.add.rectangle(equipYX[i].x, equipYX[i].y, zoneSize, zoneSize, 0xffffff, 0)
        .setScrollFactor(0);
      zone.setVisible(false);
      this.container.add(zone);
      this.equipSlots.push({ bg, icon, badge, zone });
    }

    this.container.add(createText(this.scene, CX, 138, 'EQUIPMENT', {
      fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#6a5a8a',
    }).setOrigin(0.5));

    const consYX = [
      { x: CX - 76, y: 302 },
      { x: CX, y: 302 },
      { x: CX + 76, y: 302 },
    ];
    for (let i = 0; i < 3; i++) {
      const bg = this.scene.add.graphics();
      this.container.add(bg);
      const icon = this.scene.add.image(consYX[i].x, consYX[i].y, 'item_stamina_potion').setScale(0.8);
      icon.setVisible(false);
      this.container.add(icon);
      const badge = createText(this.scene, consYX[i].x, consYX[i].y + 16, '', {
        fontSize: fs(9), fontFamily: 'Inter', resolution: 4, color: '#88cc88',
      }).setOrigin(0.5);
      badge.setVisible(false);
      this.container.add(badge);
      const zone = this.scene.add.rectangle(consYX[i].x, consYX[i].y, 64, 44, 0xffffff, 0)
        .setScrollFactor(0);
      zone.setVisible(false);
      this.container.add(zone);
      this.consSlots.push({ bg, icon, badge, zone });
    }

    this.container.add(createText(this.scene, CX, 270, 'CONSUMABLES', {
      fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#6a5a8a',
    }).setOrigin(0.5));

    for (let i = 0; i < 4; i++) {
      const t = createText(this.scene, CX, 362 + i * 22, '', {
        fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#b8a898',
      }).setOrigin(0.5);
      this.container.add(t);
      this.settingsTexts.push(t);
      const zone = this.scene.add.rectangle(CX, 350 + i * 22, 260, 44, 0xffffff, 0)
        .setScrollFactor(0);
      zone.setVisible(false);
      this.container.add(zone);
      this.settingsZones.push(zone);
    }

    this.container.add(createText(this.scene, CX, 344, 'SETTINGS', {
      fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#6a5a8a',
    }).setOrigin(0.5));

    this.embarkBtn = createText(this.scene, CX, 462, '[  EMBARK  ]', {
      fontSize: fs(14), fontFamily: 'Inter', resolution: 4, color: '#ffcc44',
      backgroundColor: '#442a1acc', padding: { x: 16, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0);
    this.embarkBtn.setVisible(false);
    this.container.add(this.embarkBtn);
    this.embarkBtnZone = this.scene.add.rectangle(CX, 442, 140, 44, 0xffffff, 0)
      .setScrollFactor(0).setInteractive({ useHandCursor: true });
    this.embarkBtnZone.on('pointerdown', () => this.embark());
    this.embarkBtnZone.setVisible(false);
    this.container.add(this.embarkBtnZone);

    this.descBg = this.scene.add.graphics();
    this.container.add(this.descBg);

    for (let i = 0; i < 2; i++) {
      const t = createText(this.scene, CX, 472 + i * 16, '', {
        fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#c8b898',
      }).setOrigin(0.5);
      this.container.add(t);
      this.descLines.push(t);
    }

    this.footerText = createText(this.scene, CX, VH - 30, '', {
      fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#8a7a9a', align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.footerText);

    this.addCloseButton();
  }

  show(): void {
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
    for (const ct of CONSUMABLE_TYPES) {
      this.consumableLoadout[ct.id] = 0;
    }

    this.elevatorFloorOptions = gameState.getAvailableElevatorFloors();
    this.selectedElevatorFloor = this.elevatorFloorOptions[this.elevatorFloorOptions.length - 1] ?? 0;
    this.gateSeed = gameState.currentRunSeed || Math.random().toString(36).substring(2, 10);
    this.debugMode = false;
    this.resetConfirm = false;
    this.gateTab = 0;

    this.render();
    this.embarkBtn.setVisible(true);
    this.embarkBtnZone.setVisible(true);
    this.equipSlots.forEach(s => s.zone.setVisible(true));
    this.consSlots.forEach(s => s.zone.setVisible(true));
    this.settingsZones.forEach(z => z.setVisible(true));

    this.clickHandler = (p: Phaser.Input.Pointer) => {
      if (this.equipPicker.isVisible() || this.consumablePicker.isVisible() ||
          this.floorPicker.isVisible() || this.seedPopup.isVisible() ||
          this.confirmPopup.isVisible()) {
        return;
      }
      const eb = this.embarkBtn.getBounds();
      if (eb.contains(p.x, p.y)) {
        if (this.isVisible()) this.embark();
        return;
      }
      for (let i = 0; i < 5; i++) {
        const z = this.equipSlots[i].zone;
        if (z.visible) {
          const b = z.getBounds();
          if (b.contains(p.x, p.y)) {
            this.onEquipClick(i);
            return;
          }
        }
      }
      for (let i = 0; i < 3; i++) {
        const z = this.consSlots[i].zone;
        if (z.visible) {
          const b = z.getBounds();
          if (b.contains(p.x, p.y)) {
            this.onConsumableClick(i);
            return;
          }
        }
      }
      for (let i = 0; i < 4; i++) {
        const z = this.settingsZones[i];
        if (z.visible) {
          const b = z.getBounds();
          if (b.contains(p.x, p.y)) {
            this.onSettingsClick(i);
            return;
          }
        }
      }
    };
    this.scene.input.on('pointerdown', this.clickHandler);

    this.fadeIn();
  }

  hide(): void {
    this.resetConfirm = false;
    this.embarkBtn.setVisible(false);
    this.embarkBtnZone.setVisible(false);
    this.equipSlots.forEach(s => s.zone.setVisible(false));
    this.consSlots.forEach(s => s.zone.setVisible(false));
    this.settingsZones.forEach(z => z.setVisible(false));
    if (this.clickHandler) {
      this.scene.input.off('pointerdown', this.clickHandler);
      this.clickHandler = null;
    }
    this.onCloseCb();
    super.hide();
  }

  render(): void {
    this.renderBackground();
    this.renderStats();
    this.renderEquipmentSlots();
    this.renderConsumableSlots();
    this.renderSettings();
    this.renderDescription();
    this.renderFooter();
  }

  private renderBackground(): void {
    this.bg.clear();
    this.bg.fillStyle(0x0a0a1a, 0.88);
    this.bg.fillRect(0, 0, VW, VH);
    this.bg.lineStyle(1, 0x3a3a4a, 0.4);
    this.bg.strokeRect(4, 4, VW - 8, VH - 8);
  }

  private renderStats(): void {
    const bootEffects = this.selectedBootsIdx >= 0
      ? gameState.getBootEffectsById(this.bootOptions[this.selectedBootsIdx]?.id ?? null)
      : { maxStaminaBonus: 0, luckBonus: 0, stairMultiplier: 1 };
    const lanternId = this.selectedLanternIdx >= 0
      ? (this.lanternOptions[this.selectedLanternIdx]?.id ?? null)
      : null;
    const maxStamina = this.debugMode ? 10000 : (100 + gameState.maxStaminaBonus + bootEffects.maxStaminaBonus);
    const invSlots = 16 + gameState.inventorySlotBonus;
    const luck = bootEffects.luckBonus;
    const light = gameState.getLanternRangeForPreview(lanternId) || 0;
    const relicCount = gameState.getFoundRelics().length;

    this.statTexts[0].setText(`\u2665 Stamina: ${maxStamina}`);
    this.statTexts[1].setText(`\u25a0 Slots: ${invSlots}`);
    this.statTexts[2].setText(`\u2726 Luck: ${Math.round(luck * 100)}%`);
    this.statTexts[3].setText(`\u2600 Light: ${light > 0 ? light + 'px' : 'none'}`);
    this.statTexts[4].setText(`\u26b6 Relics: ${relicCount}`);
  }

  private renderEquipmentSlots(): void {
    const equipYX: { x: number; y: number }[] = [
      { x: 190, y: 205 },
      { x: 285, y: 179 },
      { x: 352, y: 179 },
      { x: 285, y: 231 },
      { x: 352, y: 231 },
    ];
    for (let i = 0; i < 5; i++) {
      const slot = this.equipSlots[i];
      const isSelected = this.gateTab === i;
      const baseX = equipYX[i].x;
      const baseY = equipYX[i].y;
      const half = i === 0 ? 52 : 26;

      slot.bg.clear();

      let opt: any = null;
      let iconKey = '';
      let badgeText = '';

      switch (i) {
        case 0: {
          opt = this.pickaxeOptions[this.selectedPickaxeIdx] ?? null;
          if (opt) {
            iconKey = `item_pickaxe_${opt.tier}`;
            const runs = gameState.remainingPickaxeRuns(opt.tier);
            badgeText = opt.tier === 1 ? '\u221e' : `${runs}/5`;
          }
          break;
        }
        case 1: {
          opt = this.selectedRing1Idx >= 0 ? this.ringOptions[this.selectedRing1Idx] : null;
          if (opt) iconKey = `item_${opt.id}`;
          break;
        }
        case 2: {
          opt = this.selectedRing2Idx >= 0 ? this.ringOptions[this.selectedRing2Idx] : null;
          if (opt) iconKey = `item_${opt.id}`;
          break;
        }
        case 3: {
          opt = this.selectedBootsIdx >= 0 ? this.bootOptions[this.selectedBootsIdx] : null;
          if (opt) {
            iconKey = `item_${opt.id}`;
            badgeText = opt.runs === Infinity ? '\u221e' : `${opt.runs}/5`;
          }
          break;
        }
        case 4: {
          opt = this.selectedLanternIdx >= 0 ? this.lanternOptions[this.selectedLanternIdx] : null;
          if (opt) {
            iconKey = `item_${opt.id}`;
            badgeText = opt.runs === Infinity ? '\u221e' : `${opt.runs}/5`;
          }
          break;
        }
      }

      if (opt) {
        slot.icon.setTexture(iconKey).setAlpha(1);
        slot.icon.setVisible(true);
        slot.badge.setText(badgeText);
        slot.badge.setVisible(!!badgeText);
        slot.badge.setColor(isSelected ? '#ffddaa' : '#999999');

        if (isSelected) {
          slot.bg.fillStyle(0x3a3a5a, 0.6);
          slot.bg.fillRoundedRect(baseX - half, baseY - half, half * 2, half * 2, 5);
          slot.bg.lineStyle(1, 0x8a7aaa);
          slot.bg.strokeRoundedRect(baseX - half, baseY - half, half * 2, half * 2, 5);
        } else {
          slot.bg.fillStyle(0x1a1a2a, 0.3);
          slot.bg.lineStyle(1, 0x3a3a4a);
          slot.bg.fillRoundedRect(baseX - half, baseY - half, half * 2, half * 2, 5);
          slot.bg.strokeRoundedRect(baseX - half, baseY - half, half * 2, half * 2, 5);
        }
      } else {
        const placeholderKey = ['item_pickaxe_1', 'item_ring_critical', 'item_ring_critical', 'item_boots_stamina_bronze', 'item_lantern_bronze'][i];
        slot.icon.setTexture(placeholderKey).setAlpha(0.15);
        slot.icon.setVisible(true);
        slot.badge.setVisible(false);
        slot.bg.fillStyle(0x1a1a2a, 0.3);
        slot.bg.lineStyle(1, 0x3a3a4a);
        slot.bg.fillRoundedRect(baseX - half, baseY - half, half * 2, half * 2, 5);
        slot.bg.strokeRoundedRect(baseX - half, baseY - half, half * 2, half * 2, 5);
      }
    }
  }

  private renderConsumableSlots(): void {
    const consYX = [
      { x: CX - 76, y: 302 },
      { x: CX, y: 302 },
      { x: CX + 76, y: 302 },
    ];
    for (let i = 0; i < 3; i++) {
      const slot = this.consSlots[i];
      const ct = CONSUMABLE_TYPES[i];
      const qty = this.consumableLoadout[ct.id] ?? 0;
      const isSelected = this.gateTab === 5 + i;
      const baseX = consYX[i].x;
      const baseY = consYX[i].y;

      const iconKey = `item_${ct.id}`;
      if (this.scene.textures.exists(iconKey)) {
        slot.icon.setTexture(iconKey);
      }
      slot.icon.setVisible(true);

      slot.badge.setText(`\u00d7${qty}`);
      slot.badge.setVisible(true);
      slot.badge.setColor(isSelected ? '#ffddaa' : (qty > 0 ? '#88cc88' : '#666666'));

      slot.bg.clear();
      if (isSelected) {
        slot.bg.fillStyle(0x3a3a5a, 0.6);
        slot.bg.fillRoundedRect(baseX - 32, baseY - 21, 64, 42, 5);
        slot.bg.lineStyle(1, 0x8a7aaa);
        slot.bg.strokeRoundedRect(baseX - 32, baseY - 21, 64, 42, 5);
      } else {
        slot.bg.fillStyle(0x1a1a2a, 0.3);
        slot.bg.lineStyle(1, 0x3a3a4a);
        slot.bg.fillRoundedRect(baseX - 32, baseY - 21, 64, 42, 5);
        slot.bg.strokeRoundedRect(baseX - 32, baseY - 21, 64, 42, 5);
      }
    }
  }

  private renderSettings(): void {
    const elevStr = this.selectedElevatorFloor === 0
      ? '0'
      : `Depth ${this.selectedElevatorFloor}`;
    const seedDisplay = this.gateSeed || '(none)';
    const debugStr = this.debugMode ? 'ON' : 'OFF';
    const resetStr = this.resetConfirm ? 'Reset? [SPACE]' : 'Reset Game';

    const lines = [
      `Start Floor: ${elevStr}`,
      `Seed: ${seedDisplay}`,
      `Debug: ${debugStr}`,
      resetStr,
    ];

    for (let i = 0; i < 4; i++) {
      const isSelected = this.gateTab === 8 + i;
      this.settingsTexts[i].setText(lines[i]);
      this.settingsTexts[i].setColor(isSelected ? '#ffddaa' : '#b8a898');
    }
  }

  private renderDescription(): void {
    this.descBg.clear();
    this.descBg.fillStyle(0x1a1a2a, 0.7);
    this.descBg.fillRoundedRect(CX - 170, 494, 340, 34, 5);
    this.descBg.lineStyle(1, 0x3a3a5a);
    this.descBg.strokeRoundedRect(CX - 170, 494, 340, 34, 5);

    const lines = this.getDescriptionLines();
    for (let i = 0; i < 2; i++) {
      this.descLines[i].setText(lines[i] ?? '');
      this.descLines[i].setColor(i === 0 ? '#e8d5b7' : '#999999');
      this.descLines[i].setPosition(CX, 502 + i * 16);
    }
  }

  private getDescriptionLines(): [string, string] {
    switch (this.gateTab) {
      case 0: return this.descPickaxe();
      case 1: return this.descRing(this.selectedRing1Idx, 'Ring 1');
      case 2: return this.descRing(this.selectedRing2Idx, 'Ring 2');
      case 3: return this.descBoots();
      case 4: return this.descLantern();
      case 5: return this.descConsumable(0);
      case 6: return this.descConsumable(1);
      case 7: return this.descConsumable(2);
      case 8: return ['Start Floor', this.selectedElevatorFloor === 0 ? 'Homeland' : `Floor ${this.selectedElevatorFloor}`];
      case 9: return ['Run Seed', this.gateSeed || '(empty — random)'];
      case 10: return ['Debug Mode', this.debugMode ? 'ON' : 'OFF'];
      case 11: return ['Reset Game', 'Wipes all progress permanently'];
      case 12: return ['Ready to descend', '[SPACE] to embark'];
      default: return ['', ''];
    }
  }

  private descPickaxe(): [string, string] {
    const opt = this.selectedPickaxeIdx >= 0 ? this.pickaxeOptions[this.selectedPickaxeIdx] : null;
    if (!opt) return ['Pickaxe', 'No pickaxe available'];
    const name = NAMES[opt.tier] ?? `Pickaxe T${opt.tier}`;
    const runs = gameState.remainingPickaxeRuns(opt.tier);
    const runsStr = opt.tier === 1 ? '\u221e' : `${runs}/5`;
    const ores = opt.tier >= 4 ? 'Gold/Silver/Bronze' : opt.tier >= 3 ? 'Silver/Bronze' : opt.tier >= 2 ? 'Bronze' : 'Stone';
    return [`${name} [Tier ${opt.tier}]`, `Dmg: ${opt.tier} | ${ores} | ${runsStr}`];
  }

  private descRing(idx: number, label: string): [string, string] {
    const opt = idx >= 0 ? this.ringOptions[idx] : null;
    if (!opt) return [label, 'No ring equipped'];
    const effect = gameState.getRingDescription(opt.id);
    return [opt.name, `${effect} | Permanent`];
  }

  private descBoots(): [string, string] {
    const opt = this.selectedBootsIdx >= 0 ? this.bootOptions[this.selectedBootsIdx] : null;
    if (!opt) return ['Boots', 'No boots equipped'];
    const eff = gameState.getBootEffectsById(opt.id);
    const parts: string[] = [];
    if (eff.maxStaminaBonus > 0) parts.push(`+${eff.maxStaminaBonus} stamina`);
    if (eff.luckBonus > 0) parts.push(`${Math.round(eff.luckBonus * 100)}% luck`);
    if (eff.stairMultiplier > 1) parts.push(`${eff.stairMultiplier}x stair loot`);
    parts.push(`Dur: ${opt.runs === Infinity ? '\u221e' : opt.runs + '/5'}`);
    return [opt.name, parts.join(' | ')];
  }

  private descLantern(): [string, string] {
    const opt = this.selectedLanternIdx >= 0 ? this.lanternOptions[this.selectedLanternIdx] : null;
    if (!opt) return ['Lantern', 'No lantern equipped'];
    const range = gameState.getLanternRangeForPreview(opt.id);
    const darkRange = range + 90;
    return [opt.name, `Light: +${range}px (+${darkRange}px dark) | Dur: ${opt.runs === Infinity ? '\u221e' : opt.runs + '/5'}`];
  }

  private descConsumable(idx: number): [string, string] {
    const ct = CONSUMABLE_TYPES[idx];
    const qty = this.consumableLoadout[ct.id] ?? 0;
    const stash = gameState.inventory.count(ct.id);
    return [ct.name, `Loadout: ${qty} | Stash: ${stash}`];
  }

  private renderFooter(): void {
    this.footerText.setText('[W/S] nav  [SPACE] pick  [\u2190\u2192] cycle  [ESC] cancel');
  }

  private onEquipClick(idx: number): void {
    if (!this.isVisible()) return;
    this.gateTab = idx;
    this.render();
    this.openEquipPicker(idx);
  }

  private onConsumableClick(idx: number): void {
    if (!this.isVisible()) return;
    this.gateTab = 5 + idx;
    this.render();
    this.openConsumablePicker(idx);
  }

  private onSettingsClick(idx: number): void {
    if (!this.isVisible()) return;
    this.gateTab = 8 + idx;
    this.render();
    switch (idx) {
      case 0: this.openFloorPicker(); break;
      case 1: this.openSeedPopup(); break;
      case 2: this.debugMode = !this.debugMode; this.render(); break;
      case 3:
        if (this.resetConfirm) {
          this.openResetConfirm();
        } else {
          this.resetConfirm = true;
          this.render();
        }
        break;
    }
  }

  private openEquipPicker(slotIdx: number): void {
    const slotNames = ['Pickaxe', 'Ring 1', 'Ring 2', 'Boots', 'Lantern'];
    let options: PickerOption[] = [];
    let currentId: string | null = null;

    switch (slotIdx) {
      case 0: {
        options = this.pickaxeOptions.map(o => {
          const runs = gameState.remainingPickaxeRuns(o.tier);
          const runsStr = o.tier === 1 ? '\u221e' : `${runs}/5`;
          const ores = o.tier >= 4 ? 'Gold/Silver/Bronze' : o.tier >= 3 ? 'Silver/Bronze' : o.tier >= 2 ? 'Bronze' : 'Stone';
          return {
            id: o.id,
            name: NAMES[o.tier] ?? `Pickaxe T${o.tier}`,
            desc1: `Dmg: ${o.tier} | ${ores}`,
            desc2: `Dur: ${runsStr}`,
            disabled: o.tier > 1 && gameState.inventory.count(o.id) <= 0 && gameState.currentPickaxeTier !== o.tier,
          } as PickerOption;
        });
        currentId = this.pickaxeOptions[this.selectedPickaxeIdx]?.id ?? null;
        break;
      }
      case 1: {
        options = this.ringOptions.map(r => ({
          id: r.id,
          name: r.name,
          desc1: gameState.getRingDescription(r.id),
          disabled: false,
        }));
        options.unshift({ id: '', name: '(none)', desc1: 'Unequip this slot', disabled: false });
        currentId = this.selectedRing1Idx >= 0 ? this.ringOptions[this.selectedRing1Idx]?.id ?? null : null;
        break;
      }
      case 2: {
        options = this.ringOptions.map(r => ({
          id: r.id,
          name: r.name,
          desc1: gameState.getRingDescription(r.id),
          disabled: false,
        }));
        options.unshift({ id: '', name: '(none)', desc1: 'Unequip this slot', disabled: false });
        currentId = this.selectedRing2Idx >= 0 ? this.ringOptions[this.selectedRing2Idx]?.id ?? null : null;
        break;
      }
      case 3: {
        options = this.bootOptions.map(b => ({
          id: b.id,
          name: b.name,
          desc1: b.runs === Infinity ? '\u221e durability' : `${b.runs}/5 runs`,
          disabled: false,
        }));
        options.unshift({ id: '', name: '(none)', desc1: 'Unequip this slot', disabled: false });
        currentId = this.selectedBootsIdx >= 0 ? this.bootOptions[this.selectedBootsIdx]?.id ?? null : null;
        break;
      }
      case 4: {
        options = this.lanternOptions.map(l => ({
          id: l.id,
          name: l.name,
          desc1: l.runs === Infinity ? '\u221e durability' : `${l.runs}/5 runs`,
          disabled: false,
        }));
        options.unshift({ id: '', name: '(none)', desc1: 'Unequip this slot', disabled: false });
        currentId = this.selectedLanternIdx >= 0 ? this.lanternOptions[this.selectedLanternIdx]?.id ?? null : null;
        break;
      }
    }

    if (options.length === 0) return;

    this.equipPicker.show(options, currentId, `Select ${slotNames[slotIdx]}`, (id) => {
      this.onEquipSelected(slotIdx, id);
    });
  }

  private onEquipSelected(slotIdx: number, id: string): void {
    switch (slotIdx) {
      case 0: {
        const idx = this.pickaxeOptions.findIndex(o => o.id === id);
        if (idx >= 0) this.selectedPickaxeIdx = idx;
        break;
      }
      case 1: {
        const idx = this.ringOptions.findIndex(r => r.id === id);
        if (idx >= 0) this.selectedRing1Idx = idx;
        else this.selectedRing1Idx = -1;
        break;
      }
      case 2: {
        const idx = this.ringOptions.findIndex(r => r.id === id);
        if (idx >= 0) this.selectedRing2Idx = idx;
        else this.selectedRing2Idx = -1;
        break;
      }
      case 3: {
        if (id === '') { this.selectedBootsIdx = -1; break; }
        const idx = this.bootOptions.findIndex(b => b.id === id);
        if (idx >= 0) this.selectedBootsIdx = idx;
        else this.selectedBootsIdx = -1;
        break;
      }
      case 4: {
        if (id === '') { this.selectedLanternIdx = -1; break; }
        const idx = this.lanternOptions.findIndex(l => l.id === id);
        if (idx >= 0) this.selectedLanternIdx = idx;
        else this.selectedLanternIdx = -1;
        break;
      }
    }
    this.render();
  }

  private openConsumablePicker(idx: number): void {
    const ct = CONSUMABLE_TYPES[idx];
    const currentQty = this.consumableLoadout[ct.id] ?? 0;
    const maxQty = gameState.inventory.count(ct.id);

    this.consumablePicker.show(ct.id, currentQty, maxQty, (id, qty) => {
      this.consumableLoadout[id] = qty;
      this.render();
    });
  }

  private openFloorPicker(): void {
    this.floorPicker.show(this.elevatorFloorOptions, this.selectedElevatorFloor, (floor) => {
      this.selectedElevatorFloor = floor;
      this.render();
    });
  }

  private openSeedPopup(): void {
    this.seedPopup.show(this.gateSeed, (seed) => {
      this.gateSeed = seed;
      this.render();
    });
  }

  private openResetConfirm(): void {
    this.confirmPopup.show(
      'Reset all progress?',
      'This cannot be undone. All items, buildings, and research will be lost.',
      () => {
        gameState.resetProgress();
        this.hide();
        this.scene.cameras.main.fadeOut(400, 0, 0, 0);
        this.scene.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.scene.start('HomelandScene');
        });
      },
    );
  }

  isPickerOpen(): boolean {
    return this.equipPicker.isVisible()
      || this.consumablePicker.isVisible()
      || this.floorPicker.isVisible()
      || this.seedPopup.isVisible()
      || this.confirmPopup.isVisible();
  }

  handleUp(): void {
    this.gateTab--;
    if (this.gateTab < 0) this.gateTab = this.maxTab;
    this.render();
  }

  handleDown(): void {
    this.gateTab++;
    if (this.gateTab > this.maxTab) this.gateTab = 0;
    this.render();
  }

  handleLeft(): void {
    if (this.gateTab === 8) {
      const idx = this.elevatorFloorOptions.indexOf(this.selectedElevatorFloor);
      if (idx > 0) this.selectedElevatorFloor = this.elevatorFloorOptions[idx - 1];
      this.render();
    } else if (this.gateTab === 10) {
      this.debugMode = !this.debugMode;
      this.render();
    }
  }

  handleRight(): void {
    if (this.gateTab === 8) {
      const idx = this.elevatorFloorOptions.indexOf(this.selectedElevatorFloor);
      if (idx < this.elevatorFloorOptions.length - 1) this.selectedElevatorFloor = this.elevatorFloorOptions[idx + 1];
      this.render();
    } else if (this.gateTab === 10) {
      this.debugMode = !this.debugMode;
      this.render();
    }
  }

  handleESC(): boolean {
    if (this.resetConfirm) {
      this.resetConfirm = false;
      this.render();
      return true;
    }
    return false;
  }

  handleSpace(): void {
    const t = this.gateTab;
    if (t >= 0 && t <= 4) {
      this.openEquipPicker(t);
    } else if (t >= 5 && t <= 7) {
      this.openConsumablePicker(t - 5);
    } else if (t === 8) {
      this.openFloorPicker();
    } else if (t === 9) {
      this.openSeedPopup();
    } else if (t === 10) {
      this.debugMode = !this.debugMode;
      this.render();
    } else if (t === 11) {
      if (this.resetConfirm) {
        this.openResetConfirm();
      } else {
        this.resetConfirm = true;
        this.render();
      }
    } else if (t === 12) {
      this.embark();
    }
  }

  private embark(): void {
    this.resetConfirm = false;
    const selected = this.pickaxeOptions[this.selectedPickaxeIdx] ?? this.pickaxeOptions[0];
    const consumables: Record<string, number> = {};
    for (const ct of CONSUMABLE_TYPES) {
      const qty = this.consumableLoadout[ct.id] ?? 0;
      if (qty > 0) {
        consumables[ct.id] = qty;
        gameState.inventory.removeItem(ct.id, qty);
      }
    }
    gameState.currentRunSeed = this.gateSeed || Math.random().toString(36).substring(2, 10);
    gameState.save();
    this.onEmbark({
      pickaxeTier: selected?.tier ?? 1,
      ring1: this.selectedRing1Idx >= 0 ? this.ringOptions[this.selectedRing1Idx]?.id ?? null : null,
      ring2: this.selectedRing2Idx >= 0 ? this.ringOptions[this.selectedRing2Idx]?.id ?? null : null,
      boots: this.selectedBootsIdx >= 0 ? this.bootOptions[this.selectedBootsIdx]?.id ?? null : null,
      lantern: this.selectedLanternIdx >= 0 ? this.lanternOptions[this.selectedLanternIdx]?.id ?? null : null,
      consumables,
      seed: gameState.currentRunSeed,
      debug: this.debugMode,
      startFloor: this.selectedElevatorFloor,
    });
  }

  destroy(): void {
    this.equipPicker.destroy();
    this.consumablePicker.destroy();
    this.floorPicker.destroy();
    this.seedPopup.destroy();
    this.confirmPopup.destroy();
    super.destroy();
  }
}
