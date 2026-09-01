import argparse
from pathlib import Path

import numpy as np
import rembg
from PIL import Image, ImageFilter


def checkerboard(size, cell=32):
    y, x = np.indices((size[1], size[0]))
    cells = (x // cell + y // cell) % 2
    a = np.array([14, 43, 50], dtype=np.uint8)
    b = np.array([33, 79, 85], dtype=np.uint8)
    return Image.fromarray(np.where(cells[..., None] == 0, a, b), "RGB")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    session = rembg.new_session("u2net")
    for source in sorted(args.input_dir.glob("*.png")):
        image = Image.open(source).convert("RGB")
        scale = min(1.0, 1536 / max(image.size))
        if scale < 1:
            image = image.resize(
                (round(image.width * scale), round(image.height * scale)),
                Image.Resampling.LANCZOS,
            )
        cutout = rembg.remove(image, session=session).convert("RGBA")
        alpha = cutout.getchannel("A").filter(ImageFilter.GaussianBlur(0.35))
        cutout.putalpha(alpha)
        cutout.save(args.output_dir / source.name)

        preview = checkerboard(cutout.size)
        preview.paste(cutout, mask=cutout.getchannel("A"))
        preview.save(args.output_dir / f"preview-{source.stem}.jpg", quality=90)


if __name__ == "__main__":
    main()
