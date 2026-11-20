"""Génère toutes les icônes de Gecko Budget à partir du fichier SVG fourni.
Lancer d'abord : node scripts/render-svg.cjs  (SVG → PNG 1024 px)
puis          : python3 scripts/make-icons.py  (nécessite Pillow)"""
from pathlib import Path
import shutil
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
R = ROOT / "assets/rendered"
SRC = Image.open(R / "icon-1024.png").convert("RGBA")       # coins arrondis transparents
FULL = Image.open(R / "full-1024.png").convert("RGB")       # carré plein
MASK = Image.open(R / "maskable-1024.png").convert("RGB")   # carré plein + marge de sécurité
OUT = ROOT / "public/icons"
SPLASH = ROOT / "public/splash"
OUT.mkdir(parents=True, exist_ok=True)
SPLASH.mkdir(parents=True, exist_ok=True)

def sized(img, s):
    return img.resize((s, s), Image.LANCZOS)

# Icônes classiques (coins arrondis, comme le SVG)
for s in (512, 192):
    sized(SRC, s).save(OUT / f"icon-{s}.png", optimize=True)

# Icônes « maskable » (Android découpe en rond, en goutte… : le gecko reste visible)
for s in (512, 192):
    sized(MASK, s).save(OUT / f"maskable-{s}.png", optimize=True)

# iPhone : carré plein, iOS arrondit lui-même les coins
sized(FULL, 180).save(OUT / "apple-touch-icon.png", optimize=True)
sized(FULL, 180).save(ROOT / "public/apple-touch-icon.png", optimize=True)

# Favicons (le SVG lui-même pour les navigateurs récents)
shutil.copy(ROOT / "assets/gecko-budget-icon.svg", ROOT / "public/favicon.svg")
for s in (16, 32, 48, 64):
    sized(SRC, s).save(OUT / f"favicon-{s}.png", optimize=True)
sized(SRC, 256).save(ROOT / "public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

# Logo de l'en-tête (affiché en 40 px, fichier en 128 px pour les écrans nets)
sized(SRC, 128).save(OUT / "logo-128.png", optimize=True)

# Écrans de démarrage iPhone (fond #F2F1EE / sombre, logo au centre + nom)
BG_LIGHT = (242, 241, 238)
BG_DARK = (14, 17, 23)
FONT = None
for cand in [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]:
    if Path(cand).exists():
        FONT = cand
        break

# (largeur CSS, hauteur CSS, ratio de pixels)
DEVICES = [
    (440, 956, 3), (430, 932, 3), (402, 874, 3), (393, 852, 3), (428, 926, 3),
    (390, 844, 3), (375, 812, 3), (414, 896, 3), (414, 896, 2), (375, 667, 2), (320, 568, 2),
]
for w, h, r in DEVICES:
    W, H = w * r, h * r
    for mode, bg, fg in (("light", BG_LIGHT, (14, 47, 51)), ("dark", BG_DARK, (243, 244, 246))):
        img = Image.new("RGB", (W, H), bg)
        logo_s = int(W * 0.30)
        logo = sized(SRC, logo_s)
        y = int(H * 0.42 - logo_s / 2)
        img.paste(logo, ((W - logo_s) // 2, y), logo)
        if FONT:
            d = ImageDraw.Draw(img)
            f = ImageFont.truetype(FONT, int(W * 0.065))
            t = "Gecko Budget"
            tw = d.textlength(t, font=f)
            d.text(((W - tw) / 2, y + logo_s + W * 0.06), t, font=f, fill=fg)
        img.save(SPLASH / f"splash-{w}x{h}@{r}x-{mode}.png", optimize=True)

print("Icônes générées dans public/icons et public/splash")
