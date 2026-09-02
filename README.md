# image-to-3d-pipeline

Turn a handful of images into a 3D mesh, then find out which model did it best.

Single-image-to-3D reconstruction has a dozen open-source models and no obvious winner; the honest way to choose is to run several on the same input and look hard at what comes out. This pipeline does exactly that. It takes AI-generated renders of a fictional submersible, reconstructs candidate meshes with several models, scores them against a fixed Blender inspection protocol, and serves the winner in a browser-based WebGL explorer.

For the curious, a live photogrammetry case study from this repo: [3d.thedreamers.us/about](https://3d.thedreamers.us/about/), and the explorer itself at [3d.thedreamers.us](https://3d.thedreamers.us/) for live interaction.

Built by [Dreamers Inc](https://thedreamers.us).

## Source imagery

All source images in this repository are AI-generated synthetic renders of a fictional vessel. No real vehicle, vessel, person, or client is depicted.

## Repository layout

- `tools/`: preprocessing, inference, rendering, and evaluation scripts.
- `05-web-explorer/`: local Three.js/WebGL explorer for the reconstructed meshes.
- `06-evaluation/`: the written evaluation and a variant comparison screenshot.
- `07-experiments/`: controlled follow-up experiments (Hunyuan3D 2MV, TRELLIS.2, MapAnything) with their protocol documents.
- `examples/`: three sample source renders and one reconstructed GLB (`submersible-v2-stochastic.glb`, about 1.5 MB), so the pipeline output can be inspected without running anything.
- `setup.sh`: clones the third-party reconstruction tools at pinned commits into `tools/vendor/`.

Large artifacts are excluded: Python environments, model checkpoints, intermediate PLY/GLB outputs, and the explorer's full runtime asset set. `05-web-explorer/README.md` describes how to supply runtime assets, and `examples/` provides a mesh you can use for that.

## Review order

1. `06-evaluation/EVALUATION.md` for the ranking and its limitations.
2. `06-evaluation/explorer-variant-comparison.jpg` for the same browser scene with three candidate meshes.
3. `05-web-explorer/README.md` for local run instructions.
4. `examples/` for sample inputs and a reconstructed output.

## Third-party reconstruction tools

Run `./setup.sh` to clone the four reconstruction models at the exact commits used in this evaluation. They are cloned rather than vendored because each carries its own license, which you accept when you fetch it:

| Tool | License |
| --- | --- |
| [TRELLIS](https://github.com/microsoft/TRELLIS) | MIT |
| [TripoSR](https://github.com/VAST-AI-Research/TripoSR) | MIT |
| [stable-fast-3d](https://github.com/Stability-AI/stable-fast-3d) | Stability AI Community License |
| [Hunyuan3D-2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) | Tencent Hunyuan community license, territorially restricted |

Review each license before use, particularly the Stability AI and Tencent terms, which restrict commercial use and territory respectively.

## Pipeline stages

1. Preprocess: `tools/preprocess_object_masks.py` produces transparent object-only masks from the source renders.
2. Reconstruct: `tools/run_trellis_multiview.py` runs multi-image TRELLIS; `07-experiments/` holds runners for the other candidates.
3. Evaluate: `tools/run_reconstruction_eval.sh` renders each GLB through the same fixed Blender orbit and builds contact sheets for the 0-2 visual rubric in `07-experiments/HUNYUAN_2MV_EXPERIMENT_PROTOCOL.md`.
4. Explore: `05-web-explorer/` loads the chosen GLB in a navigable underwater scene with BVH collision.

## License

The code in this repository is licensed under the Apache License 2.0 (see `LICENSE`). The third-party tools fetched by `setup.sh` are excluded and remain under their own licenses.
