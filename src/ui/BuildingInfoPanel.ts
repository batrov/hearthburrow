import Phaser from 'phaser';
import { BasePanel } from './BasePanel';
import { VW, VH, CX, CY } from '../systems/Viewport';

export class BuildingInfoPanel extends BasePanel {
  private titleText: Phaser.GameObjects.Text;
  private descText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene);

    this.createOverlay();
    this.overlay.clear();
    this.overlay.fillStyle(0x0a0a1a, 0.85);
    this.overlay.fillRoundedRect(CX - 160, CY - 80, 320, 160, 10);
    this.overlay.lineStyle(2, 0x6a5a8a, 1);
    this.overlay.strokeRoundedRect(CX - 160, CY - 80, 320, 160, 10);

    this.titleText = scene.add.text(CX, CY - 50, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.descText = scene.add.text(CX, CY, '', {
      fontSize: '13px', fontFamily: 'monospace', color: '#b8a898', align: 'center',
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
