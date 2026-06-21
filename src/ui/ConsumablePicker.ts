import Phaser from 'phaser';
import { itemIconKey, itemDisplayName } from '../systems/GameState';

export class ConsumablePicker {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private visible = false;
  private consumableId = '';
  private currentQty = 0;
  private maxQty = 0;
  private onConfirmCb: ((id: string, qty: number) => void) | null = null;
  private onCancelCb: (() => void) | null = null;

  private overlay: Phaser.GameObjects.Graphics;
  private blocker: Phaser.GameObjects.Rectangle;
  private popupBg: Phaser.GameObjects.Graphics;
  private icon: Phaser.GameObjects.Image;
  private nameText: Phaser.GameObjects.Text;
  private descText: Phaser.GameObjects.Text;
  private stashText: Phaser.GameObjects.Text;
  private qtyText: Phaser.GameObjects.Text;
  private minusBtn: Phaser.GameObjects.Text;
  private plusBtn: Phaser.GameObjects.Text;
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

    this.overlay = scene.add.graphics();
    this.overlay.fillStyle(0x000000, 0.55);
    this.overlay.fillRect(0, 0, 960, 640);
    this.container.add(this.overlay);

    this.blocker = scene.add.rectangle(480, 320, 960, 640, 0x000000, 0)
      .setScrollFactor(0)
      .setInteractive();
    this.blocker.on('pointerdown', () => {});
    this.container.add(this.blocker);

    this.popupBg = scene.add.graphics();
    this.container.add(this.popupBg);

    this.icon = scene.add.image(480, 220, 'item_stamina_potion').setScale(2.5);
    this.container.add(this.icon);

    this.nameText = scene.add.text(480, 268, '', {
      fontSize: '20px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.nameText);

    this.descText = scene.add.text(480, 296, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#b8a898',
    }).setOrigin(0.5);
    this.container.add(this.descText);

    this.stashText = scene.add.text(480, 326, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5);
    this.container.add(this.stashText);

    this.qtyText = scene.add.text(480, 370, '', {
      fontSize: '28px', fontFamily: 'monospace', color: '#ffddaa',
    }).setOrigin(0.5);
    this.container.add(this.qtyText);

    this.minusBtn = scene.add.text(400, 370, '[−]', {
      fontSize: '24px', fontFamily: 'monospace', color: '#cc8888',
    }).setOrigin(0.5);
    this.container.add(this.minusBtn);

    this.plusBtn = scene.add.text(560, 370, '[+]', {
      fontSize: '24px', fontFamily: 'monospace', color: '#88cc88',
    }).setOrigin(0.5);
    this.container.add(this.plusBtn);

    this.footerText = scene.add.text(480, 440, '[← →] adjust  [SPACE] confirm  [ESC] cancel', {
      fontSize: '14px', fontFamily: 'monospace', color: '#8a7a9a',
    }).setOrigin(0.5);
    this.container.add(this.footerText);
  }

  show(
    consumableId: string,
    currentQty: number,
    maxQty: number,
    onConfirm: (id: string, qty: number) => void,
    onCancel?: () => void,
  ): void {
    this.consumableId = consumableId;
    this.currentQty = currentQty;
    this.maxQty = maxQty;
    this.onConfirmCb = onConfirm;
    this.onCancelCb = onCancel ?? null;

    this.keyHandler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft': case 'a': e.preventDefault(); this.adjustQty(-1); break;
        case 'ArrowRight': case 'd': e.preventDefault(); this.adjustQty(1); break;
        case ' ': case 'Enter': e.preventDefault(); this.confirm(); break;
        case 'Escape': this.hide(); break;
      }
    };
    this.scene.input.keyboard!.on('keydown', this.keyHandler);

    this.clickHandler = (p: Phaser.Input.Pointer) => {
      const popH = 310;
      const popY = Math.floor((640 - popH) / 2);
      const insidePopup = p.x >= 300 && p.x <= 660 && p.y >= popY && p.y <= popY + popH;
      if (!insidePopup) {
        this.hide();
        return;
      }
      const btnY = popY + 198;
      const hw = 24, hh = 18;
      if (p.x >= 390 - hw && p.x <= 390 + hw && p.y >= btnY - hh && p.y <= btnY + hh) {
        this.adjustQty(-1);
      } else if (p.x >= 570 - hw && p.x <= 570 + hw && p.y >= btnY - hh && p.y <= btnY + hh) {
        this.adjustQty(1);
      }
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
    const popY = Math.floor((640 - popH) / 2);

    this.popupBg.clear();
    this.popupBg.fillStyle(0x0a0a1a, 0.95);
    this.popupBg.fillRoundedRect(300, popY, 360, popH, 10);
    this.popupBg.lineStyle(2, 0x6a5a8a);
    this.popupBg.strokeRoundedRect(300, popY, 360, popH, 10);

    const iconKey = itemIconKey(this.consumableId);
    if (this.scene.textures.exists(iconKey)) {
      this.icon.setTexture(iconKey);
    }
    this.icon.setPosition(480, popY + 55);

    this.nameText.setText(itemDisplayName(this.consumableId));
    this.nameText.setPosition(480, popY + 100);

    this.descText.setText(this.DESC_MAP[this.consumableId] ?? '');
    this.descText.setPosition(480, popY + 128);

    this.stashText.setText(`In stash: ${this.maxQty}`);
    this.stashText.setPosition(480, popY + 155);

    this.qtyText.setText(`${this.currentQty}`);
    this.qtyText.setPosition(480, popY + 198);

    this.minusBtn.setPosition(390, popY + 198);
    this.minusBtn.setAlpha(this.currentQty <= 0 ? 0.3 : 1);

    this.plusBtn.setPosition(570, popY + 198);
    this.plusBtn.setAlpha(this.currentQty >= this.maxQty ? 0.3 : 1);

    this.footerText.setPosition(480, popY + popH - 18);
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
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 100,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.container.setVisible(false);
        this.visible = false;
        this.onCancelCb?.();
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
