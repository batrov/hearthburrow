import Phaser from 'phaser';
import { BasePanel } from './BasePanel';
import { NineSliceBg } from './NineSliceBg';
import { UiButton } from './UiButton';
import { gameState } from '../systems/GameState';
import { EquipmentPicker, PickerOption } from './EquipmentPicker';
import { ConsumablePicker } from './ConsumablePicker';
import { DepthPicker } from './DepthPicker';
import { VW, VH, CX } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';
import { getInputMode } from '../systems/InputMode';

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
  onDeveloperMenu?: () => void;

  gateTab = 0;
  maxTab = 9;

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
  debugMode = false;
  private selectedElevatorDepth = 0;
  private elevatorDepthOptions: number[] = [];
  gateSeed = '';

  settingsDirty = false;

  private panelBlocker!: Phaser.GameObjects.Rectangle;
  private title!: Phaser.GameObjects.Text;
  private portraitSprite!: Phaser.GameObjects.Image;
  private statTexts: Phaser.GameObjects.Text[] = [];

  private equipSlots: {
    btn: UiButton;
    icon: Phaser.GameObjects.Image;
    badge: Phaser.GameObjects.Text;
  }[] = [];

  private consSlots: {
    btn: UiButton;
    icon: Phaser.GameObjects.Image;
    badge: Phaser.GameObjects.Text;
  }[] = [];

  private depthLabel!: Phaser.GameObjects.Text;
  private depthBtn!: UiButton;
  private descBg!: Phaser.GameObjects.NineSlice;
  private descLines: Phaser.GameObjects.Text[] = [];
  private footerText!: Phaser.GameObjects.Text;
  private embarkBtn!: UiButton;

  // Equipment slot grid, CX()-relative (tuned originally for CX()=195 at
  // VW()=390) so the rightmost slots don't clip off-screen at the narrowest
  // clamped width.
  private equipYX(): { x: number; y: number }[] {
    const cx = CX();
    return [
      { x: cx - 5, y: 205 },
      { x: cx + 90, y: 179 },
      { x: cx + 157, y: 179 },
      { x: cx + 90, y: 231 },
      { x: cx + 157, y: 231 },
    ];
  }

  private equipPicker: EquipmentPicker;
  private consumablePicker: ConsumablePicker;
  private depthPicker: DepthPicker;
  private clickHandler: ((p: Phaser.Input.Pointer) => void) | null = null;
  private hoverHandler: ((p: Phaser.Input.Pointer) => void) | null = null;
  private pressTimer: Phaser.Time.TimerEvent | null = null;
  private pointerUpHandler: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.equipPicker = new EquipmentPicker(scene);
    this.consumablePicker = new ConsumablePicker(scene);
    this.depthPicker = new DepthPicker(scene);
    this.buildUI();
  }

  private buildUI(): void {
    this.overlayPanel = NineSliceBg.panel(this.scene, CX(), VH() / 2, VW(), VH());
    this.overlayPanel.setDepth(199).setAlpha(0.85);
    this.container.add(this.overlayPanel);

    this.panelBlocker = this.scene.add.rectangle(CX(), VH() / 2, VW(), VH(), 0x000000, 0)
      .setScrollFactor(0).setData('isUI', true).setInteractive();
    this.panelBlocker.on('pointerdown', () => {});
    this.container.add(this.panelBlocker);

    this.title = createText(this.scene, CX(), 20, 'Expedition Loadout', {
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

    const equipYX = this.equipYX();
    for (let i = 0; i < 5; i++) {
      const slotSize = i === 0 ? 104 : 52;
      const btn = new UiButton(this.scene, equipYX[i].x, equipYX[i].y, '', slotSize, slotSize, () => this.onEquipClick(i), { small: true });
      btn.setDepth(200).setVisible(false);
      for (const c of btn.getChildren()) this.container.add(c);
      const iconScale = i === 0 ? 1.6 : 0.8;
      const icon = this.scene.add.image(equipYX[i].x, equipYX[i].y, 'item_pickaxe_1').setScale(iconScale);
      icon.setVisible(false);
      this.container.add(icon);
      const badge = createText(this.scene, equipYX[i].x, equipYX[i].y + 26, '', {
        fontSize: fs(9), fontFamily: 'Inter', resolution: 4, color: '#999999',
      }).setOrigin(0.5);
      badge.setVisible(false);
      this.container.add(badge);
      this.equipSlots.push({ btn, icon, badge });
    }

    this.container.add(createText(this.scene, CX(), 138, 'EQUIPMENT', {
      fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#6a5a8a',
    }).setOrigin(0.5));

    const consYX = [
      { x: CX() - 76, y: 302 },
      { x: CX(), y: 302 },
      { x: CX() + 76, y: 302 },
    ];
    for (let i = 0; i < 3; i++) {
      const btn = new UiButton(this.scene, consYX[i].x, consYX[i].y, '', 64, 44, () => this.onConsumableClick(i), { small: true });
      btn.setDepth(200).setVisible(false);
      for (const c of btn.getChildren()) this.container.add(c);
      const icon = this.scene.add.image(consYX[i].x, consYX[i].y, 'item_stamina_potion').setScale(0.8);
      icon.setVisible(false);
      this.container.add(icon);
      const badge = createText(this.scene, consYX[i].x, consYX[i].y + 16, '', {
        fontSize: fs(9), fontFamily: 'Inter', resolution: 4, color: '#88cc88',
      }).setOrigin(0.5);
      badge.setVisible(false);
      this.container.add(badge);
      this.consSlots.push({ btn, icon, badge });
    }

    this.container.add(createText(this.scene, CX(), 270, 'CONSUMABLES', {
      fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#6a5a8a',
    }).setOrigin(0.5));

    this.depthLabel = createText(this.scene, CX() - 5, 362, 'Start Depth:', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#b8a898',
    }).setOrigin(1, 0.5);
    this.container.add(this.depthLabel);
    this.depthBtn = new UiButton(this.scene, CX() + 50, 362, '0', 80, 44, () => this.onDepthClick(), { small: true });
    this.depthBtn.setDepth(200).setVisible(false);
    for (const c of this.depthBtn.getChildren()) this.container.add(c);

    this.embarkBtn = new UiButton(this.scene, CX(), 420, 'EMBARK', 140, 44, () => this.embark(), {
      color: '#ffcc44', fontSize: fs(14),
    });
    this.embarkBtn.setDepth(210).setVisible(false);
    for (const child of this.embarkBtn.getChildren()) this.container.add(child);

    this.descBg = NineSliceBg.modal(this.scene, CX(), 511, 340, 34);
    this.descBg.setDepth(200);
    this.container.add(this.descBg);

    for (let i = 0; i < 2; i++) {
      const t = createText(this.scene, CX(), 472 + i * 16, '', {
        fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#c8b898',
      }).setOrigin(0.5);
      this.container.add(t);
      this.descLines.push(t);
    }

    this.footerText = createText(this.scene, CX(), VH() - 30, '', {
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
    if (gameState.inventory.count('teleport_scroll') > 0) {
      this.consumableLoadout['teleport_scroll'] = 1;
    }

    this.settingsDirty = false;
    this.elevatorDepthOptions = gameState.getAvailableElevatorFloors();
    this.selectedElevatorDepth = this.elevatorDepthOptions[this.elevatorDepthOptions.length - 1] ?? 0;
    this.gateTab = 0;

    this.render();
    this.embarkBtn.setVisible(true);
    this.equipSlots.forEach(s => s.btn.setVisible(true));
    this.consSlots.forEach(s => s.btn.setVisible(true));
    this.depthLabel.setVisible(true);
    this.depthBtn.setVisible(true);

    const portraitBounds = new Phaser.Geom.Rectangle(
      this.portraitSprite.x - this.portraitSprite.displayWidth / 2,
      this.portraitSprite.y - this.portraitSprite.displayHeight / 2,
      this.portraitSprite.displayWidth,
      this.portraitSprite.displayHeight,
    );

    this.pointerUpHandler = () => {
      if (this.pressTimer) { this.pressTimer.remove(); this.pressTimer = null; }
    };
    this.scene.input.on('pointerup', this.pointerUpHandler);

    this.clickHandler = (p: Phaser.Input.Pointer) => {
      if (this.equipPicker.isVisible() || this.consumablePicker.isVisible() ||
          this.depthPicker.isVisible()) {
        return;
      }
      if (this.embarkBtn.handleClick(p)) return;
      for (let i = 0; i < 5; i++) {
        if (this.equipSlots[i].btn.handleClick(p)) return;
      }
      for (let i = 0; i < 3; i++) {
        if (this.consSlots[i].btn.handleClick(p)) return;
      }
      if (this.depthBtn.handleClick(p)) return;
      if (portraitBounds.contains(p.x, p.y)) {
        this.pressTimer = this.scene.time.delayedCall(500, () => {
          this.onDeveloperMenu?.();
        });
        return;
      }
    };
    this.scene.input.on('pointerdown', this.clickHandler);

    this.hoverHandler = (p: Phaser.Input.Pointer) => {
      this.equipSlots.forEach(s => s.btn.handleHover(p));
      this.consSlots.forEach(s => s.btn.handleHover(p));
      this.depthBtn.handleHover(p);
      this.embarkBtn.handleHover(p);
    };
    this.scene.input.on('pointermove', this.hoverHandler);

    this.fadeIn();
  }

  hide(): void {
    this.embarkBtn.setVisible(false);
    this.equipSlots.forEach(s => s.btn.setVisible(false));
    this.consSlots.forEach(s => s.btn.setVisible(false));
    this.depthLabel.setVisible(false);
    this.depthBtn.setVisible(false);
    if (this.pressTimer) { this.pressTimer.remove(); this.pressTimer = null; }
    if (this.pointerUpHandler) {
      this.scene.input.off('pointerup', this.pointerUpHandler);
      this.pointerUpHandler = null;
    }
    if (this.clickHandler) {
      this.scene.input.off('pointerdown', this.clickHandler);
      this.clickHandler = null;
    }
    if (this.hoverHandler) {
      this.scene.input.off('pointermove', this.hoverHandler);
      this.hoverHandler = null;
    }
    this.onCloseCb();
    super.hide();
  }

  render(): void {
    this.renderBackground();
    this.renderStats();
    this.renderEquipmentSlots();
    this.renderConsumableSlots();
    this.renderDepthRow();
    this.renderDescription();
    this.renderFooter();
  }

  private renderBackground(): void {
    NineSliceBg.updateSize(this.overlayPanel, VW(), VH());
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
    const equipYX = this.equipYX();
    for (let i = 0; i < 5; i++) {
      const slot = this.equipSlots[i];
      const isSelected = this.gateTab === i;
      const baseX = equipYX[i].x;
      const baseY = equipYX[i].y;
      const half = i === 0 ? 52 : 26;

      let opt: { id: string; tier?: number; name?: string; runs?: number } | null = null;
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

        slot.btn.bg.clearTint();
        slot.btn.bg.setAlpha(1);
      } else {
        const placeholderKey = ['item_pickaxe_1', 'item_ring_critical', 'item_ring_critical', 'item_boots_stamina_bronze', 'item_lantern_bronze'][i];
        slot.icon.setTexture(placeholderKey).setAlpha(0.15);
        slot.icon.setVisible(true);
        slot.badge.setVisible(false);
        slot.btn.bg.clearTint();
        slot.btn.bg.setAlpha(1);
      }
    }
  }

  private renderConsumableSlots(): void {
    const consYX = [
      { x: CX() - 76, y: 302 },
      { x: CX(), y: 302 },
      { x: CX() + 76, y: 302 },
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

      slot.btn.bg.clearTint();
      slot.btn.bg.setAlpha(1);
    }
  }

  private renderDepthRow(): void {
    const elevStr = String(this.selectedElevatorDepth);
    const isSelected = this.gateTab === 8;
    this.depthLabel.setColor(isSelected ? '#ffddaa' : '#b8a898');
    this.depthBtn.setText(elevStr);
    this.depthBtn.label.setColor(isSelected ? '#ffddaa' : '#b8a898');
    this.depthBtn.bg.clearTint();
    this.depthBtn.bg.setAlpha(1);
  }

  private renderDescription(): void {
    NineSliceBg.updateSize(this.descBg, 340, 34);
    this.descBg.setPosition(CX(), 496);

    const lines = this.getDescriptionLines();
    for (let i = 0; i < 2; i++) {
      this.descLines[i].setText(lines[i] ?? '');
      this.descLines[i].setColor(i === 0 ? '#e8d5b7' : '#999999');
      this.descLines[i].setPosition(CX(), 488 + i * 16);
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
      case 8: return ['Start Depth', this.selectedElevatorDepth === 0 ? 'Homeland' : `Depth ${this.selectedElevatorDepth}`];
      case 9: return ['Ready to descend', getInputMode() !== 'keyboard' ? 'Tap to embark' : '[SPACE] to embark'];
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
    this.footerText.setText(getInputMode() !== 'keyboard'
      ? 'Tap to navigate & select'
      : '[W/S] nav  [SPACE] pick  [\u2190\u2192] floor  [ESC] cancel');
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

  private onDepthClick(): void {
    if (!this.isVisible()) return;
    this.gateTab = 8;
    this.render();
    this.openDepthPicker();
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
    const stash = gameState.inventory.count(ct.id);
    const maxQty = ct.id === 'teleport_scroll' ? Math.min(stash, 1) : stash;

    this.consumablePicker.show(ct.id, currentQty, maxQty, (id, qty) => {
      this.consumableLoadout[id] = qty;
      this.render();
    });
  }

  private openDepthPicker(): void {
    this.depthPicker.show(this.elevatorDepthOptions, this.selectedElevatorDepth, (depth: number) => {
      this.selectedElevatorDepth = depth;
      this.render();
    });
  }

  isPickerOpen(): boolean {
    return this.equipPicker.isVisible()
      || this.consumablePicker.isVisible()
      || this.depthPicker.isVisible();
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
      const idx = this.elevatorDepthOptions.indexOf(this.selectedElevatorDepth);
      if (idx > 0) this.selectedElevatorDepth = this.elevatorDepthOptions[idx - 1];
      this.render();
    }
  }

  handleRight(): void {
    if (this.gateTab === 8) {
      const idx = this.elevatorDepthOptions.indexOf(this.selectedElevatorDepth);
      if (idx < this.elevatorDepthOptions.length - 1) this.selectedElevatorDepth = this.elevatorDepthOptions[idx + 1];
      this.render();
    }
  }

  handleESC(): boolean {
    return false;
  }

  handleSpace(): void {
    const t = this.gateTab;
    if (t >= 0 && t <= 4) {
      this.openEquipPicker(t);
    } else if (t >= 5 && t <= 7) {
      this.openConsumablePicker(t - 5);
    } else if (t === 8) {
      this.openDepthPicker();
    } else if (t === 9) {
      this.embark();
    }
  }

  private embark(): void {
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
      startFloor: this.selectedElevatorDepth,
    });
  }

  /**
   * GatePanel's content is almost entirely top-anchored (title through
   * description sit within ~530px of fixed offsets, well under the shortest
   * clamped viewport height), so it doesn't overlap/clip across the
   * phone-plausible clamp range without a full rebase. The one genuine staleness
   * risk is the handful of elements sized/positioned once at construction from
   * VW()/VH() (panelBlocker, footerText) — reposition those, then re-render if
   * visible (render() already reads CX()/VW() live on every call).
   */
  onViewportResize(): void {
    super.onViewportResize();
    this.panelBlocker.setPosition(CX(), VH() / 2).setSize(VW(), VH());
    this.footerText.setPosition(CX(), VH() - 30);
    this.embarkBtn.setPosition(CX(), 420);
    NineSliceBg.updateSize(this.overlayPanel, VW(), VH());

    const equipYX = this.equipYX();
    for (let i = 0; i < 5; i++) {
      const slot = this.equipSlots[i];
      slot.btn.setPosition(equipYX[i].x, equipYX[i].y);
      slot.icon.setPosition(equipYX[i].x, equipYX[i].y);
      slot.badge.setPosition(equipYX[i].x, equipYX[i].y + 26);
    }

    this.depthLabel.setPosition(CX() - 5, 362);
    this.depthBtn.setPosition(CX() + 50, 362);

    if (this._visible) this.render();
  }

  destroy(): void {
    this.equipPicker.destroy();
    this.consumablePicker.destroy();
    this.depthPicker.destroy();
    super.destroy();
  }
}
