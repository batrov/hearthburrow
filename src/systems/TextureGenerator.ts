import Phaser from 'phaser';
import { drawDiamond, drawExtrudedTile, WALL_HEIGHT } from './IsoUtils';

const wallPalettes: Record<string, [number, number, number]> = {
  FOREST: [0x3a3a4a, 0x2a2a3a, 0x222230],
  CAVE: [0x4a3a2a, 0x3a2a1a, 0x302218],
  ICE: [0x4a6a8a, 0x3a5a7a, 0x2a4a6a],
  LAVA: [0x5a2a1a, 0x4a1a12, 0x3a120a],
  RUINS: [0x3a2a4a, 0x2a1a3a, 0x20122a],
};

function make(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, key: string, w: number, h: number, fn: () => void): void {
  if (scene.textures.exists(key)) return;
  fn();
  g.generateTexture(key, w, h);
  g.clear();
}

function centered(w: number, h: number): { cx: number; cy: number } {
  return { cx: Math.floor(w / 2), cy: Math.floor(h / 2) };
}

export function generateAll(scene: Phaser.Scene): void {
  const g = scene.add.graphics();

  // --- Walls (5 biomes) ---
  for (const [biome, colors] of Object.entries(wallPalettes)) {
    make(scene, g, `wall_${biome}`, 80, 64, () => {
      drawExtrudedTile(g, 40, 44, colors[0], colors[1], colors[2], WALL_HEIGHT);
    });
  }

  // --- Player ---
  make(scene, g, 'player_bottom_left', 32, 48, () => {
    const { cx, cy } = centered(32, 48);
    g.fillStyle(0x6699cc, 1);
    g.beginPath();
    g.moveTo(cx, cy - 10);
    g.lineTo(cx + 14, cy);
    g.lineTo(cx, cy + 10);
    g.lineTo(cx - 14, cy);
    g.closePath();
    g.fill();
    g.fillStyle(0x88ccff, 1);
    g.fillRect(cx - 10, cy - 18, 12, 20);
    // indicator
    g.fillStyle(0xffdd44, 0.8);
    g.fillCircle(cx - 8, cy + 10, 3);
  });

  make(scene, g, 'player_top_right', 32, 48, () => {
    const { cx, cy } = centered(32, 48);
    g.fillStyle(0x6699cc, 1);
    g.beginPath();
    g.moveTo(cx, cy - 10);
    g.lineTo(cx + 14, cy);
    g.lineTo(cx, cy + 10);
    g.lineTo(cx - 14, cy);
    g.closePath();
    g.fill();
    g.fillStyle(0x88ccff, 1);
    g.fillRect(cx - 6, cy - 18, 12, 20);
    // indicator
    g.fillStyle(0xffdd44, 0.8);
    g.fillCircle(cx + 8, cy - 6, 3);
  });

  // --- Ores ---
  const oreConfigs: Record<string, { base: number; inner: number; innerW: number; innerH: number }> = {
    stone: { base: 0x5a5a6a, inner: 0x6a6a7a, innerW: 10, innerH: 10 },
    bronze_ore: { base: 0x8a6a3a, inner: 0xaa8a4a, innerW: 12, innerH: 12 },
    silver_ore: { base: 0x7a8a9a, inner: 0x9aaabc, innerW: 12, innerH: 12 },
    gold_ore: { base: 0x8a7a2a, inner: 0xccaa44, innerW: 12, innerH: 12 },
    crystal: { base: 0x6a4a8a, inner: 0x9a6acc, innerW: 12, innerH: 12 },
  };

  for (const [res, cfg] of Object.entries(oreConfigs)) {
    make(scene, g, `ore_${res}`, 40, 40, () => {
      const { cx, cy } = centered(40, 40);
      drawDiamond(g, cx, cy, 0x000000, 0.2);
      g.fillStyle(cfg.base, 1);
      g.fillRoundedRect(cx - 14, cy - 14, 28, 28, 4);
      g.fillStyle(cfg.inner, 1);
      g.fillRoundedRect(cx - cfg.innerW / 2, cy - cfg.innerH / 2, cfg.innerW, cfg.innerH, 2);
    });
  }

  // --- Enemies ---
  const enemyColors: Record<string, number> = {
    slime: 0x44aa44,
    rat: 0x8a6a3a,
    bat: 0x6a4a7a,
  };

  for (const [type, color] of Object.entries(enemyColors)) {
    make(scene, g, `enemy_${type}`, 40, 40, () => {
      const { cx, cy } = centered(40, 40);
      g.fillStyle(0x000000, 0.3);
      g.fillCircle(cx - 3, cy + 5, 10);
      g.fillStyle(color, 0.7);
      g.fillCircle(cx - 3, cy - 3, 9);
    });
  }

  // --- Boss ---
  make(scene, g, 'enemy_boss', 40, 40, () => {
    const { cx, cy } = centered(40, 40);
    g.fillStyle(0xcc4444, 1);
    g.fillCircle(cx, cy, 14);
    g.fillStyle(0xaa2222, 0.5);
    g.fillCircle(cx, cy, 10);
    g.lineStyle(2, 0xff6644, 0.8);
    g.strokeCircle(cx, cy, 14);
    g.fillStyle(0xffff00, 0.6);
    g.fillTriangle(cx - 4, cy - 8, cx, cy - 14, cx + 4, cy - 8);
  });

  // --- Events ---
  const eventConfigs: Record<string, () => void> = {
    event_chest: () => {
      const { cx, cy } = centered(40, 40);
      g.fillStyle(0x8a6a3a, 1);
      g.fillRoundedRect(cx - 14, cy - 12, 28, 20, 3);
      g.fillStyle(0xccaa44, 1);
      g.fillRect(cx - 4, cy - 6, 8, 4);
    },
    event_merchant: () => {
      const { cx, cy } = centered(40, 40);
      g.fillStyle(0x3a5a8a, 1);
      g.fillCircle(cx, cy - 10, 6);
      g.fillRect(cx - 10, cy - 4, 20, 16);
    },
    event_goblin: () => {
      const { cx, cy } = centered(40, 40);
      g.fillStyle(0x5a8a3a, 1);
      g.fillCircle(cx, cy - 10, 6);
      g.fillRect(cx - 10, cy - 4, 20, 16);
    },
    event_villager: () => {
      const { cx, cy } = centered(40, 40);
      g.fillStyle(0xcc8844, 1);
      g.fillCircle(cx, cy - 10, 6);
      g.fillRect(cx - 10, cy - 4, 20, 16);
    },
    event_fountain: () => {
      const { cx, cy } = centered(40, 40);
      g.fillStyle(0x3a5a8a, 1);
      g.fillRoundedRect(cx - 14, cy - 12, 28, 20, 6);
      g.fillStyle(0x5a8acc, 0.6);
      g.fillRoundedRect(cx - 10, cy - 8, 20, 12, 4);
    },
    event_shop: () => {
      const { cx, cy } = centered(40, 40);
      g.fillStyle(0x8a6a3a, 1);
      g.fillRect(cx - 14, cy - 4, 28, 16);
      g.fillStyle(0xccaa44, 1);
      g.fillTriangle(cx - 6, cy + 8, cx + 6, cy + 8, cx, cy - 8);
    },
    event_treasure_vault: () => {
      const { cx, cy } = centered(40, 40);
      g.fillStyle(0xccaa44, 1);
      g.fillRoundedRect(cx - 14, cy - 10, 28, 20, 4);
      g.fillStyle(0xffdd66, 1);
      g.fillRect(cx - 4, cy - 4, 8, 8);
      g.fillStyle(0x88ccff, 0.7);
      g.fillRect(cx - 2, cy - 2, 4, 4);
    },
    event_relic: () => {
      const { cx, cy } = centered(40, 40);
      g.fillStyle(0xaa66dd, 1);
      g.fillCircle(cx, cy, 12);
      g.fillStyle(0xcc88ff, 0.8);
      g.fillCircle(cx, cy, 8);
      g.lineStyle(2, 0xffffff, 0.6);
      g.strokeCircle(cx, cy, 12);
    },
  };

  for (const [type, drawFn] of Object.entries(eventConfigs)) {
    make(scene, g, type, 40, 40, drawFn);
  }

  // --- Stairs ---
  make(scene, g, 'stairs_up', 40, 40, () => {
    const { cx, cy } = centered(40, 40);
    g.fillStyle(0x44cc66, 0.7);
    g.fillTriangle(cx - 10, cy + 8, cx, cy - 12, cx + 10, cy + 8);
  });

  make(scene, g, 'stairs_down', 40, 40, () => {
    const { cx, cy } = centered(40, 40);
    g.fillStyle(0x8866cc, 0.7);
    g.fillTriangle(cx - 10, cy - 8, cx, cy + 12, cx + 10, cy - 8);
  });

  // --- Pressure plate ---
  make(scene, g, 'pressure_plate', 40, 40, () => {
    const { cx, cy } = centered(40, 40);
    g.lineStyle(1, 0x88cc88, 0.6);
    g.strokeCircle(cx - 3, cy - 3, 10);
    g.fillStyle(0x88cc88, 0.3);
    g.fillCircle(cx - 3, cy - 3, 6);
  });

  // --- Blocked ---
  make(scene, g, 'blocked', 40, 40, () => {
    const { cx, cy } = centered(40, 40);
    g.fillStyle(0x5a4a3a, 0.9);
    g.fillRect(cx - 12, cy - 8, 24, 16);
    g.lineStyle(2, 0xcc6644, 0.8);
    g.lineBetween(cx - 8, cy - 4, cx + 8, cy + 4);
    g.lineBetween(cx - 8, cy + 4, cx + 8, cy - 4);
  });

  // --- Monster drop (ore-textured but no inner highlight) ---
  make(scene, g, 'ore_monster_drop', 40, 40, () => {
    const { cx, cy } = centered(40, 40);
    drawDiamond(g, cx, cy, 0x000000, 0.2);
    g.fillStyle(0x8a3a3a, 1);
    g.fillRoundedRect(cx - 14, cy - 14, 28, 28, 4);
  });

  // --- Durability overlays ---
  make(scene, g, 'overlay_damage', 28, 28, () => {
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(0, 0, 28, 28, 4);
  });

  make(scene, g, 'overlay_crack', 28, 28, () => {
    g.lineStyle(1, 0x000000, 0.5);
    g.lineBetween(4, 2, 24, 26);
    g.lineBetween(24, 2, 4, 26);
  });

  g.destroy();
}
