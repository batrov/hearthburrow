import Phaser from 'phaser';
import { __setViewportSize } from './Viewport';

const MIN_W = 360, MAX_W = 430;
const MIN_H = 700, MAX_H = 950;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Picks a logical (width, height) that matches the device's real aspect ratio as
 * closely as the phone-plausible clamp range allows, so in-range phones get ~zero
 * letterboxing while out-of-range devices (tablets, desktop monitors) degrade to a
 * clamped portrait rectangle that Phaser.Scale.FIT can letterbox within the window.
 */
export function computeLogicalSize(rawW: number, rawH: number): { width: number; height: number } {
  const clampedW = clamp(rawW, MIN_W, MAX_W);
  const rawAspect = rawH / rawW;

  let targetH = clampedW * rawAspect;
  targetH = clamp(targetH, MIN_H, MAX_H);

  const impliedW = clamp(targetH / rawAspect, MIN_W, MAX_W);

  return {
    width: Math.round(impliedW),
    height: Math.round(targetH),
  };
}

type ResizeListener = () => void;

class ViewportManager {
  private game: Phaser.Game | null = null;
  private listeners = new Set<ResizeListener>();
  private debounceHandle: number | null = null;

  /** Called once from main.ts after `new Phaser.Game(config)`. */
  init(game: Phaser.Game): void {
    this.game = game;
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('orientationchange', this.onWindowResize);
  }

  /** Scenes/panels call this to be notified after VW()/VH()/CX()/CY() and cameras are updated. */
  onResize(cb: ResizeListener): void {
    this.listeners.add(cb);
  }

  offResize(cb: ResizeListener): void {
    this.listeners.delete(cb);
  }

  private onWindowResize = (): void => {
    if (this.debounceHandle !== null) window.clearTimeout(this.debounceHandle);
    this.debounceHandle = window.setTimeout(() => this.applyResize(), 120);
  };

  private applyResize(): void {
    if (!this.game) return;
    const { width, height } = computeLogicalSize(window.innerWidth, window.innerHeight);
    const cur = this.game.scale;
    if (width === cur.gameSize.width && height === cur.gameSize.height) return;

    __setViewportSize(width, height);
    cur.setGameSize(width, height);
    this.resizeActiveSceneCameras(width, height);
    this.listeners.forEach((cb) => cb());
  }

  private resizeActiveSceneCameras(w: number, h: number): void {
    for (const scene of this.game!.scene.getScenes(true)) {
      scene.cameras.resize(w, h);
    }
  }
}

export const viewportManager = new ViewportManager();
