import Phaser from 'phaser';
import { getInputMode, onInputModeChange } from '../systems/InputMode';
import { textStyle } from '../systems/Font';

export function createAdaptiveText(
  scene: Phaser.Scene,
  x: number, y: number,
  keyboardText: string,
  touchText: string,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  const initialText = getInputMode() === 'keyboard' ? keyboardText : touchText;
  const t = scene.add.text(x, y, initialText, textStyle(style));
  if ((t as any).frame?.source) {
    (t as any).frame.source.setFilter(0);
  }
  const unsub = onInputModeChange((mode) => {
    if (t.active) t.setText(mode === 'keyboard' ? keyboardText : touchText);
  });
  t.on('destroy', unsub);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, unsub);
  return t;
}
