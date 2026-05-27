import Phaser from 'phaser';
import { gameState } from '../systems/GameState';
import { InventoryPanel } from '../ui/InventoryPanel';
import { CraftingPanel } from '../ui/CraftingPanel';
import { canRestore, restoreBuilding, isRestored } from '../systems/BuildingSystem';
import { getBuilding } from '../systems/DataRegistry';

interface BuildingZone {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  description: string;
  action: string;
  unlocked: boolean;
  interactable: boolean;
  interactDistance: number;
  solid: boolean;
}

export class HomelandScene extends Phaser.Scene {
  private buildings: BuildingZone[] = [];
  private player!: Phaser.GameObjects.Rectangle;
  private playerLabel!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private promptText!: Phaser.GameObjects.Text;
  private panelBg!: Phaser.GameObjects.Graphics;
  private panelText!: Phaser.GameObjects.Text;
  private panelVisible: boolean = false;
  private restoreMode: boolean = false;
  private gateMode: boolean = false;
  private pickaxeOptions: { id: string; tier: number }[] = [];
  private selectedPickaxeIdx: number = 0;
  private ringOptions: { id: string; name: string }[] = [];
  private selectedRing1Idx: number = -1;
  private selectedRing2Idx: number = -1;
  private gateTab: number = 0;
  private currentBuilding: BuildingZone | null = null;
  private debugMode: boolean = false;
  private consumableTypes: { id: string; name: string }[] = [
    { id: 'stamina_potion', name: 'Stamina Potion' },
    { id: 'teleport_scroll', name: 'Teleport Scroll' },
    { id: 'mining_bomb', name: 'Mining Bomb' },
  ];
  private consumableLoadout: Record<string, number> = {};
  private consumableSelectionIdx: number = 0;
  private moveSpeed: number = 200;
  private inventoryPanel!: InventoryPanel;
  private craftingPanel!: CraftingPanel;

  constructor() {
    super({ key: 'HomelandScene' });
  }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.panelVisible = false;
    this.currentBuilding = null;

    this.drawTerrain();
    this.drawBuildings();
    this.drawExpeditionGate();
    this.drawPlayer();
    this.createInteractionUI();
    this.setupInput();

    this.inventoryPanel = new InventoryPanel(this, gameState.inventory, null, (id) => this.trashItem(id), 'Storage');
    this.craftingPanel = new CraftingPanel(this);
  }

  private drawTerrain(): void {
    const ground = this.add.graphics();
    ground.fillStyle(0x3a5a2a, 1);
    ground.fillRect(0, 0, 960, 640);

    for (let i = 0; i < 60; i++) {
      const gx = Phaser.Math.Between(0, 960);
      const gy = Phaser.Math.Between(0, 640);
      ground.fillStyle(0x4a6a3a, Phaser.Math.FloatBetween(0.2, 0.5));
      ground.fillRect(gx, gy, Phaser.Math.Between(4, 12), Phaser.Math.Between(4, 12));
    }

    const path = this.add.graphics();
    path.fillStyle(0x5a4a3a, 1);
    path.fillRect(960 / 2 - 22, 0, 44, 520);

    path.fillStyle(0x4a3a2a, 0.4);
    for (let y = 20; y < 520; y += 60) {
      path.fillRect(960 / 2 - 18, y, 36, 8);
    }

    const platform = this.add.graphics();
    platform.fillStyle(0x4a3a3a, 1);
    platform.fillRoundedRect(960 / 2 - 80, 520, 160, 24, 4);
    platform.fillStyle(0x3a2a2a, 0.6);
    platform.fillRoundedRect(960 / 2 - 76, 524, 152, 16, 3);
  }

  private drawBuildings(): void {
    this.buildings = [
      {
        x: 80, y: 80, w: 160, h: 110,
        label: 'Crafting Station',
        description: 'Craft tools and equipment from mined materials.',
        action: 'Open crafting menu',
        unlocked: true, interactable: true, interactDistance: 60, solid: true,
      },
      {
        x: 720, y: 80, w: 160, h: 110,
        label: 'Storage',
        description: 'Store and manage your collected resources.',
        action: 'Open storage',
        unlocked: true, interactable: true, interactDistance: 60, solid: true,
      },
      {
        x: 80, y: 340, w: 160, h: 110,
        label: 'Trading Post',
        description: 'Trade resources with wandering merchants.',
        action: 'Visit merchant',
        unlocked: false, interactable: false, interactDistance: 60, solid: true,
      },
      {
        x: 720, y: 340, w: 160, h: 110,
        label: 'Laboratory',
        description: 'Research advanced upgrades and recipes.',
        action: 'Enter laboratory',
        unlocked: false, interactable: false, interactDistance: 60, solid: true,
      },
      {
        x: 400, y: 200, w: 160, h: 110,
        label: 'Villager House',
        description: 'A cozy home. Increases max stamina when restored.',
        action: isRestored('housing') ? 'Visit house' : 'Restore house',
        unlocked: isRestored('housing'),
        interactable: true, interactDistance: 60, solid: true,
      },
    ];

    for (const b of this.buildings) {
      this.drawBuilding(b);
    }
  }

  private drawBuilding(b: BuildingZone): void {
    const alpha = b.unlocked ? 1 : 0.4;
    const g = this.add.graphics();

    g.fillStyle(0x5a3a1a, alpha);
    g.fillRoundedRect(b.x, b.y, b.w, b.h, 6);

    g.fillStyle(b.unlocked ? 0x8a6a3a : 0x4a3a2a, alpha);
    g.fillRoundedRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12, 4);

    const roof = this.add.graphics();
    roof.fillStyle(0x6a4a2a, alpha);
    roof.fillTriangle(b.x - 10, b.y, b.x + b.w / 2, b.y - 30, b.x + b.w + 10, b.y);

    this.add.text(b.x + b.w / 2, b.y + b.h / 2, b.label, {
      fontSize: '14px', fontFamily: 'monospace', color: b.unlocked ? '#e8d5b7' : '#6a5a4a',
    }).setOrigin(0.5).setAlpha(alpha);

    if (!b.unlocked) {
      const label = b.label === 'Villager House' ? 'restore' : 'locked';
      this.add.text(b.x + b.w / 2, b.y + b.h / 2 + 18, label, {
        fontSize: '11px', fontFamily: 'monospace', color: '#5a4a3a',
      }).setOrigin(0.5);
    }
  }

  private drawExpeditionGate(): void {
    const gx = 960 / 2;
    const gy = 544;

    const gate = this.add.graphics();
    gate.fillStyle(0x1a1a2e, 1);
    gate.fillRoundedRect(gx - 44, gy, 88, 96, 6);

    gate.fillStyle(0x3a2a5a, 0.7);
    gate.fillRoundedRect(gx - 36, gy + 8, 72, 80, 4);

    gate.fillStyle(0x5a4a8a, 0.4);
    gate.fillRect(gx - 28, gy + 16, 56, 64);

    const glow = this.add.graphics();
    glow.fillStyle(0x6a5a9a, 0.2);
    glow.fillRoundedRect(gx - 52, gy - 4, 104, 104, 10);
    glow.fillStyle(0x8a7aba, 0.1);
    glow.fillRoundedRect(gx - 60, gy - 8, 120, 112, 12);

    this.tweens.add({
      targets: glow,
      alpha: 0.6,
      yoyo: true,
      repeat: -1,
      duration: 1200,
      ease: 'Sine.easeInOut',
    });

    this.add.text(gx, gy - 16, 'FORGOTTEN DEPTHS', {
      fontSize: '11px', fontFamily: 'monospace', color: '#7a6a9a',
    }).setOrigin(0.5);

    this.add.text(gx, gy + 112, '[SPACE] Descend', {
      fontSize: '13px', fontFamily: 'monospace', color: '#8a7aba',
    }).setOrigin(0.5);

    this.buildings.push({
      x: gx - 44, y: gy, w: 88, h: 96,
      label: 'Expedition Gate',
      description: 'Descend into the procedural dungeon to mine resources.',
      action: 'Begin expedition',
      unlocked: true, interactable: true, interactDistance: 60, solid: false,
    });
  }

  private drawPlayer(): void {
    this.player = this.add.rectangle(960 / 2, 544 - 32, 20, 24, 0x88ccff);
    this.playerLabel = this.add.text(960 / 2, 544 - 52, 'You', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaddff',
    }).setOrigin(0.5);
  }

  private createInteractionUI(): void {
    this.add.text(960 / 2, 510, '[TAB] Inventory', {
      fontSize: '11px', fontFamily: 'monospace', color: '#4a5a4a',
    }).setOrigin(0.5);

    this.promptText = this.add.text(0, 0, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#ffdd88',
    }).setOrigin(0.5).setAlpha(0).setDepth(50);

    this.panelBg = this.add.graphics();
    this.panelBg.setDepth(90);
    this.panelBg.setAlpha(0);

    this.panelText = this.add.text(960 / 2, 640 / 2, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#e8d5b7',
      align: 'center', lineSpacing: 8,
    }).setOrigin(0.5).setDepth(91).setAlpha(0);
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
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
      Z: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
    };
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.TAB)) {
      if (this.panelVisible || this.restoreMode) return;
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

        if (this.gateTab === 3) {
          if (up) {
            if (this.consumableSelectionIdx > 0) {
              this.consumableSelectionIdx--;
            } else {
              this.gateTab = 2;
            }
            this.renderGatePanel();
          } else if (down) {
            if (this.consumableSelectionIdx < this.consumableTypes.length - 1) {
              this.consumableSelectionIdx++;
            } else {
              this.gateTab = 4;
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
            this.renderGatePanel();
          }
          if (down) {
            this.gateTab = Math.min(4, this.gateTab + 1);
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
            } else if (this.gateTab === 4) {
              this.debugMode = !this.debugMode;
              this.renderGatePanel();
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
            } else if (this.gateTab === 4) {
              this.debugMode = !this.debugMode;
              this.renderGatePanel();
            }
          }
        }
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        if (this.restoreMode) {
          this.tryRestore();
        } else if (this.gateMode) {
          this.startExpedition();
        } else {
          this.closePanel();
        }
      }
      return;
    }

    this.handleMovement(delta);
    this.checkProximity();
    this.handleInteraction();
  }

  private handleMovement(delta: number): void {
    let dx = 0;
    let dy = 0;

    if (this.keys.A.isDown || this.keys.LEFT.isDown) dx = -1;
    else if (this.keys.D.isDown || this.keys.RIGHT.isDown) dx = 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) dy = -1;
    else if (this.keys.S.isDown || this.keys.DOWN.isDown) dy = 1;

    if (dx === 0 && dy === 0) return;

    const speed = this.moveSpeed * (delta / 1000);
    const pHw = 10;
    const pHh = 12;

    let nx = this.player.x + dx * speed;
    let ny = this.player.y + dy * speed;

    nx = Phaser.Math.Clamp(nx, pHw, 960 - pHw);
    ny = Phaser.Math.Clamp(ny, pHh, 640 - pHh);

    const collides = (cx: number, cy: number): boolean => {
      for (const b of this.buildings) {
        if (!b.solid) continue;
        if (cx + pHw > b.x && cx - pHw < b.x + b.w &&
            cy + pHh > b.y && cy - pHh < b.y + b.h) {
          return true;
        }
      }
      return false;
    };

    if (!collides(nx, ny)) {
      this.player.setPosition(nx, ny);
      this.playerLabel.setPosition(nx, ny - 20);
      return;
    }

    const tryX = this.player.x + dx * speed;
    const tryY = this.player.y + dy * speed;

    if (dx !== 0 && !collides(tryX, this.player.y)) {
      this.player.x = tryX;
    }
    if (dy !== 0 && !collides(this.player.x, tryY)) {
      this.player.y = tryY;
    }
    this.playerLabel.setPosition(this.player.x, this.player.y - 20);
  }

  private checkProximity(): void {
    let closest: BuildingZone | null = null;
    let closestDist = Infinity;

    for (const b of this.buildings) {
      if (!b.interactable) continue;
      const nearX = Phaser.Math.Clamp(this.player.x, b.x, b.x + b.w);
      const nearY = Phaser.Math.Clamp(this.player.y, b.y, b.y + b.h);
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, nearX, nearY);

      if (dist < b.interactDistance && dist < closestDist) {
        closest = b;
        closestDist = dist;
      }
    }

    if (closest) {
      this.currentBuilding = closest;
      this.promptText.setPosition(this.player.x, this.player.y - 32);
      this.promptText.setText(`[SPACE] ${closest.action}`);
      this.promptText.setAlpha(1);
    } else {
      this.currentBuilding = null;
      this.promptText.setAlpha(0);
    }
  }

  private handleInteraction(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) return;
    if (!this.currentBuilding || !this.currentBuilding.interactable) return;

    if (this.currentBuilding.label === 'Expedition Gate') {
      this.showGatePanel();
      return;
    }

    if (this.currentBuilding.label === 'Crafting Station') {
      this.craftingPanel.refresh();
      this.craftingPanel.show();
      return;
    }

    if (this.currentBuilding.label === 'Storage') {
      this.inventoryPanel.refresh();
      this.inventoryPanel.show();
      return;
    }

    if (this.currentBuilding.label === 'Villager House') {
      if (isRestored('housing')) {
        this.showBuildingPanel(this.currentBuilding);
      } else {
        this.showRestorePanel('housing');
      }
      return;
    }

    this.showBuildingPanel(this.currentBuilding);
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

  private tryRestore(): void {
    const success = restoreBuilding('housing');
    this.restoreMode = false;
    this.closePanel();

    if (success) {
      const popup = this.add.text(960 / 2, 640 / 2, 'Villager House Restored!\n+20 Max Stamina', {
        fontSize: '18px', fontFamily: 'monospace', color: '#44cc66', fontStyle: 'bold', align: 'center',
      }).setOrigin(0.5).setDepth(250);

      this.tweens.add({
        targets: popup,
        y: popup.y - 50,
        alpha: 0,
        duration: 1500,
        ease: 'Quad.easeOut',
        onComplete: () => {
          popup.destroy();
          this.scene.restart();
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

    const currentTier = gameState.currentPickaxeTier;
    this.selectedPickaxeIdx = this.pickaxeOptions.findIndex(o => o.tier === currentTier);
    if (this.selectedPickaxeIdx < 0) this.selectedPickaxeIdx = 0;

    this.selectedRing1Idx = this.ringOptions.findIndex(r => r.id === gameState.equippedRings.ring1);
    this.selectedRing2Idx = this.ringOptions.findIndex(r => r.id === gameState.equippedRings.ring2);

    this.consumableLoadout = {};
    for (const ct of this.consumableTypes) {
      this.consumableLoadout[ct.id] = 0;
    }
    this.consumableSelectionIdx = 0;

    this.gateTab = 0;

    this.renderGatePanel();
  }

  private renderGatePanel(): void {
    const names: Record<number, string> = {
      1: 'Common Pickaxe',
      2: 'Copper Pickaxe',
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

    const consumableLines = this.consumableTypes
      .map((ct, i) => {
        const marker = this.gateTab === 3 && i === this.consumableSelectionIdx ? '▶' : ' ';
        const qty = this.consumableLoadout[ct.id];
        const available = gameState.inventory.count(ct.id);
        return `  ${marker} ${ct.name.padEnd(18)} ${qty} (have ${available})`;
      })
      .join('\n');

    const dbgMarker = this.gateTab === 4 ? '▶' : ' ';
    const dbgLine = `  ${dbgMarker} Debug Mode: ${this.debugMode ? 'ON' : 'OFF'}`;

    this.panelBg.clear();
    this.panelBg.fillStyle(0x0a0a1a, 0.85);
    this.panelBg.fillRoundedRect(960 / 2 - 220, 640 / 2 - 170, 440, 350, 10);
    this.panelBg.lineStyle(2, 0x6a5a8a, 1);
    this.panelBg.strokeRoundedRect(960 / 2 - 220, 640 / 2 - 170, 440, 350, 10);
    this.panelBg.setAlpha(1);

    this.panelText.setText(
      `Expedition Loadout\n\n` +
      `${pickaxeLines}\n\n` +
      `${ringLines}\n\n` +
      `Consumables:\n${consumableLines}\n\n` +
      `${dbgLine}\n\n` +
      `   [↑/↓] select slot  [←/→] change\n\n` +
      `Max Stamina: ${maxStamina}\n` +
      `Inventory: ${invSlots} slots\n\n` +
      `[SPACE] Descend  |  [ESC] cancel`
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
      this.scene.start('ExpeditionScene', { debug: this.debugMode, consumables });
    });
  }

  private showBuildingPanel(building: BuildingZone): void {
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
    this.panelBg.setAlpha(0);
    this.panelText.setAlpha(0);
  }

  private trashItem(itemId: string): void {
    if (gameState.inventory.count(itemId) <= 0) return;
    gameState.inventory.removeItem(itemId, 1);
    this.inventoryPanel.refresh();
  }
}
