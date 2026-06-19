import Phaser from 'phaser';
import { gameState, itemDisplayName } from '../systems/GameState';
import { audio } from '../systems/AudioSystem';
import { BasePanel } from './BasePanel';

interface ResearchProject {
  id: string;
  label: string;
  levels: { cost: Record<string, number>; slotBonus?: number; staminaBonus?: number }[];
  maxLevel: number;
}

const PROJECTS: ResearchProject[] = [
  {
    id: 'backpack', label: 'Backpack Expansion', maxLevel: 5,
    levels: [
      { cost: { stone: 100 }, slotBonus: 2 },
      { cost: { stone: 200, bronze_ore: 50 }, slotBonus: 3 },
      { cost: { stone: 300, bronze_ore: 100, silver_ore: 50 }, slotBonus: 4 },
      { cost: { stone: 400, bronze_ore: 150, silver_ore: 100 }, slotBonus: 5 },
      { cost: { stone: 500, bronze_ore: 200, silver_ore: 150, gold_ore: 50 }, slotBonus: 6 },
    ],
  },
  {
    id: 'stamina', label: 'Stamina Boost', maxLevel: 5,
    levels: [
      { cost: { crystal: 1 }, staminaBonus: 5 },
      { cost: { crystal: 3 }, staminaBonus: 5 },
      { cost: { crystal: 5 }, staminaBonus: 5 },
      { cost: { crystal: 7 }, staminaBonus: 5 },
      { cost: { crystal: 10 }, staminaBonus: 5 },
    ],
  },
];

export class ResearchPanel extends BasePanel {
  private text: Phaser.GameObjects.Text;
  private selectionIndex: number = 0;
  private clickZones: Phaser.GameObjects.Zone[] = [];

  constructor(scene: Phaser.Scene) {
    super(scene);

    this.createOverlay();

    this.text = scene.add.text(960 / 2, 50, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#e8d5b7',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0);
    this.container.add(this.text);

    this.addCloseButton();
  }

  show(): void {
    this.selectionIndex = 0;
    this.render();
    this.fadeIn();
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

    const level = gameState.getResearchLevel(project.id);
    if (level >= project.maxLevel) {
      audio.playError();
      return;
    }

    const levelData = project.levels[level];
    for (const [id, qty] of Object.entries(levelData.cost)) {
      if (gameState.inventory.count(id) < qty) {
        audio.playError();
        return;
      }
    }

    for (const [id, qty] of Object.entries(levelData.cost)) {
      gameState.inventory.removeItem(id, qty);
    }

    gameState.setResearchLevel(project.id, level + 1);

    if (levelData.slotBonus) {
      gameState.inventorySlotBonus += levelData.slotBonus;
      gameState.inventory.expandSlots(levelData.slotBonus);
    }
    if (levelData.staminaBonus) {
      gameState.maxStaminaBonus += levelData.staminaBonus;
    }

    audio.playItemPickup();
    gameState.save();
    this.render();
  }

  private getLevelSummary(project: ResearchProject): string {
    let totalSlots = 0;
    let totalStamina = 0;
    for (let i = 0; i < project.maxLevel; i++) {
      totalSlots += project.levels[i].slotBonus ?? 0;
      totalStamina += project.levels[i].staminaBonus ?? 0;
    }
    if (totalSlots > 0) return `+${totalSlots} inventory slots max`;
    if (totalStamina > 0) return `+${totalStamina} max stamina max`;
    return '';
  }

  private render(): void {
    this.overlay!.clear();
    this.overlay!.fillStyle(0x0a0a1a, 0.92);
    this.overlay!.fillRect(0, 0, 960, 640);
    this.overlay!.lineStyle(1, 0x3a3a4a, 0.5);
    this.overlay!.strokeRect(40, 40, 880, 560);

    this.clickZones.forEach(z => z.destroy());
    this.clickZones = [];

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
      const level = gameState.getResearchLevel(p.id);
      const cursor = i === this.selectionIndex ? '▸' : ' ';
      const done = level >= p.maxLevel;
      const status = done ? '[MAX]' : `[${level}/${p.maxLevel}]`;

      lines.push(` ${cursor} ${p.label.padEnd(22)} ${status}`);
      lines.push(`    ${this.getLevelSummary(p)}`);

      if (!done) {
        const levelData = p.levels[level];
        const costStr = Object.entries(levelData.cost)
          .map(([id, qty]) => {
            const have = gameState.inventory.count(id);
            const color = have >= qty ? '#88dd88' : '#dd6666';
            return `${itemDisplayName(id)} ${have}/${qty}`;
          })
          .join('  ');
        const bonusStr = levelData.slotBonus ? `+${levelData.slotBonus} slots` :
          levelData.staminaBonus ? `+${levelData.staminaBonus} stamina` : '';
        lines.push(`    Cost: ${costStr}  ${bonusStr}`);
      }
      lines.push('');

      const zone = this.scene.add.zone(480, 50 + 6 * 20 + i * 80, 860, 80)
        .setDepth(210)
        .setScrollFactor(0)
        .setInteractive();
      zone.on('pointerdown', () => {
        this.selectionIndex = i;
        this.render();
        this.confirm();
      });
      this.container.add(zone);
      this.clickZones.push(zone);
    }
    lines.push('  [W/S] navigate  [SPACE] research  [ESC] close');
    this.text.setText(lines.join('\n'));
  }
}
