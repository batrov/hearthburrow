import Phaser from 'phaser';
import { VW, VH, CX, CY, PANEL_PAD, OVERLAY_W, OVERLAY_H } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';
import { NineSliceBg } from './NineSliceBg';
import { UiButton } from './UiButton';

 export class BasePanel {
   protected scene: Phaser.Scene;
   container: Phaser.GameObjects.Container;
   protected _visible: boolean = false;
   protected overlayPanel: Phaser.GameObjects.NineSlice | null = null;
   protected overlay!: Phaser.GameObjects.Graphics;
   protected _closeBtn: UiButton | null = null;
   private _closeBtnRightOffset = 0;
   private _closeBtnY = 0;
   /** Set by onViewportResize(); consumed (and cleared) the next time the panel is shown. */
   protected _layoutDirty = false;

   constructor(scene: Phaser.Scene) {
     this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(215).setScrollFactor(0);
    scene.cameras.main.ignore(this.container);
    this.container.setVisible(false);
   }

   isVisible(): boolean {
     return this._visible;
   }

   hide(): void {
     this.fadeOut();
   }

   protected fadeIn(duration = 150): void {
     if (this._layoutDirty) {
       this.relayout();
       this._layoutDirty = false;
     }
     this._visible = true;
     this.container.setAlpha(0);
     this.container.setVisible(true);
     this.scene.tweens.add({
       targets: this.container,
       alpha: 1,
       duration,
       ease: 'Quad.easeOut',
     });
     if (this._closeBtn) this._closeBtn.setVisible(true);
   }

   protected fadeOut(duration = 150): void {
     this.scene.tweens.add({
       targets: this.container,
       alpha: 0,
       duration,
       ease: 'Quad.easeIn',
       onComplete: () => {
         this._visible = false;
         this.container.setVisible(false);
         if (this._closeBtn) this._closeBtn.setVisible(false);
       },
     });
   }

   protected createOverlay(): Phaser.GameObjects.Graphics {
      this.overlayPanel = NineSliceBg.panel(this.scene, CX(), CY(), VW(), VH());
      this.container.add(this.overlayPanel);
      this.overlayPanel.setAlpha(0.85);

     this.overlay = this.scene.add.graphics();
     this.container.add(this.overlay);
     return this.overlay;
   }

   protected addCloseButton(x = VW() - 40, y = 44): UiButton {
     this._closeBtnRightOffset = VW() - x;
     this._closeBtnY = y;

     const btn = new UiButton(this.scene, x, y, '[X]', 48, 48, () => {
       if (this.isVisible()) this.hide();
     }, { small: true, color: '#cd863f', fontSize: fs(24) });
     btn.setDepth(220);
     btn.setVisible(false);
     for (const child of btn.getChildren()) {
       this.scene.cameras.main.ignore(child);
     }

    btn.hitZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isVisible()) btn.handleClick(pointer);
    });

    this._closeBtn = btn;
    return btn;
   }

   protected setVisible(v: boolean): void {
     this._visible = v;
     this.container.setVisible(v);
   }

   /**
    * Called by ViewportManager (via the owning scene's relayout()) after a resize.
    * Never toggles visibility — only marks state dirty so the next show() recomputes
    * positions, avoiding redundant work on panels that aren't currently visible and
    * avoiding any interaction with the same-frame show/hide race.
    */
   onViewportResize(): void {
     this._layoutDirty = true;
   }

   /**
    * Re-applies position/size to already-existing overlay + close-button objects
    * using the current live viewport. Subclasses should override to reposition their
    * own content, calling super.relayout() first. Must only reposition — never
    * create/destroy objects or call show()/hide().
    */
   protected relayout(): void {
     NineSliceBg.updateSize(this.overlayPanel, VW(), VH());
     if (this._closeBtn) {
       const x = VW() - this._closeBtnRightOffset;
       this._closeBtn.setPosition(x, this._closeBtnY);
     }
   }

   destroy(): void {
     if (this._closeBtn) this._closeBtn.destroy();
     this.container.destroy(true);
   }
 }
