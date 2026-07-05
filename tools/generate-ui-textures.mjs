import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'assets', 'sprites', 'ui');

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

function hex6(h) {
  return '#' + h.toString(16).padStart(6, '0');
}

function make(key, w, h, draw) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  draw(ctx);
  const buf = canvas.toBuffer('image/png');
  writeFileSync(join(OUT_DIR, `${key}.png`), buf);
  console.log(`  ${key}.png (${w}×${h})`);
}

function fill(ctx, hex, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = hex6(hex);
}

function stroke(ctx, hex, width = 1, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = hex6(hex);
  ctx.lineWidth = width;
}

function lineBetween(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

console.log('Generating UI 9-slice textures...\n');

// ui_panel_bg (32×32, margins 4)
// Corner ornaments kept at inset 2 (pixels [2,3]) so they stay within fixed margin region (0-3)
make('ui_panel_bg', 32, 32, (ctx) => {
  fill(ctx, 0x2a1a0a, 1);
  ctx.fillRect(0, 0, 32, 32);

  stroke(ctx, 0x5a4a3a, 1, 0.8);
  ctx.strokeRect(1, 1, 30, 30);

  stroke(ctx, 0x4a3a2a, 1, 0.4);
  ctx.strokeRect(2, 2, 28, 28);

  const c = 2;
  fill(ctx, 0x6a5a4a, 0.5);
  ctx.fillRect(c, c, 2, 1);
  ctx.fillRect(c, c, 1, 2);
  ctx.fillRect(32 - c - 2, c, 2, 1);
  ctx.fillRect(32 - c - 1, c, 1, 2);
  ctx.fillRect(c, 32 - c - 1, 2, 1);
  ctx.fillRect(c, 32 - c - 2, 1, 2);
  ctx.fillRect(32 - c - 2, 32 - c - 1, 2, 1);
  ctx.fillRect(32 - c - 1, 32 - c - 2, 1, 2);
});

// ui_card_bg (16×16, margins 3)
make('ui_card_bg', 16, 16, (ctx) => {
  fill(ctx, 0x3a2a1a, 1);
  ctx.fillRect(0, 0, 16, 16);

  stroke(ctx, 0x6a5a3a, 1, 0.7);
  ctx.strokeRect(1, 1, 14, 14);

  fill(ctx, 0x5a4a2a, 0.3);
  ctx.fillRect(0, 0, 16, 1);
  ctx.fillRect(0, 0, 1, 16);
});

// ui_slot_bg (14×14, margins 3)
make('ui_slot_bg', 14, 14, (ctx) => {
  fill(ctx, 0x1a0a00, 1);
  ctx.fillRect(0, 0, 14, 14);

  stroke(ctx, 0x3a2a1a, 1, 0.6);
  ctx.strokeRect(1, 1, 12, 12);

  fill(ctx, 0x000000, 0.3);
  ctx.fillRect(2, 2, 10, 10);
});

// ui_modal_bg (24×24, margins 4)
make('ui_modal_bg', 24, 24, (ctx) => {
  fill(ctx, 0x2a1a0a, 1);
  ctx.fillRect(0, 0, 24, 24);

  stroke(ctx, 0x7a6a4a, 1, 0.9);
  ctx.strokeRect(1, 1, 22, 22);

  stroke(ctx, 0x5a4a2a, 1, 0.5);
  ctx.strokeRect(2, 2, 20, 20);

  fill(ctx, 0x8a7a5a, 0.6);
  ctx.fillRect(2, 2, 2, 2);
  ctx.fillRect(20, 2, 2, 2);
  ctx.fillRect(2, 20, 2, 2);
  ctx.fillRect(20, 20, 2, 2);
});

// ui_btn_bg (12×12, margins 3)
make('ui_btn_bg', 12, 12, (ctx) => {
  fill(ctx, 0x3a2a1a, 1);
  ctx.fillRect(0, 0, 12, 12);

  stroke(ctx, 0x7a6a3a, 1, 0.7);
  lineBetween(ctx, 0, 0, 11, 0);
  lineBetween(ctx, 0, 0, 0, 11);

  stroke(ctx, 0x1a0a00, 1, 0.7);
  lineBetween(ctx, 11, 0, 11, 11);
  lineBetween(ctx, 0, 11, 11, 11);

  fill(ctx, 0x4a3a2a, 1);
  ctx.fillRect(3, 3, 6, 6);
});

// ui_btn_sm (8×8, margins 2)
make('ui_btn_sm', 8, 8, (ctx) => {
  fill(ctx, 0x3a2a1a, 1);
  ctx.fillRect(0, 0, 8, 8);

  stroke(ctx, 0x7a6a3a, 1, 0.7);
  lineBetween(ctx, 0, 0, 7, 0);
  lineBetween(ctx, 0, 0, 0, 7);

  stroke(ctx, 0x1a0a00, 1, 0.7);
  lineBetween(ctx, 7, 0, 7, 7);
  lineBetween(ctx, 0, 7, 7, 7);

  fill(ctx, 0x4a3a2a, 1);
  ctx.fillRect(2, 2, 4, 4);
});

console.log('\nDone. 6 textures generated in public/assets/sprites/ui/');
