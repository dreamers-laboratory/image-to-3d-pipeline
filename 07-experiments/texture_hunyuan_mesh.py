"""Apply Hunyuan Paint to one existing mesh using a fixed multi-image input set."""

import argparse
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image
import trimesh

from hy3dgen.texgen import Hunyuan3DPaintPipeline


INPUTS = (
    "03-bow-on-object.png",
    "01-port-profile-object.png",
    "06-stern-on-object.png",
    "13-starboard-orthographic-object.png",
)


def sha256(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mesh", type=Path, required=True)
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--paint-model", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    images = []
    input_manifest = []
    for name in INPUTS:
        path = args.input_dir / name
        if not path.exists():
            raise FileNotFoundError(path)
        images.append(Image.open(path).convert("RGBA"))
        input_manifest.append({"file": name, "bytes": path.stat().st_size, "sha256": sha256(path)})
    mesh = trimesh.load(args.mesh, force="mesh")
    start = time.monotonic()
    paint = Hunyuan3DPaintPipeline.from_pretrained(str(args.paint_model))
    textured = paint(mesh, image=images)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    textured.export(args.output)
    record = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "method": "Hunyuan Paint Turbo multi-image texture only",
        "input_mesh": str(args.mesh),
        "input_mesh_sha256": sha256(args.mesh),
        "paint_model": str(args.paint_model),
        "input_images": input_manifest,
        "elapsed_seconds": time.monotonic() - start,
    }
    with args.output.with_suffix(".run-config.json").open("w", encoding="utf-8") as handle:
        json.dump(record, handle, indent=2)


if __name__ == "__main__":
    main()
