# Submersible reconstruction evaluation

## Current decision

Use **TRELLIS V2 stochastic** as the evaluator-explorer placeholder. It best preserves the long hull, canopy, side turbine recess, and fin language from the 15 object-only references. It is a plausible visual reconstruction, not an engineering-faithful digital twin.

The web runtime is ready to accept a better GLB without architectural change.

## Ranked results

| Rank | Candidate | Inputs | Result | Browser asset | Main defect |
|---|---|---|---|---:|---|
| 1 | TRELLIS V2 stochastic | 15 masked object-only views, 20 steps | Best identity/detail balance | 1.56 MB; 11,866 faces | Front and stern machinery remain inferred; fine seams are mostly texture |
| 2 | TRELLIS V2 multidiffusion | Same 15 views, 20 steps | Strong continuous hull and stable silhouette | 1.61 MB; 12,444 faces | Over-smoothed canopy/underside; some view-specific details disappear |
| 3 | TRELLIS V1 multidiffusion | 10 rembg-masked scene images, 12 steps | Coherent long object | 1.58 MB; 11,114 faces | Blurred/flattened stern and generic upper surface |
| 4 | TRELLIS V1 stochastic | Same 10 images, 12 steps | Complete volume with richer local texture | 1.85 MB; 17,790 faces | Fuses the vessel into an incorrect manta-like near-symmetry |
| 5 | TripoSR single-view | Individual scene images | Very fast baseline | 0.8–2.3 MB | Thin relief/shell, blank or hallucinated back, unusable as the ship |

## Visual inspection checklist

- **Silhouette:** V2 stochastic is recognizably the supplied long submersible from most views.
- **Back side:** all TRELLIS candidates are closed/visible around the full orbit; TripoSR is not.
- **Bow/stern:** circular machinery is plausible but not mechanically consistent across source views.
- **Underside:** V2 references improve volume, but turbine apertures are still partly texture and partly inferred geometry.
- **Canopy:** major curvature holds; frame spacing and glass boundaries soften at grazing angles.
- **Fins/antenna:** present, but thin parts are fragile and can merge or change thickness.
- **Web behavior:** default V2 mesh loads, moves at interactive frame rate, and participates in BVH collision.

## Artifacts to inspect

- `trellis-v2-object-only-stochastic-contact-sheet.jpg` — full appearance/normal orbit of the recommended mesh.
- `trellis-v2-object-only-multidiffusion-contact-sheet.jpg` — smoother comparison.
- `explorer-variant-comparison.jpg` — all three web candidates under the same scene/camera.
- `rembg-u2net-v2-object-only-contact-sheet.jpg` — actual segmentation supplied to TRELLIS.
- `triposr-r256-contact-sheet.png` — single-view failure baseline.

## Next image guidance

More images help only when the vessel remains the same object. Prefer fixed design details, neutral/transparent background, matched focal length, consistent lighting, and evenly distributed azimuth/elevation. The top, bottom, port, starboard, bow, stern, and underbody anchors already provide useful coverage. Additional images should fill genuinely unseen surfaces, not merely add near-duplicate angles.

For photogrammetry-style reconstruction, render a camera orbit from one locked 3D design with exact camera metadata. Independently generated views can be semantically consistent yet lack the pixel-level correspondence photogrammetry requires.

## Known runtime boundary

The collision model prevents surface crossing during ordinary movement and was tested against solid hull geometry. Open or hallucinated holes in the generated mesh remain open to the collider. That is correct mesh-based behavior and also a reason to use a simplified authored collision proxy for a production training scene.
