"""Prepare supplied logo textures and a deterministic, tileable asphalt surface."""
from pathlib import Path
from PIL import Image, ImageFilter
import math
import random

target = Path(__file__).resolve().parents[1] / 'public/models/branding'
target.mkdir(parents=True, exist_ok=True)
# The supplied LPQ logo is 11231 x 11219; decode it once, not in the web model.
Image.MAX_IMAGE_PIXELS = 150_000_000
for source, name, limit in [
    ('C:/Users/ALDO/Pictures/Logo LPQ [Fixed].png', 'lpq-logo.png', 1024),
    ('C:/Users/ALDO/Pictures/logo-qiroati-png-4.png', 'qiroati-logo.png', 768),
]:
    with Image.open(source) as image:
        image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        image.convert('RGBA').save(target / name, optimize=True)

size = 512
rng = random.Random(303)
height = [max(0, min(255, round(128 + rng.gauss(0, 19)))) for _ in range(size * size)]
diffuse = []
normals = []
for y in range(size):
    for x in range(size):
        i = y * size + x
        patch = 3 * math.sin(x * math.tau / size) * math.cos(y * math.tau / size)
        value = round(51 + (height[i] - 128) * .29 + patch)
        if height[i] > 171:
            value += 12
        diffuse.append((value, value + 1, value + 2))
        dx = (height[y * size + (x + 1) % size] - height[y * size + (x - 1) % size]) / 160
        dy = (height[((y + 1) % size) * size + x] - height[((y - 1) % size) * size + x]) / 160
        length = math.sqrt(dx * dx + dy * dy + 1)
        normals.append(tuple(round((v / length * .5 + .5) * 255) for v in (-dx, -dy, 1)))
image = Image.new('RGB', (size, size)); image.putdata(diffuse)
image.save(target / 'asphalt-color.jpg', quality=91)
image = Image.new('RGB', (size, size)); image.putdata(normals)
image.save(target / 'asphalt-normal.png', optimize=True)
for path in target.iterdir():
    print(path.name, path.stat().st_size)
