"""
Builds every logo asset the site uses from ONE source image (the logo on a
plain background): transparent cut-outs, favicon, home-screen icon and the
link-preview image.

Needs: pip install pillow numpy scipy
Run:   python3 scripts/brand-assets.py brand/filamint-logo-original.jpg

Writes:
  src/assets/brand/mark.png          icon only (header, footer, login)
  src/assets/brand/logo.png          icon + wordmark
  src/app/icon.png, apple-icon.png, favicon.ico, opengraph-image.png
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

CREAM = (255, 246, 234)  # the site's background (--color-cream)
ROOT = Path(__file__).resolve().parent.parent

src = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "brand/filamint-logo-original.jpg")
rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
h, w, _ = rgb.shape

# ── 1. Find the background: the flat color the image edge is made of ─────────
edge = np.concatenate([rgb[:12].reshape(-1, 3), rgb[-12:].reshape(-1, 3), rgb[:, :12].reshape(-1, 3), rgb[:, -12:].reshape(-1, 3)])
bg = np.median(edge, axis=0)
near_bg = np.abs(rgb - bg).max(axis=2) <= 14  # tolerance covers JPEG noise

# Only background that touches the image edge counts, so cream *inside* the
# artwork (e.g. letter counters) is left alone.
labels, _ = ndimage.label(near_bg)
edge_labels = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
is_bg = np.isin(labels, list(edge_labels))
fg = ~is_bg

# Drop stray specks left by JPEG noise.
fg_labels, n = ndimage.label(fg)
sizes = ndimage.sum(fg, fg_labels, range(1, n + 1))
fg = np.isin(fg_labels, [i + 1 for i, s in enumerate(sizes) if s >= 300])

# ── 2. Clean edges: no cream halo on dark backgrounds ────────────────────────
# Take colors from the solid interior, and soften only the alpha.
core = ndimage.binary_erosion(fg, iterations=2)
_, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
clean = rgb[iy, ix]
alpha = np.clip(ndimage.gaussian_filter(fg.astype(np.float32), 0.8) * 1.15, 0, 1)
rgba = np.dstack([clean, alpha * 255]).round().astype(np.uint8)
cut = Image.fromarray(rgba)

# ── 3. Split icon from wordmark at the emptiest row between them ─────────────
rows = fg.sum(axis=1)
ys = np.where(rows > 0)[0]
top, bottom = ys.min(), ys.max()
search = np.arange(int(top + (bottom - top) * 0.55), int(top + (bottom - top) * 0.8))
split = int(search[np.argmin(rows[search])])


def crop_to_content(img: Image.Image, box, pad=6) -> Image.Image:
    part = img.crop(box)
    bbox = part.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    x0, y0, x1, y1 = bbox
    return part.crop((max(0, x0 - pad), max(0, y0 - pad), min(part.width, x1 + pad), min(part.height, y1 + pad)))


mark = crop_to_content(cut, (0, 0, w, split))
logo = crop_to_content(cut, (0, 0, w, h), pad=10)


def fit(img: Image.Image, box_w: int, box_h: int) -> Image.Image:
    scale = min(box_w / img.width, box_h / img.height)
    return img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)


def canvas(size, color=None):
    return Image.new("RGBA", size, (*color, 255) if color else (0, 0, 0, 0))


def paste_center(base: Image.Image, img: Image.Image):
    base.alpha_composite(img, ((base.width - img.width) // 2, (base.height - img.height) // 2))
    return base


out_assets = ROOT / "src/assets/brand"
out_app = ROOT / "src/app"
out_assets.mkdir(parents=True, exist_ok=True)

# Header/footer mark and full lockup (kept a bit larger than displayed, for sharp retina screens).
fit(mark, 384, 384).save(out_assets / "mark.png", optimize=True)
fit(logo, 900, 900).save(out_assets / "logo.png", optimize=True)

# Browser tab icon, home-screen icon (opaque: iOS masks it), multi-size .ico.
icon = paste_center(canvas((256, 256)), fit(mark, 240, 240))
icon.save(out_app / "icon.png", optimize=True)
paste_center(canvas((180, 180), CREAM), fit(mark, 136, 136)).convert("RGB").save(out_app / "apple-icon.png", optimize=True)
icon.save(out_app / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# Link-preview card (Facebook, iMessage, Slack, X…): 1200×630.
paste_center(canvas((1200, 630), CREAM), fit(logo, 900, 470)).convert("RGB").save(out_app / "opengraph-image.png", optimize=True)

print(f"background {bg.round().astype(int).tolist()}, icon/wordmark split at row {split}")
print(f"mark {fit(mark, 384, 384).size}, logo {fit(logo, 900, 900).size}")
