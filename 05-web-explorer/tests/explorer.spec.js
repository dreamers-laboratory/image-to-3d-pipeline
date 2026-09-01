import { test, expect } from '@playwright/test';

test('ships the vetted TRELLIS.2 mesh-textured asset by default', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await expect(page).toHaveTitle('Welcome Underwater');
  await expect(page.locator('#variant')).toHaveText('LOCAL RECONSTRUCTION · TRELLIS.2');
  await expect(page.locator('#status')).toContainText('TRELLIS.2 · starboard reference');
  const asset = await page.evaluate(async () => {
    const [meshResponse, projectionResponse] = await Promise.all([
      fetch('/assets/ship-trellis2-starboard.glb'),
      fetch('/assets/ship-source-starboard-projection.png'),
    ]);
    return {
      mesh: { ok: meshResponse.ok, bytes: (await meshResponse.arrayBuffer()).byteLength },
      sourceProjection: { ok: projectionResponse.ok, bytes: (await projectionResponse.arrayBuffer()).byteLength },
    };
  });
  expect(asset.mesh.ok).toBe(true);
  expect(asset.mesh.bytes).toBeGreaterThan(0);
  expect(asset.sourceProjection.ok).toBe(true);
  expect(asset.sourceProjection.bytes).toBeGreaterThan(0);
});

test('renders, navigates, and resolves contact with the hull', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await expect(page.locator('#status')).toContainText('collision active');
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__surveyDebug.getState().colliders)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__surveyDebug.getState().variant)).toBe('trellis2');
  expect(await page.evaluate(() => window.__surveyDebug.getState().sourceImagePlanes)).toBe(0);
  expect(await page.evaluate(() => window.__surveyDebug.getState().materialPresentation)).toEqual([
    { type: 'MeshStandardMaterial', hasMap: true, fog: false, toneMapped: false },
  ]);
  expect(await page.evaluate(() => window.__surveyDebug.getState().worldLayers)).toEqual([
    'city-panorama', 'ocean-floor',
  ]);
  expect(await page.evaluate(() => window.__surveyDebug.getState().floorPresentation)).toEqual({
    type: 'MeshStandardMaterial', transparent: true, fog: true, farFade: true, height: -1.8, width: 1000,
  });
  const lightRig = await page.evaluate(() => window.__surveyDebug.getState().lightRig);
  expect(lightRig).toMatchObject({
    ambientBase: 1.5, ambientSurfaceBonus: .55, sun: 2.35, sunColor: 'ffc584', hasPointLight: false,
  });
  expect(lightRig.ambient).toBeGreaterThan(lightRig.ambientBase);
  await expect(page.locator('.enter-label')).toHaveText('Click');
  await expect(page.locator('.escape')).toContainText('ESC');
  await expect(page.locator('.escape')).toContainText('TO RELEASE');
  await expect(page.locator('.escape')).toBeHidden();
  await page.screenshot({ path: 'test-results/explorer-desktop.png', fullPage: true });

  const beforeArrow = await page.evaluate(() => window.__surveyDebug.getState().position);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(160);
  const afterArrow = await page.evaluate(() => window.__surveyDebug.getState().position);
  expect(afterArrow).toEqual(beforeArrow);

  const before = await page.evaluate(() => window.__surveyDebug.getState().position);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(450);
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => window.__surveyDebug.getState().position);
  expect(after).not.toEqual(before);

  await page.evaluate(() => window.__surveyDebug.setView(.62));
  const upwardBefore = await page.evaluate(() => window.__surveyDebug.getState().position);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(320);
  await page.keyboard.up('KeyW');
  const upwardAfter = await page.evaluate(() => window.__surveyDebug.getState().position);
  expect(upwardAfter[1]).toBeGreaterThan(upwardBefore[1]);

  await page.evaluate(() => window.__surveyDebug.setView(.62));
  const scrollBefore = await page.evaluate(() => window.__surveyDebug.getState().position);
  await page.locator('#world').hover();
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(35);
  const scrollUpEarly = await page.evaluate(() => window.__surveyDebug.getState());
  await page.waitForTimeout(140);
  const scrollUpLate = await page.evaluate(() => window.__surveyDebug.getState());
  expect(scrollUpEarly.position[1]).toBeGreaterThan(scrollBefore[1]);
  expect(scrollUpLate.position[1]).toBeGreaterThan(scrollUpEarly.position[1]);
  expect(scrollUpLate.verticalScrollVelocity).toBeGreaterThan(0);
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(35);
  const reverseImpulse = await page.evaluate(() => window.__surveyDebug.getState());
  expect(reverseImpulse.verticalScrollVelocity).toBeLessThan(0);
  await page.waitForTimeout(380);
  const scrollDown = await page.evaluate(() => window.__surveyDebug.getState().position);
  expect(scrollDown[1]).toBeLessThan(scrollUpLate.position[1]);

  await page.evaluate(() => window.__surveyDebug.setView(.62));
  const concurrentBefore = await page.evaluate(() => window.__surveyDebug.getState().position);
  await page.keyboard.down('KeyD');
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(180);
  await page.keyboard.up('KeyD');
  const concurrentAfter = await page.evaluate(() => window.__surveyDebug.getState().position);
  expect(concurrentAfter[1]).toBeGreaterThan(concurrentBefore[1]);
  expect(Math.hypot(
    concurrentAfter[0] - concurrentBefore[0],
    concurrentAfter[2] - concurrentBefore[2],
  )).toBeGreaterThan(0);

  await page.evaluate(() => window.__surveyDebug.testPosition(34, -1, 34));
  await page.waitForTimeout(40);
  const lowDiffuse = await page.evaluate(() => window.__surveyDebug.getState().lightRig.ambient);
  await page.evaluate(() => window.__surveyDebug.testPosition(34, 17, 34));
  await page.waitForTimeout(40);
  const highDiffuse = await page.evaluate(() => window.__surveyDebug.getState().lightRig.ambient);
  expect(highDiffuse).toBeGreaterThan(lowDiffuse);
  await page.evaluate(() => window.__surveyDebug.setView(1.15, Math.PI));
  await page.waitForTimeout(180);
  await page.screenshot({ path: 'test-results/surface-up.png', fullPage: true });

  await page.evaluate(() => {
    window.__surveyDebug.testPosition(34, 9, 34);
    window.__surveyDebug.setView(-1.35, Math.PI);
  });
  await page.waitForTimeout(180);
  await page.screenshot({ path: 'test-results/floor-down.png', fullPage: true });

  await page.evaluate(() => window.__surveyDebug.setView(-.62));
  const backwardUpBefore = await page.evaluate(() => window.__surveyDebug.getState().position);
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(320);
  await page.keyboard.up('KeyS');
  const backwardUpAfter = await page.evaluate(() => window.__surveyDebug.getState().position);
  expect(backwardUpAfter[1]).toBeGreaterThan(backwardUpBefore[1]);

  const contact = await page.evaluate(() => window.__surveyDebug.testPosition(0, 5, 8));
  expect(contact.collided).toBe(true);
  expect(contact.position).not.toEqual([0, 5, 8]);
  expect(errors).toEqual([]);
});

test('changes Click into Escape while preserving movement guidance', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await expect(page.locator('#status')).toContainText('collision active');
  await expect(await page.evaluate(() => typeof document.querySelector('#world').requestPointerLock)).toBe('function');

  const movement = page.locator('.movement-keys');
  await expect(movement.locator('.key-w')).toContainText('W↑');
  await expect(movement.locator('.key-a')).toContainText('A←');
  await expect(movement.locator('.key-s')).toContainText('S↓');
  await expect(movement.locator('.key-d')).toContainText('D→');
  await expect(page.locator('.scroll-cue')).toHaveText('Scroll ↑↓');
  await expect(page.locator('.scroll-cue')).toBeVisible();
  await expect(page.locator('.enter-label')).toHaveText('Click');
  await expect(page.locator('.enter-label')).toBeVisible();
  await expect(page.locator('#enter')).toBeVisible();
  await expect(page.locator('.escape')).toBeHidden();
  await page.screenshot({ path: 'test-results/explorer-0.11.0-idle.png', fullPage: true });

  await page.evaluate(() => {
    const canvas = document.querySelector('#world');
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => canvas });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  await expect(page.locator('body')).toHaveClass(/is-captured/);
  await expect(movement).toBeVisible();
  await expect(page.locator('.scroll-cue')).toBeVisible();
  await expect(page.locator('#enter')).toBeVisible();
  await expect(page.locator('.enter-label')).toBeHidden();
  await expect(page.locator('.escape')).toBeVisible();
  await expect(page.locator('.escape')).toContainText('ESC');
  await expect(page.locator('.escape')).toContainText('TO RELEASE');
  await page.screenshot({ path: 'test-results/explorer-0.11.0-captured.png', fullPage: true });

  await page.evaluate(() => {
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => null });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  await expect(page.locator('body')).not.toHaveClass(/is-captured/);
  await expect(movement).toBeVisible();
  await expect(page.locator('.scroll-cue')).toBeVisible();
  await expect(page.locator('#enter')).toBeVisible();
  await expect(page.locator('.escape')).toBeHidden();
  await expect(page.locator('.enter-label')).toBeVisible();
});

test('pilot mode moves the actual textured submarine and keeps inertial depth control', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('http://127.0.0.1:4173/?mode=pilot', { waitUntil: 'networkidle' });
  await expect(page.locator('#variant')).toHaveText('PILOT MODE · TRELLIS.2');
  await expect(page.locator('#controls')).toContainText('steer submarine');
  await expect(page.locator('#status')).toContainText('piloting active');
  await expect.poll(() => page.evaluate(() => window.__surveyDebug.getState().colliders)).toBeGreaterThan(0);

  const before = await page.evaluate(() => window.__surveyDebug.getState());
  expect(before.mode).toBe('pilot');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');
  const afterDrive = await page.evaluate(() => window.__surveyDebug.getState());
  expect(afterDrive.shipPosition).not.toEqual(before.shipPosition);

  await page.locator('#world').hover();
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(60);
  const afterScrollEarly = await page.evaluate(() => window.__surveyDebug.getState());
  await page.waitForTimeout(140);
  const afterScrollLate = await page.evaluate(() => window.__surveyDebug.getState());
  expect(afterScrollEarly.shipPosition[1]).toBeGreaterThan(afterDrive.shipPosition[1]);
  expect(afterScrollLate.shipPosition[1]).toBeGreaterThan(afterScrollEarly.shipPosition[1]);
  await page.screenshot({ path: 'test-results/pilot-mode.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('isolates the one-view starboard projection experiment from the default texture path', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('http://127.0.0.1:4173/?projection=starboard', { waitUntil: 'networkidle' });
  await expect(page.locator('#status')).toContainText('collision active');
  const state = await page.evaluate(() => {
    window.__surveyDebug.testPosition(15, 6, 0);
    return window.__surveyDebug.setView(-.066, Math.PI / 2);
  });
  expect(state.sourceImagePlanes).toBe(0);
  expect(state.projectionMode).toBe('starboard');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/trellis2-close-starboard-experiment.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('HUD remains usable at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await expect(page.locator('#status')).toContainText('collision active');
  await expect(page.locator('#brief')).toBeInViewport();
  await expect(page.locator('.telemetry')).toBeInViewport();
  await page.screenshot({ path: 'test-results/explorer-mobile.png', fullPage: true });
});

const viewports = [
  [320, 568], [360, 800], [390, 844], [430, 932], [844, 390],
  [768, 1024], [1366, 768], [1512, 982], [1920, 1080], [2560, 1080],
];

for (const [width, height] of viewports) {
  test(`layout holds at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
    await expect(page.locator('#status')).toContainText('collision active');
    const layout = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      canvasWidth: document.querySelector('canvas').getBoundingClientRect().width,
      briefWidth: document.querySelector('#brief').getBoundingClientRect().width,
      briefLeft: document.querySelector('#brief').getBoundingClientRect().left,
      briefBottom: window.innerHeight - document.querySelector('#brief').getBoundingClientRect().bottom,
    }));
    expect(layout.horizontalOverflow).toBe(false);
    expect(layout.canvasWidth).toBe(width);
    expect(layout.briefWidth).toBeLessThanOrEqual(width - 32);
    expect(layout.briefLeft).toBeGreaterThanOrEqual(16);
    expect(layout.briefBottom).toBeGreaterThanOrEqual(16);

    await page.evaluate(() => {
      const canvas = document.querySelector('#world');
      Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => canvas });
      document.dispatchEvent(new Event('pointerlockchange'));
    });
    await expect(page.locator('.escape')).toBeVisible();
    await expect(page.locator('.nav-idle')).toBeVisible();
    await expect(page.locator('.movement-keys')).toBeVisible();
    await expect(page.locator('.scroll-cue')).toBeVisible();
    const captured = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      escapeLeft: document.querySelector('.escape').getBoundingClientRect().left,
      escapeBottom: window.innerHeight - document.querySelector('.escape').getBoundingClientRect().bottom,
    }));
    expect(captured.horizontalOverflow).toBe(false);
    expect(captured.escapeLeft).toBeGreaterThanOrEqual(16);
    expect(captured.escapeBottom).toBeGreaterThanOrEqual(16);
    await page.screenshot({ path: `test-results/explorer-0.11.0-${width}x${height}-captured.png`, fullPage: true });
  });
}
