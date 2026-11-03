import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { unzipSync } from 'fflate';

const vectors = JSON.parse(await readFile(new URL('./vectors.json', import.meta.url), 'utf8'));
const vector = serial => vectors.find(item => item.serial === serial);
const names = ['渐变 ND', '星点自动对焦', '遥控对焦微动', '星空影像处理'];
const k3Vectors = JSON.parse(await readFile(new URL('./k3iii-vectors.json', import.meta.url), 'utf8'));
const k1Vectors = JSON.parse(await readFile(new URL('./k1-vectors.json', import.meta.url), 'utf8'));
const monoVectors = JSON.parse(await readFile(new URL('./k3iiim-vectors.json', import.meta.url), 'utf8'));

async function downloadBytes(page, locator) {
  const pending = page.waitForEvent('download');
  await locator.click();
  const download = await pending;
  expect(await download.failure()).toBeNull();
  return { name: download.suggestedFilename(), data: await readFile(await download.path()) };
}

function checkPng(data, payload) {
  const png = PNG.sync.read(Buffer.from(data));
  expect([png.width, png.height]).toEqual([540, 540]);
  // Verify every quiet-zone pixel, then decode with a different implementation.
  for (let y = 0; y < 540; y++) {
    for (let x = 0; x < 540; x++) {
      if (x >= 48 && x < 492 && y >= 48 && y < 492) continue;
      const offset = (y * 540 + x) * 4;
      if (png.data[offset] !== 255 || png.data[offset + 1] !== 255 || png.data[offset + 2] !== 255 || png.data[offset + 3] !== 255) {
        throw new Error('Quiet zone is not opaque white');
      }
    }
  }
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded?.data).toBe(payload);
  expect(decoded?.version).toBe(5);
  expect(decoded?.chunks).toHaveLength(1);
  expect(decoded?.chunks[0].type).toBe('byte');
}

for (const { id, name, prefix, vectors: modelVectors } of [
  { id: 'k3iii', name: 'K-3 III', prefix: 'K3III', vectors: k3Vectors },
  { id: 'k3iiim', name: 'K-3 III Monochrome', prefix: 'K3IIIM', vectors: monoVectors },
  { id: 'k1', name: 'K-1', prefix: 'K1', vectors: k1Vectors },
]) {
test(`${name} PNGs and ZIP match native firmware; model switches clear pending and completed results`, async ({ page }) => {
  await page.goto('./');
  const model = page.getByLabel('相机型号', { exact: true });
  const serial = page.getByLabel('相机序列号', { exact: true });
  const button = page.getByRole('button', { name: '生成二维码' });
  await serial.fill('0012345');
  await button.click();
  await model.selectOption(id);
  await expect(page.locator('#results')).toBeHidden();
  await expect(button).toBeEnabled();
  await expect(page.locator('#model-note')).toContainText('尚待真机');
  await button.click();
  await expect(page.locator('#status')).toHaveText('4 个二维码已生成');
  await expect(page.locator('#result-model')).toHaveText(name);
  const expected = modelVectors.find(v => v.serial === '0012345');
  const pngs = new Map();
  for (let i = 0; i < 4; i++) {
    const file = await downloadBytes(page, page.getByRole('link', { name: `保存${names[i]}二维码`, exact: true }));
    expect(file.name.startsWith(`${prefix}_`)).toBe(true);
    checkPng(file.data, expected.codes[i].payload);
    pngs.set(file.name, file.data);
  }
  const archive = await downloadBytes(page, page.locator('#download-all'));
  expect(archive.name).toBe(`${prefix}_0012345.zip`);
  const entries = Object.entries(unzipSync(archive.data));
  expect(entries).toHaveLength(4);
  for (const [name, bytes] of entries) expect(Buffer.from(bytes).equals(pngs.get(name))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await model.selectOption('k1ii');
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#download-all')).not.toHaveAttribute('href');
  await button.click();
  await expect(page.locator('#status')).toHaveText('4 个二维码已生成');
  await expect(page.locator('#result-model')).toHaveText('K-1 II');
  const restored = await downloadBytes(page, page.getByRole('link', { name: '保存渐变 ND二维码', exact: true }));
  checkPng(restored.data, vector('0012345').codes[0].payload);
});
}

test('four independently decoded PNGs, ZIP, local calculation, and responsive layout', async ({ page }, testInfo) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push(request.url()));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '功能二维码', exact: true })).toBeVisible();
  await page.getByLabel('相机序列号', { exact: true }).fill('1234567');
  await page.getByRole('button', { name: '生成二维码' }).click();
  await expect(page.locator('#status')).toHaveText('4 个二维码已生成');
  await expect(page.locator('#cards canvas')).toHaveCount(4);
  await expect(page.locator('#result-serial')).toHaveText('1234567');
  const expected = vector('1234567');
  const pngs = new Map();
  for (let i = 0; i < names.length; i++) {
    const download = await downloadBytes(page, page.getByRole('link', { name: `保存${names[i]}二维码`, exact: true }));
    checkPng(download.data, expected.codes[i].payload);
    pngs.set(download.name, download.data);
  }
  const archive = await downloadBytes(page, page.locator('#download-all'));
  expect(archive.name).toBe('K1II_1234567.zip');
  const unzipped = unzipSync(archive.data);
  expect(Object.keys(unzipped)).toHaveLength(4);
  for (const [name, bytes] of Object.entries(unzipped)) {
    expect(Buffer.from(bytes).equals(pngs.get(name))).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  expect(new URL(page.url()).pathname).toBe('/pentax-feature-qr/');
  expect(requests.every(url => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
  expect(requests.some(url => url.includes('1234567'))).toBe(false);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('generated.png'), fullPage: true });
  await page.getByLabel('相机序列号', { exact: true }).fill('0012345');
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#download-all')).not.toHaveAttribute('href');
  await page.getByRole('button', { name: '生成二维码' }).click();
  await expect(page.locator('#status')).toHaveText('4 个二维码已生成');
  await expect(page.locator('#result-serial')).toHaveText('0012345');
  const leadingZeroQr = await downloadBytes(page, page.getByRole('link', { name: '保存渐变 ND二维码', exact: true }));
  checkPng(leadingZeroQr.data, vector('0012345').codes[0].payload);
});

test('model requests open a draft with only the requested model', async ({ page, context }) => {
  const drafts = [];
  await context.route('https://github.com/**', async route => {
    drafts.push(new URL(route.request().url()));
    await route.fulfill({ contentType: 'text/html', body: '<title>Draft</title>' });
  });
  await page.goto('./');
  await page.getByLabel('相机序列号', { exact: true }).fill('0012345');
  const model = page.getByLabel('列表里没有你的机型？');
  await model.fill('   ');
  await page.getByRole('button', { name: '去 GitHub 反馈' }).click();
  expect(await model.evaluate(el => el.validity.valid)).toBe(false);
  expect(drafts).toHaveLength(0);
  await model.fill('  K-70 & KP  ');
  const popup = context.waitForEvent('page');
  await model.press('Enter');
  const draft = await popup;
  await draft.waitForLoadState('domcontentloaded');
  expect(drafts).toHaveLength(1);
  expect(drafts[0].pathname).toBe('/nahtaki/pentax-feature-qr/issues/new');
  expect([...drafts[0].searchParams]).toEqual([['title','机型请求：K-70 & KP'], ['body','希望支持的机型：K-70 & KP']]);
  expect(drafts[0].href).not.toContain('0012345');
  await expect(page.locator('#results')).toBeHidden();
});

test('zero-feature models clear finished and pending codes without requesting a serial', async ({ page }) => {
  await page.goto('./');
  const model = page.getByLabel('相机型号', {exact:true});
  const serial = page.getByLabel('相机序列号', {exact:true});
  const generate = page.locator('#generate');
  await serial.fill('0012345');
  await generate.click();
  await expect(page.locator('#cards canvas')).toHaveCount(4);
  for (const [id,label,version] of [['k70','K-70','1.16'],['k5iis','K-5 IIs','1.07']]) {
    await model.selectOption(id);
    await expect(page.locator('#model-note')).toHaveText(`${label}（固件 ${version}）：0 项已验证的功能二维码，无需输入序列号。`);
    await expect(serial).toBeHidden();
    await expect(generate).toBeDisabled();
    await expect(page.locator('#cards canvas')).toHaveCount(0);
    await expect(page.locator('#download-all')).not.toHaveAttribute('href');
    await expect(page.locator('#requested-model')).toBeVisible();
    await model.selectOption('k1ii');
    await expect(serial).toBeVisible();
    await expect(generate).toBeEnabled();
    await generate.click();
  }
  await expect(page.locator('#cards canvas')).toHaveCount(4);
});

test('one and two verified features produce exactly that many labelled PNGs and ZIP entries', async ({ page, context }) => {
  // Test-only catalog entries reuse known K-1 vectors. No synthetic camera is published.
  await context.route(/\/assets\/models\.js$/, route => route.fulfill({
    contentType: 'text/javascript', body: `
      import {MODELS as original} from './models.js?unmodified';
      export {FEATURES} from './models.js?unmodified';
      const partial = (n,features) => ({...original.k1,name:'Fixture '+n,filePrefix:'TEST'+n,features});
      export const MODELS = {...original, test1:partial(1,[original.k1.features[2]]),
        test2:partial(2,[original.k1.features[1],original.k1.features[3]])};
    `,
  }));
  await page.goto('./');
  const expected=k1Vectors.find(v=>v.serial==='0012345');
  for (const [id,indices] of [['test1',[2]],['test2',[1,3]]]) {
    const count=indices.length;
    await page.getByLabel('相机型号',{exact:true}).selectOption(id);
    await expect(page.locator('#progress')).toHaveAttribute('max',String(count));
    await page.getByLabel('相机序列号',{exact:true}).fill('0012345');
    await page.locator('#generate').click();
    await expect(page.locator('#status')).toHaveText(`${count} 个二维码已生成`);
    await expect(page.locator('#cards canvas')).toHaveCount(count);
    await expect(page.locator('#cards h3')).toHaveText(indices.map(i=>expected.codes[i].name));
    const zip=await downloadBytes(page,page.locator('#download-all'));
    const entries=Object.entries(unzipSync(zip.data));
    expect(entries).toHaveLength(count);
    for (const [i,[name,png]] of entries.entries()) {
      expect(name).toContain(expected.codes[indices[i]].name.replaceAll(' ',''));
      checkPng(png,expected.codes[indices[i]].payload);
    }
  }
});

test('invalid serial and editing during generation cannot leave stale results', async ({ page }) => {
  await page.goto('./');
  const input = page.getByLabel('相机序列号', { exact: true });
  const button = page.getByRole('button', { name: '生成二维码' });
  for (const serial of ['１２３４５', '123456789012345678901', '12 345', '']) {
    await input.fill(serial);
    await button.click();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#status')).toHaveText('请输入 1–20 位数字序列号');
    await expect(page.locator('#results')).toBeHidden();
  }
  await input.fill('1234567');
  await button.click();
  await input.fill('0012345');
  await expect(button).toBeEnabled();
  await expect(page.locator('#results')).toBeHidden();
  await button.click();
  await expect(page.locator('#status')).toHaveText('4 个二维码已生成');
  await expect(page.locator('#result-serial')).toHaveText('0012345');
  const result = await downloadBytes(page, page.getByRole('link', { name: '保存渐变 ND二维码', exact: true }));
  checkPng(result.data, vector('0012345').codes[0].payload);
});

test('worker loading failure returns to a retryable state', async ({ page }) => {
  await page.route('**/assets/worker.js', route => route.abort());
  await page.goto('./');
  await page.getByLabel('相机序列号', { exact: true }).fill('1234567');
  await page.getByRole('button', { name: '生成二维码' }).click();
  await expect(page.locator('#status')).toHaveText('生成失败，请刷新页面后重试');
  await expect(page.getByRole('button', { name: '生成二维码' })).toBeEnabled();
  await expect(page.locator('#results')).toBeHidden();
  await page.unroute('**/assets/worker.js');
  await page.getByRole('button', { name: '生成二维码' }).click();
  await expect(page.locator('#status')).toHaveText('4 个二维码已生成');
});

test('QR viewer fills the viewport, decodes every feature, and closes with blank space, Escape or the close button', async ({ page }, testInfo) => {
  await page.goto('./');
  await page.getByLabel('相机型号', { exact: true }).selectOption('k1');
  await page.getByLabel('相机序列号', { exact: true }).fill('0012345');
  await page.getByRole('button', { name: '生成二维码', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('4 个二维码已生成');
  const expected = k1Vectors.find(v => v.serial === '0012345');
  const viewer = page.locator('#qr-viewer');
  const largeQr = page.locator('#qr-viewer-canvas');
  for (let i = 0; i < names.length; i++) {
    const trigger = page.getByRole('button', { name: `放大${names[i]}二维码`, exact: true });
    const small = await trigger.boundingBox();
    await trigger.click();
    await expect(viewer).toBeVisible();
    await expect(viewer).toHaveAccessibleName(names[i]);
    await expect(page.locator('#qr-viewer-meta')).toHaveText('K-1 · 序列号 0012345');
    const size = await largeQr.boundingBox();
    expect(size.width).toBeGreaterThan(small.width);
    expect(size.width).toBe(size.height);
    const available = await page.locator('#qr-viewer-stage').evaluate(el => Math.min(el.clientWidth, el.clientHeight));
    expect(available - size.width).toBeLessThan(1);
    expect(size.x).toBeGreaterThanOrEqual(0);
    expect(size.y).toBeGreaterThanOrEqual(0);
    expect(size.x + size.width).toBeLessThanOrEqual(page.viewportSize().width);
    expect(size.y + size.height).toBeLessThanOrEqual(page.viewportSize().height);
    // Decode the actual on-screen, enlarged QR, including device pixel ratio.
    const png = PNG.sync.read(await largeQr.screenshot());
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded?.data).toBe(expected.codes[i].payload);
    await largeQr.click();
    await expect(viewer).toBeVisible();
    if (i === 0) {
      await page.screenshot({ path: testInfo.outputPath('enlarged-qr.png') });
      await viewer.click({ position: { x: 2, y: 2 } });
    } else if (i === 1) {
      await page.keyboard.press('Escape');
    } else {
      if (i === 3) {
        await page.setViewportSize({ width: 844, height: 390 });
        await expect.poll(async () => (await largeQr.boundingBox()).height).toBeLessThan(350);
        const landscape = PNG.sync.read(await largeQr.screenshot());
        expect(jsQR(new Uint8ClampedArray(landscape.data), landscape.width, landscape.height)?.data).toBe(expected.codes[i].payload);
      }
      await page.getByRole('button', { name: '关闭大图', exact: true }).click();
    }
    await expect(viewer).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  }
});
