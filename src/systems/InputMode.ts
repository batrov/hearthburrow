export type InputMode = 'keyboard' | 'click' | 'touch';

let _mode: InputMode;
const listeners = new Set<(mode: InputMode) => void>();
let initialized = false;

function detectInitial(): InputMode {
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return 'touch';
  return 'keyboard';
}

function setMode(mode: InputMode): void {
  if (_mode === mode) return;
  _mode = mode;
  listeners.forEach(fn => fn(mode));
}

export function getInputMode(): InputMode {
  return _mode;
}

export function onInputModeChange(fn: (mode: InputMode) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initInputModeDetection(): void {
  if (initialized) return;
  initialized = true;
  _mode = detectInitial();

  window.addEventListener('keydown', () => setMode('keyboard'), { capture: true });
  window.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') setMode('touch');
    else if (e.pointerType === 'mouse') setMode('click');
  }, { capture: true });
}
