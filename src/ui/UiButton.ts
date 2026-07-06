import Phaser from 'phaser';
import { NineSliceBg } from './NineSliceBg';
import { createText } from '../systems/Font';

export interface ButtonStyle {
  fontSize?: string;
  color?: string;
  small?: boolean;
}

export class UiButton {
  readonly scene: Phaser.Scene;
  readonly bg: Phaser.GameObjects.NineSlice;
  readonly label: Phaser.GameObjects.Text;
  readonly hitZone: Phaser.GameObjects.Rectangle;

  private _callback: () => void;
  private _enabled: boolean = true;
  private _hovered: boolean = false;
  private _pressed: boolean = false;
  private _selected: boolean = false;
  private _width: number;
  private _height: number;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    text: string,
    width: number, height: number,
    onClick: () => void,
    style?: ButtonStyle,
  ) {
    this.scene = scene;
    this._callback = onClick;
    this._width = width;
    this._height = height;

    if (style?.small) {
      this.bg = NineSliceBg.btnSmall(scene, x, y, width, height);
    } else {
      this.bg = NineSliceBg.btn(scene, x, y, width, height);
    }

    this.label = createText(scene, x, y, text, {
      fontSize: style?.fontSize || '12px',
      fontFamily: 'Inter',
      resolution: 4,
      color: style?.color || '#b8a898',
    }).setOrigin(0.5);

    this.hitZone = scene.add.rectangle(x, y, width, height, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
  }

  /** Call from the panel's scene-level pointerdown handler. Returns true if the click was consumed. */
  handleClick(pointer: Phaser.Input.Pointer): boolean {
    if (!this._enabled) return false;
    if (!this.hitZone.getBounds().contains(pointer.x, pointer.y)) return false;

    this._pressed = true;
    this.bg.setTint(0x666688);

    this.scene.tweens.add({
      targets: this.bg,
      scaleX: 0.95,
      scaleY: 0.95,
      duration: 60,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (!this._pressed) return;
        this._pressed = false;
        this.bg.clearTint();
        if (this._hovered) {
          this.bg.setTint(0xccccff);
        }
        this._callback();
        this.scene.tweens.add({
          targets: this.bg,
          scaleX: 1,
          scaleY: 1,
          duration: 120,
          ease: 'Quad.easeOut',
        });
      },
    });
    return true;
  }

  /** Call from the panel's scene-level pointerup handler. */
  handleRelease(_pointer?: Phaser.Input.Pointer): void {
    if (!this._pressed) return;
    this._pressed = false;

    this.scene.tweens.killTweensOf(this.bg);

    this.bg.clearTint();
    if (this._hovered) {
      this.bg.setTint(0xccccff);
    }

    this.scene.tweens.add({
      targets: this.bg,
      scaleX: 1,
      scaleY: 1,
      duration: 120,
      ease: 'Quad.easeOut',
    });
  }

  /** Call from the panel's scene-level pointermove handler. */
  handleHover(pointer: Phaser.Input.Pointer): void {
    const contained = this.hitZone.getBounds().contains(pointer.x, pointer.y);

    if (contained && !this._hovered) {
      this._hovered = true;
      if (!this._pressed && !this._selected) {
        this.bg.setTint(0xccccff);
      }
    } else if (!contained && this._hovered) {
      this._hovered = false;
      if (!this._pressed && !this._selected) {
        this.bg.clearTint();
      }
    }
  }

  setSelected(selected: boolean): void {
    this._selected = selected;
    if (selected) {
      this.bg.setTint(0xffffaa);
    } else if (!this._hovered && !this._pressed) {
      this.bg.clearTint();
    }
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    this.bg.setAlpha(enabled ? 1 : 0.4);
    this.label.setAlpha(enabled ? 1 : 0.4);
  }

  setText(text: string): void {
    this.label.setText(text);
  }

  setPosition(x: number, y: number): void {
    this.bg.setPosition(x, y);
    this.label.setPosition(x, y);
    this.hitZone.setPosition(x, y);
  }

  setVisible(visible: boolean): this {
    this.bg.setVisible(visible);
    this.label.setVisible(visible);
    this.hitZone.setVisible(visible);
    return this;
  }

  setDepth(d: number): this {
    this.bg.setDepth(d);
    this.label.setDepth(d + 1);
    this.hitZone.setDepth(d + 1);
    return this;
  }

  getBounds(): Phaser.Geom.Rectangle {
    return this.hitZone.getBounds();
  }

  /** Returns [bg, label, hitZone] for camera routing. */
  getChildren(): Phaser.GameObjects.GameObject[] {
    return [this.bg, this.label, this.hitZone];
  }

  destroy(): void {
    this.bg.destroy();
    this.label.destroy();
    this.hitZone.destroy();
  }
}
