import Phaser from 'phaser';
import { BasePanel } from './BasePanel';

export class BuildingInfoPanel extends BasePanel {
  private titleText: Phaser.GameObjects.Text;
  private descText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene);

    this.createOverlay();
    this.overlay.clear();
    this.overlay.fillStyle(0x0a0a1a, 0.85);
    this.overlay.fillRoundedRect(480 - 200, 320 - 90, 400, 180, 10);
    this.overlay.lineStyle(2, 0x6a5a8a, 1);
    this.overlay.strokeRoundedRect(480 - 200, 320 - 90, 400, 180, 10);

    this.titleText = scene.add.text(480, 290, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#e8d5b7', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    this.descText = scene.add.text(480, 340, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#b8a898', align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.descText);

    this.addCloseButton(665, 234);
  }

  show(label: string, description: string): void {
    this.titleText.setText(label);
    this.descText.setText(description);
    this.fadeIn();
  }
}
