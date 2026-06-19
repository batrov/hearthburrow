import Phaser from 'phaser';
import { BasePanel } from './BasePanel';
import { gameState } from '../systems/GameState';

interface PickaxeOption { id: string; tier: number }
interface RingOption { id: string; name: string }
interface BootOption { id: string; name: string; runs: number }
interface LanternOption { id: string; name: string; runs: number }

export class GatePanel extends BasePanel {
  onEmbark!: (config: {
    pickaxeTier: number; ring1: string | null; ring2: string | null;
    boots: string | null; lantern: string | null;
    consumables: Record<string, number>; seed: string; debug: boolean; startFloor: number;
  }) => void;
  onCloseCb!: () => void;

  gateTab = 0;
  debugMode = false;
  consumableLoadout: Record<string, number> = {};
  consumableSelectionIdx = 0;
  selectedElevatorFloor = 0;
  resetConfirm = false;
  gateSeed = '';
  seedEditing = false;

  private gateBg!: Phaser.GameObjects.Graphics;
  private gateTitle!: Phaser.GameObjects.Text;
  private gateEquipIcons: Phaser.GameObjects.Image[] = [];
  private gateEquipLabels: Phaser.GameObjects.Text[] = [];
  private gateEquipArrowsL: Phaser.GameObjects.Image[] = [];
  private gateEquipArrowsR: Phaser.GameObjects.Image[] = [];
  private gateEquipZonesL: Phaser.GameObjects.Rectangle[] = [];
  private gateEquipZonesR: Phaser.GameObjects.Rectangle[] = [];
  private gateConsumableIcons: Phaser.GameObjects.Image[] = [];
  private gateConsumableTexts: Phaser.GameObjects.Text[] = [];
  private gateConsumableBtnsMinus: Phaser.GameObjects.Text[] = [];
  private gateConsumableBtnsPlus: Phaser.GameObjects.Text[] = [];
  private gateConsumableZonesL: Phaser.GameObjects.Rectangle[] = [];
  private gateConsumableZonesR: Phaser.GameObjects.Rectangle[] = [];
  private gateConsumableHeader!: Phaser.GameObjects.Text;
  private gateBottomTexts: Phaser.GameObjects.Text[] = [];
  private gateBottomZones: Phaser.GameObjects.Rectangle[] = [];
  private gateFooter!: Phaser.GameObjects.Text;

  private pickaxeOptions: PickaxeOption[] = [];
  private selectedPickaxeIdx = 0;
  private ringOptions: RingOption[] = [];
  private selectedRing1Idx = -1;
  private selectedRing2Idx = -1;
  private bootOptions: BootOption[] = [];
  private selectedBootsIdx = -1;
  private lanternOptions: LanternOption[] = [];
  private selectedLanternIdx = -1;
  private elevatorFloorOptions: number[] = [];
  private maxTab = 9;

  private readonly consumableTypes = [
    { id: 'stamina_potion', name: 'Stamina Potion' },
    { id: 'teleport_scroll', name: 'Teleport Scroll' },
    { id: 'mining_bomb', name: 'Mining Bomb' },
  ];
  private readonly names: Record<number, string> = {
    1: 'Common Pickaxe', 2: 'Bronze Pickaxe', 3: 'Silver Pickaxe', 4: 'Gold Pickaxe',
  };

  private seedKeyHandler: ((event: KeyboardEvent) => void) | null = null;
  private embarkBtn!: Phaser.GameObjects.Text;
  private closeBtn!: Phaser.GameObjects.Text;
  private destroyed = false;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.buildUI();
  }

  private buildUI(): void {
    const PL = 130, PT = 40, PW = 700, PH = 560;
    const CX = 395;
    const TEXT_STYLE = { fontSize: '14px', fontFamily: 'monospace', color: '#e8d5b7' };
    const ROW_YS = [114, 152, 190, 228, 266];
    const CONS_YS = [324, 356, 388];
    const BOTTOM_YS = [440, 470, 500, 530];

    this.gateBg = this.scene.add.graphics();
    this.container.add(this.gateBg);

    this.gateTitle = this.scene.add.text(480, 58, 'Expedition Loadout', {
      fontSize: '20px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.gateTitle);

    for (let i = 0; i < 5; i++) {
      const ry = ROW_YS[i];

      const icon = this.scene.add.image(CX + 18, ry, 'item_pickaxe_1');
      this.container.add(icon);
      this.gateEquipIcons.push(icon);

      const label = this.scene.add.text(CX + 40, ry + 6, '', TEXT_STYLE);
      this.container.add(label);
      this.gateEquipLabels.push(label);

      const arrL = this.scene.add.image(CX + 22, ry, 'item_arrow_left').setInteractive({ useHandCursor: true });
      arrL.setData('row', i).setData('dir', -1);
      arrL.on('pointerdown', () => this.handleArrowClick(i, -1));
      this.container.add(arrL);
      this.gateEquipArrowsL.push(arrL);

      const arrR = this.scene.add.image(CX + 40, ry, 'item_arrow_right').setInteractive({ useHandCursor: true });
      arrR.setData('row', i).setData('dir', 1);
      arrR.on('pointerdown', () => this.handleArrowClick(i, 1));
      this.container.add(arrR);
      this.gateEquipArrowsR.push(arrR);

      const zoneL = this.scene.add.rectangle(CX + 90, ry + 12, 200, 28, 0xffffff, 0)
        .setScrollFactor(0).setDepth(220).setInteractive({ useHandCursor: true }).setData('isUI', true);
      zoneL.setVisible(false);
      zoneL.on('pointerdown', () => {
        if (!this.isVisible()) return;
        this.handleArrowClick(i, -1);
      });
      this.gateEquipZonesL.push(zoneL);

      const zoneR = this.scene.add.rectangle(CX + 270, ry + 12, 200, 28, 0xffffff, 0)
        .setScrollFactor(0).setDepth(220).setInteractive({ useHandCursor: true }).setData('isUI', true);
      zoneR.setVisible(false);
      zoneR.on('pointerdown', () => {
        if (!this.isVisible()) return;
        this.handleArrowClick(i, 1);
      });
      this.gateEquipZonesR.push(zoneR);
    }

    this.gateConsumableHeader = this.scene.add.text(CX, 304, 'Consumables:', {
      fontSize: '14px', fontFamily: 'monospace', color: '#b8a898',
    });
    this.container.add(this.gateConsumableHeader);

    for (let i = 0; i < 3; i++) {
      const cy = CONS_YS[i];
      const icon = this.scene.add.image(CX + 18, cy, 'item_stamina_potion');
      this.container.add(icon);
      this.gateConsumableIcons.push(icon);

      const text = this.scene.add.text(CX + 40, cy + 6, '', TEXT_STYLE);
      this.container.add(text);
      this.gateConsumableTexts.push(text);

      const minusBtn = this.scene.add.text(CX - 6, cy, '(-)', {
        fontSize: '14px', fontFamily: 'monospace', color: '#cc8888',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(220);
      minusBtn.setVisible(false);
      this.gateConsumableBtnsMinus.push(minusBtn);

      const plusBtn = this.scene.add.text(760, cy, '(+)', {
        fontSize: '14px', fontFamily: 'monospace', color: '#88cc88',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(220);
      plusBtn.setVisible(false);
      this.gateConsumableBtnsPlus.push(plusBtn);

      const zoneL = this.scene.add.rectangle(CX + 90, cy + 12, 200, 28, 0xffffff, 0)
        .setScrollFactor(0).setDepth(220).setInteractive({ useHandCursor: true }).setData('isUI', true);
      zoneL.setVisible(false);
      zoneL.on('pointerdown', () => {
        if (!this.isVisible()) return;
        this.gateTab = 5;
        this.consumableSelectionIdx = i;
        const ct = this.consumableTypes[i];
        this.consumableLoadout[ct.id] = Math.max(0, this.consumableLoadout[ct.id] - 1);
        this.render();
      });
      this.gateConsumableZonesL.push(zoneL);

      const zoneR = this.scene.add.rectangle(CX + 270, cy + 12, 200, 28, 0xffffff, 0)
        .setScrollFactor(0).setDepth(220).setInteractive({ useHandCursor: true }).setData('isUI', true);
      zoneR.setVisible(false);
      zoneR.on('pointerdown', () => {
        if (!this.isVisible()) return;
        this.gateTab = 5;
        this.consumableSelectionIdx = i;
        const ct = this.consumableTypes[i];
        const available = gameState.inventory.count(ct.id);
        if (this.consumableLoadout[ct.id] < available) this.consumableLoadout[ct.id]++;
        this.render();
      });
      this.gateConsumableZonesR.push(zoneR);
    }

    for (let i = 0; i < 4; i++) {
      const by = BOTTOM_YS[i];

      const text = this.scene.add.text(CX + 18, by + 6, '', TEXT_STYLE);
      this.container.add(text);
      this.gateBottomTexts.push(text);

      const zone = this.scene.add.rectangle(CX + 180, by + 12, 320, 28, 0xffffff, 0)
        .setScrollFactor(0).setDepth(220).setInteractive({ useHandCursor: true }).setData('isUI', true);
      zone.setVisible(false);
      const idx = i;
      zone.on('pointerdown', () => {
        if (!this.isVisible()) return;
        this.handleBottomClick(idx);
      });
      this.gateBottomZones.push(zone);
    }

    this.gateFooter = this.scene.add.text(480, 564, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#8a7a9a', align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.gateFooter);

    this.container.add(this.scene.add.image(258, 180, 'portrait'));

    this.embarkBtn = this.scene.add.text(258, 320, '[ EMBARK ]', {
      fontSize: '15px', fontFamily: 'monospace', color: '#ffcc44',
      backgroundColor: '#442a1acc', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(220).setInteractive({ useHandCursor: true }).setData('isUI', true);
    this.embarkBtn.on('pointerdown', () => {
      if (this.isVisible() && this.gateTab !== 8 && this.gateTab !== 9) this.handleSpace();
    });
    this.embarkBtn.setVisible(false);

    this.closeBtn = this.scene.add.text(810, 50, '[X]', {
      fontSize: '16px', fontFamily: 'monospace', color: '#aa6666',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(220).setInteractive({ useHandCursor: true }).setData('isUI', true);
    this.closeBtn.on('pointerdown', () => this.hide());
    this.closeBtn.setVisible(false);
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
    for (const ct of this.consumableTypes) {
      this.consumableLoadout[ct.id] = 0;
    }
    this.consumableSelectionIdx = 0;

    this.elevatorFloorOptions = gameState.getAvailableElevatorFloors();
    this.selectedElevatorFloor = this.elevatorFloorOptions.includes(0) ? 0 : (this.elevatorFloorOptions[0] ?? 0);
    this.resetConfirm = false;
    this.maxTab = 9;
    this.gateSeed = gameState.currentRunSeed || Math.random().toString(36).substring(2, 10);
    this.seedEditing = false;
    this.gateTab = 0;
    this.debugMode = false;

    this.seedKeyHandler = (event: KeyboardEvent) => {
      if (this.gateTab !== 8 || !this.isVisible() || !this.seedEditing) return;
      if (event.key === ' ') {
        return
      } else if (event.key === 'Backspace') {
        this.gateSeed = this.gateSeed.slice(0, -1);
        this.render();
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (this.gateSeed.length < 24) {
          this.gateSeed += event.key;
          this.render();
        }
      }
    };
    this.scene.input.keyboard!.on('keydown', this.seedKeyHandler);

    this.render();
    this.embarkBtn.setVisible(true);
    this.closeBtn.setVisible(true);
    this.gateEquipZonesL.forEach(z => z.setVisible(true));
    this.gateEquipZonesR.forEach(z => z.setVisible(true));
    this.gateConsumableZonesL.forEach(z => z.setVisible(true));
    this.gateConsumableZonesR.forEach(z => z.setVisible(true));
    this.gateBottomZones.forEach(z => z.setVisible(true));
    this.fadeIn();
  }

  hide(): void {
    if (this.seedKeyHandler) {
      this.scene.input.keyboard!.off('keydown', this.seedKeyHandler);
      this.seedKeyHandler = null;
    }
    this.seedEditing = false;
    this.consumableLoadout = {};
    this.embarkBtn.setVisible(false);
    this.closeBtn.setVisible(false);
    this.gateEquipZonesL.forEach(z => z.setVisible(false));
    this.gateEquipZonesR.forEach(z => z.setVisible(false));
    this.gateConsumableBtnsMinus.forEach(t => t.setVisible(false));
    this.gateConsumableBtnsPlus.forEach(t => t.setVisible(false));
    this.gateConsumableZonesL.forEach(z => z.setVisible(false));
    this.gateConsumableZonesR.forEach(z => z.setVisible(false));
    this.gateBottomZones.forEach(z => z.setVisible(false));
    this.onCloseCb();
    super.hide();
  }

  handleArrowClick(row: number, dir: number): void {
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
    this.render();
  }

  private handleBottomClick(index: number): void {
    this.gateTab = 6 + index;
    switch (index) {
      case 0: this.debugMode = !this.debugMode; break;
      case 1:
        if (this.elevatorFloorOptions.length > 0) {
          const ci = this.elevatorFloorOptions.indexOf(this.selectedElevatorFloor);
          this.selectedElevatorFloor = this.elevatorFloorOptions[(ci + 1) % this.elevatorFloorOptions.length];
        }
        break;
      case 2: this.seedEditing = !this.seedEditing; break;
      case 3:
        if (this.resetConfirm) {
          gameState.resetProgress();
          this.hide();
          this.scene.cameras.main.fadeOut(400, 0, 0, 0);
          this.scene.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.scene.start('HomelandScene');
          });
        } else {
          this.resetConfirm = true;
        }
        break;
    }
    this.render();
  }

  handleUp(): void {
    if (this.seedEditing) {
      return
    }
    if (this.gateTab === 5) {
      if (this.consumableSelectionIdx > 0) {
        this.consumableSelectionIdx--;
      } else {
        this.gateTab = 4;
      }
    } else {
      this.gateTab--;
      if (this.gateTab < 0) {
        this.gateTab = this.maxTab;
      }
      if (this.gateTab === 5) this.consumableSelectionIdx = this.consumableTypes.length - 1;
    }
    this.render();
  }

  handleDown(): void {
    if (this.seedEditing) {
      return
    }
    if (this.gateTab === 5) {
      if (this.consumableSelectionIdx < this.consumableTypes.length - 1) {
        this.consumableSelectionIdx++;
      } else {
        this.gateTab = 6;
      }
    } else {
      this.gateTab++;
      if (this.gateTab > this.maxTab) {
        this.gateTab = 0;
      }
      if (this.gateTab === 5) this.consumableSelectionIdx = 0;
    }
    this.render();
  }

  handleLeft(): void {
    if (this.gateTab === 5) {
      const ct = this.consumableTypes[this.consumableSelectionIdx];
      this.consumableLoadout[ct.id] = Math.max(0, this.consumableLoadout[ct.id] - 1);
    } else if (this.gateTab === 0 && this.selectedPickaxeIdx > 0) {
      this.selectedPickaxeIdx--;
    } else if (this.gateTab === 1 && this.selectedRing1Idx > -1) {
      this.selectedRing1Idx--;
    } else if (this.gateTab === 2 && this.selectedRing2Idx > -1) {
      this.selectedRing2Idx--;
    } else if (this.gateTab === 3 && this.selectedBootsIdx > -1) {
      this.selectedBootsIdx--;
    } else if (this.gateTab === 4 && this.selectedLanternIdx > -1) {
      this.selectedLanternIdx--;
    } else if (this.gateTab === 6) {
      this.debugMode = !this.debugMode;
    } else if (this.gateTab === 7 && this.elevatorFloorOptions.length > 0) {
      const idx = this.elevatorFloorOptions.indexOf(this.selectedElevatorFloor);
      if (idx > 0) this.selectedElevatorFloor = this.elevatorFloorOptions[idx - 1];
    }
    this.render();
  }

  handleRight(): void {
    if (this.gateTab === 5) {
      const ct = this.consumableTypes[this.consumableSelectionIdx];
      const available = gameState.inventory.count(ct.id);
      if (this.consumableLoadout[ct.id] < available) this.consumableLoadout[ct.id]++;
    } else if (this.gateTab === 0 && this.selectedPickaxeIdx < this.pickaxeOptions.length - 1) {
      this.selectedPickaxeIdx++;
    } else if (this.gateTab === 1 && this.selectedRing1Idx < this.ringOptions.length - 1) {
      this.selectedRing1Idx++;
    } else if (this.gateTab === 2 && this.selectedRing2Idx < this.ringOptions.length - 1) {
      this.selectedRing2Idx++;
    } else if (this.gateTab === 3 && this.selectedBootsIdx < this.bootOptions.length - 1) {
      this.selectedBootsIdx++;
    } else if (this.gateTab === 4 && this.selectedLanternIdx < this.lanternOptions.length - 1) {
      this.selectedLanternIdx++;
    } else if (this.gateTab === 6) {
      this.debugMode = !this.debugMode;
    } else if (this.gateTab === 7 && this.elevatorFloorOptions.length > 0) {
      const idx = this.elevatorFloorOptions.indexOf(this.selectedElevatorFloor);
      if (idx < this.elevatorFloorOptions.length - 1) this.selectedElevatorFloor = this.elevatorFloorOptions[idx + 1];
    }
    this.render();
  }

  handleESC(): boolean {
    if (this.seedEditing) {
      this.seedEditing = false;
      this.render();
      return true;
    }
    return false;
  }

  handleSpace(): void {
    if (this.gateTab === 9) {
      if (this.resetConfirm) {
        gameState.resetProgress();
        this.hide();
        this.scene.cameras.main.fadeOut(400, 0, 0, 0);
        this.scene.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.scene.start('HomelandScene');
        });
      } else {
        this.resetConfirm = true;
        this.render();
      }
    } else if (this.gateTab === 8) {
      this.seedEditing = !this.seedEditing;
      this.render();
    } else {
      this.resetConfirm = false;
      this.embark();
    }
  }

  private embark(): void {
    const selected = this.pickaxeOptions[this.selectedPickaxeIdx];
    const consumables: Record<string, number> = {};
    for (const ct of this.consumableTypes) {
      const qty = this.consumableLoadout[ct.id];
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

  render(): void {
    const PL = 130, PT = 40, PW = 700, PH = 560, CX = 395;
    const maxStamina = this.debugMode ? 10000 : 100 + gameState.maxStaminaBonus;
    const invSlots = 16 + gameState.inventorySlotBonus;
    const foundRelics = gameState.getFoundRelics();

    this.gateBg.clear();
    this.gateBg.fillStyle(0x0a0a1a, 0.85);
    this.gateBg.fillRoundedRect(PL, PT, PW, PH, 12);
    this.gateBg.lineStyle(2, 0x6a5a8a, 1);
    this.gateBg.strokeRoundedRect(PL, PT, PW, PH, 12);

    for (let i = 0; i < 5; i++) {
      const icon = this.gateEquipIcons[i];
      const label = this.gateEquipLabels[i];
      const arrL = this.gateEquipArrowsL[i];
      const arrR = this.gateEquipArrowsR[i];
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
            const n = this.names[opt.tier];
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

      if (hasOpt && iconKey && this.scene.textures.exists(iconKey)) {
        icon.setTexture(iconKey);
      }
      icon.setVisible(hasOpt);
      label.setText(text);

      if (selected) {
        const iy = icon.y;
        arrL.setPosition(CX + 20, iy).setVisible(true);
        arrR.setPosition(CX + 40 + label.width + 8, iy).setVisible(true);
      } else {
        arrL.setVisible(false);
        arrR.setVisible(false);
      }
    }

    for (let i = 0; i < 3; i++) {
      const ct = this.consumableTypes[i];
      const icon = this.gateConsumableIcons[i];
      const text = this.gateConsumableTexts[i];
      const minusBtn = this.gateConsumableBtnsMinus[i];
      const plusBtn = this.gateConsumableBtnsPlus[i];
      const qty = this.consumableLoadout[ct.id];
      const available = gameState.inventory.count(ct.id);
      const selected = this.gateTab === 5 && i === this.consumableSelectionIdx;

      const iconKey = `item_${ct.id}`;
      if (this.scene.textures.exists(iconKey)) {
        icon.setTexture(iconKey);
      }
      icon.setVisible(true);
      text.setText(`${ct.name}  ${qty} (have ${available})`);

      const atMin = qty <= 0;
      const atMax = qty >= available;
      minusBtn.setVisible(selected).setAlpha(selected && atMin ? 0.3 : 1);
      plusBtn.setVisible(selected).setAlpha(selected && atMax ? 0.3 : 1);
    }

    this.gateBottomTexts[0].setText(`Debug Mode: ${this.debugMode ? 'ON' : 'OFF'}`);

    const elevStr = this.selectedElevatorFloor === 0 ? '0 (Homeland)' : `${this.selectedElevatorFloor}`;
    this.gateBottomTexts[1].setText(`Start Floor: ${elevStr}`);

    const seedDisplay = this.gateSeed || '(none - random)';
    const seedStatus = this.seedEditing ? ' [EDITING]' : '';
    this.gateBottomTexts[2].setText(`Seed: ${seedDisplay}${seedStatus}`);

    this.gateBottomTexts[3].setText(`Reset Game${this.resetConfirm ? '  [SPACE] confirm' : ''}`);

    let footer = `[↑/↓] select  [←/→] change  [SPACE] Enter  [ESC] cancel\n`;
    footer += `Max Stamina: ${maxStamina}  |  Inventory: ${invSlots} slots`;
    if (foundRelics.length > 0) {
      footer += `  |  Relics: ${foundRelics.length}`;
    }
    this.gateFooter.setText(footer);
    this.gateFooter.setAlpha(1);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.seedKeyHandler) {
      this.scene.input.keyboard!.off('keydown', this.seedKeyHandler);
      this.seedKeyHandler = null;
    }
    if (this.embarkBtn) { this.embarkBtn.destroy(); }
    if (this.closeBtn) { this.closeBtn.destroy(); }
    this.gateEquipZonesL.forEach(z => z.destroy());
    this.gateEquipZonesR.forEach(z => z.destroy());
    this.gateConsumableBtnsMinus.forEach(t => t.destroy());
    this.gateConsumableBtnsPlus.forEach(t => t.destroy());
    this.gateConsumableZonesL.forEach(z => z.destroy());
    this.gateConsumableZonesR.forEach(z => z.destroy());
    this.gateBottomZones.forEach(z => z.destroy());
    super.destroy();
  }
}
