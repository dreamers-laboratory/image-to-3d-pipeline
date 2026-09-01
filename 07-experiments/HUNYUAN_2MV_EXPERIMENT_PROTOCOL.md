# Hunyuan3D 2MV + Paint pilot protocol

## Decision

Does Hunyuan's separate multi-view shape and multi-view Paint stages produce a more source-faithful textured submersible than the current TRELLIS V2 object-only stochastic baseline, especially at unseen orbit angles?

## Hypotheses

- **H1:** Hunyuan multi-view shape + multi-view Paint improves texture continuity and source feature retention without lowering novel-view credibility below the TRELLIS baseline.
- **H0:** Its review result is no better than the TRELLIS baseline, or it introduces texture smearing, incorrect geometry, or unstable novel views.

## Controlled inputs

Use only these RGBA object-only anchors, copied without re-encoding:

1. `01-port-profile-object.png`
2. `03-bow-on-object.png`
3. `06-stern-on-object.png`
4. `13-starboard-orthographic-object.png`

They approximate Hunyuan's named `front`, `left`, `back`, and `right` input contract. The ship's historical image axis is documented in the run config; labels must be checked against the asset before execution.

## Runs

| Run | Independent variable | Shape | Texture | Purpose |
| --- | --- | --- | --- | --- |
| H0 | Existing baseline | TRELLIS V2 stochastic | TRELLIS baked texture | Comparator only; no rerun required. |
| H1 | Reconstruction method | Hunyuan2MV Turbo, four anchors | Hunyuan Paint Turbo, same four anchors | Direct end-to-end candidate. |
| H2 | Texture stage only | H0 GLB geometry | Hunyuan Paint Turbo, same four anchors | Tests whether Paint improves the existing geometry without conflating shape quality. |
| H1R | Preprocessing guardrail | H1 shape reduced to 40,000 faces | Hunyuan Paint Turbo, same four anchors | A separately labelled Paint-feasibility run; it must not be compared as pure texture-only evidence. |

Do not change model, number of anchors, seed, mesh resolution, or renderer within a named run. A four-to-six anchor coverage test is a separate later experiment.

## Measurements

Run all candidates through `tools/run_reconstruction_eval.sh` using the same 10 Blender angles and resolution. Score the pre-existing 0–2 visual rubric:

- all-angle silhouette;
- source feature retention;
- texture continuity;
- novel-view credibility;
- asset integrity.

Guardrails: GLB imports in Blender, texture node exists, no catastrophic missing surfaces, and remote GPU OOM/failure is logged rather than retried silently.

## Interpretation boundary

The original images have no registered camera metadata. Scores are therefore structured visual inspection, not photogrammetric pixel error or evidence of physical accuracy. A result that passes visual review can still require authored collision, retopology, and texture correction before production.
