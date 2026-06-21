import Phaser from 'phaser';
import { drawDiamond, drawExtrudedTile, drawBuildingShape, WALL_HEIGHT } from './IsoUtils';

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

  // --- Floor & Corridor tiles (5 biomes, matching ExpeditionScene palette) ---
  const floorPalettes: Record<string, { floorA: number; floorB: number; corridor: number }> = {
    FOREST: { floorA: 0x1a1a2a, floorB: 0x1e1e30, corridor: 0x151520 },
    CAVE: { floorA: 0x2a1a12, floorB: 0x30201a, corridor: 0x221510 },
    ICE: { floorA: 0x8a9aaa, floorB: 0x7a8a9a, corridor: 0x6a7a8a },
    LAVA: { floorA: 0x2a1a0a, floorB: 0x3a2010, corridor: 0x1a0a08 },
    RUINS: { floorA: 0x1a0e22, floorB: 0x22122a, corridor: 0x140a1a },
  };

  const tileW = 160, tileH = 80, tileHW = 80, tileHH = 40;
  for (const [biome, colors] of Object.entries(floorPalettes)) {
    make(scene, g, `floor_${biome}_a`, tileW, tileH, () => {
      g.fillStyle(colors.floorA, 1);
      g.beginPath();
      g.moveTo(tileHW, 0);
      g.lineTo(tileW, tileHH);
      g.lineTo(tileHW, tileH);
      g.lineTo(0, tileHH);
      g.closePath();
      g.fill();
    });
    make(scene, g, `floor_${biome}_b`, tileW, tileH, () => {
      g.fillStyle(colors.floorB, 1);
      g.beginPath();
      g.moveTo(tileHW, 0);
      g.lineTo(tileW, tileHH);
      g.lineTo(tileHW, tileH);
      g.lineTo(0, tileHH);
      g.closePath();
      g.fill();
    });
    make(scene, g, `corridor_${biome}`, tileW, tileH, () => {
      g.fillStyle(colors.corridor, 1);
      g.beginPath();
      g.moveTo(tileHW, 0);
      g.lineTo(tileW, tileHH);
      g.lineTo(tileHW, tileH);
      g.lineTo(0, tileHH);
      g.closePath();
      g.fill();
    });
  }

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

  // --- Boss (large, 3x3 tiles) ---
  make(scene, g, 'enemy_boss', 120, 120, () => {
    const { cx, cy } = centered(120, 120);
    g.fillStyle(0xcc4444, 1);
    g.fillCircle(cx, cy, 42);
    g.fillStyle(0xaa2222, 0.5);
    g.fillCircle(cx, cy, 30);
    g.lineStyle(4, 0xff6644, 0.8);
    g.strokeCircle(cx, cy, 42);
    g.fillStyle(0xffff00, 0.6);
    g.fillTriangle(cx - 12, cy - 24, cx, cy - 42, cx + 12, cy - 24);
  });

  // --- Boss body (surrounding tiles) ---
  make(scene, g, 'boss_body', 40, 40, () => {
    const { cx, cy } = centered(40, 40);
    g.fillStyle(0x5a1a1a, 0.8);
    g.fillCircle(cx, cy, 12);
    g.fillStyle(0x3a0a0a, 0.4);
    g.fillCircle(cx, cy, 8);
    g.lineStyle(1, 0xcc4444, 0.3);
    g.strokeCircle(cx, cy, 12);
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

  // --- Item sprites (24x24 UI icons) ---
  const itemSize = 24;

  const itemConfigs: Record<string, (cx: number, cy: number) => void> = {
    carrot: (cx, cy) => {
      g.fillStyle(0x44aa33, 1);
      g.fillTriangle(cx, cy - 6, cx - 3, cy + 6, cx + 3, cy + 6);
      g.fillStyle(0x88cc44, 1);
      g.fillTriangle(cx - 2, cy - 7, cx, cy - 11, cx + 2, cy - 7);
    },
    stamina_potion: (cx, cy) => {
      g.fillStyle(0xcccccc, 1);
      g.fillRect(cx - 3, cy - 8, 6, 4);
      g.fillStyle(0x44dd66, 1);
      g.fillRoundedRect(cx - 5, cy - 4, 10, 10, 3);
    },
    teleport_scroll: (cx, cy) => {
      g.fillStyle(0xddddaa, 1);
      g.fillRoundedRect(cx - 7, cy - 9, 14, 18, 2);
      g.fillStyle(0xcc6644, 0.8);
      g.fillRect(cx - 3, cy - 2, 6, 4);
    },
    mining_bomb: (cx, cy) => {
      g.fillStyle(0x555555, 1);
      g.fillCircle(cx, cy, 7);
      g.fillStyle(0x888888, 1);
      g.fillRect(cx - 1, cy - 11, 2, 5);
      g.fillStyle(0xff6644, 1);
      g.fillCircle(cx, cy + 3, 2);
    },
    pickaxe_1: (cx, cy) => {
      g.lineStyle(2, 0x8a6a3a, 1);
      g.lineBetween(cx - 6, cy - 8, cx - 1, cy);
      g.lineBetween(cx - 1, cy, cx + 6, cy - 6);
      g.lineStyle(2, 0x6a4a2a, 1);
      g.lineBetween(cx, cy, cx + 1, cy + 8);
    },
    pickaxe_2: (cx, cy) => {
      g.lineStyle(2, 0xcc8844, 1);
      g.lineBetween(cx - 6, cy - 8, cx - 1, cy);
      g.lineBetween(cx - 1, cy, cx + 6, cy - 6);
      g.lineStyle(2, 0x6a4a2a, 1);
      g.lineBetween(cx, cy, cx + 1, cy + 8);
    },
    pickaxe_3: (cx, cy) => {
      g.lineStyle(2, 0x88bbdd, 1);
      g.lineBetween(cx - 6, cy - 8, cx - 1, cy);
      g.lineBetween(cx - 1, cy, cx + 6, cy - 6);
      g.lineStyle(2, 0x6a4a2a, 1);
      g.lineBetween(cx, cy, cx + 1, cy + 8);
    },
    pickaxe_4: (cx, cy) => {
      g.lineStyle(2, 0xddbb44, 1);
      g.lineBetween(cx - 6, cy - 8, cx - 1, cy);
      g.lineBetween(cx - 1, cy, cx + 6, cy - 6);
      g.lineStyle(2, 0x6a4a2a, 1);
      g.lineBetween(cx, cy, cx + 1, cy + 8);
    },
    ring_critical: (cx, cy) => {
      g.lineStyle(2, 0xccccaa, 1);
      g.strokeCircle(cx, cy, 6);
      g.fillStyle(0xcc3333, 1);
      g.fillCircle(cx, cy, 3);
    },
    ring_damage: (cx, cy) => {
      g.lineStyle(2, 0xccccaa, 1);
      g.strokeCircle(cx, cy, 6);
      g.fillStyle(0xdd8833, 1);
      g.fillCircle(cx, cy, 3);
    },
    ring_precision: (cx, cy) => {
      g.lineStyle(2, 0xccccaa, 1);
      g.strokeCircle(cx, cy, 6);
      g.fillStyle(0x3388cc, 1);
      g.fillCircle(cx, cy, 3);
    },
    ring_hunter: (cx, cy) => {
      g.lineStyle(2, 0xccccaa, 1);
      g.strokeCircle(cx, cy, 6);
      g.fillStyle(0x44aa44, 1);
      g.fillCircle(cx, cy, 3);
    },
    boots_stamina_bronze: (cx, cy) => {
      g.fillStyle(0xcc8844, 1);
      g.fillRect(cx - 5, cy - 4, 10, 8);
      g.fillRect(cx - 7, cy + 1, 14, 4);
    },
    boots_stamina_silver: (cx, cy) => {
      g.fillStyle(0x88bbdd, 1);
      g.fillRect(cx - 5, cy - 4, 10, 8);
      g.fillRect(cx - 7, cy + 1, 14, 4);
    },
    boots_stamina_gold: (cx, cy) => {
      g.fillStyle(0xddbb44, 1);
      g.fillRect(cx - 5, cy - 4, 10, 8);
      g.fillRect(cx - 7, cy + 1, 14, 4);
    },
    boots_luck_bronze: (cx, cy) => {
      g.fillStyle(0xcc8844, 1);
      g.fillRect(cx - 5, cy - 4, 10, 8);
      g.fillRect(cx - 7, cy + 1, 14, 4);
      g.fillStyle(0x44dd44, 0.8);
      g.fillCircle(cx, cy - 1, 2);
    },
    boots_luck_silver: (cx, cy) => {
      g.fillStyle(0x88bbdd, 1);
      g.fillRect(cx - 5, cy - 4, 10, 8);
      g.fillRect(cx - 7, cy + 1, 14, 4);
      g.fillStyle(0x44dd44, 0.8);
      g.fillCircle(cx, cy - 1, 2);
    },
    boots_luck_gold: (cx, cy) => {
      g.fillStyle(0xddbb44, 1);
      g.fillRect(cx - 5, cy - 4, 10, 8);
      g.fillRect(cx - 7, cy + 1, 14, 4);
      g.fillStyle(0x44dd44, 0.8);
      g.fillCircle(cx, cy - 1, 2);
    },
    boots_regen: (cx, cy) => {
      g.fillStyle(0x88cc88, 1);
      g.fillRect(cx - 5, cy - 4, 10, 8);
      g.fillRect(cx - 7, cy + 1, 14, 4);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(cx, cy - 1, 2);
    },
    lantern_bronze: (cx, cy) => {
      g.lineStyle(2, 0x8a6a3a, 1);
      g.strokeRect(cx - 5, cy - 8, 10, 12);
      g.fillStyle(0xff8844, 0.7);
      g.fillCircle(cx, cy - 2, 4);
    },
    lantern_silver: (cx, cy) => {
      g.lineStyle(2, 0x888899, 1);
      g.strokeRect(cx - 5, cy - 8, 10, 12);
      g.fillStyle(0x88ccff, 0.7);
      g.fillCircle(cx, cy - 2, 4);
    },
    lantern_gold: (cx, cy) => {
      g.lineStyle(2, 0xccaa44, 1);
      g.strokeRect(cx - 5, cy - 8, 10, 12);
      g.fillStyle(0xffdd66, 0.7);
      g.fillCircle(cx, cy - 2, 4);
    },
    relic_stamina: (cx, cy) => {
      g.fillStyle(0x8844cc, 1);
      g.fillCircle(cx, cy, 7);
      g.fillStyle(0xcc88ff, 0.8);
      g.fillCircle(cx, cy, 4);
      g.lineStyle(1, 0xffffff, 0.5);
      g.strokeCircle(cx, cy, 7);
    },
    relic_inventory: (cx, cy) => {
      g.fillStyle(0x4488cc, 1);
      g.fillCircle(cx, cy, 7);
      g.fillStyle(0x88ccff, 0.8);
      g.fillCircle(cx, cy, 4);
      g.lineStyle(1, 0xffffff, 0.5);
      g.strokeCircle(cx, cy, 7);
    },
    miners_spirit: (cx, cy) => {
      g.fillStyle(0x8844aa, 1);
      g.fillCircle(cx, cy, 6);
      g.fillStyle(0xaa66cc, 0.8);
      g.fillCircle(cx, cy, 3);
      g.fillStyle(0xcccccc, 1);
      g.fillRect(cx - 2, cy - 9, 4, 4);
    },
    miners_potion: (cx, cy) => {
      g.fillStyle(0xcccccc, 1);
      g.fillRect(cx - 3, cy - 8, 6, 4);
      g.fillStyle(0xddaa44, 1);
      g.fillRoundedRect(cx - 5, cy - 4, 10, 10, 3);
      g.fillStyle(0xffdd88, 0.6);
      g.fillCircle(cx, cy, 2);
    },
    relic_luck: (cx, cy) => {
      g.fillStyle(0x44cc66, 1);
      g.fillCircle(cx, cy, 7);
      g.fillStyle(0x88ffaa, 0.8);
      g.fillCircle(cx, cy, 4);
      g.lineStyle(1, 0xffffff, 0.5);
      g.strokeCircle(cx, cy, 7);
    },
  };

  for (const [name, drawFn] of Object.entries(itemConfigs)) {
    make(scene, g, `item_${name}`, itemSize, itemSize, () => {
      const { cx, cy } = centered(itemSize, itemSize);
      drawFn(cx, cy);
    });
  }

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

  // --- Hub terrain diamond (white, tinted at use) ---
  make(scene, g, 'terrain_diamond', 80, 40, () => {
    drawDiamond(g, 40, 20, 0xffffff, 1);
  });

  // --- Water tile ---
  make(scene, g, 'terrain_water', 80, 40, () => {
    drawDiamond(g, 40, 20, 0x3a5a7a, 1);
    g.fillStyle(0x5a8aaa, 0.25);
    g.beginPath();
    g.moveTo(20, 12);
    g.lineTo(44, 8);
    g.lineTo(60, 12);
    g.lineTo(36, 16);
    g.closePath();
    g.fill();
    g.fillStyle(0x2a4a6a, 0.2);
    g.beginPath();
    g.moveTo(16, 20);
    g.lineTo(40, 18);
    g.lineTo(56, 22);
    g.lineTo(32, 24);
    g.closePath();
    g.fill();
    g.lineStyle(1, 0x7aaacc, 0.15);
    g.lineBetween(34, 18, 46, 22);
    g.lineBetween(36, 16, 44, 18);
  });

  // --- Terrain variants (textured grass & path) ---
  function drawTerrainDiamond(g: Phaser.GameObjects.Graphics, cx: number, cy: number, base: number, hl: number, dark: number): void {
    drawDiamond(g, cx, cy, base, 1);
    g.fillStyle(hl, 0.25);
    g.beginPath();
    g.moveTo(cx, cy - 20);
    g.lineTo(cx + 6, cy);
    g.lineTo(cx, cy + 3);
    g.lineTo(cx - 6, cy);
    g.closePath();
    g.fill();
    for (let i = 0; i < 6; i++) {
      const gx = cx - 30 + (i * 12);
      const gy = cy - 16 + (i * 6);
      g.fillStyle(dark, 0.15);
      g.fillRect(gx, gy, 2, 1);
    }
  }
  make(scene, g, 'terrain_grass_a', 80, 40, () => {
    drawTerrainDiamond(g, 40, 20, 0x3a5a2a, 0x5a7a4a, 0x2a4a1a);
  });
  make(scene, g, 'terrain_grass_b', 80, 40, () => {
    drawTerrainDiamond(g, 40, 20, 0x4a6a3a, 0x6a8a5a, 0x3a5a2a);
  });
  make(scene, g, 'terrain_path', 80, 40, () => {
    drawTerrainDiamond(g, 40, 20, 0x5a4a3a, 0x6a5a4a, 0x4a3a2a);
    g.fillStyle(0x000000, 0.08);
    for (let i = 0; i < 12; i++) {
      const px = 6 + (i * 5 + 3) % 68;
      const py = 2 + (i * 3 + 7) % 36;
      g.fillCircle(px - 40, py - 20, 1);
    }
  });
  make(scene, g, 'terrain_bridge', 80, 40, () => {
    drawTerrainDiamond(g, 40, 20, 0x7a5a3a, 0x8a6a4a, 0x5a3a1a);
    // Plank lines
    g.lineStyle(1, 0x5a3a1a, 0.4);
    for (let i = -3; i <= 3; i++) {
      g.lineBetween(32 + i * 10, 14 + i * 2, 48 + i * 10, 26 + i * 2);
    }
    // Top surface highlight
    g.fillStyle(0x8a6a4a, 0.7);
    g.beginPath();
    g.moveTo(40, 2);
    g.lineTo(72, 20);
    g.lineTo(40, 38);
    g.lineTo(8, 20);
    g.closePath();
    g.fill();
    // Nail dots
    g.fillStyle(0xaa8866, 0.8);
    g.fillCircle(32, 18, 1);
    g.fillCircle(48, 18, 1);
    g.fillCircle(28, 24, 1);
    g.fillCircle(52, 24, 1);
  });

  // --- Hub buildings (extruded tiles per type) ---
  const buildingConfigs: Record<string, [number, number, number]> = {
    trading_post: [0x8a6a3a, 0x6a4a2a, 0x5a3a1a],
    crafting: [0x6a7a8a, 0x4a5a6a, 0x3a4a5a],
    farm: [0x5a7a3a, 0x3a5a2a, 0x2a4a1a],
    tavern: [0x6a3a1a, 0x4a2a0a, 0x3a1a00],
    storage: [0x6a5a4a, 0x4a3a2a, 0x3a2a1a],
    laboratory: [0x6a4a8a, 0x4a2a6a, 0x3a1a5a],
    gate: [0x3a2a5a, 0x2a1a4a, 0x1a0a3a],
  };

  for (const [id, colors] of Object.entries(buildingConfigs)) {
    const gw = id === 'gate' ? 2 : 3;
    const gh = id === 'gate' ? 1 : 3;
    const cw = id === 'gate' ? 120 : 160;
    const ch = id === 'gate' ? 80 : 120;
    make(scene, g, `building_${id}`, cw, ch, () => {
      drawBuildingShape(g, cw, ch, gw, gh, colors[0], colors[1], colors[2], WALL_HEIGHT);
    });
  }

  // --- Gate glow diamond ---
  make(scene, g, 'gate_glow', 80, 40, () => {
    drawDiamond(g, 40, 20, 0x8a7aba, 0.3);
    drawDiamond(g, 40, 20, 0x6a5a9a, 0.2);
  });

  // --- Villager NPC variants (20 unique colors) ---
  for (let i = 0; i < 20; i++) {
    const hue = i / 20;
    const bodyColor = Phaser.Display.Color.HSLToColor(hue, 0.7, 0.6).color;
    const headColor = Phaser.Display.Color.HSLToColor(hue, 0.6, 0.8).color;
    make(scene, g, `npc_${i}`, 24, 24, () => {
      const { cx, cy } = centered(24, 24);
      g.fillStyle(bodyColor, 1);
      g.fillCircle(cx, cy + 2, 7);
      g.fillStyle(headColor, 1);
      g.fillRect(cx - 4, cy - 7, 8, 5);
    });
  }

  // --- Environment decorations ---
  const decoSize: Record<string, [number, number]> = {
    decoration_tree_pine: [64, 80],
    decoration_tree_oak: [64, 80],
    decoration_bush: [48, 32],
    decoration_rock: [48, 24],
    decoration_flower_red: [24, 24],
    decoration_flower_yellow: [24, 24],
    decoration_fence: [40, 24],
    decoration_lantern_post: [24, 48],
    decoration_well: [60, 40],
    decoration_signpost: [24, 48],
  };

  const decoDraw: Record<string, (cx: number, cy: number) => void> = {
    decoration_tree_pine: (cx, cy) => {
      g.fillStyle(0x5a3a1a, 1);
      g.fillRect(cx - 4, cy + 12, 8, 18);
      const layers = [60, 44, 28, 14];
      const widths = [20, 16, 12, 8];
      for (let i = 0; i < 4; i++) {
        const by = layers[i];
        const bw = widths[i];
        g.fillStyle(0x2a6a1a, 1);
        g.beginPath();
        g.moveTo(cx, by - bw);
        g.lineTo(cx + bw, by);
        g.lineTo(cx + bw - 4, by);
        g.lineTo(cx, by + 6);
        g.lineTo(cx - bw + 4, by);
        g.lineTo(cx - bw, by);
        g.closePath();
        g.fill();
        g.fillStyle(0x3a8a2a, 0.5);
        g.beginPath();
        g.moveTo(cx, by - bw + 4);
        g.lineTo(cx + bw - 4, by - 2);
        g.lineTo(cx, by + 4);
        g.lineTo(cx - bw + 4, by - 2);
        g.closePath();
        g.fill();
      }
      g.fillStyle(0x3a8a2a, 1);
      g.fillTriangle(cx, 0, cx + 4, 10, cx - 4, 10);
    },
    decoration_tree_oak: (cx, cy) => {
      g.fillStyle(0x6a4a2a, 1);
      g.fillRect(cx - 5, cy + 14, 10, 18);
      g.fillStyle(0x3a7a2a, 1);
      g.fillCircle(cx, cy + 7, 26);
      g.fillStyle(0x4a8a3a, 0.7);
      g.fillCircle(cx, cy + 2, 20);
      g.fillStyle(0x5a9a4a, 0.4);
      g.fillCircle(cx - 8, cy, 12);
      g.fillCircle(cx + 10, cy - 3, 12);
      g.fillStyle(0x2a5a1a, 0.3);
      g.fillCircle(cx, cy + 20, 22);
    },
    decoration_bush: (cx, cy) => {
      g.fillStyle(0x3a7a2a, 1);
      g.fillCircle(cx, cy + 3, 16);
      g.fillStyle(0x4a8a3a, 1);
      g.fillCircle(cx, cy - 2, 12);
      g.fillStyle(0x5a9a4a, 0.6);
      g.fillCircle(cx, cy - 6, 6);
    },
    decoration_rock: (cx, cy) => {
      g.fillStyle(0x6a6a7a, 1);
      g.fillEllipse(cx, cy, 28, 12);
      g.fillStyle(0x7a7a8a, 1);
      g.fillEllipse(cx, cy - 1, 20, 10);
      g.fillStyle(0x8a8a9a, 0.6);
      g.fillEllipse(cx, cy - 4, 12, 6);
      g.lineStyle(1, 0x4a4a5a, 0.3);
      g.lineBetween(cx - 4, cy - 4, cx + 2, cy);
      g.lineBetween(cx + 2, cy, cx + 6, cy - 2);
    },
    decoration_flower_red: (cx, cy) => {
      g.lineStyle(1, 0x44aa33, 0.6);
      g.lineBetween(cx - 4, cy, cx - 4, cy + 4);
      g.lineBetween(cx + 4, cy - 2, cx + 4, cy + 4);
      g.fillStyle(0xcc3333, 1);
      g.fillCircle(cx - 4, cy, 3);
      g.fillCircle(cx + 4, cy - 2, 3);
      g.fillStyle(0xff6644, 0.7);
      g.fillCircle(cx - 4, cy, 1);
      g.fillCircle(cx + 4, cy - 2, 1);
    },
    decoration_flower_yellow: (cx, cy) => {
      g.lineStyle(1, 0x44aa33, 0.6);
      g.lineBetween(cx - 3, cy, cx - 3, cy + 4);
      g.lineBetween(cx + 3, cy - 2, cx + 3, cy + 4);
      g.fillStyle(0xddaa33, 1);
      g.fillCircle(cx - 3, cy, 2);
      g.fillCircle(cx + 3, cy - 2, 2);
      g.fillStyle(0xffdd66, 0.7);
      g.fillCircle(cx - 3, cy, 1);
      g.fillCircle(cx + 3, cy - 2, 1);
    },
    decoration_fence: (cx, cy) => {
      g.fillStyle(0x6a4a2a, 1);
      g.fillRect(cx - 16, cy - 2, 32, 4);
      g.fillStyle(0x5a3a1a, 1);
      g.fillRect(cx - 14, cy - 6, 4, 14);
      g.fillRect(cx + 10, cy - 6, 4, 14);
      g.fillTriangle(cx - 14, cy - 6, cx - 10, cy - 6, cx - 12, cy - 10);
      g.fillTriangle(cx + 10, cy - 6, cx + 14, cy - 6, cx + 12, cy - 10);
    },
    decoration_lantern_post: (cx, cy) => {
      g.fillStyle(0x4a3a2a, 1);
      g.fillRect(cx - 2, cy + 4, 4, 14);
      g.fillStyle(0x6a5a3a, 1);
      g.fillRect(cx - 6, cy - 6, 12, 10);
      g.fillTriangle(cx - 6, cy - 6, cx + 6, cy - 6, cx, cy - 12);
      g.fillStyle(0xffaa44, 0.8);
      g.fillCircle(cx, cy - 1, 3);
      g.fillStyle(0xffaa44, 0.2);
      g.fillCircle(cx, cy - 1, 5);
    },
    decoration_well: (cx, cy) => {
      g.fillStyle(0x5a5a6a, 1);
      g.fillEllipse(cx, cy, 40, 16);
      g.fillStyle(0x3a3a4a, 1);
      g.fillEllipse(cx, cy, 32, 12);
      g.fillStyle(0x3a5a8a, 0.7);
      g.fillEllipse(cx, cy, 24, 8);
      g.fillStyle(0x5a8acc, 0.4);
      g.fillEllipse(cx, cy, 16, 4);
      g.fillStyle(0x4a3a2a, 1);
      g.fillRect(cx - 16, cy - 14, 2, 12);
      g.fillRect(cx + 14, cy - 14, 2, 12);
      g.fillStyle(0x5a4a3a, 1);
      g.fillRect(cx - 16, cy - 16, 32, 2);
      g.lineStyle(1, 0x8a7a5a, 0.7);
      g.lineBetween(cx - 2, cy - 14, cx - 2, cy - 4);
      g.lineBetween(cx + 2, cy - 14, cx + 2, cy - 4);
    },
    decoration_signpost: (cx, cy) => {
      g.fillStyle(0x5a3a1a, 1);
      g.fillRect(cx - 2, cy + 4, 4, 16);
      g.fillStyle(0x6a4a2a, 1);
      g.fillRect(cx - 10, cy - 2, 20, 6);
      g.fillTriangle(cx - 10, cy - 2, cx + 10, cy - 2, cx + 8, cy - 6);
      g.fillTriangle(cx - 10, cy - 2, cx + 10, cy - 2, cx - 8, cy - 6);
      g.fillStyle(0x3a2a0a, 0.3);
      g.fillRect(cx, cy + 4, 2, 16);
      g.fillStyle(0x8a8a8a, 1);
      g.fillCircle(cx - 6, cy + 1, 1);
      g.fillCircle(cx + 6, cy + 1, 1);
    },
  };

  for (const [key, [w, h]] of Object.entries(decoSize)) {
    make(scene, g, key, w, h, () => {
      const { cx, cy } = centered(w, h);
      decoDraw[key](cx, cy);
    });
  }

  g.destroy();
}
