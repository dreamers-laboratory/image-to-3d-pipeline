#!/usr/bin/env python3
"""Run one pinned TRELLIS.2 candidate in its isolated GPU pilot environment."""
import argparse
import json
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
repo = os.environ.get("TRELLIS2_REPO")
if repo:
    sys.path.insert(0, repo)

parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--pipeline", choices=("512", "1024", "1024_cascade", "1536_cascade"), default="1024_cascade")
parser.add_argument("--seed", type=int, default=42)
parser.add_argument("--max-tokens", type=int, default=49152)
args = parser.parse_args()

import torch
import numpy as np
from PIL import Image
from trellis2.pipelines import Trellis2ImageTo3DPipeline
from trellis2.pipelines import rembg
import o_voxel

output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
started = time.time()
image = Image.open(args.input).convert("RGBA")
alpha = np.asarray(image.getchannel("A"))
if np.all(alpha == 255):
    raise ValueError(
        "This controlled runner requires an input with a real alpha mask; "
        "it must not silently bypass TRELLIS.2 background removal for a scene image."
    )

# TRELLIS.2 constructs BRIA RMBG at pipeline-load time, even though its own
# preprocess path skips background removal when a genuine alpha matte exists.
# The supplied input has such a matte, so avoid an otherwise-unused gated
# dependency only for this alpha-guarded controlled run.
original_birefnet = rembg.BiRefNet
rembg.BiRefNet = lambda *unused_args, **unused_kwargs: None
try:
    pipeline = Trellis2ImageTo3DPipeline.from_pretrained("microsoft/TRELLIS.2-4B")
finally:
    rembg.BiRefNet = original_birefnet
pipeline.cuda()
mesh = pipeline.run(
    image,
    seed=args.seed,
    pipeline_type=args.pipeline,
    max_num_tokens=args.max_tokens,
)[0]
mesh.simplify(16777216)
glb = o_voxel.postprocess.to_glb(
    vertices=mesh.vertices,
    faces=mesh.faces,
    attr_volume=mesh.attrs,
    coords=mesh.coords,
    attr_layout=mesh.layout,
    voxel_size=mesh.voxel_size,
    aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
    decimation_target=1_000_000,
    texture_size=4096,
    remesh=True,
    remesh_band=1,
    remesh_project=0,
    verbose=True,
)
glb.export(str(output), extension_webp=True)
config = {
    "input": str(Path(args.input).resolve()),
    "output": str(output.resolve()),
    "pipeline": args.pipeline,
    "seed": args.seed,
    "max_tokens": args.max_tokens,
    "input_alpha_matte": True,
    "background_removal_model_loaded": False,
    "elapsed_seconds": round(time.time() - started, 3),
    "torch": torch.__version__,
    "cuda": torch.version.cuda,
}
output.with_suffix(".run-config.json").write_text(json.dumps(config, indent=2) + "\n")
print(json.dumps(config, indent=2))
