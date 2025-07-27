"""Draws the Chrome extension icons into extension/icons/.

A white knight on the app's dark surface, over a cyan evaluation curve.
Drawn once at 512 px and downscaled, so the small sizes stay smooth.
Needs Pillow and a font with chess glyphs (Apple Symbols on macOS).

    python3 scripts/build-extension-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE = 512
BG = (17, 19, 28)  # --color-well
FG = (238, 240, 250)  # --color-fg
ACCENT = (45, 212, 255)  # --color-accent
FONT = "/System/Library/Fonts/Apple Symbols.ttf"
OUT = Path(__file__).resolve().parent.parent / "extension" / "icons"

image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((8, 8, SIZE - 8, SIZE - 8), radius=104, fill=BG)

# Evaluation curve along the bottom, ending in a dot like the review graph.
curve = [(70, 400), (150, 392), (215, 405), (270, 360), (330, 372), (390, 318), (442, 300)]
draw.line(curve, fill=ACCENT, width=26, joint="curve")
draw.ellipse((442 - 30, 300 - 30, 442 + 30, 300 + 30), fill=ACCENT, outline=BG, width=10)

knight = "♞"
font = ImageFont.truetype(FONT, 330)
left, top, right, bottom = draw.textbbox((0, 0), knight, font=font)
x = (SIZE - (right - left)) / 2 - left
y = 185 - (bottom - top) / 2 - top
draw.text((x, y), knight, font=font, fill=FG)

OUT.mkdir(parents=True, exist_ok=True)
for size in (16, 32, 48, 128):
    image.resize((size, size), Image.LANCZOS).save(OUT / f"icon-{size}.png")
print(f"wrote {OUT}")
