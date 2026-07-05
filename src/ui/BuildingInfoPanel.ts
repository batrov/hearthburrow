import Phaser from 'phaser';
import { BasePanel } from './BasePanel';
import { NineSliceBg } from './NineSliceBg';
import { VW, VH, CX, CY } from '../systems/Viewport';
import { textStyle, fs, createText } from '../systems/Font';

export class BuildingInfoPanel extends BasePanel {
  private titleText: Phaser.GameObjects.Text;
  private descText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene);

    this.createOverlay();
    this.overlay.clear();

    const bw = 320, bh = 160;
    const modal = NineSliceBg.modal(this.scene, CX(), CY(), bw, bh);
    modal.setDepth(200);
    this.container.add(modal);

    this.titleText = createText(scene, CX(), CY() - 50, '', {
      fontSize: fs(16), fontFamily: 'Inter', resolution: 4, color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.descText = createText(scene, CX(), CY(), '', {
      fontSize: fs(13), fontFamily: 'Inter', resolution: 4, color: '#b8a898', align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.descText);

    this.addCloseButton();
  }

  show(label: string, description: string): void {
    this.titleText.setText(label);
    this.descText.setText(description);
    this.fadeIn();
  }
}
