import Phaser from 'phaser';
import { gameState } from '../systems/GameState';
import { InventoryPanel } from '../ui/InventoryPanel';

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
  private currentBuilding: BuildingZone | null = null;
  private moveSpeed: number = 200;
  private inventoryPanel!: InventoryPanel;

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

    this.inventoryPanel = new InventoryPanel(this, gameState.inventory, 'Storage');
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
    path.fillRect(0, 320 - 12, 960, 24);
  }

  private drawBuildings(): void {
    this.buildings = [
      {
        x: 80, y: 80, w: 160, h: 110,
        label: 'Crafting Station',
        description: 'Craft tools and equipment from mined materials.',
        action: 'Open crafting menu',
        unlocked: true, interactable: true, interactDistance: 60,
      },
      {
        x: 720, y: 80, w: 160, h: 110,
        label: 'Storage',
        description: 'Store and manage your collected resources.',
        action: 'Open storage',
        unlocked: true, interactable: true, interactDistance: 60,
      },
      {
        x: 80, y: 450, w: 160, h: 110,
        label: 'Trading Post',
        description: 'Trade resources with wandering merchants.',
        action: 'Visit merchant',
        unlocked: false, interactable: false, interactDistance: 60,
      },
      {
        x: 720, y: 450, w: 160, h: 110,
        label: 'Laboratory',
        description: 'Research advanced upgrades and recipes.',
        action: 'Enter laboratory',
        unlocked: false, interactable: false, interactDistance: 60,
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
      this.add.text(b.x + b.w / 2, b.y + b.h / 2 + 18, 'locked', {
        fontSize: '11px', fontFamily: 'monospace', color: '#5a4a3a',
      }).setOrigin(0.5);
    }
  }

  private drawExpeditionGate(): void {
    const gx = 960 / 2;

    const gate = this.add.graphics();
    gate.fillStyle(0x4a3a6a, 0.5);
    gate.fillRect(gx - 30, 0, 60, 640);
    gate.fillStyle(0x6a5a8a, 0.3);
    gate.fillRect(gx - 8, 0, 16, 640);

    this.add.text(gx, 40, 'FORGOTTEN DEPTHS', {
      fontSize: '13px', fontFamily: 'monospace', color: '#6a5a8a',
    }).setOrigin(0.5);

    this.add.text(gx, 620, '⬇ Expedition Gate', {
      fontSize: '15px', fontFamily: 'monospace', color: '#e8d5b7',
    }).setOrigin(0.5);

    this.buildings.push({
      x: gx - 30, y: 0, w: 60, h: 640,
      label: 'Expedition Gate',
      description: 'Descend into the procedural dungeon to mine resources.',
      action: 'Begin expedition',
      unlocked: true, interactable: true, interactDistance: 50,
    });
  }

  private drawPlayer(): void {
    this.player = this.add.rectangle(960 / 2, 640 - 80, 20, 24, 0x88ccff);
    this.playerLabel = this.add.text(960 / 2, 640 - 80 - 20, 'You', {
      fontSize: '11px', fontFamily: 'monospace', color: '#aaddff',
    }).setOrigin(0.5);
  }

  private createInteractionUI(): void {
    this.add.text(960 / 2, 590, '[TAB] Inventory', {
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
    };
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.TAB)) {
      if (this.panelVisible) return;
      this.inventoryPanel.toggle();
      return;
    }

    if (this.inventoryPanel.isVisible()) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        this.inventoryPanel.hide();
      }
      return;
    }

    if (this.panelVisible) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
        this.closePanel();
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
    let nx = this.player.x + dx * speed;
    let ny = this.player.y + dy * speed;

    nx = Phaser.Math.Clamp(nx, 10, 950);
    ny = Phaser.Math.Clamp(ny, 10, 630);

    for (const b of this.buildings) {
      const bx = b.x;
      const by = b.y;
      const bw = b.w;
      const bh = b.h;

      if (nx + 10 > bx && nx - 10 < bx + bw && ny + 12 > by && ny - 12 < by + bh) {
        const overlapX = Math.min(nx + 10, bx + bw) - Math.max(nx - 10, bx);
        const overlapY = Math.min(ny + 12, by + bh) - Math.max(ny - 12, by);
        if (overlapX < overlapY) {
          nx = dx > 0 ? bx - 10 : bx + bw + 10;
        } else {
          ny = dy > 0 ? by - 12 : by + bh + 12;
        }
      }
    }

    this.player.setPosition(nx, ny);
    this.playerLabel.setPosition(nx, ny - 20);
  }

  private checkProximity(): void {
    let closest: BuildingZone | null = null;
    let closestDist = Infinity;

    for (const b of this.buildings) {
      if (!b.interactable) continue;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, cx, cy);

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
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('ExpeditionScene');
      });
      return;
    }

    if (this.currentBuilding.label === 'Storage') {
      this.inventoryPanel.refresh();
      this.inventoryPanel.show();
      return;
    }

    this.showBuildingPanel(this.currentBuilding);
  }

  private showBuildingPanel(building: BuildingZone): void {
    this.panelVisible = true;

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
    this.panelBg.setAlpha(0);
    this.panelText.setAlpha(0);
  }
}
