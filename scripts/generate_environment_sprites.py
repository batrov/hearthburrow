#!/usr/bin/env python3
"""Generate terrain variant and environment decoration PNG sprites.

Output:
  public/assets/sprites/tiles/terrain_grass_a.png     (80x40)
  public/assets/sprites/tiles/terrain_grass_b.png     (80x40)
  public/assets/sprites/tiles/terrain_path.png         (80x40)
  public/assets/sprites/decoration/*.png              (10 sprites)

Run:  python3 scripts/generate_environment_sprites.py
"""

from PIL import Image, ImageDraw as ID
import os, math

TILE_DIR = 'public/assets/sprites/tiles'
DECO_DIR = 'public/assets/sprites/decoration'
os.makedirs(DECO_DIR, exist_ok=True)

BIG = 4
RGBA = (0, 0, 0, 0)

def rgba(hex_color, a=255):
    return ((hex_color >> 16) & 0xff, (hex_color >> 8) & 0xff, hex_color & 0xff, a)

def save_terrain(name, w, h, draw_fn):
    img = Image.new('RGBA', (w, h), RGBA)
    draw_fn(ID.Draw(img))
    path = os.path.join(TILE_DIR, f'{name}.png')
    img.save(path)
    print(f'  saved {path}  ({w}x{h})')

def save_big(name, size, draw_fn):
    """Draw at 4x, downscale for anti-aliased edges."""
    sw, sh = size
    img = Image.new('RGBA', (sw * BIG, sh * BIG), RGBA)
    draw_fn(ID.Draw(img), sw * BIG // 2, sh * BIG // 2)
    img = img.resize((sw, sh), Image.LANCZOS)
    path = os.path.join(DECO_DIR, f'{name}.png')
    img.save(path)
    print(f'  saved {path}  ({sw}x{sh})')

# ─── Water Tile (80x40 isometric diamond) ─────────────────────────────────

def save_terrain_water():
    w, h = 80, 40
    img = Image.new('RGBA', (w, h), RGBA)
    d = ID.Draw(img)
    cx, cy = w // 2, h // 2
    base = (0x3a, 0x5a, 0x7a)
    d.polygon([(cx, 0), (w, cy), (cx, h), (0, cy)], fill=base + (255,))
    # Subtle wave lines
    for i in range(3):
        wy = cy - 8 + i * 8
        d.line([(cx - 20 + i * 4, wy), (cx + 4 - i * 2, wy - 2), (cx + 20 - i * 6, wy)],
               fill=(0x5a, 0x8a, 0xaa, 60), width=1)
        d.line([(cx - 16 + i * 3, wy + 2), (cx + 2 - i * 2, wy), (cx + 16 - i * 4, wy + 2)],
               fill=(0x2a, 0x4a, 0x6a, 50), width=1)
    # Reflection highlight
    d.line([(cx - 6, cy - 2), (cx + 6, cy + 2)], fill=(0x7a, 0xaa, 0xcc, 40), width=1)
    d.line([(cx - 4, cy - 4), (cx + 4, cy)], fill=(0x7a, 0xaa, 0xcc, 30), width=1)
    path = os.path.join(TILE_DIR, 'terrain_water.png')
    img.save(path)
    print(f'  saved {path}')

# ─── Bridge Decoration (120x80, isometric wooden bridge) ──────────────────

def deco_bridge(d, CX, CY):
    """Wooden bridge ~120x80, drawn at 4x then downscaled."""
    # Main deck (isometric diamond of planks)
    d.polygon([(CX, CY - 32), (CX + 48, CY), (CX, CY + 32), (CX - 48, CY)],
              fill=rgba(0x6a4a2a))
    # Plank lines across deck
    for i in range(-3, 4):
        px = CX + i * 14
        py = CY - i * 4
        d.line([(px - 4, py + 10), (px + 4, py - 10)], fill=rgba(0x5a3a1a, 120), width=2)
    # Top surface (lighter)
    d.polygon([(CX, CY - 30), (CX + 44, CY), (CX, CY + 28), (CX - 44, CY)],
              fill=rgba(0x7a5a3a))
    # Railings
    # Left railing
    d.polygon([(CX - 44, CY - 8), (CX - 4, CY - 28), (CX - 4, CY - 38), (CX - 44, CY - 16)],
              fill=rgba(0x5a3a1a))
    d.line([(CX - 40, CY - 12), (CX - 8, CY - 30)], fill=rgba(0x8a6a3a, 200), width=3)
    d.line([(CX - 36, CY - 10), (CX - 12, CY - 26)], fill=rgba(0x8a6a3a, 180), width=2)
    # Right railing
    d.polygon([(CX + 44, CY - 8), (CX + 4, CY - 28), (CX + 4, CY - 38), (CX + 44, CY - 16)],
              fill=rgba(0x5a3a1a))
    d.line([(CX + 40, CY - 12), (CX + 8, CY - 30)], fill=rgba(0x8a6a3a, 200), width=3)
    d.line([(CX + 36, CY - 10), (CX + 12, CY - 26)], fill=rgba(0x8a6a3a, 180), width=2)
    # Under-arch shadow
    d.polygon([(CX - 44, CY), (CX, CY + 32), (CX + 44, CY), (CX, CY + 28)],
              fill=rgba(0x3a2a0a, 60))

# ─── Terrain Variants (80x40 isometric diamonds) ──────────────────────────

def draw_grass_diamond(d, w, h, base_color):
    cx, cy = w // 2, h // 2
    # Diamond body
    d.polygon([(cx, 0), (w, cy), (cx, h), (0, cy)], fill=rgba(base_color))
    # Subtle highlight strip on top-left edge
    hl = tuple(min(c + 20, 255) for c in rgba(base_color)[:3]) + (60,)
    d.polygon([(cx, 0), (cx + 8, cy), (cx, cy + 4), (cx - 8, cy)], fill=hl)
    # Grass blade tufts (small strokes)
    for _ in range(12):
        gx = cx + int((_ % 6) * 10) - 30 + int(math.sin(_ * 1.7) * 8)
        gy = 4 + int(_ * 2.7) % 36
        blade_color = tuple(min(c + 40, 255) for c in rgba(base_color)[:3]) + (120,)
        d.line([(gx, gy), (gx - 1, gy - 2), (gx + 1, gy - 3)], fill=blade_color, width=1)

def save_terrain_grass_a():
    w, h = 80, 40
    img = Image.new('RGBA', (w, h), RGBA)
    d = ID.Draw(img)
    cx, cy = w // 2, h // 2
    base = (0x3a, 0x5a, 0x2a)
    d.polygon([(cx, 0), (w, cy), (cx, h), (0, cy)], fill=base + (255,))
    # Highlight edge
    d.polygon([(cx, 0), (cx + 6, cy), (cx, cy + 3), (cx - 6, cy)], fill=(0x5a, 0x7a, 0x4a, 60))
    # Grass strokes
    for i in range(14):
        gx = 8 + (i * 5) % 64
        gy = 4 + (i * 3) % 32
        d.line([(gx, gy), (gx - 1, gy - 2)], fill=(0x5a, 0x7a, 0x4a, 160), width=1)
        d.line([(gx + 2, gy + 1), (gx + 1, gy - 1)], fill=(0x4a, 0x6a, 0x3a, 130), width=1)
    # Darker variant stroke
    for i in range(8):
        gx = 4 + (i * 9) % 72
        gy = 2 + (i * 7) % 36
        d.line([(gx, gy), (gx, gy - 1)], fill=(0x2a, 0x4a, 0x1a, 100), width=1)
    path = os.path.join(TILE_DIR, 'terrain_grass_a.png')
    img.save(path)
    print(f'  saved {path}')

def save_terrain_grass_b():
    w, h = 80, 40
    img = Image.new('RGBA', (w, h), RGBA)
    d = ID.Draw(img)
    cx, cy = w // 2, h // 2
    base = (0x4a, 0x6a, 0x3a)
    d.polygon([(cx, 0), (w, cy), (cx, h), (0, cy)], fill=base + (255,))
    d.polygon([(cx, 0), (cx + 6, cy), (cx, cy + 3), (cx - 6, cy)], fill=(0x6a, 0x8a, 0x5a, 60))
    for i in range(16):
        gx = 4 + (i * 4) % 72
        gy = 2 + (i * 3) % 36
        d.line([(gx, gy), (gx - 1, gy - 2)], fill=(0x6a, 0x8a, 0x5a, 150), width=1)
        d.line([(gx + 3, gy + 1), (gx + 2, gy - 1)], fill=(0x5a, 0x7a, 0x4a, 120), width=1)
    for i in range(10):
        gx = 2 + (i * 7) % 76
        gy = 2 + (i * 5) % 36
        d.line([(gx, gy), (gx, gy - 1)], fill=(0x3a, 0x5a, 0x2a, 90), width=1)
    path = os.path.join(TILE_DIR, 'terrain_grass_b.png')
    img.save(path)
    print(f'  saved {path}')

def save_terrain_path():
    w, h = 80, 40
    img = Image.new('RGBA', (w, h), RGBA)
    d = ID.Draw(img)
    cx, cy = w // 2, h // 2
    base = (0x5a, 0x4a, 0x3a)
    d.polygon([(cx, 0), (w, cy), (cx, h), (0, cy)], fill=base + (255,))
    d.polygon([(cx, 0), (cx + 6, cy), (cx, cy + 3), (cx - 6, cy)], fill=(0x6a, 0x5a, 0x4a, 50))
    # Gravel dots
    for i in range(20):
        gx = 4 + (i * 5 + 3) % 72
        gy = 2 + (i * 3 + 7) % 36
        shade = 100 + (i % 3) * 20
        d.point((gx, gy), fill=(shade, shade - 10, shade - 20, 120))
    # Small pebbles
    for i in range(6):
        gx = 6 + (i * 12) % 68
        gy = 4 + (i * 8) % 32
        peb_shade = (80 + i * 10, 70 + i * 8, 60 + i * 6, 150)
        d.ellipse([gx - 1, gy - 1, gx + 1, gy + 1], fill=peb_shade)
    # Wheel rut lines
    d.line([(10, 8), (20, 14)], fill=(0x4a, 0x3a, 0x2a, 80), width=1)
    d.line([(30, 16), (50, 26)], fill=(0x4a, 0x3a, 0x2a, 70), width=1)
    d.line([(55, 28), (70, 36)], fill=(0x4a, 0x3a, 0x2a, 60), width=1)
    path = os.path.join(TILE_DIR, 'terrain_path.png')
    img.save(path)
    print(f'  saved {path}')

def save_terrain_bridge():
    """80x40 isometric diamond with wooden planks."""
    w, h = 80, 40
    img = Image.new('RGBA', (w, h), RGBA)
    d = ID.Draw(img)
    cx, cy = w // 2, h // 2
    base = (0x7a, 0x5a, 0x3a)
    d.polygon([(cx, 0), (w, cy), (cx, h), (0, cy)], fill=base + (255,))
    d.polygon([(cx, 0), (cx + 6, cy), (cx, cy + 3), (cx - 6, cy)], fill=(0x8a, 0x6a, 0x4a, 60))
    # Plank lines across the diamond
    for i in range(-3, 4):
        px = cx + i * 10
        py = cy + i * 2
        d.line([(px - 5, py + 5), (px + 5, py - 5)], fill=(0x5a, 0x3a, 0x1a, 100), width=1)
    # Top surface highlight
    d.polygon([(cx, 2), (cx + 32, cy), (cx, h - 2), (cx - 32, cy)], fill=(0x8a, 0x6a, 0x4a, 180))
    # Nail dots
    for nx, ny in [(-8, -2), (8, -2), (-12, 4), (12, 4)]:
        nail_color = (0xaa, 0x88, 0x66, 200)
        d.point((cx + nx, cy + ny), fill=nail_color)
    path = os.path.join(TILE_DIR, 'terrain_bridge.png')
    img.save(path)
    print(f'  saved {path}')

# ─── Decoration Sprites ───────────────────────────────────────────────────

def deco_tree_pine(d, CX, CY):
    """Conical pine tree ~64x80."""
    # Trunk
    d.rectangle([CX - 4, CY + 12, CX + 4, CY + 30], fill=rgba(0x5a3a1a))
    # Foliage layers (bottom to top, largest to smallest)
    layers = [(0, 60, 20), (0, 44, 16), (0, 28, 12), (0, 14, 8)]
    for dx, by, bw in layers:
        d.polygon([
            (CX, by - bw),
            (CX + bw, by),
            (CX + bw - 4, by),
            (CX, by + 6),
            (CX - bw + 4, by),
            (CX - bw, by),
        ], fill=rgba(0x2a6a1a))
        d.polygon([
            (CX, by - bw + 4),
            (CX + bw - 4, by - 2),
            (CX, by + 4),
            (CX - bw + 4, by - 2),
        ], fill=rgba(0x3a8a2a, 140))
    # Top tip
    d.polygon([(CX, 0), (CX + 4, 10), (CX - 4, 10)], fill=rgba(0x3a8a2a))

def deco_tree_oak(d, CX, CY):
    """Round deciduous tree ~64x80."""
    # Trunk
    d.rectangle([CX - 5, CY + 14, CX + 5, CY + 32], fill=rgba(0x6a4a2a))
    # Main canopy (large circle)
    d.ellipse([CX - 26, CY - 10, CX + 26, CY + 24], fill=rgba(0x3a7a2a))
    d.ellipse([CX - 20, CY - 14, CX + 20, CY + 18], fill=rgba(0x4a8a3a, 180))
    # Highlight patches
    d.ellipse([CX - 14, CY - 6, CX - 2, CY + 4], fill=rgba(0x5a9a4a, 120))
    d.ellipse([CX + 4, CY - 8, CX + 16, CY + 2], fill=rgba(0x5a9a4a, 100))
    # Shadow under canopy
    d.ellipse([CX - 22, CY + 14, CX + 22, CY + 26], fill=rgba(0x2a5a1a, 100))

def deco_bush(d, CX, CY):
    """Green shrub ~48x32."""
    d.ellipse([CX - 16, CY - 6, CX + 16, CY + 12], fill=rgba(0x3a7a2a))
    d.ellipse([CX - 12, CY - 10, CX + 12, CY + 6], fill=rgba(0x4a8a3a))
    d.ellipse([CX - 6, CY - 12, CX + 6, CY + 2], fill=rgba(0x5a9a4a, 150))

def deco_rock(d, CX, CY):
    """Grey stone formation ~48x24."""
    d.ellipse([CX - 14, CY - 6, CX + 14, CY + 6], fill=rgba(0x6a6a7a))
    d.ellipse([CX - 10, CY - 8, CX + 10, CY + 2], fill=rgba(0x7a7a8a))
    d.ellipse([CX - 6, CY - 10, CX + 6, CY], fill=rgba(0x8a8a9a, 160))
    # Crack line
    d.line([(CX - 4, CY - 4), (CX + 2, CY), (CX + 6, CY - 2)], fill=rgba(0x4a4a5a, 100), width=1)

def deco_flower_red(d, CX, CY):
    """Small red flower cluster ~24x24."""
    # Stems
    d.line([(CX - 4, CY), (CX - 4, CY + 4)], fill=rgba(0x44aa33, 150), width=1)
    d.line([(CX + 4, CY - 2), (CX + 4, CY + 4)], fill=rgba(0x44aa33, 150), width=1)
    # Petals
    for ox, oy in [(-4, 0), (4, -2)]:
        d.ellipse([CX + ox - 3, CY + oy - 2, CX + ox + 3, CY + oy + 2], fill=rgba(0xcc3333))
        d.ellipse([CX + ox - 1, CY + oy - 1, CX + ox + 1, CY + oy + 1], fill=rgba(0xff6644, 180))

def deco_flower_yellow(d, CX, CY):
    """Small yellow flower cluster ~24x24."""
    d.line([(CX - 3, CY), (CX - 3, CY + 4)], fill=rgba(0x44aa33, 150), width=1)
    d.line([(CX + 3, CY - 2), (CX + 3, CY + 4)], fill=rgba(0x44aa33, 150), width=1)
    for ox, oy in [(-3, 0), (3, -2)]:
        d.ellipse([CX + ox - 2, CY + oy - 2, CX + ox + 2, CY + oy + 2], fill=rgba(0xddaa33))
        d.ellipse([CX + ox - 1, CY + oy - 1, CX + ox + 1, CY + oy + 1], fill=rgba(0xffdd66, 180))

def deco_fence(d, CX, CY):
    """Wooden fence segment ~40x24."""
    # Horizontal rail
    d.rectangle([CX - 16, CY - 2, CX + 16, CY + 2], fill=rgba(0x6a4a2a))
    # Posts
    d.rectangle([CX - 14, CY - 6, CX - 10, CY + 8], fill=rgba(0x5a3a1a))
    d.rectangle([CX + 10, CY - 6, CX + 14, CY + 8], fill=rgba(0x5a3a1a))
    # Pointed tops
    d.polygon([(CX - 14, CY - 6), (CX - 10, CY - 6), (CX - 12, CY - 10)], fill=rgba(0x5a3a1a))
    d.polygon([(CX + 10, CY - 6), (CX + 14, CY - 6), (CX + 12, CY - 10)], fill=rgba(0x5a3a1a))

def deco_lantern_post(d, CX, CY):
    """Path lantern on post ~24x48."""
    # Post
    d.rectangle([CX - 2, CY + 4, CX + 2, CY + 18], fill=rgba(0x4a3a2a))
    # Lantern housing
    d.rectangle([CX - 6, CY - 6, CX + 6, CY + 4], fill=rgba(0x6a5a3a))
    d.polygon([(CX - 6, CY - 6), (CX + 6, CY - 6), (CX, CY - 12)], fill=rgba(0x6a5a3a))
    # Glow
    d.ellipse([CX - 3, CY - 3, CX + 3, CY + 1], fill=rgba(0xffaa44, 200))
    d.ellipse([CX - 5, CY - 5, CX + 5, CY + 3], fill=rgba(0xffaa44, 60))

def deco_well(d, CX, CY):
    """Stone well ~60x40."""
    # Well rim (ellipse)
    d.ellipse([CX - 20, CY - 8, CX + 20, CY + 8], fill=rgba(0x5a5a6a))
    d.ellipse([CX - 16, CY - 6, CX + 16, CY + 6], fill=rgba(0x3a3a4a))
    # Water inside
    d.ellipse([CX - 12, CY - 4, CX + 12, CY + 4], fill=rgba(0x3a5a8a, 180))
    d.ellipse([CX - 8, CY - 2, CX + 8, CY + 2], fill=rgba(0x5a8acc, 120))
    # Support posts
    d.rectangle([CX - 16, CY - 14, CX - 14, CY - 2], fill=rgba(0x4a3a2a))
    d.rectangle([CX + 14, CY - 14, CX + 16, CY - 2], fill=rgba(0x4a3a2a))
    # Cross beam
    d.rectangle([CX - 16, CY - 16, CX + 16, CY - 14], fill=rgba(0x5a4a3a))
    # Rope
    d.line([(CX - 2, CY - 14), (CX - 2, CY - 4)], fill=rgba(0x8a7a5a, 180), width=1)
    d.line([(CX + 2, CY - 14), (CX + 2, CY - 4)], fill=rgba(0x8a7a5a, 180), width=1)

def deco_signpost(d, CX, CY):
    """Wooden signpost ~24x48."""
    d.rectangle([CX - 2, CY + 4, CX + 2, CY + 20], fill=rgba(0x5a3a1a))
    d.rectangle([CX - 10, CY - 2, CX + 10, CY + 4], fill=rgba(0x6a4a2a))
    d.polygon([(CX - 10, CY - 2), (CX + 10, CY - 2), (CX + 8, CY - 6), (CX - 8, CY - 6)], fill=rgba(0x6a4a2a))
    # Post shadow
    d.rectangle([CX, CY + 4, CX + 2, CY + 20], fill=rgba(0x3a2a0a, 80))
    # Nail dots
    d.point((CX - 6, CY + 1), fill=(0x8a, 0x8a, 0x8a, 255))
    d.point((CX + 6, CY + 1), fill=(0x8a, 0x8a, 0x8a, 255))


DECORATIONS = {
    'decoration_tree_pine':    (64, 80, deco_tree_pine),
    'decoration_tree_oak':     (64, 80, deco_tree_oak),
    'decoration_bush':         (48, 32, deco_bush),
    'decoration_rock':         (48, 24, deco_rock),
    'decoration_flower_red':   (24, 24, deco_flower_red),
    'decoration_flower_yellow':(24, 24, deco_flower_yellow),
    'decoration_fence':        (40, 24, deco_fence),
    'decoration_lantern_post': (24, 48, deco_lantern_post),
    'decoration_well':         (60, 40, deco_well),
    'decoration_signpost':     (24, 48, deco_signpost),
}

# ─── Secret Room Decorations (26 variants, 64x64) ──────────────────────────

import colorsys

def hsv_to_rgba(h, s, v, a=255):
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return (int(r * 255), int(g * 255), int(b * 255), a)

def save_secret_decos():
    shapes = [
        # circle
        lambda d, cx, cy, c: d.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=c) or d.ellipse([cx - 10, cy - 10, cx - 2, cy - 2], fill=hsv_to_rgba(0, 0, 1, 60)),
        # square
        lambda d, cx, cy, c: d.rectangle([cx - 14, cy - 14, cx + 14, cy + 14], fill=c) or d.rectangle([cx - 8, cy - 8, cx + 4, cy + 4], fill=hsv_to_rgba(0, 0, 1, 50)),
        # diamond
        lambda d, cx, cy, c: d.polygon([(cx, cy - 20), (cx + 20, cy), (cx, cy + 20), (cx - 20, cy)], fill=c),
        # triangle
        lambda d, cx, cy, c: d.polygon([(cx, cy - 18), (cx + 14, cy + 10), (cx - 14, cy + 10)], fill=c),
    ]
    for i in range(26):
        hue = i / 26
        main = hsv_to_rgba(hue, 0.55, 0.45)
        accent = hsv_to_rgba(hue, 0.4, 0.7, 120)
        img = Image.new('RGBA', (64, 64), RGBA)
        d = ID.Draw(img)
        cx, cy = 32, 32
        # Shadow
        d.ellipse([cx - 16, cy + 14, cx + 16, cy + 22], fill=(0, 0, 0, 40))
        # Main shape
        shapes[i % 4](d, cx, cy, main)
        # Accent dot
        d.ellipse([cx + 6, cy + 6, cx + 10, cy + 10], fill=accent)
        path = os.path.join(TILE_DIR, f'secret_deco_{i}.png')
        img.save(path)
        print(f'  saved {path}')

# ─── Main ─────────────────────────────────────────────────────────────────

def main():
    print('Generating secret room decorations...')
    save_secret_decos()
    print('Done — 26 secret room decorations.')

if __name__ == '__main__':
    main()
