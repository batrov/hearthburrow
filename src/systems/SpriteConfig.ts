import offsets from './sprite-offsets.json';

export interface SpriteConfig {
  originX?: number;
  originY?: number;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
}

const cache = new Map<string, SpriteConfig>();

export function getSpriteConfig(key: string): SpriteConfig {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  let cfg: SpriteConfig = {};

  if (key in offsets) {
    cfg = (offsets as Record<string, SpriteConfig>)[key];
  } else {
    let best = '';
    for (const pattern of Object.keys(offsets)) {
      if (pattern.endsWith('_*') && key.startsWith(pattern.slice(0, -1))) {
        if (pattern.length > best.length) best = pattern;
      }
    }
    if (best) cfg = (offsets as Record<string, SpriteConfig>)[best];
  }

  cache.set(key, cfg);
  return cfg;
}
