import Phaser from 'phaser';
import { itemIconKey, itemDisplayName } from '../systems/GameState';
import { VW, VH, CX, CY } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';
import { NineSliceBg } from './NineSliceBg';
import { UiButton } from './UiButton';

export class ConsumablePicker {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private visible = false;
  private consumableId = '';
  private currentQty = 0;
  private maxQty = 0;
  private onConfirmCb: ((id: string, qty: number) => void) | null = null;

  private overlay: Phaser.GameObjects.NineSlice;
  private blocker: Phaser.GameObjects.Rectangle;
  private popupBg!: Phaser.GameObjects.NineSlice;
  private icon: Phaser.GameObjects.Image;
  private nameText: Phaser.GameObjects.Text;
  private descText: Phaser.GameObjects.Text;
  private stashText: Phaser.GameObjects.Text;
  private qtyText: Phaser.GameObjects.Text;
  private minusBtn: UiButton;
  private plusBtn: UiButton;
  private footerText: Phaser.GameObjects.Text;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((p: Phaser.Input.Pointer) => void) | null = null;
  private destroyed = false;

  private readonly DESC_MAP: Record<string, string> = {
    stamina_potion: 'Restores +30 stamina during expedition.',
    teleport_scroll: 'Teleports you home safely — keeps all items.',
    mining_bomb: 'Breaks all minable tiles in an 8-tile area.',
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(250).setScrollFactor(0).setVisible(false);

    this.overlay = NineSliceBg.panel(this.scene, CX(), CY(), VW(), VH());
    this.overlay.setDepth(249);
    this.container.add(this.overlay);

    this.blocker = scene.add.rectangle(CX(), VH() / 2, VW(), VH(), 0x000000, 0)
      .setScrollFactor(0)
      .setInteractive();
    this.blocker.on('pointerdown', () => {});
    this.container.add(this.blocker);

    this.minusBtn = new UiButton(scene, CX() - 60, 370, '\u2212', 44, 36, () => { this.adjustQty(-1); }, {
      color: '#cc8888', fontSize: fs(22),
    });
    for (const child of this.minusBtn.getChildren()) this.container.add(child);

    this.plusBtn = new UiButton(scene, CX() + 60, 370, '+', 44, 36, () => { this.adjustQty(1); }, {
      color: '#88cc88', fontSize: fs(22),
    });
    for (const child of this.plusBtn.getChildren()) this.container.add(child);

    this.icon = scene.add.image(CX(), 220, 'item_stamina_potion').setScale(2);
    this.container.add(this.icon);

    this.nameText = createText(scene, CX(), 268, '', {
      fontSize: fs(16), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.nameText);

    this.descText = createText(scene, CX(), 296, '', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#b8a898',
    }).setOrigin(0.5);
    this.container.add(this.descText);

    this.stashText = createText(scene, CX(), 326, '', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#888888',
    }).setOrigin(0.5);
    this.container.add(this.stashText);

    this.qtyText = createText(scene, CX(), 370, '', {
      fontSize: fs(24), fontFamily: 'Inter', resolution: 4, color: '#ffddaa',
    }).setOrigin(0.5);
    this.container.add(this.qtyText);

    this.footerText = createText(scene, CX(), 440, '[← →] adjust  [SPACE] confirm  [ESC] cancel', {
      fontSize: fs(11), fontFamily: 'Inter', resolution: 4, color: '#8a7a9a',
    }).setOrigin(0.5);
    this.container.add(this.footerText);
  }

  show(
    consumableId: string,
    currentQty: number,
    maxQty: number,
    onConfirm: (id: string, qty: number) => void,
  ): void {
    this.consumableId = consumableId;
    this.currentQty = currentQty;
    this.maxQty = maxQty;
    this.onConfirmCb = onConfirm;

    this.keyHandler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft': case 'a': e.preventDefault(); this.adjustQty(-1); break;
        case 'ArrowRight': case 'd': e.preventDefault(); this.adjustQty(1); break;
        case ' ': case 'Enter': e.preventDefault(); this.confirm(); break;
        case 'Escape': e.preventDefault(); this.confirm(); break;
      }
    };
    this.scene.input.keyboard!.on('keydown', this.keyHandler);

    this.clickHandler = (p: Phaser.Input.Pointer) => {
      const popH = 310;
      const popY = Math.floor((VH() - popH) / 2);
      const insidePopup = p.x >= CX() - 150 && p.x <= CX() + 150 && p.y >= popY && p.y <= popY + popH;
      if (!insidePopup) {
        this.confirm();
        return;
      }
      if (this.minusBtn.handleClick(p)) return;
      if (this.plusBtn.handleClick(p)) return;
    };
    this.scene.input.on('pointerdown', this.clickHandler);

    this.render();
    this.container.setAlpha(0).setVisible(true);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 120,
      ease: 'Quad.easeOut',
    });
    this.visible = true;
  }

  private render(): void {
    const popH = 310;
    const popY = Math.floor((VH() - popH) / 2);
    const popCx = CX();
    const popCy = popY + popH / 2;

    this.popupBg = NineSliceBg.modal(this.scene, popCx, popCy, 320, popH);
    this.popupBg.setDepth(249);
    this.container.addAt(this.popupBg, 2);

    const iconKey = itemIconKey(this.consumableId);
    if (this.scene.textures.exists(iconKey)) {
      this.icon.setTexture(iconKey);
    }
    this.icon.setPosition(CX(), popY + 55);

    this.nameText.setText(itemDisplayName(this.consumableId));
    this.nameText.setPosition(CX(), popY + 100);

    this.descText.setText(this.DESC_MAP[this.consumableId] ?? '');
    this.descText.setPosition(CX(), popY + 128);

    this.stashText.setText(`In stash: ${this.maxQty}`);
    this.stashText.setPosition(CX(), popY + 155);

    this.qtyText.setText(`${this.currentQty}`);
    this.qtyText.setPosition(CX(), popY + 198);

    this.minusBtn.setPosition(CX() - 60, popY + 198);
    this.minusBtn.setEnabled(this.currentQty > 0);

    this.plusBtn.setPosition(CX() + 60, popY + 198);
    this.plusBtn.setEnabled(this.currentQty < this.maxQty);

    this.footerText.setPosition(CX(), popY + popH - 18);
  }

  private adjustQty(delta: number): void {
    const newQty = this.currentQty + delta;
    if (newQty >= 0 && newQty <= this.maxQty) {
      this.currentQty = newQty;
      this.render();
    }
  }

  private confirm(): void {
    this.onConfirmCb?.(this.consumableId, this.currentQty);
    this.hide();
  }

  hide(): void {
    if (!this.visible) return;
    if (this.keyHandler) {
      this.scene.input.keyboard!.off('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.clickHandler) {
      this.scene.input.off('pointerdown', this.clickHandler);
      this.clickHandler = null;
    }
    if (this.popupBg) {
      this.popupBg.destroy();
      (this.popupBg as unknown) = undefined;
    }
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 100,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.container.setVisible(false);
        this.visible = false;
      },
    });
  }

  isVisible(): boolean { return this.visible; }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.hide();
    this.container.destroy(true);
  }
}
