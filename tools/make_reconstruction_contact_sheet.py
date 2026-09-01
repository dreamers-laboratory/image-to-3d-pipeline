"""Create labelled source/reference and textured/clay contact sheets."""

import argparse
import fnmatch
import math
import os

from PIL import Image, ImageDraw, ImageFont


def font(size):
    for candidate in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        if os.path.exists(candidate):
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def build_sheet(input_dir, output, title, cell_width=360, columns=5, pattern="*"):
    paths = sorted(
        os.path.join(input_dir, name)
        for name in os.listdir(input_dir)
        if name.lower().endswith((".png", ".jpg", ".jpeg")) and fnmatch.fnmatch(name, pattern)
    )
    if not paths:
        raise RuntimeError(f"No images in {input_dir}")
    title_font = font(28)
    label_font = font(18)
    label_height = 34
    title_height = 50
    cell_height = cell_width + label_height
    rows = math.ceil(len(paths) / columns)
    sheet = Image.new("RGB", (columns * cell_width, title_height + rows * cell_height), (18, 22, 29))
    draw = ImageDraw.Draw(sheet)
    draw.text((16, 12), title, fill=(238, 242, 247), font=title_font)
    for index, path in enumerate(paths):
        image = Image.open(path).convert("RGB")
        image.thumbnail((cell_width, cell_width), Image.Resampling.LANCZOS)
        x = (index % columns) * cell_width + (cell_width - image.width) // 2
        y = title_height + (index // columns) * cell_height + (cell_width - image.height) // 2
        sheet.paste(image, (x, y))
        draw.text(((index % columns) * cell_width + 10, title_height + (index // columns) * cell_height + cell_width + 6), os.path.splitext(os.path.basename(path))[0], fill=(194, 206, 218), font=label_font)
    sheet.save(output, quality=94)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--cell-width", type=int, default=360)
    parser.add_argument("--columns", type=int, default=5)
    parser.add_argument("--pattern", default="*", help="Filename glob, for example '*-object.png'.")
    args = parser.parse_args()
    build_sheet(args.input, args.output, args.title, args.cell_width, args.columns, args.pattern)


if __name__ == "__main__":
    main()
