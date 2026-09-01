# Better-model research — 2026-08-07

## Question

Can a newer reconstruction or texture system improve on the current local
winner without losing the source illustration's distinctive ink, canopy,
engine, and hull detail?

## Facts about the supplied inputs

- The object-only set contains fifteen 1536 x 768 PNGs. The local explorer
  serves source plates at that native resolution; it did not downsample them.
- The images are strong visual references, but they are not camera-calibrated
  photographs. Several hidden/underside details vary between views. Treat them
  as view-conditioned artwork rather than pixel-aligned ground truth.
- Consequently, a photogrammetry pipeline cannot be expected to recover a
  faithful closed asset merely because it has many inputs.

## Candidates worth distinguishing

| Candidate | What it could improve | Fit to these inputs | Decision |
| --- | --- | --- | --- |
| Current TRELLIS V2 object-only stochastic | Fast, source-like visual baseline. Its 1.5 MB GLB is the local default. | Good visual fit; no new download. | Keep as current winner. |
| Microsoft TRELLIS.2 (4B) | Newer, high-resolution textured/PBR image-to-3D; supports 512^3 to 1536^3 output. | Promising quality upgrade, but official image path is one image, not real multi-image reconstruction. Requires Linux, NVIDIA GPU >=24 GB and a separate pilot environment. | Best controlled next **single-reference** comparison. Do not call it multi-image. |
| Tencent Hunyuan3D 2.1 | Newer Hunyuan Shape and PBR Paint; official documentation identifies a six-view texture-paint stage. | It can be a texture-quality test, but its documented public shape API remains a single image. It does not supersede the already-proven multi-image Hunyuan 2MV experiment as a multi-view reconstructor. | Worth a later texture-only comparison on fixed geometry, not first. |
| Metric multi-view reconstruction (MapAnything/VGGT/MASt3R family) | Estimate poses/depth from multiple views and give a real geometric consistency check. | Requires pose estimation/feature matching, then separate meshing and texture baking. Stylized, independently generated views make this higher risk but it is the only category that genuinely uses all views as observations. | Research geometry route; run only after we define a small pose/depth gate. |
| NVIDIA 3D Object Reconstruction | Production textured mesh workflow with pose optimization and multi-view colour fusion. | Its stated path expects calibrated stereo video/photographic imagery. That assumption is not met here. | Not an efficient first test. |

## Recommendation

Do not replace the local winner merely because another model advertises higher
resolution. The live explorer already combines the compact TRELLIS collision
surface with native-resolution, source-derived view plates; those plates are
the reason the object looks like the supplied art.

The next evaluation should be deliberately narrow:

1. Render the current fixed, canonical views from TRELLIS V2.
2. Run TRELLIS.2 on the best single orthographic/object-only view at 1024^3
   and 1536^3 in a new isolated GPU pilot environment.
3. Judge it with the same textured/clay Blender orbit sheets.
4. Promote it only if it improves source character at unseen angles without
   producing generic/smeared detail. It remains a single-image result.

For a true multi-image route, first use a pose/depth test on six broad,
nonredundant views. Abort before meshing if estimated cameras or projected
features disagree. That avoids spending GPU time on an asset that will merely
average conflicting illustrations.

## Sources checked

- Microsoft, TRELLIS.2 repository (accessed 2026-08-07): image-to-3D,
  4B model, 512^3–1536^3 output, Linux/NVIDIA >=24 GB requirements:
  https://github.com/microsoft/TRELLIS.2
- Tencent, Hunyuan3D 2.1 repository (accessed 2026-08-07): 3.3B Shape,
  2B Paint, documented 6-view 512 texture pipeline, stated VRAM figures:
  https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1
- Meta, MapAnything repository (accessed 2026-08-07): multi-image metric
  reconstruction inputs, modular external models, Apache model option:
  https://github.com/facebookresearch/map-anything
- NVIDIA, 3D Object Reconstruction repository (accessed 2026-08-07):
  stereo-video workflow, pose optimization, and top-N colour fusion:
  https://github.com/NVIDIA/3DObjectReconstruction
