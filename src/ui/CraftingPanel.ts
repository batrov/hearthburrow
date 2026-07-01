import Phaser from 'phaser';
import { gameState, itemDisplayName, itemIconKey } from '../systems/GameState';
import { getRecipe } from '../systems/DataRegistry';
import { audio } from '../systems/AudioSystem';
import { BasePanel } from './BasePanel';
import { VW, VH, CX } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';

const RECIPE_INFO: Record<string, { desc: string; unlock?: string }> = {
  pickaxe_2: { desc: 'Bronze Pickaxe — 5 runs, mines bronze ore' },
  pickaxe_3: { desc: 'Silver Pickaxe — 5 runs, mines silver ore', unlock: 'Mine silver ore' },
  pickaxe_4: { desc: 'Gold Pickaxe — 5 runs, mines gold ore', unlock: 'Mine gold ore' },
  stamina_potion: { desc: 'Restores 50 stamina during expedition', unlock: 'Defeat the boss on floor 4' },
  teleport_scroll: { desc: 'Emergency teleport back to homeland', unlock: 'Exhaust yourself 3 times' },
  mining_bomb: { desc: 'Destroys surrounding walls instantly', unlock: 'Unlocked via events' },
  ring_critical: { desc: 'Chance to deal double damage in combat', unlock: 'Defeat 3 slimes' },
  ring_damage: { desc: '+1 base damage in combat', unlock: 'Defeat 3 rats' },
  ring_precision: { desc: 'Wider hit zone in combat', unlock: 'Defeat 3 bats' },
  ring_hunter: { desc: 'Combines crit + damage bonuses', unlock: 'Defeat 3 of each monster' },
  boots_stamina_bronze: { desc: '+10 max stamina for 5 expeditions', unlock: 'Reach floor 3 (dark)' },
  boots_stamina_silver: { desc: '+20 max stamina for 5 expeditions', unlock: 'Craft bronze version first' },
  boots_stamina_gold: { desc: '+30 max stamina for 5 expeditions', unlock: 'Craft silver version first' },
  boots_luck_bronze: { desc: '10% double-drop chance for 5 expeditions', unlock: 'Reach floor 3 (dark)' },
  boots_luck_silver: { desc: '25% double-drop chance for 5 expeditions', unlock: 'Craft bronze version first' },
  boots_luck_gold: { desc: '40% double-drop chance for 5 expeditions', unlock: 'Craft silver version first' },
  boots_regen: { desc: '+1 stamina per 5 rocks broken for 5 expeditions', unlock: 'Reach floor 8 (dark)' },
  lantern_bronze: { desc: '+60px light radius for 5 expeditions', unlock: 'Reach floor 3 (dark)' },
  lantern_silver: { desc: '+60px light radius for 5 expeditions', unlock: 'Craft bronze version first' },
  lantern_gold: { desc: '+60px light radius for 5 expeditions', unlock: 'Craft silver version first' },
  miners_potion: { desc: 'Permanently +5 max stamina (consumed on craft)', unlock: 'Rescue a villager and talk to them at the Tavern' },
};

function cardW(): number { return VW() - 40; }
const CARD_H = 86;
const CARD_GAP = 6;
const CARD_X = 20;
const LIST_TOP = 72;
function listBtm(): number { return VH() - 96; }
const SCROLL_SPEED = 28;

type CardState = 'canCraft' | 'craftedBefore' | 'discovered' | 'undiscovered';

const CARD_FILL: Record<CardState, number> = {
  canCraft: 0x1a2a1a,
  craftedBefore: 0x1a222a,
  discovered: 0x1a1a2a,
  undiscovered: 0x0a0a1a,
};

const CARD_BORDER: Record<CardState, number> = {
  canCraft: 0x44cc66,
  craftedBefore: 0x4488aa,
  discovered: 0x6a5a8a,
  undiscovered: 0x3a3a4a,
};

const CARD_NAME_COLOR: Record<CardState, string> = {
  canCraft: '#e8d5b7',
  craftedBefore: '#8ab0d0',
  discovered: '#8a9aaa',
  undiscovered: '#6a7a9a',
};

export class CraftingPanel extends BasePanel {
  private titleText: Phaser.GameObjects.Text;
  private recipeLines: Phaser.GameObjects.Container;
  private hintText: Phaser.GameObjects.Text;
  private descriptionText: Phaser.GameObjects.Text;
  private scrollbarGfx: Phaser.GameObjects.Graphics;

  private recipes: { id: string; name: string }[] = [];
  private selectedIndex: number = 0;
  private scrollOffset: number = 0;
  private maxScroll: number = 0;

  private cardContainers: Phaser.GameObjects.Container[] = [];
  private cardBgs: Phaser.GameObjects.Graphics[] = [];

  private pointerStartY: number = 0;
  private pointerStartScroll: number = 0;
  private isPointerDown: boolean = false;
  private pointerMoved: boolean = false;

  constructor(scene: Phaser.Scene) {
    super(scene);

    this.createOverlay();

    this.titleText = createText(scene, CX(), 36, 'Crafting Station', {
      fontSize: fs(18), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.recipeLines = scene.add.container(0, 0);
    this.container.add(this.recipeLines);

    this.scrollbarGfx = scene.add.graphics();
    this.container.add(this.scrollbarGfx);

    this.descriptionText = createText(scene, CX(), VH() - 70, '', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#b8a898',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.descriptionText);

    this.hintText = createText(scene, CX(), VH() - 44, '[W/S] Select  [SPACE] Craft  [ESC] Close', {
      fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#5a4a6a',
    }).setOrigin(0.5);
    this.container.add(this.hintText);

    this.addCloseButton();
  }

  show(): void {
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.isPointerDown = false;
    this.refresh();
    this.fadeIn();
    this.scene.input.on('pointerdown', this.onPointerDown, this);
    this.scene.input.on('pointermove', this.onPointerMove, this);
    this.scene.input.on('pointerup', this.onPointerUp, this);
    this.scene.input.on('wheel', this.onWheel, this);
  }

  hide(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('wheel', this.onWheel, this);
    this.fadeOut();
  }

  navigateUp(): void {
    if (this.recipes.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.recipes.length) % this.recipes.length;
    this.ensureVisible();
    this.syncContent();
  }

  navigateDown(): void {
    if (this.recipes.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.recipes.length;
    this.ensureVisible();
    this.syncContent();
  }

  craftSelected(): boolean {
    if (this.recipes.length === 0) {
      audio.playError();
      this.showNoCraft();
      return false;
    }
    const recipe = this.recipes[this.selectedIndex];
    if (!gameState.crafting.isDiscovered(recipe.id)) {
      audio.playError();
      const info = RECIPE_INFO[recipe.id];
      this.showHowToUnlock(info?.unlock ?? 'Unknown discovery method');
      return false;
    }
    if (!gameState.crafting.canCraft(recipe.id)) {
      audio.playError();
      this.showNoCraft();
      return false;
    }
    gameState.crafting.craft(recipe.id);
    audio.playItemPickup();
    this.refresh();
    this.showCraftSuccess(recipe.id);
    return true;
  }

  refresh(): void {
    const pad = 16;
    this.overlay.clear();
    this.overlay.fillStyle(0x0a0a1a, 0.88);
    this.overlay.fillRect(0, 0, VW(), VH());
    this.overlay.lineStyle(1, 0x3a3a4a, 0.5);
    this.overlay.strokeRect(pad, 60, VW() - pad * 2, VH() - 60 - pad);

    const discovered = gameState.crafting.getDiscoveredRecipes();
    const undiscovered = gameState.crafting.getUndiscoveredRecipes();
    this.recipes = [
      ...discovered.map(r => ({ id: r.id, name: itemDisplayName(r.result) })),
      ...undiscovered.map(r => ({ id: r.id, name: '???' })),
    ];

    if (this.selectedIndex >= this.recipes.length) {
      this.selectedIndex = 0;
    }

    this.rebuildCards();
    this.maxScroll = Math.max(0, this.recipes.length * (CARD_H + CARD_GAP) - (listBtm() - LIST_TOP));
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, this.maxScroll);
    this.syncContent();
  }

  private getCardState(i: number): CardState {
    const r = this.recipes[i];
    if (!gameState.crafting.isDiscovered(r.id)) return 'undiscovered';
    const recipe = getRecipe(r.id);
    if (!recipe) return 'discovered';
    if (gameState.crafting.canCraft(r.id)) return 'canCraft';
    if (gameState.hasCraftedItem(recipe.result)) return 'craftedBefore';
    return 'discovered';
  }

  private rebuildCards(): void {
    this.cardContainers.forEach(c => c.destroy());
    this.cardContainers = [];
    this.cardBgs = [];

    for (let i = 0; i < this.recipes.length; i++) {
      this.createCard(i);
    }
  }

  private createCard(i: number): void {
    const r = this.recipes[i];
    const discovered = gameState.crafting.isDiscovered(r.id);
    const recipe = discovered ? getRecipe(r.id) : null;
    const state = this.getCardState(i);
    const isSelected = i === this.selectedIndex;
    const cy = LIST_TOP + i * (CARD_H + CARD_GAP);

    const card = this.scene.add.container(CARD_X, cy);

    const bg = this.scene.add.graphics();
    this.drawCardBg(bg, state, isSelected);
    card.add(bg);

    if (discovered && recipe) {
      const iconKey = itemIconKey(recipe.result);
      if (this.scene.textures.exists(iconKey)) {
        const icon = this.scene.add.image(28, 26, iconKey).setScale(0.65);
        card.add(icon);
      }
    } else {
      const placeholder = createText(this.scene, 28, 26, '?', {
        fontSize: fs(20), fontFamily: 'Inter', resolution: 4, color: '#5a6a7a',
      }).setOrigin(0.5);
      card.add(placeholder);
    }

    const nameColor = CARD_NAME_COLOR[state];
    const nameStr = discovered ? r.name : '???';
    const nameText = createText(this.scene, 56, 14, nameStr, {
      fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: nameColor, fontStyle: 'bold',
    });
    card.add(nameText);

    let indicator = '';
    let indColor = '';
    if (state === 'canCraft') { indicator = '✓'; indColor = '#44cc66'; }
    else if (state === 'craftedBefore') { indicator = 'C'; indColor = '#4488aa'; }
    else if (!discovered) { indicator = '?'; indColor = '#6a7a9a'; }

    if (indicator) {
      const ind = createText(this.scene, cardW() - 12, 14, indicator, {
        fontSize: fs(12), fontFamily: 'Inter', resolution: 4, color: indColor, fontStyle: 'bold',
      }).setOrigin(1, 0);
      card.add(ind);
    }

    if (discovered && recipe) {
      const ings = Object.entries(recipe.ingredients);
      for (let mi = 0; mi < ings.length && mi < 3; mi++) {
        const [matId, need] = ings[mi];
        const have = gameState.inventory.count(matId);
        const sufficient = have >= need;
        const matColor = sufficient ? '#b8b8b8' : '#cc6644';
        const matText = createText(this.scene, 56, 42 + mi * 14,
          `\u2022 ${itemDisplayName(matId).padEnd(17)} ${String(have).padStart(2)}/${need}${sufficient ? ' \u2714' : ''}`, {
          fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: matColor,
        });
        card.add(matText);
      }
    } else {
      const info = RECIPE_INFO[r.id];
      if (info?.unlock) {
        const hint = createText(this.scene, 56, 42, `(Unlock: ${info.unlock})`, {
          fontSize: fs(10), fontFamily: 'Inter', resolution: 4, color: '#5a6a7a',
        });
        card.add(hint);
      }
    }

    this.recipeLines.add(card);
    this.cardContainers.push(card);
    this.cardBgs.push(bg);
  }

  private drawCardBg(bg: Phaser.GameObjects.Graphics, state: CardState, selected: boolean): void {
    const fill = CARD_FILL[state];
    const border = CARD_BORDER[state];
    const bw = selected ? 2 : 1;

    bg.fillStyle(fill, 1);
    bg.fillRoundedRect(0, 0, cardW(), CARD_H, 6);
    bg.lineStyle(bw, border, 0.8);
    bg.strokeRoundedRect(0, 0, cardW(), CARD_H, 6);

    if (selected) {
      bg.fillStyle(border, 0.4);
      bg.fillRect(0, 0, 4, CARD_H);
    }
  }

  private ensureVisible(): void {
    const cardTop = this.selectedIndex * (CARD_H + CARD_GAP);
    const cardBottom = cardTop + CARD_H;
    const viewTop = this.scrollOffset;
    const viewBottom = this.scrollOffset + (listBtm() - LIST_TOP);

    if (cardTop < viewTop) {
      this.scrollOffset = cardTop;
    } else if (cardBottom > viewBottom) {
      this.scrollOffset = cardBottom - (listBtm() - LIST_TOP);
    }

    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, this.maxScroll);
  }

  private syncContent(): void {
    this.recipeLines.y = -this.scrollOffset;
    this.updateCardHighlights();
    this.updateScrollbar();
    this.updateDescription();
  }

  private updateCardHighlights(): void {
    for (let i = 0; i < this.cardBgs.length; i++) {
      const bg = this.cardBgs[i];
      bg.clear();
      this.drawCardBg(bg, this.getCardState(i), i === this.selectedIndex);
    }
  }

  private updateScrollbar(): void {
    this.scrollbarGfx.clear();
    if (this.maxScroll <= 0) return;

    const sbX = VW() - 20;
    const sbY = LIST_TOP;
    const sbH = listBtm() - LIST_TOP;
    const barH = Math.max(12, sbH * (sbH / (sbH + this.maxScroll)));
    const barY = sbY + (this.scrollOffset / this.maxScroll) * (sbH - barH);

    this.scrollbarGfx.fillStyle(0x5a5a7a, 0.5);
    this.scrollbarGfx.fillRoundedRect(sbX, barY, 4, barH, 2);
  }

  private updateDescription(): void {
    if (this.recipes.length > 0 && this.selectedIndex < this.recipes.length) {
      const selectedId = this.recipes[this.selectedIndex].id;
      const disc = gameState.crafting.isDiscovered(selectedId);
      const info = RECIPE_INFO[selectedId];
      if (info) {
        if (disc) {
          this.descriptionText.setText(info.desc);
          this.descriptionText.setColor('#b8a898');
        } else {
          this.descriptionText.setText(`??? \u2014 ${info.unlock ?? 'Unknown discovery method'}`);
          this.descriptionText.setColor('#aa8844');
        }
      } else {
        this.descriptionText.setText('');
      }
    } else {
      this.descriptionText.setText('');
    }
  }

  private doScroll(dy: number): void {
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + dy, 0, this.maxScroll);
    this.recipeLines.y = -this.scrollOffset;
    this.updateScrollbar();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.x < 16 || pointer.x > VW() - 16) return;
    if (pointer.y < LIST_TOP || pointer.y > listBtm()) return;

    this.pointerStartY = pointer.y;
    this.pointerStartScroll = this.scrollOffset;
    this.isPointerDown = true;
    this.pointerMoved = false;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isPointerDown) return;

    const dy = pointer.y - this.pointerStartY;
    if (Math.abs(dy) > 5) {
      this.pointerMoved = true;
      this.doScroll(this.pointerStartScroll - dy - this.scrollOffset);
    }
  }

  private onPointerUp(_pointer: Phaser.Input.Pointer): void {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;

    if (this.pointerMoved) return;

    const adjustedY = _pointer.y - LIST_TOP + this.scrollOffset;
    const index = Math.floor(adjustedY / (CARD_H + CARD_GAP));

    if (index < 0 || index >= this.recipes.length) return;

    if (index === this.selectedIndex) {
      this.craftSelected();
    } else {
      this.selectedIndex = index;
      this.ensureVisible();
      this.syncContent();
    }
  }

  private onWheel(_pointer: Phaser.Input.Pointer, _gx: number[], _gy: number[], _gz: number[], dz: number): void {
    this.doScroll(dz > 0 ? SCROLL_SPEED : -SCROLL_SPEED);
  }

  private showCraftSuccess(itemId: string): void {
    const popup = createText(this.scene, 
      CX(), VH() / 2,
      `Crafted: ${itemDisplayName(itemId)}`,
      { fontSize: fs(16), fontFamily: 'Inter', resolution: 4, color: '#44cc66', fontStyle: 'bold' }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(250);

    this.scene.tweens.add({
      targets: popup,
      y: popup.y - 60,
      alpha: 0,
      scale: { from: 1.2, to: 0.9 },
      duration: 1200,
      ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }

  private showNoCraft(): void {
    const popup = createText(this.scene, 
      CX(), VH() / 2,
      'No craftable recipe \u2014 need more materials!',
      { fontSize: fs(14), fontFamily: 'Inter', resolution: 4, color: '#cc6644' }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(250);

    this.scene.tweens.add({
      targets: popup,
      y: popup.y - 40,
      alpha: 0,
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }

  private showHowToUnlock(hint: string): void {
    const popup = createText(this.scene, 
      CX(), VH() / 2,
      `??? \u2014 ${hint}`,
      { fontSize: fs(14), fontFamily: 'Inter', resolution: 4, color: '#aa8844' }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(250);

    this.scene.tweens.add({
      targets: popup,
      y: popup.y - 40,
      alpha: 0,
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });
  }

  /** refresh() (called by show()) already redraws overlay/cards live from
   * cardW()/listBtm()/VW()/VH(); only the constructor-positioned texts need
   * an explicit reposition here. */
  onViewportResize(): void {
    super.onViewportResize();
    this.titleText.setPosition(CX(), 36);
    this.descriptionText.setPosition(CX(), VH() - 70);
    this.hintText.setPosition(CX(), VH() - 44);
    if (this._visible) this.refresh();
  }
}
