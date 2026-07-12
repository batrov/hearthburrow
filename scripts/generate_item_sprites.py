"""Generate item PNG sprites matching TextureGenerator.ts output.
Draws at 96x96 (4x of the original 24x24), downscales to 32x32 for smooth anti-aliased edges.
"""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'sprites', 'items')
os.makedirs(OUT, exist_ok=True)

BIG = 96
SM = 32
CX = 48
CY = 48


def c(x):
    return x * 4


def rgba(hex_color):
    return ((hex_color >> 16) & 0xff, (hex_color >> 8) & 0xff, hex_color & 0xff, 255)


def rgba_a(hex_color, a):
    return ((hex_color >> 16) & 0xff, (hex_color >> 8) & 0xff, hex_color & 0xff, int(a * 255))


def save_big(name, draw_fn):
    img = Image.new('RGBA', (BIG, BIG), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(img))
    img = img.resize((SM, SM), Image.LANCZOS)
    img.save(os.path.join(OUT, f'{name}.png'))


# ── Pickaxes ──────────────────────────────────────────────
PICKAXES = {
    'pickaxe_1': (0x8a6a3a, 0x6a4a2a),
    'pickaxe_2': (0xcc8844, 0x6a4a2a),
    'pickaxe_3': (0x88bbdd, 0x6a4a2a),
    'pickaxe_4': (0xddbb44, 0x6a4a2a),
    'pickaxe_5': (0x44aa55, 0x6a4a2a),
    'pickaxe_6': (0x8855aa, 0x6a4a2a),
    'pickaxe_7': (0x88ddff, 0xccccdd),
    'pickaxe_8': (0xdd5533, 0x443322),
    'pickaxe_9': (0x8844bb, 0x222233),
}
for name, (head, handle) in PICKAXES.items():
    def make(head=head, handle=handle):
        def draw(d):
            lw = c(2)
            hc = rgba(head)
            hdc = rgba(handle)
            d.line([(CX + c(-6), CY + c(-8)), (CX + c(-1), CY)], fill=hc, width=lw)
            d.line([(CX + c(-1), CY), (CX + c(6), CY + c(-6))], fill=hc, width=lw)
            d.line([(CX, CY), (CX + c(1), CY + c(8))], fill=hdc, width=lw)
        return draw
    save_big(name, make())

# ── Rings ─────────────────────────────────────────────────
RINGS = {
    'ring_critical': 0xcc3333,
    'ring_damage':   0xdd8833,
    'ring_precision': 0x3388cc,
    'ring_hunter':   0x44aa44,
}
for name, gem in RINGS.items():
    def make(gem=gem):
        def draw(d):
            r = c(6)
            d.ellipse([CX - r, CY - r, CX + r, CY + r], outline=rgba(0xccccaa), width=c(2))
            r2 = c(3)
            d.ellipse([CX - r2, CY - r2, CX + r2, CY + r2], fill=rgba(gem))
        return draw
    save_big(name, make())

# ── Boots ─────────────────────────────────────────────────
BOOTS = {
    'boots_stamina_bronze': (0xcc8844, None),
    'boots_stamina_silver': (0x88bbdd, None),
    'boots_stamina_gold':   (0xddbb44, None),
    'boots_luck_bronze':    (0xcc8844, 0x44dd44),
    'boots_luck_silver':    (0x88bbdd, 0x44dd44),
    'boots_luck_gold':      (0xddbb44, 0x44dd44),
    'boots_regen':          (0x88cc88, 0xffffff),
}
for name, (body, accent) in BOOTS.items():
    def make(body=body, accent=accent):
        def draw(d):
            bc = rgba(body)
            d.rectangle(
                [CX + c(-5), CY + c(-4), CX + c(-5) + c(10), CY + c(-4) + c(8)],
                fill=bc,
            )
            d.rectangle(
                [CX + c(-7), CY + c(1), CX + c(-7) + c(14), CY + c(1) + c(4)],
                fill=bc,
            )
            if accent:
                ar = c(2)
                d.ellipse(
                    [CX + c(-1) - ar, CY + c(-1) - ar, CX + c(-1) + ar, CY + c(-1) + ar],
                    fill=rgba(accent),
                )
        return draw
    save_big(name, make())

# ── Lanterns ──────────────────────────────────────────────
LANTERNS = {
    'lantern_bronze': (0x8a6a3a, 0xff8844),
    'lantern_silver': (0x888899, 0x88ccff),
    'lantern_gold':   (0xccaa44, 0xffdd66),
}
for name, (body, glow) in LANTERNS.items():
    def make(body=body, glow=glow):
        def draw(d):
            d.rectangle(
                [CX + c(-5), CY + c(-8), CX + c(-5) + c(10), CY + c(-8) + c(12)],
                outline=rgba(body), width=c(2),
            )
            gr = c(4)
            d.ellipse(
                [CX - gr, CY + c(-2) - gr, CX + gr, CY + c(-2) + gr],
                fill=rgba(glow),
            )
        return draw
    save_big(name, make())

# ── Consumables ───────────────────────────────────────────
save_big('stamina_potion', lambda d: (
    d.rectangle(
        [CX + c(-3), CY + c(-8), CX + c(-3) + c(6), CY + c(-8) + c(4)],
        fill=rgba(0xcccccc),
    ),
    d.rounded_rectangle(
        [CX + c(-5), CY + c(-4), CX + c(-5) + c(10), CY + c(-4) + c(10)],
        radius=c(3), fill=rgba(0x44dd66),
    ),
))

save_big('teleport_scroll', lambda d: (
    d.rounded_rectangle(
        [CX + c(-7), CY + c(-9), CX + c(-7) + c(14), CY + c(-9) + c(18)],
        radius=c(2), fill=rgba(0xddddaa),
    ),
    d.rectangle(
        [CX + c(-3), CY + c(-2), CX + c(-3) + c(6), CY + c(-2) + c(4)],
        fill=rgba(0xcc6644),
    ),
))

save_big('mining_bomb', lambda d: (
    d.ellipse([CX - c(7), CY - c(7), CX + c(7), CY + c(7)], fill=rgba(0x666666)),
    d.rectangle(
        [CX + c(-1), CY + c(-11), CX + c(-1) + c(2), CY + c(-11) + c(5)],
        fill=rgba(0x888888),
    ),
    d.ellipse([CX + c(-2), CY + c(3) - c(2), CX + c(2), CY + c(3) + c(2)], fill=rgba(0xff6644)),
))

# ── Arrows (drawn directly at 32x32) ────────────────────
def save_arrow(name, left_facing):
    img = Image.new('RGBA', (SM, SM), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    C = SM // 2
    if left_facing:
        d.polygon([(6, C), (C, 5), (C, SM - 5)], fill=(204, 204, 204, 255))
        d.polygon([(C + 6, 4), (SM - 4, 2), (SM - 4, SM - 2)], fill=(136, 136, 136, 255))
    else:
        d.polygon([(SM - 6, C), (C, 5), (C, SM - 5)], fill=(204, 204, 204, 255))
        d.polygon([(C - 6, 4), (4, 2), (4, SM - 2)], fill=(136, 136, 136, 255))
    img.save(os.path.join(OUT, f'{name}.png'))

save_arrow('arrow_left', True)
save_arrow('arrow_right', False)

# ── Character Portrait (256x256) ──────────────────────────
PORT = 256
PHC = 128

portrait = Image.new('RGBA', (PORT, PORT), (0, 0, 0, 0))
pd = ImageDraw.Draw(portrait)

pd.ellipse([20, 20, PORT - 20, PORT - 20], fill=(26, 26, 46, 255), outline=(58, 42, 90, 255), width=3)

pd.polygon([(PHC - 60, 180), (PHC - 80, PORT - 10), (PHC + 80, PORT - 10), (PHC + 60, 180)], fill=(42, 26, 62, 255))
pd.polygon([(PHC - 40, 170), (PHC - 50, PORT), (PHC + 50, PORT), (PHC + 40, 170)], fill=(58, 42, 78, 255))

pd.ellipse([PHC - 70, 140, PHC - 20, 200], fill=(58, 42, 78, 255))
pd.ellipse([PHC + 20, 140, PHC + 70, 200], fill=(58, 42, 78, 255))

pd.rectangle([PHC - 12, 110, PHC + 12, 145], fill=(221, 200, 160, 255))
pd.ellipse([PHC - 42, 30, PHC + 42, 120], fill=(221, 200, 160, 255))

pd.ellipse([PHC - 44, 25, PHC + 44, 75], fill=(90, 58, 26, 255))
pd.ellipse([PHC - 38, 20, PHC - 10, 55], fill=(74, 42, 10, 255))
pd.ellipse([PHC + 10, 20, PHC + 38, 55], fill=(74, 42, 10, 255))

pd.ellipse([PHC - 16, 65, PHC - 6, 78], fill=(255, 255, 255, 255))
pd.ellipse([PHC + 6, 65, PHC + 16, 78], fill=(255, 255, 255, 255))
pd.ellipse([PHC - 13, 69, PHC - 9, 75], fill=(68, 170, 221, 255))
pd.ellipse([PHC + 9, 69, PHC + 13, 75], fill=(68, 170, 221, 255))
pd.point((PHC - 11, 72), fill=(255, 255, 255, 255))
pd.point((PHC + 11, 72), fill=(255, 255, 255, 255))

pd.ellipse([PHC - 8, 94, PHC + 8, 102], fill=(138, 90, 74, 255))

pd.rectangle([PHC - 25, 110, PHC + 25, 130], fill=(138, 58, 58, 255))
pd.rectangle([PHC - 30, 125, PHC - 15, 145], fill=(138, 58, 58, 255))
pd.rectangle([PHC + 15, 125, PHC + 30, 145], fill=(138, 58, 58, 255))

pd.line([PHC - 8, 150, PHC - 2, 158], fill=(136, 136, 136, 255), width=3)
pd.line([PHC - 2, 158, PHC + 6, 152], fill=(136, 136, 136, 255), width=3)
pd.line([PHC - 1, 157, PHC - 1, 167], fill=(106, 74, 42, 255), width=3)

portrait.save(os.path.join(os.path.dirname(OUT), 'player', 'portrait.png'))

count = len(PICKAXES) + len(RINGS) + len(BOOTS) + len(LANTERNS) + 5
print(f'Generated {count} item sprites + portrait')
