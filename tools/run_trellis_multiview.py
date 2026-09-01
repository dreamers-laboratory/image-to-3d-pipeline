#!/usr/bin/env python3
"""Run a reproducible TRELLIS multi-image reconstruction experiment."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import time
from pathlib import Path

os.environ.setdefault("ATTN_BACKEND", "xformers")
os.environ.setdefault("SPCONV_ALGO", "native")

import imageio.v2 as imageio
import numpy as np
import torch
import trimesh
from PIL import Image
from trellis.pipelines import TrellisImageTo3DPipeline
from trellis.utils import postprocessing_utils, render_utils


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--mode", choices=("stochastic", "multidiffusion"), default="stochastic")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--steps", type=int, default=12)
    parser.add_argument("--simplify", type=float, default=0.90)
    parser.add_argument("--texture-size", type=int, default=1024)
    args = parser.parse_args()

    image_paths = sorted(
        path for path in args.input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
    )
    if not image_paths:
        raise SystemExit(f"No images found in {args.input_dir}")
    if len(image_paths) > args.steps:
        raise SystemExit(
            f"TRELLIS needs at least as many sampler steps as images: "
            f"{len(image_paths)} images > {args.steps} steps"
        )

    args.output_dir.mkdir(parents=True, exist_ok=False)
    metrics = {
        "tool": "microsoft/TRELLIS",
        "model": "microsoft/TRELLIS-image-large",
        "mode": args.mode,
        "seed": args.seed,
        "steps": args.steps,
        "simplify_ratio_removed": args.simplify,
        "texture_size": args.texture_size,
        "host": platform.node(),
        "torch": torch.__version__,
        "cuda": torch.version.cuda,
        "gpu": torch.cuda.get_device_name(0),
        "inputs": [
            {"name": path.name, "sha256": sha256(path), "bytes": path.stat().st_size}
            for path in image_paths
        ],
    }
    (args.output_dir / "run-config.json").write_text(json.dumps(metrics, indent=2) + "\n")

    images = [Image.open(path).convert("RGBA") for path in image_paths]
    torch.cuda.reset_peak_memory_stats()

    start = time.perf_counter()
    pipeline = TrellisImageTo3DPipeline.from_pretrained(metrics["model"])
    pipeline.cuda()
    metrics["model_load_seconds"] = round(time.perf_counter() - start, 3)

    start = time.perf_counter()
    outputs = pipeline.run_multi_image(
        images,
        seed=args.seed,
        mode=args.mode,
        formats=["mesh", "gaussian"],
        preprocess_image=True,
        sparse_structure_sampler_params={"steps": args.steps, "cfg_strength": 7.5},
        slat_sampler_params={"steps": args.steps, "cfg_strength": 3.0},
    )
    metrics["inference_seconds"] = round(time.perf_counter() - start, 3)

    mesh = outputs["mesh"][0]
    metrics["raw_vertices"] = int(mesh.vertices.shape[0])
    metrics["raw_faces"] = int(mesh.faces.shape[0])
    raw_mesh = trimesh.Trimesh(
        vertices=mesh.vertices.detach().cpu().numpy(),
        faces=mesh.faces.detach().cpu().numpy(),
        process=False,
    )
    raw_mesh.export(args.output_dir / "raw-mesh.ply")
    outputs["gaussian"][0].save_ply(str(args.output_dir / "gaussian.ply"))

    start = time.perf_counter()
    gaussian_frames = render_utils.render_video(outputs["gaussian"][0])["color"]
    mesh_frames = render_utils.render_video(mesh)["normal"]
    comparison_frames = [
        np.concatenate((gaussian_frame, mesh_frame), axis=1)
        for gaussian_frame, mesh_frame in zip(gaussian_frames, mesh_frames)
    ]
    imageio.mimsave(args.output_dir / "appearance-vs-mesh.mp4", comparison_frames, fps=30)
    metrics["turntable_seconds"] = round(time.perf_counter() - start, 3)

    start = time.perf_counter()
    glb = postprocessing_utils.to_glb(
        outputs["gaussian"][0],
        mesh,
        simplify=args.simplify,
        texture_size=args.texture_size,
    )
    glb.export(args.output_dir / "ship.glb")
    metrics["glb_seconds"] = round(time.perf_counter() - start, 3)
    metrics["glb_vertices"] = int(len(glb.vertices))
    metrics["glb_faces"] = int(len(glb.faces))
    metrics["peak_cuda_gib"] = round(torch.cuda.max_memory_allocated() / (1024 ** 3), 3)
    metrics["outputs"] = {
        path.name: path.stat().st_size
        for path in sorted(args.output_dir.iterdir())
        if path.is_file()
    }
    (args.output_dir / "run-metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
