import Phaser from 'phaser';
import { gameState, itemDisplayName } from '../systems/GameState';
import { audio } from '../systems/AudioSystem';
import { BasePanel } from './BasePanel';
import { NineSliceBg } from './NineSliceBg';
import { UiButton } from './UiButton';
import { VW, VH, CX } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';
import { createAdaptiveText } from './AdaptiveText';
import { getInputMode } from '../systems/InputMode';

interface ResearchNode {
  id: string;
  name: string;
  description: string;
  tier: number;
  branch: 'mining' | 'combat' | 'survival';
  prereqId: string | null;
  cost: Record<string, number>;
  spriteKey: string;
  effect: { type: string; value: number };
}

function branchCols(): number[] { return [CX() - 100, CX(), CX() + 100]; }
const ROWS_Y = [100, 175, 250, 325];
const VIEWPORT_TOP = 60;
const VIEWPORT_BOTTOM = 410;

const NODES: ResearchNode[] = [
  { id: 'efficient_mining', name: 'Efficient Mining', description: 'Reduce stamina cost per mining swing by 1.', tier: 1, branch: 'mining', prereqId: null, cost: { crystal: 1, stone: 50 }, spriteKey: 'stone_ore', effect: { type: 'mining_stamina', value: 1 } },
  { id: 'combat_training', name: 'Combat Training', description: 'Deal +1 damage per hit.', tier: 1, branch: 'combat', prereqId: null, cost: { crystal: 1, stone: 50 }, spriteKey: 'item_ring_damage', effect: { type: 'bonus_damage', value: 1 } },
  { id: 'trail_rations', name: 'Trail Rations', description: '+25% effectiveness from consumables.', tier: 1, branch: 'survival', prereqId: null, cost: { crystal: 1, stone: 50 }, spriteKey: 'item_stamina_potion', effect: { type: 'consumable_mult', value: 1.25 } },
  { id: 'ore_magnet', name: 'Ore Magnet', description: '15% chance to mine double ore from a vein.', tier: 2, branch: 'mining', prereqId: 'efficient_mining', cost: { crystal: 3, bronze_ore: 10 }, spriteKey: 'bronze_ore', effect: { type: 'double_ore_chance', value: 0.15 } },
  { id: 'critical_strikes', name: 'Critical Strikes', description: '+10% critical hit chance.', tier: 2, branch: 'combat', prereqId: 'combat_training', cost: { crystal: 3, bronze_ore: 10 }, spriteKey: 'item_ring_critical', effect: { type: 'crit_chance', value: 0.1 } },
  { id: 'deep_pockets', name: 'Deep Pockets', description: 'Permanently add 8 inventory slots.', tier: 2, branch: 'survival', prereqId: 'trail_rations', cost: { crystal: 3, bronze_ore: 10 }, spriteKey: 'item_inventory_bag', effect: { type: 'slot_bonus', value: 8 } },
  { id: 'deep_core_mining', name: 'Deep Core Mining', description: 'Mine ore one tier above your current pickaxe.', tier: 3, branch: 'mining', prereqId: 'ore_magnet', cost: { crystal: 5, silver_ore: 10 }, spriteKey: 'silver_ore', effect: { type: 'mine_tier_offset', value: 1 } },
  { id: 'vitality_surge', name: 'Vitality Surge', description: '+20% maximum stamina.', tier: 3, branch: 'combat', prereqId: 'critical_strikes', cost: { crystal: 5, silver_ore: 10 }, spriteKey: 'item_boots_stamina_bronze', effect: { type: 'stamina_percent', value: 20 } },
  { id: 'lantern_efficiency', name: 'Lantern Efficiency', description: 'Extend lantern range by 1 tile.', tier: 3, branch: 'survival', prereqId: 'deep_pockets', cost: { crystal: 5, silver_ore: 10 }, spriteKey: 'item_lantern_bronze', effect: { type: 'lantern_range', value: 1 } },
  { id: 'excavation_mastery', name: 'Excavation Mastery', description: 'Halve mining animation time.', tier: 4, branch: 'mining', prereqId: 'deep_core_mining', cost: { crystal: 10, gold_ore: 5 }, spriteKey: 'gold_ore', effect: { type: 'mining_anim_speed', value: 0.5 } },
  { id: 'boss_slayer', name: 'Boss Slayer', description: '+50% damage against bosses.', tier: 4, branch: 'combat', prereqId: 'vitality_surge', cost: { crystal: 10, gold_ore: 5 }, spriteKey: 'monster_drop_ore', effect: { type: 'boss_damage_mult', value: 1.5 } },
  { id: 'second_wind', name: 'Second Wind', description: 'Recover 5 stamina when entering a new floor.', tier: 4, branch: 'survival', prereqId: 'lantern_efficiency', cost: { crystal: 10, gold_ore: 5 }, spriteKey: 'item_boots_luck_bronze', effect: { type: 'floor_stamina', value: 5 } },
];

function getNode(row: number, col: number): ResearchNode | undefined {
  return NODES[row * 3 + col];
}

export class ResearchPanel extends BasePanel {
  private focusRow: number = 0;
  private focusCol: number = 0;
  private state: 'idle' | 'prompt' = 'idle';
  private pendingNode: ResearchNode | null = null;
  private scrollY: number = 0;
  private maxScroll: number = 0;
  private readonly SCROLL_SPEED = 20;

  private scrollContainer!: Phaser.GameObjects.Container;
  private treeGfx!: Phaser.GameObjects.Graphics;
  private sprites: Phaser.GameObjects.Image[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private clickZones: Phaser.GameObjects.Zone[] = [];
  private selectionGfx!: Phaser.GameObjects.Graphics;
  private descBg!: Phaser.GameObjects.NineSlice | null;
  private descName!: Phaser.GameObjects.Text;
  private descDetail!: Phaser.GameObjects.Text;
  private descStatus!: Phaser.GameObjects.Text;
  private descSprite!: Phaser.GameObjects.Image;
  private descCost!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private promptContainer!: Phaser.GameObjects.Container;
  private promptPointerHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  private scrollbar!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    super(scene);

    this.createOverlay();

    this.scrollContainer = scene.add.container(0, 0).setDepth(205);
    this.container.add(this.scrollContainer);

    this.treeGfx = scene.add.graphics();
    this.scrollContainer.add(this.treeGfx);

    this.selectionGfx = scene.add.graphics();
    this.scrollContainer.add(this.selectionGfx);

    this.descBg = NineSliceBg.modal(scene, CX(), 460, VW() - 32, 60);
    this.descBg.setDepth(206);
    this.container.add(this.descBg);

    this.descSprite = scene.add.image(24 + 20, 440 + 28, 'stone_ore').setDepth(207).setScrollFactor(0).setScale(1.5).setVisible(false);
    this.container.add(this.descSprite);

    this.descName = createText(scene, 24 + 44, 440 + 4, '', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7', fontStyle: 'bold',
    }).setDepth(207).setScrollFactor(0);
    this.container.add(this.descName);

    this.descDetail = createText(scene, 24 + 44, 440 + 18, '', {
      fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#888899',
    }).setDepth(207).setScrollFactor(0);
    this.container.add(this.descDetail);

    this.descCost = createText(scene, 24 + 44, 440 + 34, '', {
      fontSize: fs(9), fontFamily: 'Inter', resolution: 4, color: '#888899',
    }).setDepth(207).setScrollFactor(0).setVisible(false);
    this.container.add(this.descCost);

    this.descStatus = createText(scene, CX() + 160, 440 + 6, '', {
      fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#88dd88',
    }).setDepth(207).setScrollFactor(0).setOrigin(1, 0);
    this.container.add(this.descStatus);

    this.hintText = createAdaptiveText(scene, CX(), VH() - 30, '[W/S] Scroll  [A/D] Nav  [SPACE] Research  [Click] Focus', 'Scroll & tap to research', {
      fontSize: fs(9), fontFamily: 'Inter', resolution: 4, color: '#6a5a8a',
    }).setOrigin(0.5).setDepth(207).setScrollFactor(0);
    this.container.add(this.hintText);

    this.scrollbar = scene.add.graphics().setDepth(207).setScrollFactor(0);
    this.container.add(this.scrollbar);

    this.promptContainer = scene.add.container(0, 0).setDepth(210).setScrollFactor(0).setVisible(false);
    this.container.add(this.promptContainer);

    scene.input.keyboard!.on('keydown-SPACE', () => {
      if (this.state === 'prompt' && this.pendingNode) {
        this.executeResearch(this.pendingNode);
      }
    });
    scene.input.keyboard!.on('keydown-ESC', () => {
      if (this.state === 'prompt') {
        this.state = 'idle';
        this.pendingNode = null;
        this.render();
      }
    });

    this.addCloseButton();
  }

  isPromptActive(): boolean {
    return this.state === 'prompt';
  }

  private noMatPopup: Phaser.GameObjects.Text | null = null;

  private showNoMaterials(): void {
    if (this.noMatPopup) this.noMatPopup.destroy();
    this.noMatPopup = createText(this.scene, CX(), VH() / 2 + 80, 'Not enough materials!', {
      fontSize: fs(13), color: '#ff6666',
    }).setOrigin(0.5).setDepth(250);
    this.scene.time.delayedCall(1500, () => { this.noMatPopup?.destroy(); this.noMatPopup = null; });
  }

  show(): void {
    this.focusRow = 0;
    this.focusCol = 0;
    this.state = 'idle';
    this.pendingNode = null;
    this.scrollY = 0;
    this.render();
    this.fadeIn();
  }

  navigateUp(): void {
    if (this.state !== 'idle') return;
    if (this.maxScroll > 0 && this.focusRow === 0) {
      this.scrollY = Math.max(0, this.scrollY - this.SCROLL_SPEED);
      this.scrollContainer.y = -this.scrollY;
      this.updateScrollbar();
      return;
    }
    if (this.focusRow > 0) { this.focusRow--; this.render(); }
  }

  navigateDown(): void {
    if (this.state !== 'idle') return;
    if (this.maxScroll > 0 && this.focusRow === 3) {
      this.scrollY = Math.min(this.maxScroll, this.scrollY + this.SCROLL_SPEED);
      this.scrollContainer.y = -this.scrollY;
      this.updateScrollbar();
      return;
    }
    if (this.focusRow < 3) { this.focusRow++; this.render(); }
  }

  navigateLeft(): void {
    if (this.state !== 'idle') return;
    if (this.focusCol > 0) { this.focusCol--; this.render(); }
  }

  navigateRight(): void {
    if (this.state !== 'idle') return;
    if (this.focusCol < 2) { this.focusCol++; this.render(); }
  }

  confirm(): void {
    if (this.state !== 'idle') return;
    const node = getNode(this.focusRow, this.focusCol);
    if (!node) return;

    const level = gameState.getResearchLevel(node.id);
    if (level >= 1) { audio.playError(); return; }
    if (node.prereqId && gameState.getResearchLevel(node.prereqId) < 1) { audio.playError(); return; }
    for (const [id, qty] of Object.entries(node.cost)) {
      if (gameState.inventory.count(id) < qty) { audio.playError(); this.showNoMaterials(); return; }
    }

    this.state = 'prompt';
    this.pendingNode = node;
    this.renderPrompt(node);
  }

  private renderPrompt(node: ResearchNode): void {
    this.promptContainer.removeAll(true);
    this.promptContainer.setVisible(true);

    const px = CX(), py = 340, pw = 300, ph = 160;

    const box = NineSliceBg.modal(this.scene, px, py, pw, ph);
    box.setDepth(210);
    this.promptContainer.add(box);

    const title = createText(this.scene, px, py - 48, `Research ${node.name}?`, {
      fontSize: fs(13), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.promptContainer.add(title);

    const costStr = Object.entries(node.cost)
      .map(([id, qty]) => `${qty} ${itemDisplayName(id)}`)
      .join(', ');
    const costText = createText(this.scene, px, py - 24, `Cost: ${costStr}`, {
      fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#888899',
    }).setOrigin(0.5);
    this.promptContainer.add(costText);

    const effectDesc = createText(this.scene, px, py - 4, this.effectDescription(node), {
      fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#88dd88',
    }).setOrigin(0.5);
    this.promptContainer.add(effectDesc);

    const confirmBtn = new UiButton(this.scene, px - 50, py + 36, 'Confirm', 80, 24, () => {
      this.executeResearch(node);
    }, { color: '#88ff88', fontSize: fs(11) });
    confirmBtn.setDepth(211);
    for (const c of confirmBtn.getChildren()) this.promptContainer.add(c);

    const cancelBtn = new UiButton(this.scene, px + 50, py + 36, 'Cancel', 80, 24, () => {
      this.state = 'idle';
      this.pendingNode = null;
      this.render();
    }, { color: '#b8a8d8', fontSize: fs(11) });
    cancelBtn.setDepth(211);
    for (const c of cancelBtn.getChildren()) this.promptContainer.add(c);

    this.promptPointerHandler = (pointer: Phaser.Input.Pointer) => {
      if (confirmBtn.handleClick(pointer)) return;
      if (cancelBtn.handleClick(pointer)) return;
    };
    this.scene.input.on('pointerdown', this.promptPointerHandler);
  }

  private executeResearch(node: ResearchNode): void {
    if (this.state !== 'prompt') return;

    for (const [id, qty] of Object.entries(node.cost)) {
      gameState.inventory.removeItem(id, qty);
    }
    gameState.setResearchLevel(node.id, 1);

    switch (node.effect.type) {
      case 'stamina_percent':
        gameState.staminaPercentBonus = node.effect.value;
        break;
      case 'slot_bonus':
        gameState.inventorySlotBonus += node.effect.value;
        gameState.inventory.expandSlots(node.effect.value);
        break;
    }

    audio.playItemPickup();
    gameState.save();
    this.state = 'idle';
    this.pendingNode = null;
    this.render();
  }

  private effectDescription(node: ResearchNode): string {
    switch (node.effect.type) {
      case 'mining_stamina': return `Effect: ${node.effect.value} less stamina per swing`;
      case 'double_ore_chance': return `Effect: ${Math.round(node.effect.value * 100)}% chance for double ore`;
      case 'mine_tier_offset': return `Effect: Mine ${node.effect.value} tier above pickaxe`;
      case 'mining_anim_speed': return `Effect: ${Math.round((1 - node.effect.value) * 100)}% faster mining`;
      case 'bonus_damage': return `Effect: +${node.effect.value} damage per hit`;
      case 'crit_chance': return `Effect: +${Math.round(node.effect.value * 100)}% critical hit chance`;
      case 'stamina_percent': return `Effect: +${node.effect.value}% max stamina`;
      case 'boss_damage_mult': return `Effect: +${Math.round((node.effect.value - 1) * 100)}% boss damage`;
      case 'consumable_mult': return `Effect: +${Math.round((node.effect.value - 1) * 100)}% consumable effectiveness`;
      case 'slot_bonus': return `Effect: +${node.effect.value} inventory slots`;
      case 'lantern_range': return `Effect: +${node.effect.value} tile lantern range`;
      case 'floor_stamina': return `Effect: Recover ${node.effect.value} stamina per floor`;
      default: return '';
    }
  }

  private render(): void {
    if (this.promptPointerHandler) {
      this.scene.input.off('pointerdown', this.promptPointerHandler);
      this.promptPointerHandler = null;
    }
    this.promptContainer.setVisible(false);
    this.promptContainer.removeAll(true);
    this.cleanupDynamic();

    this.drawConnectors();
    this.drawNodes();
    this.drawSelection();
    this.drawDescription();
    this.computeScroll();
    this.updateScrollbar();
    this.createClickZones();

    this.hintText.setText(this.state === 'idle'
      ? (getInputMode() !== 'keyboard' ? 'Scroll & tap to research' : '[W/S] Scroll  [A/D] Nav  [SPACE] Research  [Click] Focus')
      : (getInputMode() !== 'keyboard' ? 'Confirm  |  Cancel' : '[SPACE] Confirm  [ESC] Cancel'));
  }

  private cleanupDynamic(): void {
    for (const s of this.sprites) s.destroy();
    this.sprites = [];
    for (const l of this.labels) l.destroy();
    this.labels = [];
    for (const z of this.clickZones) z.destroy();
    this.clickZones = [];
    this.selectionGfx.clear();
    this.treeGfx.clear();
  }

  private drawConnectors(): void {
    const g = this.treeGfx;
    for (let col = 0; col < 3; col++) {
      const cx = branchCols()[col];
      g.lineStyle(1, 0x3a3a4a, 0.5);
      g.lineBetween(cx, 75, cx, ROWS_Y[0] + 20);
      for (let row = 0; row < 3; row++) {
        const node = getNode(row, col);
        const next = getNode(row + 1, col);
        if (node && next && gameState.getResearchLevel(node.id) >= 1) {
          g.lineStyle(2, 0x5a4a7a, 0.7);
        } else {
          g.lineStyle(1, 0x3a3a4a, 0.4);
        }
        g.lineBetween(cx, ROWS_Y[row] + 20, cx, ROWS_Y[row + 1]);
      }
    }

    const branchKeys = ['mining', 'combat', 'survival'];
    const branchColors = ['#e8c87a', '#e87a7a', '#7ac8e8'];
    for (let col = 0; col < 3; col++) {
      const label = createText(this.scene, branchCols()[col], 68, branchKeys[col].toUpperCase(), {
        fontSize: fs(9), fontFamily: 'Inter', resolution: 4, color: branchColors[col], fontStyle: 'bold',
      }).setOrigin(0.5);
      this.scrollContainer.add(label);
      this.sprites.push(label as unknown as Phaser.GameObjects.Image);
    }
  }

  private drawNodes(): void {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const node = getNode(row, col);
        if (!node) continue;

        const x = branchCols()[col];
        const y = ROWS_Y[row];
        const level = gameState.getResearchLevel(node.id);
        const prereqDone = !node.prereqId || gameState.getResearchLevel(node.prereqId) >= 1;

        const img = this.scene.add.image(x, y, node.spriteKey).setScale(1.5).setOrigin(0.5);
        if (!prereqDone) {
          img.setTint(0x000000);
        } else if (level < 1) {
          img.setTint(0x444444);
        }
        this.scrollContainer.add(img);
        this.sprites.push(img);

        const labelColor = !prereqDone ? '#333333' : (level >= 1 ? '#c8b898' : '#888888');
        const label = createText(this.scene, x, y + 22, node.name, {
          fontSize: fs(8), fontFamily: 'Inter', resolution: 4, color: labelColor, align: 'center',
        }).setOrigin(0.5, 0);
        this.scrollContainer.add(label);
        this.labels.push(label);
      }
    }
  }

  private drawSelection(): void {
    const x = branchCols()[this.focusCol];
    const y = ROWS_Y[this.focusRow];
    this.selectionGfx.lineStyle(2, 0xffffff, 0.8);
    this.selectionGfx.strokeRect(x - 18, y - 18, 36, 36);
    this.selectionGfx.lineStyle(1, 0xffffff, 0.3);
    this.selectionGfx.strokeRect(x - 22, y - 22, 44, 44);
  }

  private drawDescription(): void {
    const node = getNode(this.focusRow, this.focusCol);
    if (!node) return;

    const level = gameState.getResearchLevel(node.id);
    const prereqDone = !node.prereqId || gameState.getResearchLevel(node.prereqId) >= 1;

    const bw = VW() - 32, bh = 60;
    NineSliceBg.updateSize(this.descBg, bw, bh);
    this.descBg!.setPosition(CX(), 460);

    this.descSprite.setTexture(node.spriteKey).setVisible(true).clearTint();
    if (!prereqDone) {
      this.descSprite.setTint(0x000000);
    } else if (level < 1) {
      this.descSprite.setTint(0x444444);
    }

    this.descName.setText(node.name);
    this.descDetail.setVisible(true);
    this.descCost.setVisible(true);
    this.descDetail.setText(node.description);
    if (level >= 1) {
      this.descName.setColor('#88ff88');
      this.descDetail.setColor('#669966');
      this.descCost.setVisible(false);
      this.descStatus.setText('UNLOCKED');
      this.descStatus.setColor('#88ff88');
    } else if (!prereqDone) {
      this.descName.setColor('#666666');
      this.descDetail.setColor('#555555');
      this.descCost.setVisible(false);
      this.descStatus.setText('LOCKED');
      this.descStatus.setColor('#666666');
    } else {
      this.descName.setColor('#e8d5b7');
      this.descDetail.setColor('#888899');
      const costStr = Object.entries(node.cost)
        .map(([id, qty]) => {
          const have = gameState.inventory.count(id);
          const color = have >= qty ? '#88dd88' : '#dd6666';
          return `${itemDisplayName(id)} ${have}/${qty}`;
        }).join('  ');
      const canAfford = Object.entries(node.cost).every(([id, qty]) => gameState.inventory.count(id) >= qty);
      this.descCost.setText(`Cost: ${costStr}`);
      this.descCost.setColor(canAfford ? '#888899' : '#dd6666');
      this.descStatus.setText(canAfford ? 'AVAILABLE' : 'INSUFFICIENT');
      this.descStatus.setColor(canAfford ? '#88dd88' : '#dd6666');
    }
  }

  private computeScroll(): void {
    const contentBottom = ROWS_Y[3] + 20 + 16;
    const viewH = VIEWPORT_BOTTOM - VIEWPORT_TOP;
    this.maxScroll = Math.max(0, contentBottom - viewH);
    if (this.scrollY > this.maxScroll) this.scrollY = this.maxScroll;
  }

  private updateScrollbar(): void {
    this.scrollbar.clear();
    if (this.maxScroll <= 0) return;
    const vh = VIEWPORT_BOTTOM - VIEWPORT_TOP;
    const barH = Math.max(16, vh * (vh / (vh + this.maxScroll)));
    const barY = VIEWPORT_TOP + (this.scrollY / this.maxScroll) * (vh - barH);
    this.scrollbar.fillStyle(0x5a5a7a, 0.5);
    this.scrollbar.fillRoundedRect(VW() - 6, barY, 3, barH, 2);
  }

  private createClickZones(): void {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        if (!getNode(row, col)) continue;
        const x = branchCols()[col];
        const y = ROWS_Y[row];
        const zone = this.scene.add.zone(x, y, 44, 44)
          .setDepth(210)
          .setScrollFactor(0)
          .setInteractive();
        zone.on('pointerdown', () => {
          if (this.state !== 'idle') return;
          if (this.focusRow === row && this.focusCol === col) {
            this.confirm();
          } else {
            this.focusRow = row;
            this.focusCol = col;
            this.render();
          }
        });
        this.clickZones.push(zone);
        this.container.add(zone);
      }
    }
  }

  hide(): void {
    if (this.promptPointerHandler) {
      this.scene.input.off('pointerdown', this.promptPointerHandler);
      this.promptPointerHandler = null;
    }
    this.state = 'idle';
    this.pendingNode = null;
    super.hide();
  }

  /**
   * show() already calls render() fresh (which reads branchCols()/CX() live),
   * so re-showing after a resize is already correct. Only the handful of
   * elements positioned once in the constructor from CX()/VH() need an
   * explicit reposition here.
   */
  onViewportResize(): void {
    super.onViewportResize();
    this.descStatus.setPosition(CX() + 160, 440 + 6);
    this.hintText.setPosition(CX(), VH() - 30);
    if (this._visible) this.render();
  }

  destroy(): void {
    if (this.promptPointerHandler) {
      this.scene.input.off('pointerdown', this.promptPointerHandler);
      this.promptPointerHandler = null;
    }
    this.cleanupDynamic();
    super.destroy();
  }
}
