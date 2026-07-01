import Phaser from 'phaser';

const origUpdateText = (Phaser.GameObjects.Text.prototype as any).updateText;
(Phaser.GameObjects.Text.prototype as any).updateText = function () {
  origUpdateText.call(this);
  if (this.frame?.source) {
    this.frame.source.setFilter(0);
  }
  return this;
};

const FONT_SCALE = 1.0;

export function fs(size: number): string {
  return `${Math.round(size * FONT_SCALE)}px`;
}

export function textStyle(style: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: 'Inter', resolution: 4, ...style };
}

export function createText(
  scene: Phaser.Scene,
  x: number, y: number,
  text: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, { fontFamily: 'Inter', resolution: 4, ...style });
  if (t.frame?.source) {
    t.frame.source.setFilter(0);
  }
  return t;
}
