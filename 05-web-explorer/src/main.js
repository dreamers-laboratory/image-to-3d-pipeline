import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshBVH } from 'three-mesh-bvh';
import './style.css';

const canvas = document.querySelector('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
// The floor's real distance fog resolves to this same water family, avoiding
// a hard plane horizon while the panorama supplies detailed distant water.
scene.background = new THREE.Color(0x159da5);
scene.fog = new THREE.FogExp2(0x159da5, 0.019);

const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.08, 300);
camera.rotation.order = 'YXZ';
camera.position.set(11, 6.5, 16);
camera.lookAt(0, 5, 0);
const openingViewDirection = new THREE.Vector3(11, 1.5, 16).normalize();

// The panorama is painted/unlit. These neutral lights are only for the
// physical TRELLIS material: they retain its atlas color while restoring a
// controlled metal highlight and readable hull volume.
const surfaceDiffuseBase = 1.5;
const surfaceDiffuseBonus = .55;
const ambientWater = new THREE.HemisphereLight(0xcff5ff, 0x588aa0, surfaceDiffuseBase);
scene.add(ambientWater);
// A large, filtered surface sun: one stable direction with a broad diffuse
// response on the high-roughness hull, never a camera-following hotspot.
const sun = new THREE.DirectionalLight(0xffc584, 2.35);
sun.position.set(-35, 55, 18);
scene.add(sun);

// Visual concept: one continuous hand-inked underwater world. The panorama owns
// the water, ceiling, horizon, and floor as one coherent source image; there
// is deliberately no second transparent seafloor layered in front of it.
const environmentLoader = new THREE.TextureLoader();
const starboardProjectionTexture = environmentLoader.load('/assets/ship-source-starboard-projection.png');
starboardProjectionTexture.colorSpace = THREE.SRGBColorSpace;
starboardProjectionTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
const cityPanoramaTexture = environmentLoader.load('/assets/world/city-horizon-360.png');
cityPanoramaTexture.colorSpace = THREE.SRGBColorSpace;
cityPanoramaTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
const cityPanoramaMaterial = new THREE.MeshBasicMaterial({
  map: cityPanoramaTexture,
  side: THREE.BackSide,
  fog: false,
  toneMapped: false,
});
// An equirectangular texture necessarily compresses its very top row into one
// point. Gently dissolve that last band to the sampled water family so the
// viewer sees a continuous light-filled sea rather than an image-map star.
cityPanoramaMaterial.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <map_fragment>',
    `#include <map_fragment>
      // The panorama reserves both UV edges for open water. Blend those edge
      // texels into the surrounding water family so the spherical UV wrap has
      // no visible vertical join, even under filtered WebGL sampling.
      float edgeDistance = min(vMapUv.x, 1.0 - vMapUv.x);
      float panoSeamBlend = 1.0 - smoothstep(0.0, 0.105, edgeDistance);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.015, 0.44, 0.47), panoSeamBlend);
      float zenithBlend = smoothstep(0.66, 1.0, vMapUv.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.28, 0.57, 0.55), zenithBlend);
      // The equirectangular floor collapses at the sphere's south pole. Replace
      // that lower image region with uniform water, rather than fading a second
      // floor or allowing its pixels to form a radial blue pinch/"geyser".
      vec3 lowerWater = vec3(0.11, 0.60, 0.64);
      float floorMask = smoothstep(0.04, 0.22, vMapUv.y);
      diffuseColor.rgb = mix(lowerWater, diffuseColor.rgb, floorMask);`,
  );
};
const cityPanorama = new THREE.Mesh(
  new THREE.SphereGeometry(145, 64, 96),
  cityPanoramaMaterial,
);
cityPanorama.name = 'city-panorama';
// The bridge is intentionally tiny and far away, leaving room for the source
// vehicle while preserving a cohesive 360 world in every direction.
cityPanorama.rotation.y = Math.PI * .1;
scene.add(cityPanorama);

// One actual floor. Its source-aligned texture is fully present under the
// player, then dissolves into plain water well before the horizon. There is no
// second sand image behind it, so this is a continuous single-floor treatment.
const sourceSandTexture = environmentLoader.load('/assets/world/ocean-floor.png');
sourceSandTexture.colorSpace = THREE.SRGBColorSpace;
sourceSandTexture.wrapS = sourceSandTexture.wrapT = THREE.RepeatWrapping;
sourceSandTexture.repeat.set(40, 40);
sourceSandTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
const floorMaterial = new THREE.MeshStandardMaterial({
  map: sourceSandTexture,
  roughness: 1,
  metalness: 0,
  toneMapped: false,
  transparent: true,
  depthWrite: false,
});
floorMaterial.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vFloorRadius;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloorRadius = length(position.xz);');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vFloorRadius;')
    .replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       // Fade only at long range. The nearby surface remains fully solid;
       // beyond it, plain panorama water takes over with no floor overlap.
       diffuseColor.a *= 1.0 - smoothstep(62.0, 180.0, vFloorRadius);`,
    );
};
const floorGeometry = new THREE.PlaneGeometry(1000, 1000, 72, 72);
floorGeometry.rotateX(-Math.PI / 2);
const floorPositions = floorGeometry.attributes.position;
for (let i = 0; i < floorPositions.count; i += 1) {
  const radius = Math.hypot(floorPositions.getX(i), floorPositions.getZ(i));
  // A shallow bowl removes the infinite plane's ruler-straight horizon while
  // retaining one solid, navigable floor directly beneath the user.
  const edgeFactor = Math.min(radius / 500, 1);
  floorPositions.setY(i, -55 * edgeFactor ** 1.85);
}
floorGeometry.computeVertexNormals();
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.name = 'ocean-floor';
floor.position.y = -1.8;
scene.add(floor);

const rocks = new THREE.Group();
const rockGeometry = new THREE.IcosahedronGeometry(1, 1);
const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x1a3835, roughness: 1 });
for (let i = 0; i < 28; i += 1) {
  const rock = new THREE.Mesh(rockGeometry, rockMaterial);
  rock.position.set((Math.random() - .5) * 70, -1.8, (Math.random() - .5) * 70);
  rock.scale.set(.25 + Math.random() * 1.1, .18 + Math.random() * .7, .25 + Math.random() * 1.1);
  rock.rotation.set(Math.random(), Math.random(), Math.random());
  rocks.add(rock);
}
scene.add(rocks);

// Keep the source-textured floor, but remove the fabricated rock accents so
// the scene stays inside the source illustration's world.
rocks.visible = false;

const colliders = [];
let shipRoot;
const shipCenter = new THREE.Vector3(0, 5, 0);
const shipAnchorOffset = new THREE.Vector3();
const rotatedShipAnchorOffset = new THREE.Vector3();
let shipInitialYaw = 0;
const loader = new GLTFLoader();
const meshVariants = {
  trellis2: {
    url: '/assets/ship-trellis2-starboard.glb',
    label: 'TRELLIS.2 · starboard reference',
  },
  'v1-multidiffusion': {
    url: '/assets/ship-v1-multidiffusion.glb',
    label: 'V1 · scene-backed · multidiffusion',
  },
  'v2-multidiffusion': {
    url: '/assets/ship-v2-multidiffusion.glb',
    label: 'V2 · object-only · multidiffusion',
  },
  'v2-stochastic': {
    url: '/assets/ship-v2-stochastic.glb',
    label: 'V2 · object-only · stochastic',
  },
};
const requestedVariant = new URLSearchParams(window.location.search).get('mesh');
const projectionMode = new URLSearchParams(window.location.search).get('projection');
const requestedMode = new URLSearchParams(window.location.search).get('mode');
const pilotMode = requestedMode === 'pilot';
const variantKey = requestedVariant in meshVariants ? requestedVariant : 'trellis2';
const selectedVariant = meshVariants[variantKey];
document.querySelector('#variant').textContent = pilotMode
  ? `PILOT MODE · ${variantKey === 'trellis2' ? 'TRELLIS.2' : variantKey.toUpperCase()}`
  : `LOCAL RECONSTRUCTION · ${variantKey === 'trellis2' ? 'TRELLIS.2' : variantKey.toUpperCase()}`;
if (pilotMode) {
  document.querySelector('#controls').innerHTML = '<kbd>W A S D</kbd> steer submarine · mouse aim · scroll depth';
  document.querySelector('#range-label').textContent = 'm from launch';
}

function addStarboardSourceProjection(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.starboardProjectionMap = { value: starboardProjectionTexture };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vStarboardProjectionPosition;\nvarying vec3 vStarboardProjectionNormal;',
      )
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nvStarboardProjectionNormal = normal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvStarboardProjectionPosition = position;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform sampler2D starboardProjectionMap;
         varying vec3 vStarboardProjectionPosition;
         varying vec3 vStarboardProjectionNormal;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         // The supplied orthographic starboard illustration is projected onto
         // the matching physical hull faces. It is not a camera-facing plane:
         // at a grazing/reverse angle it feathers back to the 4K TRELLIS atlas.
         vec2 starboardUv = vec2(
           mix(0.01888, 0.97852, clamp((vStarboardProjectionPosition.z + 0.50059) / 1.00125, 0.0, 1.0)),
           mix(0.27083, 0.80599, clamp((vStarboardProjectionPosition.y + 0.13327) / 0.26822, 0.0, 1.0))
         );
         vec4 starboardSource = texture2D(starboardProjectionMap, starboardUv);
         float starboardFacing = smoothstep(0.16, 0.72, normalize(vStarboardProjectionNormal).x);
         float sourceProjectionWeight = starboardSource.a * starboardFacing * 0.94;
         diffuseColor.rgb = mix(diffuseColor.rgb, starboardSource.rgb, sourceProjectionWeight);`,
      );
  };
  material.needsUpdate = true;
}

function preserveReferenceAtlasColor(sourceMaterial) {
  // Blender's review renders use neutral inspection lighting. In the explorer,
  // the cyan sun/hemisphere, fog, and filmic curve were re-tinting the same
  // atlas until the ship read as an untextured blue-grey mesh. Keep its native
  // PBR response for highlights, but exclude fog and filmic recoloring. This
  // is deliberately not a photograph overlay or new texture: `map` is the
  // 4K atlas shipped inside the TRELLIS.2 asset.
  const material = sourceMaterial.clone();
  material.fog = false;
  material.toneMapped = false;
  if (material.map) material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return material;
}

loader.load(selectedVariant.url, (gltf) => {
  shipRoot = gltf.scene;
  const sourceBounds = new THREE.Box3().setFromObject(shipRoot);
  const sourceSize = sourceBounds.getSize(new THREE.Vector3());
  const uniformScale = 18 / Math.max(sourceSize.x, sourceSize.y, sourceSize.z);
  shipRoot.scale.setScalar(uniformScale);
  sourceBounds.setFromObject(shipRoot);
  const center = sourceBounds.getCenter(new THREE.Vector3());
  shipRoot.position.sub(center).add(shipCenter);
  shipAnchorOffset.copy(shipRoot.position).sub(shipCenter);
  shipInitialYaw = shipRoot.rotation.y;
  shipRoot.updateMatrixWorld(true);

  shipRoot.traverse((child) => {
    if (!child.isMesh) return;
    child.material = variantKey === 'trellis2'
      ? preserveReferenceAtlasColor(child.material)
      : child.material.clone();
    child.material.roughness = Math.min(child.material.roughness ?? .65, .7);
    // The selected asset ships with a 4K painted atlas. Preserve its native
    // illustrated value range rather than tinting it with a second emissive
    // copy; high anisotropy keeps ink linework crisp at glancing fly-by angles.
    if (child.material.map) {
      child.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
      if (child.material.emissive) {
        child.material.emissiveMap = null;
        child.material.emissive.setHex(0x000000);
        child.material.emissiveIntensity = 0;
      }
      child.material.needsUpdate = true;
    }
    if (variantKey === 'trellis2' && projectionMode === 'starboard') addStarboardSourceProjection(child.material);
    child.geometry.boundsTree = new MeshBVH(child.geometry, { maxLeafTris: 10 });
    colliders.push(child);
  });
  scene.add(shipRoot);
  frameOpeningView(sourceBounds.getSize(new THREE.Vector3()));
  const projectionStatus = projectionMode === 'starboard' ? ' · starboard projection experiment' : '';
  const modeStatus = pilotMode ? ' · piloting active · depth boundary active' : ' · collision active';
  document.querySelector('#status').textContent = `${selectedVariant.label}${projectionStatus}${modeStatus}`;
}, undefined, (error) => {
  console.error(error);
  document.querySelector('#status').textContent = 'Mesh failed to load';
});

const keys = new Set();
const clock = new THREE.Clock();
const velocity = new THREE.Vector3();
const pilotVelocity = new THREE.Vector3();
let verticalScrollVelocity = 0;
const scrollImpulsePerPixel = .022;
const maxVerticalScrollSpeed = 3.2;
const verticalScrollDamping = 6.5;
const wish = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const localSphere = new THREE.Sphere();
const closestPoint = new THREE.Vector3();
const correction = new THREE.Vector3();
const playerRadius = .48;
let yaw = camera.rotation.y;
let pitch = camera.rotation.x;
let collided = false;

function frameOpeningView(shipSize) {
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const boundingRadius = shipSize.length() / 2;
  const limitingFov = Math.min(verticalFov, horizontalFov);
  const distance = Math.max(20, boundingRadius / Math.sin(limitingFov / 2) * 1.1);
  camera.position.copy(shipCenter).addScaledVector(openingViewDirection, distance);
  camera.lookAt(shipCenter);
  yaw = camera.rotation.y;
  pitch = camera.rotation.x;
}

function resolveShipCollision() {
  collided = false;
  for (const mesh of colliders) {
    mesh.updateWorldMatrix(true, false);
    localSphere.center.copy(camera.position);
    mesh.worldToLocal(localSphere.center);
    const localScale = mesh.getWorldScale(new THREE.Vector3());
    localSphere.radius = playerRadius / Math.max(localScale.x, localScale.y, localScale.z);
    mesh.geometry.boundsTree.shapecast({
      intersectsBounds: (box) => box.intersectsSphere(localSphere),
      intersectsTriangle: (triangle) => {
        triangle.closestPointToPoint(localSphere.center, closestPoint);
        const distance = closestPoint.distanceTo(localSphere.center);
        if (distance >= localSphere.radius) return false;
        correction.subVectors(localSphere.center, closestPoint);
        if (correction.lengthSq() < 1e-8) triangle.getNormal(correction);
        correction.normalize().multiplyScalar(localSphere.radius - distance + .002);
        localSphere.center.add(correction);
        collided = true;
        return false;
      },
    });
    mesh.localToWorld(localSphere.center);
    camera.position.copy(localSphere.center);
  }
  document.querySelector('#collision').classList.toggle('active', collided);
}

window.__surveyDebug = {
  getState: () => ({
    position: camera.position.toArray(),
    verticalScrollVelocity,
    mode: pilotMode ? 'pilot' : 'explore',
    shipPosition: shipCenter.toArray(),
    pilotVelocity: pilotVelocity.toArray(),
    colliders: colliders.length,
    collided,
    sourceImagePlanes: 0,
    variant: variantKey,
    projectionMode,
    materialPresentation: colliders.map((mesh) => ({
      type: mesh.material.type,
      hasMap: Boolean(mesh.material.map),
      fog: mesh.material.fog,
      toneMapped: mesh.material.toneMapped,
    })),
    shipBounds: shipRoot ? new THREE.Box3().setFromObject(shipRoot).getSize(new THREE.Vector3()).toArray() : null,
    worldLayers: [cityPanorama.name, floor.name],
    floorPresentation: {
      type: floor.material.type,
      transparent: floor.material.transparent,
      fog: floor.material.fog,
      farFade: true,
      height: floor.position.y,
      width: floor.geometry.parameters.width,
    },
    lightRig: {
      ambient: ambientWater.intensity,
      ambientBase: surfaceDiffuseBase,
      ambientSurfaceBonus: surfaceDiffuseBonus,
      surfaceFactor: THREE.MathUtils.clamp(((pilotMode ? shipCenter : camera.position).y + 1.45) / 22.45, 0, 1),
      sun: sun.intensity,
      sunColor: sun.color.getHexString(),
      hasPointLight: scene.children.some((child) => child.isPointLight),
    },
  }),
  setView: (nextPitch, nextYaw = yaw) => {
    pitch = nextPitch;
    yaw = nextYaw;
    velocity.set(0, 0, 0);
    pilotVelocity.set(0, 0, 0);
    verticalScrollVelocity = 0;
    camera.rotation.set(pitch, yaw, 0);
    return window.__surveyDebug.getState();
  },
  testPosition: (x, y, z) => {
    camera.position.set(x, y, z);
    resolveShipCollision();
    return window.__surveyDebug.getState();
  },
};

function updateMovement(dt) {
  camera.rotation.set(pitch, yaw, 0);
  camera.getWorldDirection(forward);
  forward.normalize();
  right.crossVectors(forward, camera.up).normalize();

  wish.set(0, 0, 0);
  if (keys.has('KeyW')) wish.add(forward);
  if (keys.has('KeyS')) wish.sub(forward);
  if (keys.has('KeyD')) wish.add(right);
  if (keys.has('KeyA')) wish.sub(right);
  if (wish.lengthSq()) wish.normalize().multiplyScalar(6.2);
  velocity.lerp(wish, 1 - Math.exp(-8 * dt));
  camera.position.addScaledVector(velocity, dt);
  camera.position.y += verticalScrollVelocity * dt;
  verticalScrollVelocity *= Math.exp(-verticalScrollDamping * dt);
  const boundedY = THREE.MathUtils.clamp(camera.position.y, -1.45, 21);
  if (boundedY !== camera.position.y) verticalScrollVelocity = 0;
  camera.position.y = boundedY;
  const radial = Math.hypot(camera.position.x, camera.position.z);
  if (radial > 58) {
    camera.position.x *= 58 / radial;
    camera.position.z *= 58 / radial;
  }
  resolveShipCollision();
}

function updatePilotMovement(dt) {
  // The view vector is the sub's heading. The camera stays in a chase view,
  // so every directional input moves the real textured TRELLIS asset.
  camera.rotation.set(pitch, yaw, 0);
  camera.getWorldDirection(forward).normalize();
  right.crossVectors(forward, camera.up).normalize();

  wish.set(0, 0, 0);
  if (keys.has('KeyW')) wish.add(forward);
  if (keys.has('KeyS')) wish.sub(forward);
  if (keys.has('KeyD')) wish.add(right);
  if (keys.has('KeyA')) wish.sub(right);
  if (wish.lengthSq()) wish.normalize().multiplyScalar(5.6);
  pilotVelocity.lerp(wish, 1 - Math.exp(-5.5 * dt));
  shipCenter.addScaledVector(pilotVelocity, dt);
  shipCenter.y += verticalScrollVelocity * dt;
  verticalScrollVelocity *= Math.exp(-verticalScrollDamping * dt);

  const boundedY = THREE.MathUtils.clamp(shipCenter.y, 1.35, 18);
  if (boundedY !== shipCenter.y) verticalScrollVelocity = 0;
  shipCenter.y = boundedY;
  const radial = Math.hypot(shipCenter.x, shipCenter.z);
  if (radial > 58) {
    shipCenter.x *= 58 / radial;
    shipCenter.z *= 58 / radial;
  }

  if (shipRoot) {
    // This imported hull's local forward axis is -Z. Rotate it 180 degrees
    // from the camera movement vector so W visibly drives its nose away from
    // the trailing camera instead of pulling its nose toward the viewer.
    const headingYaw = Math.atan2(forward.x, forward.z) + Math.PI;
    shipRoot.rotation.y = shipInitialYaw + headingYaw;
    rotatedShipAnchorOffset.copy(shipAnchorOffset).applyAxisAngle(camera.up, headingYaw);
    shipRoot.position.copy(shipCenter).add(rotatedShipAnchorOffset);
    shipRoot.updateMatrixWorld(true);
  }

  camera.position.copy(shipCenter).addScaledVector(forward, -17);
  collided = false;
  document.querySelector('#collision').classList.remove('active');
}

const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
document.addEventListener('keydown', (event) => {
  if (!movementKeys.has(event.code)) return;
  event.preventDefault();
  keys.add(event.code);
});
document.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());

canvas.addEventListener('click', () => {
  canvas.requestPointerLock?.();
});
window.addEventListener('wheel', (event) => {
  event.preventDefault();
  // Wheel input is an impulse, not a position jump: tiny scrolls accumulate
  // into a short, damped vertical glide. Clamp one event to keep trackpads and
  // mouse wheels equally controllable.
  const impulse = THREE.MathUtils.clamp(-event.deltaY, -120, 120) * scrollImpulsePerPixel;
  verticalScrollVelocity = THREE.MathUtils.clamp(
    verticalScrollVelocity + impulse,
    -maxVerticalScrollSpeed,
    maxVerticalScrollSpeed,
  );
}, { passive: false });
document.querySelector('#enter')?.addEventListener('click', () => {
  canvas.requestPointerLock?.();
});
document.addEventListener('pointerlockchange', () => {
  const active = document.pointerLockElement === canvas;
  document.body.classList.toggle('is-captured', active);
});
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas) return;
  yaw -= event.movementX * .0022;
  pitch -= event.movementY * .0022;
  pitch = THREE.MathUtils.clamp(pitch, -1.42, 1.42);
});

let fpsFrames = 0;
let fpsElapsed = 0;
function animate() {
  const dt = Math.min(clock.getDelta(), .05);
  if (pilotMode) updatePilotMovement(dt);
  else updateMovement(dt);
  // Ascending toward the bright water ceiling adds broad sky diffusion to the
  // material, matching the visible surface reflection without a fake lamp.
  const litPosition = pilotMode ? shipCenter : camera.position;
  const surfaceFactor = THREE.MathUtils.clamp((litPosition.y + 1.45) / 22.45, 0, 1);
  ambientWater.intensity = surfaceDiffuseBase + surfaceDiffuseBonus * surfaceFactor;

  fpsFrames += 1;
  fpsElapsed += dt;
  if (fpsElapsed >= .5) {
    document.querySelector('#fps').textContent = Math.round(fpsFrames / fpsElapsed);
    fpsFrames = 0;
    fpsElapsed = 0;
  }
  document.querySelector('#depth').textContent = Math.max(0, 12 - litPosition.y).toFixed(1).padStart(4, '0');
  const distance = pilotMode
    ? Math.hypot(shipCenter.x, shipCenter.z)
    : Math.max(0, camera.position.distanceTo(shipCenter) - 9);
  document.querySelector('#range').textContent = distance.toFixed(1).padStart(4, '0');
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
});
