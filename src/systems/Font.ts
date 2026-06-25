export function textStyle(style: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: 'Inter', resolution: 4, ...style };
}
