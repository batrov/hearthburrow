#!/usr/bin/env python3
"""Generate placeholder building sprite PNGs matching the procedural drawBuildingShape logic.

Output: public/assets/sprites/tiles/building_*.png, gate_glow.png
Replace any PNG with your own sprite to override the procedural fallback.
"""

from PIL import Image, ImageDraw as ID

TARGET_DIR = 'public/assets/sprites/tiles'

BUILDING_COLORS: dict[str, tuple[int, int, int]] = {
    'trading_post': (0x8a6a3a, 0x6a4a2a, 0x5a3a1a),
    'crafting':     (0x6a7a8a, 0x4a5a6a, 0x3a4a5a),
    'farm':         (0x5a7a3a, 0x3a5a2a, 0x2a4a1a),
    'tavern':       (0x6a3a1a, 0x4a2a0a, 0x3a1a00),
    'storage':      (0x6a5a4a, 0x4a3a2a, 0x3a2a1a),
    'laboratory':   (0x6a4a8a, 0x4a2a6a, 0x3a1a5a),
    'gate':         (0x3a2a5a, 0x2a1a4a, 0x1a0a3a),
}

WALL_HEIGHT = 20


def hex_to_rgb(h: int) -> tuple[int, int, int]:
    return ((h >> 16) & 0xFF, (h >> 8) & 0xFF, h & 0xFF)


def draw_building_shape(draw: ID.Draw, w: int, h: int, gw: int, gh: int,
                         top: int, left: int, right: int) -> None:
    cx, cy = w / 2, h / 2

    bn = (cx + gh * 20, cy - gh * 10)
    bs = (cx - gh * 20, cy + gh * 10)
    bw = (cx - gw * 20, cy - gw * 10)
    be = (cx + gw * 20, cy + gw * 10)

    bn_t = (bn[0], bn[1] - WALL_HEIGHT)
    bs_t = (bs[0], bs[1] - WALL_HEIGHT)
    bw_t = (bw[0], bw[1] - WALL_HEIGHT)
    be_t = (be[0], be[1] - WALL_HEIGHT)

    # Left wall face
    draw.polygon([bw, bs, bs_t, bw_t], fill=hex_to_rgb(left))

    # Right wall face
    draw.polygon([bs, be, be_t, bs_t], fill=hex_to_rgb(right))

    # Roof (top face)
    draw.polygon([bn_t, be_t, bs_t, bw_t], fill=hex_to_rgb(top))


def main() -> None:
    for bid, (top, left, right) in BUILDING_COLORS.items():
        gw = 2 if bid == 'gate' else 3
        gh = 1 if bid == 'gate' else 3
        cw = 120 if bid == 'gate' else 160
        ch = 80 if bid == 'gate' else 120

        img = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        drw = ID.Draw(img)
        draw_building_shape(drw, cw, ch, gw, gh, top, left, right)

        path = f'{TARGET_DIR}/building_{bid}.png'
        img.save(path)
        print(f'  saved {path}  ({cw}×{ch})')

    # Gate glow diamond
    img = Image.new('RGBA', (80, 40), (0, 0, 0, 0))
    drw = ID.Draw(img)
    drw.polygon([(40, 0), (80, 20), (40, 40), (0, 20)],
                fill=(0x8a, 0x7a, 0xba, 77))
    drw.polygon([(40, 0), (80, 20), (40, 40), (0, 20)],
                fill=(0x6a, 0x5a, 0x9a, 51))
    path = f'{TARGET_DIR}/gate_glow.png'
    img.save(path)
    print(f'  saved {path}  (80×40)')


if __name__ == '__main__':
    main()
