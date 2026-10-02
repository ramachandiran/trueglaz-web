#!/usr/bin/env python3
"""
Catalogue thumbnails: one square, white-background image per product model.

Three jobs, run independently:

  --manifest     rewrite MANIFEST.json from the live catalogue
  --fetch        download each model's image from the source URL in the manifest
  --normalise    trim any dropped-in file to its subject and centre it on a
                 white square canvas, which is what makes a row of mixed
                 sources look like one shelf rather than a scrapbook
  --placeholders draw a typeset stand-in for every model that still has no
                 real photograph, so the catalogue is never visibly broken

Files are named for the model slug and nothing else. The slug already carries
the brand ("canon-eos-r5"), and a flat folder means the front end can resolve
an image from a slug alone, with no index to keep in step.
"""
import argparse, io, json, os, re, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "apps/web/public/model-images"
MANIFEST = ROOT / "assets/model-images/MANIFEST.json"
API = os.environ.get("TG_API", "http://localhost:5174/api/v1")

SIZE = 1200          # square canvas, generous enough to crop a 600px tile from
PAD = 0.08           # breathing room so nothing touches the edge
WHITE = (255, 255, 255)

# Where a human should go to find each brand's own photography. Filled into the
# manifest so whoever populates the folder is not left guessing, and so the
# fetch step has something to work from once the images are licensed.
BRAND_SOURCES = {
    "Canon":     "https://www.canon.co.in/cameras",
    "Nikon":     "https://www.nikon.co.in/en_IN/products",
    "Sony":      "https://www.sony.co.in/electronics/interchangeable-lens-cameras",
    "Fujifilm":  "https://fujifilm-x.com/en-us/products/",
    "Sigma":     "https://www.sigma-global.com/en/lenses/",
    "Tamron":    "https://www.tamron.com/global/consumer/lenses/",
    "Panasonic": "https://www.panasonic.com/global/consumer/lumix.html",
}


def get(path):
    import urllib.error
    try:
        with urllib.request.urlopen(f"{API}{path}", timeout=20) as r:
            return json.load(r)
    except (urllib.error.URLError, OSError) as e:
        sys.exit(f"Could not reach the API at {API}{path}: {e}\nStart it, or set TG_API.")


def models():
    """Every active model, from the running API, with its brand and category."""
    # The model payload carries ids rather than names, so the two lookup tables
    # come along to turn them into something a person can read in the manifest.
    brands = {b["id"]: b["name"] for b in get("/brands")}
    cats = {c["id"]: c["name"] for c in get("/categories")}
    out = []
    for m in get("/models?size=500").get("content", []):
        if m.get("status") != "active" or m.get("deletedAt"):
            continue
        brand = brands.get(m["brandId"], "")
        out.append({
            "slug": m["slug"],
            "name": m["name"],
            "brand": brand,
            "category": cats.get(m["categoryId"], ""),
            "file": f"{m['slug']}.webp",
            "sourcePage": BRAND_SOURCES.get(brand, ""),
            "imageUrl": "",      # filled in by hand, or by whoever licenses the asset
            "credit": "",        # required before a fetched image may be published
        })
    return sorted(out, key=lambda m: (m["category"], m["brand"], m["name"]))


def write_manifest():
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    rows = models()
    MANIFEST.write_text(json.dumps({
        "note": "imageUrl and credit are blank on purpose. A brand's product "
                "photography is theirs; fill these in only for images you have "
                "the right to publish on a resale marketplace.",
        "canvas": {"size": SIZE, "background": "#ffffff", "format": "webp"},
        "models": rows,
    }, indent=2) + "\n")
    print(f"MANIFEST.json <- {len(rows)} models")


def load_manifest():
    if not MANIFEST.exists():
        sys.exit(f"No manifest at {MANIFEST}. Run with --manifest first.")
    return json.loads(MANIFEST.read_text())["models"]


def canvas(img):
    """Trim to the subject, then centre on a white square."""
    from PIL import Image, ImageChops
    img = img.convert("RGBA")

    # Flatten onto white first: a PNG with a transparent surround would
    # otherwise trim to nothing, and transparency has no meaning once the
    # background is white anyway.
    flat = Image.new("RGB", img.size, WHITE)
    flat.paste(img, mask=img.split()[3])

    # Trim whatever matches the corner pixel, which is the studio background on
    # essentially every product shot.
    bg = Image.new("RGB", flat.size, flat.getpixel((0, 0)))
    box = ImageChops.difference(flat, bg).convert("L").point(lambda p: 255 if p > 12 else 0).getbbox()
    if box:
        flat = flat.crop(box)

    inner = int(SIZE * (1 - 2 * PAD))
    scale = min(inner / flat.width, inner / flat.height)
    # Never upscale: a small source enlarged looks worse than a small source.
    scale = min(scale, 1.0)
    w, h = max(1, round(flat.width * scale)), max(1, round(flat.height * scale))
    flat = flat.resize((w, h), Image.LANCZOS)

    out = Image.new("RGB", (SIZE, SIZE), WHITE)
    out.paste(flat, ((SIZE - w) // 2, (SIZE - h) // 2))
    return out


def save(img, slug):
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f"{slug}.webp"
    img.save(p, "WEBP", quality=88, method=6)
    return p


def fetch():
    rows = [m for m in load_manifest() if m.get("imageUrl")]
    if not rows:
        print("Nothing to fetch: every imageUrl in the manifest is blank.")
        print("Fill them in for images you have the right to publish, then re-run.")
        return
    from PIL import Image
    ok = bad = 0
    for m in rows:
        try:
            req = urllib.request.Request(m["imageUrl"], headers={"User-Agent": "trueglaz-catalogue/1.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read()
            p = save(canvas(Image.open(io.BytesIO(raw))), m["slug"])
            print(f"  ok   {m['slug']:36s} {len(raw)//1024:>5} KB -> {p.name}")
            ok += 1
        except Exception as e:
            print(f"  FAIL {m['slug']:36s} {e}")
            bad += 1
    print(f"\n{ok} fetched, {bad} failed")


def normalise():
    """Re-canvas anything a human dropped into assets/model-images/incoming/."""
    from PIL import Image
    src = MANIFEST.parent / "incoming"
    src.mkdir(parents=True, exist_ok=True)
    known = {m["slug"] for m in load_manifest()}
    n = 0
    for f in sorted(src.iterdir()):
        if f.is_dir() or f.name.startswith("."):
            continue
        slug = f.stem
        if slug not in known:
            print(f"  skip {f.name}: '{slug}' is not a model slug")
            continue
        save(canvas(Image.open(f)), slug)
        print(f"  ok   {slug}")
        n += 1
    print(f"\n{n} normalised" if n else f"\nNothing in {src}")


def placeholders(force=False):
    """
    A typeset stand-in, not an imitation of a product photograph.

    It has to be obviously a placeholder at a glance: a buyer who cannot tell
    the difference between this and a picture of the thing they are buying is
    being misled, which matters more here than the tile looking full.
    """
    from PIL import Image, ImageDraw, ImageFont
    rows = load_manifest()
    font = lambda sz, bold=False: ImageFont.truetype(
        f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'-Bold' if bold else ''}.ttf", sz)
    made = skipped = 0
    for m in rows:
        p = OUT / f"{m['slug']}.webp"
        if p.exists() and not force:
            skipped += 1
            continue
        img = Image.new("RGB", (SIZE, SIZE), WHITE)
        d = ImageDraw.Draw(img)

        # A dashed border reads as "nothing here yet" in a way a solid frame does not.
        inset, dash = 90, 26
        for x in range(inset, SIZE - inset, dash * 2):
            d.line([(x, inset), (min(x + dash, SIZE - inset), inset)], fill=(214, 214, 214), width=4)
            d.line([(x, SIZE - inset), (min(x + dash, SIZE - inset), SIZE - inset)], fill=(214, 214, 214), width=4)
        for y in range(inset, SIZE - inset, dash * 2):
            d.line([(inset, y), (inset, min(y + dash, SIZE - inset))], fill=(214, 214, 214), width=4)
            d.line([(SIZE - inset, y), (SIZE - inset, min(y + dash, SIZE - inset))], fill=(214, 214, 214), width=4)

        def centre(text, y, f, fill):
            w = d.textbbox((0, 0), text, font=f)[2]
            d.text(((SIZE - w) // 2, y), text, font=f, fill=fill)

        # Brand only. Every surface that shows this image already prints the
        # model name directly beneath it, and at tile size a second copy inside
        # the picture is unreadable and repetitive.
        glyph_r = 170
        block = glyph_r * 2 + 70 + 40 + 30 + 34
        top = (SIZE - block) // 2

        glyph = camera_glyph if "Camera" in m["category"] else lens_glyph
        glyph(d, SIZE // 2, top + glyph_r, glyph_r)

        y = top + glyph_r * 2 + 70
        centre(m["brand"].upper(), y, font(40, True), (122, 122, 122))
        y += 40 + 30
        centre("no photograph yet", y, font(32), (170, 170, 170))

        save(img, m["slug"])
        made += 1
    print(f"{made} placeholders written" + (f", {skipped} left alone (already have an image)" if skipped else ""))


def camera_glyph(d, cx, cy, r):
    body = (108, 108, 108)
    d.rounded_rectangle([cx - r, cy - r * 0.62, cx + r, cy + r * 0.62], radius=22, outline=body, width=9)
    d.rounded_rectangle([cx - r * 0.34, cy - r * 0.86, cx + r * 0.1, cy - r * 0.58], radius=10, outline=body, width=9)
    d.ellipse([cx - r * 0.42, cy - r * 0.42, cx + r * 0.42, cy + r * 0.42], outline=body, width=9)
    d.ellipse([cx - r * 0.2, cy - r * 0.2, cx + r * 0.2, cy + r * 0.2], outline=body, width=7)
    d.ellipse([cx + r * 0.6, cy - r * 0.38, cx + r * 0.76, cy - r * 0.22], fill=body)


def lens_glyph(d, cx, cy, r):
    body = (108, 108, 108)
    d.rounded_rectangle([cx - r * 0.72, cy - r * 0.78, cx + r * 0.72, cy + r * 0.78], radius=18, outline=body, width=9)
    for dy in (-0.34, 0.06):
        d.line([(cx - r * 0.72, cy + r * dy), (cx + r * 0.72, cy + r * dy)], fill=body, width=7)
    d.ellipse([cx - r * 0.44, cy + r * 0.2, cx + r * 0.44, cy + r * 0.74], outline=body, width=8)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", action="store_true")
    ap.add_argument("--fetch", action="store_true")
    ap.add_argument("--normalise", action="store_true")
    ap.add_argument("--placeholders", action="store_true")
    ap.add_argument("--force", action="store_true", help="overwrite images that already exist")
    a = ap.parse_args()
    if not any([a.manifest, a.fetch, a.normalise, a.placeholders]):
        ap.print_help(); sys.exit(1)
    if a.manifest: write_manifest()
    if a.fetch: fetch()
    if a.normalise: normalise()
    if a.placeholders: placeholders(a.force)
