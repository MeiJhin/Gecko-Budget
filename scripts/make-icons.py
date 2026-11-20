"""Génère toutes les icônes de Gecko Budget à partir de assets/gecko-budget-icon-512.png.
Lancer : python3 scripts/make-icons.py  (nécessite Pillow et numpy)"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = Image.open(ROOT / "assets/gecko-budget-icon-512.png").convert("RGBA")
OUT = ROOT / "public/icons"
SPLASH = ROOT / "public/splash"
OUT.mkdir(parents=True, exist_ok=True)
SPLASH.mkdir(parents=True, exist_ok=True)

# Carré plein (sans coins arrondis transparents) : on retire la marge des coins.
INSET = 36
full = SRC.crop((INSET, INSET, 512 - INSET, 512 - INSET)).convert("RGB")


def padded(img: Image.Image, size: int, scale: float) -> Image.Image:
    """Réduit l'image et prolonge ses bords pour remplir tout le carré (dégradé continu)."""
    inner = round(size * scale)
    small = np.asarray(img.resize((inner, inner), Image.LANCZOS))
    pad = (size - inner) // 2
    rest = size - inner - pad
    arr = np.pad(small, ((pad, rest), (pad, rest), (0, 0)), mode="edge")
    return Image.fromarray(arr)


# Icônes classiques (coins arrondis transparents, comme le fichier fourni)
for s in (512, 192):
    SRC.resize((s, s), Image.LANCZOS).save(OUT / f"icon-{s}.png", optimize=True)

# Icône « maskable » : le gecko reste dans la zone de sécurité (cercle de 80 %)
for s in (512, 192):
    padded(full, s, 0.76).save(OUT / f"maskable-{s}.png", optimize=True)

# iPhone : carré plein, iOS arrondit lui-même les coins
padded(full, 180, 0.94).save(OUT / "apple-touch-icon.png", optimize=True)
padded(full, 180, 0.94).save(ROOT / "public/apple-touch-icon.png", optimize=True)

# Favicons
for s in (16, 32, 48, 64):
    SRC.resize((s, s), Image.LANCZOS).save(OUT / f"favicon-{s}.png", optimize=True)
SRC.save(ROOT / "public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

# Logo de l'en-tête (affiché en 40 px, fichier en 128 px pour les écrans nets)
SRC.resize((128, 128), Image.LANCZOS).save(OUT / "logo-128.png", optimize=True)

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
        logo = SRC.resize((logo_s, logo_s), Image.LANCZOS)
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
