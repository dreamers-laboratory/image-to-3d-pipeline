#!/usr/bin/env python3
"""Run the six-angle MapAnything geometry gate and retain decision evidence."""
import argparse
import json
import os
import time
from pathlib import Path

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

parser = argparse.ArgumentParser()
parser.add_argument("--images", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--apache", action="store_true")
args = parser.parse_args()

import numpy as np
import torch
from mapanything.models import MapAnything
from mapanything.utils.device import get_device
from mapanything.utils.geometry import depthmap_to_world_frame
from mapanything.utils.image import load_images
from mapanything.utils.viz import predictions_to_glb

output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
started = time.time()
device = get_device()
model_name = "facebook/map-anything-apache" if args.apache else "facebook/map-anything"
model = MapAnything.from_pretrained(model_name).to(device)
views = load_images(args.images)
outputs = model.infer(
    views,
    memory_efficient_inference=True,
    minibatch_size=1,
    use_amp=True,
    amp_dtype="bf16",
    apply_mask=True,
    mask_edges=True,
)

world_points, images, masks = [], [], []
view_summary = []
for index, pred in enumerate(outputs):
    depth = pred["depth_z"][0].squeeze(-1)
    intrinsics = pred["intrinsics"][0]
    pose = pred["camera_poses"][0]
    points, valid = depthmap_to_world_frame(depth, intrinsics, pose)
    mask = pred["mask"][0].squeeze(-1).cpu().numpy().astype(bool)
    mask &= valid.cpu().numpy()
    confidence = pred["conf"][0].squeeze(-1).cpu().numpy()
    masked_confidence = confidence[mask]
    world_points.append(points.cpu().numpy())
    images.append(pred["img_no_norm"][0].cpu().numpy())
    masks.append(mask)
    view_summary.append({
        "index": index,
        "valid_fraction": round(float(mask.mean()), 6),
        "confidence_mean": round(float(masked_confidence.mean()), 6) if masked_confidence.size else None,
        "confidence_median": round(float(np.median(masked_confidence)), 6) if masked_confidence.size else None,
        "camera_pose": pose.cpu().numpy().round(7).tolist(),
        "intrinsics": intrinsics.cpu().numpy().round(7).tolist(),
    })

scene = predictions_to_glb({
    "world_points": np.stack(world_points),
    "images": np.stack(images),
    "final_masks": np.stack(masks),
}, as_mesh=True)
scene.export(output)
summary = {
    "model": model_name,
    "device": str(device),
    "input_folder": str(Path(args.images).resolve()),
    "input_count": len(views),
    "output": str(output.resolve()),
    "elapsed_seconds": round(time.time() - started, 3),
    "torch": torch.__version__,
    "cuda": torch.version.cuda,
    "views": view_summary,
}
output.with_suffix(".run-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
