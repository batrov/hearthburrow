import Phaser from 'phaser';
import { gameState } from '../systems/GameState';
import { audio } from '../systems/AudioSystem';

interface ResearchProject {
  id: string;
  label: string;
  description: string;
  cost: Record<string, number>;
  effect: string;
}

const PROJECTS: ResearchProject[] = [
  { id: 'stamina_up', label: 'Stamina Boost', description: '+10 max stamina', cost: { crystal: 5, gold_ore: 3 }, effect: 'stamina' },
  { id: 'inventory_up', label: 'Inventory Expansion', description: '+2 inventory slots', cost: { crystal: 3, silver_ore: 5 }, effect: 'inventory' },
];

export class ResearchPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private visible: boolean = false;
  private selectionIndex: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    this.bg = scene.add.graphics();
    this.container.add(this.bg);

    this.text = scene.add.text(960 / 2, 50, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#e8d5b7',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0);
    this.container.add(this.text);

    this.container.setVisible(false);
  }

  show(): void {
    this.visible = true;
    this.selectionIndex = 0;
    this.render();
    this.container.setVisible(true);
  }

  hide(): void {
    this.visible = false;
    this.container.setVisible(false);
  }

  isVisible(): boolean {
    return this.visible;
  }

  navigateUp(): void {
    if (this.selectionIndex > 0) {
      this.selectionIndex--;
      this.render();
    }
  }

  navigateDown(): void {
    if (this.selectionIndex < PROJECTS.length - 1) {
      this.selectionIndex++;
      this.render();
    }
  }

  confirm(): void {
    const project = PROJECTS[this.selectionIndex];
    if (!project) return;

    if (gameState.researchedUpgrades.includes(project.id)) {
      audio.playError();
      return;
    }

    for (const [id, qty] of Object.entries(project.cost)) {
      if (gameState.inventory.count(id) < qty) {
        audio.playError();
        return;
      }
    }

    for (const [id, qty] of Object.entries(project.cost)) {
      gameState.inventory.removeItem(id, qty);
    }

    gameState.researchedUpgrades.push(project.id);

    switch (project.effect) {
      case 'stamina':
        gameState.maxStaminaBonus += 10;
        break;
      case 'inventory':
        gameState.inventorySlotBonus += 2;
        gameState.inventory.expandSlots(2);
        break;
    }

    audio.playItemPickup();
    gameState.save();
    this.render();
  }

  private render(): void {
    this.bg.clear();
    this.bg.fillStyle(0x0a0a1a, 0.92);
    this.bg.fillRect(0, 0, 960, 640);
    this.bg.lineStyle(1, 0x3a3a4a, 0.5);
    this.bg.strokeRect(40, 40, 880, 560);

    const lines: string[] = [
      '--- Laboratory ---',
      '',
      'Research projects consume materials',
      'to unlock permanent upgrades.',
      '',
      '',
    ];

    for (let i = 0; i < PROJECTS.length; i++) {
      const p = PROJECTS[i];
      const cursor = i === this.selectionIndex ? '▸' : ' ';
      const done = gameState.researchedUpgrades.includes(p.id);
      const status = done ? '[DONE]' : '';
      const costStr = Object.entries(p.cost)
        .map(([id, qty]) => {
          const have = gameState.inventory.count(id);
          const color = have >= qty ? '#88dd88' : '#dd6666';
          return `${id.replace(/_/g, ' ')} ${have}/${qty}`;
        })
        .join('  ');
      lines.push(` ${cursor} ${p.label.padEnd(20)} ${status}`);
      lines.push(`    ${p.description}`);
      if (!done) lines.push(`    Cost: ${costStr}`);
      lines.push('');
    }

    lines.push('  [W/S] navigate  [SPACE] research  [ESC] close');
    this.text.setText(lines.join('\n'));
  }
}
