import Phaser from 'phaser';

export interface AnalogStickConfig {
  depth?: number;
  isModal: () => boolean;
  isPointerOverUI?: (pointer: Phaser.Input.Pointer) => boolean;
  onDragStart?: () => void;
  onClick?: (worldX: number, worldY: number) => void;
  onGfxCreated?: (gfx: Phaser.GameObjects.Graphics) => void;
}

export class AnalogStickInput {
  private scene: Phaser.Scene;
  private config: AnalogStickConfig;
  private gfx: Phaser.GameObjects.Graphics | null = null;
  private _active: boolean = false;
  private _dx: number = 0;
  private _dy: number = 0;
  private stickCenterX: number = 0;
  private stickCenterY: number = 0;
  private pointerDragged: boolean = false;
  private uiHitOnDown: boolean = false;
  private readonly stickRadius = 40;
  private readonly deadZone = 12;

  get active(): boolean { return this._active; }
  get dx(): number { return this._dx; }
  get dy(): number { return this._dy; }

  constructor(scene: Phaser.Scene, config: AnalogStickConfig) {
    this.scene = scene;
    this.config = { depth: 250, ...config };

    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);

    scene.events.on('shutdown', this.destroy, this);
  }

  reset(): void {
    this._active = false;
    this._dx = 0;
    this._dy = 0;
    if (this.gfx) {
      this.gfx.destroy();
      this.gfx = null;
    }
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.events.off('shutdown', this.destroy, this);
    this.reset();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.config.isPointerOverUI?.(pointer) || this.config.isModal()) {
      this.uiHitOnDown = true;
      return;
    }

    this.stickCenterX = pointer.x;
    this.stickCenterY = pointer.y;
    this.pointerDragged = false;
    this.uiHitOnDown = false;
    this.reset();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown) return;
    if (this.config.isModal()) return;
    if (this.config.isPointerOverUI?.(pointer)) return;

    const dx = pointer.x - this.stickCenterX;
    const dy = pointer.y - this.stickCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < this.deadZone) {
      if (this._active) {
        this._active = false;
        this._dx = 0;
        this._dy = 0;
      }
      return;
    }

    this.pointerDragged = true;

    let adx = 0;
    let ady = 0;
    if (dx > 0 && dy < 0) {
      ady = -1;
    } else if (dx < 0 && dy < 0) {
      adx = -1;
    } else if (dx > 0 && dy > 0) {
      adx = 1;
    } else if (dx < 0 && dy > 0) {
      ady = 1;
    } else if (dx !== 0) {
      adx = dx > 0 ? 1 : -1;
    } else if (dy !== 0) {
      ady = dy > 0 ? 1 : -1;
    }

    if (adx !== this._dx || ady !== this._dy) {
      this._dx = adx;
      this._dy = ady;
    }
    this._active = true;

    this.config.onDragStart?.();

    if (!this.gfx) {
      this.gfx = this.scene.add.graphics().setScrollFactor(0).setDepth(this.config.depth!);
      this.config.onGfxCreated?.(this.gfx);
    }
    this.gfx.clear();
    this.gfx.lineStyle(2, 0xffffff, 0.25);
    this.gfx.strokeCircle(this.stickCenterX, this.stickCenterY, this.stickRadius);
    this.gfx.fillStyle(0x000000, 0.2);
    this.gfx.fillCircle(this.stickCenterX, this.stickCenterY, this.stickRadius);

    const clamp = Math.min(dist, this.stickRadius);
    const angle = Math.atan2(dy, dx);
    const thumbX = this.stickCenterX + Math.cos(angle) * clamp;
    const thumbY = this.stickCenterY + Math.sin(angle) * clamp;
    this.gfx.fillStyle(0xffffff, 0.5);
    this.gfx.fillCircle(thumbX, thumbY, 12);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.uiHitOnDown) {
      this.uiHitOnDown = false;
      return;
    }
    if (this.config.isModal()) return;
    if (this.config.isPointerOverUI?.(pointer)) return;

    if (!this.pointerDragged) {
      this.config.onClick?.(pointer.worldX, pointer.worldY);
    }

    this.reset();
  }
}
