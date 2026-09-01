# Web explorer

Self-contained Three.js/WebGL experiment for navigating around a generated, textured submersible mesh. It uses a mesh BVH for player-to-hull collision; no WASM physics runtime or external service is required.

## Runtime assets

The `public/assets/` directory is not distributed with this repository because the full asset set is large. Before running, create it and supply:

- `public/assets/ship-trellis2-starboard.glb` (the default mesh; any GLB works)
- `public/assets/ship-v1-multidiffusion.glb`, `ship-v2-multidiffusion.glb`, `ship-v2-stochastic.glb` (optional comparison variants)
- `public/assets/ship-source-starboard-projection.png` (optional; used by the `?projection=starboard` experiment)
- `public/assets/world/city-horizon-360.png` (inside-facing 360 underwater panorama)
- `public/assets/world/ocean-floor.png` (repeatable sand microtexture)

A sample reconstructed mesh is included at `../examples/mesh/submersible-v2-stochastic.glb`; copy it into `public/assets/` under any of the mesh filenames above to try the explorer.

## Run

Use Node 22.12 or newer.

```sh
npm install
npm run build
npm run preview
```

Open `http://127.0.0.1:4173/`.

Controls: WASD to fly in the direction you aim with the mouse. Look upward and press W to rise; look downward and press S to rise backward. Wheel/trackpad controls vertical movement. On capture, the `CLICK` action changes in place to **ESC TO RELEASE** while the movement guide remains visible.

## Mesh comparison

- Default candidate: `http://127.0.0.1:4173/` (or `?mesh=trellis2`)
- Smoother V2 alternative: `http://127.0.0.1:4173/?mesh=v2-multidiffusion`
- Original scene-backed baseline: `http://127.0.0.1:4173/?mesh=v1-multidiffusion`
- Chase-camera piloting: `?mode=pilot`

`?projection=starboard` enables an intentionally isolated one-image projection experiment. It is a controlled comparison; a true upgrade would use calibrated multi-angle source coverage.

## Analytics

`src/analytics.js` is a no-op by default. To enable GA4, provide a measurement ID at build time:

```sh
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX npm run build
```

## Verify

With the preview server running:

```sh
npm run build
npx playwright test
npm audit --audit-level=moderate
```

The automated checks assume `public/assets/` has been populated as described above. They cover asset loading, an isolated close starboard projection view, keyboard movement, a solid-hull collision probe, console errors, pilot mode, and ten viewport sizes. Mobile layout is supported; touch navigation is not implemented in this milestone.
