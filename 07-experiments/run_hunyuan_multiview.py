"""Controlled Hunyuan 2MV reconstruction, optionally followed by multi-image Paint."""

import argparse
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import torch
from PIL import Image

from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline


INPUTS = {
    "front": "03-bow-on-object.png",
    "left": "01-port-profile-object.png",
    "back": "06-stern-on-object.png",
    "right": "13-starboard-orthographic-object.png",
}


def sha256(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--shape-model", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--paint-model", type=Path)
    parser.add_argument("--seed", type=int, default=12345)
    parser.add_argument("--steps", type=int, default=50)
    parser.add_argument("--octree-resolution", type=int, default=384)
    parser.add_argument("--num-chunks", type=int, default=20000)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    images = {}
    source_manifest = []
    for view, filename in INPUTS.items():
        path = args.input_dir / filename
        if not path.exists():
            raise FileNotFoundError(path)
        images[view] = Image.open(path).convert("RGBA")
        source_manifest.append({"view": view, "file": filename, "sha256": sha256(path), "bytes": path.stat().st_size})

    metadata = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "method": "Hunyuan3D-2mv Turbo shape; optional Hunyuan Paint Turbo multi-image texture",
        "shape_model": str(args.shape_model),
        "paint_model": str(args.paint_model) if args.paint_model else None,
        "input_views": source_manifest,
        "seed": args.seed,
        "steps": args.steps,
        "octree_resolution": args.octree_resolution,
        "num_chunks": args.num_chunks,
        "torch": torch.__version__,
        "cuda": torch.version.cuda,
        "gpu": torch.cuda.get_device_name(0),
    }
    torch.manual_seed(args.seed)
    start = time.monotonic()
    shape = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        str(args.shape_model),
        subfolder="hunyuan3d-dit-v2-mv-turbo",
        use_safetensors=True,
        device="cuda",
    )
    mesh = shape(
        image=images,
        num_inference_steps=args.steps,
        guidance_scale=7.5,
        octree_resolution=args.octree_resolution,
        num_chunks=args.num_chunks,
        generator=torch.manual_seed(args.seed),
        output_type="trimesh",
    )[0]
    metadata["shape_elapsed_seconds"] = time.monotonic() - start
    metadata["shape_vertices"] = int(len(mesh.vertices))
    metadata["shape_faces"] = int(len(mesh.faces))
    shape_path = args.output_dir / "hunyuan-2mv-shape.glb"
    mesh.export(shape_path)

    if args.paint_model:
        from hy3dgen.texgen import Hunyuan3DPaintPipeline

        torch.cuda.empty_cache()
        texture_start = time.monotonic()
        paint = Hunyuan3DPaintPipeline.from_pretrained(str(args.paint_model))
        textured_mesh = paint(mesh, image=[images["front"], images["left"], images["back"], images["right"]])
        metadata["texture_elapsed_seconds"] = time.monotonic() - texture_start
        textured_path = args.output_dir / "hunyuan-2mv-textured.glb"
        textured_mesh.export(textured_path)

    with (args.output_dir / "run-config.json").open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)


if __name__ == "__main__":
    main()
