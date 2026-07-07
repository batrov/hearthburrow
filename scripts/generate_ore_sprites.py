#!/usr/bin/env python3
"""Generate ore drop PNG sprites with bigger ore content.

Draws at 4x then downscales for anti-aliased edges.
Output overwrites existing files in public/assets/sprites/ores/

Run:  python3 scripts/generate_ore_sprites.py
"""

from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'sprites', 'ores')
os.makedirs(OUT, exist_ok=True)

def rgba(hex_color, a=255):
    return ((hex_color >> 16) & 0xff, (hex_color >> 8) & 0xff, hex_color & 0xff, a)

# ── Ore colour configs (matches TextureGenerator.ts) ───────────────────────
ORES = {
    'stone':          (0x7a7a7a, 0x9a9a9a),
    'bronze_ore':     (0x8a6a3a, 0xcc8844),
    'silver_ore':     (0x7a8a9a, 0x9aaabc),
    'gold_ore':       (0x8a7a2a, 0xccaa44),
    'crystal':        (0x6a4a8a, 0x9a6acc),
    'monster_drop':   (0x8a4a4a, 0xcc6666),
}

# ── Helpers ─────────────────────────────────────────────────────────────────
SCALE = 4

def save_big(name, w, h, draw_fn):
    sw, sh = w * SCALE, h * SCALE
    img = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(img), sw // 2, sh // 2)
    img = img.resize((w, h), Image.LANCZOS)
    path = os.path.join(OUT, f'{name}.png')
    img.save(path)
    print(f'  saved {path}  ({w}x{h})')

# ── Drop sprites (24×24, ore drawn larger) ────────────────────────────────
DROP_SIZE = 24

def draw_drop(d, cx, cy, base_col, inner_col):
    # Shadow diamond (scaled to 4x canvas)
    r = 12
    d.polygon([(cx, cy - r), (cx + r * 2, cy), (cx, cy + r), (cx - r * 2, cy)],
              fill=(0, 0, 0, 40))
    # Outer ore circle (r=40 at 4x = r=10 native)
    d.ellipse([cx - 40, cy - 40, cx + 40, cy + 40],
              fill=rgba(base_col, 230))
    # Inner highlight circle (r=20 at 4x = r=5 native)
    d.ellipse([cx - 20, cy - 20, cx + 20, cy + 20],
              fill=rgba(inner_col))

# ── Main ───────────────────────────────────────────────────────────────────
def main():
    for name, (base, inner) in ORES.items():
        drop_name = name if name.endswith('_ore') else f'{name}_ore'
        save_big(drop_name, DROP_SIZE, DROP_SIZE,
                 lambda d, cx, cy, base=base, inner=inner: draw_drop(d, cx, cy, base, inner))
    print(f'Done — {len(ORES)} ore drop sprites generated.')

if __name__ == '__main__':
    main()
