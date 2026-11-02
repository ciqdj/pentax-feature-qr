import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { unzipSync } from 'fflate';

const vectors = JSON.parse(await readFile(new URL('./vectors.json', import.meta.url), 'utf8'));
const vector = serial => vectors.find(item => item.serial === serial);
const names = ['渐变 ND', '星点自动对焦', '遥控对焦微动', '星空影像处理'];
const k3Vectors = JSON.parse(await readFile(new URL('./k3iii-vectors.json', import.meta.url), 'utf8'));

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

test('K-3 III PNGs and ZIP match native firmware; model switches clear pending and completed results', async ({ page }) => {
  await page.goto('./');
  const model = page.getByLabel('相机型号', { exact: true });
  const serial = page.getByLabel('相机序列号', { exact: true });
  const button = page.getByRole('button', { name: '生成二维码' });
  await serial.fill('0012345');
  await button.click();
  await model.selectOption('k3iii');
  await expect(page.locator('#results')).toBeHidden();
  await expect(button).toBeEnabled();
  await expect(page.locator('#model-note')).toContainText('尚待真机');
  await button.click();
  await expect(page.locator('#status')).toHaveText('4 个二维码已生成');
  await expect(page.locator('#result-model')).toHaveText('K-3 III');
  const expected = k3Vectors.find(v => v.serial === '0012345');
  const pngs = new Map();
  for (let i = 0; i < 4; i++) {
    const file = await downloadBytes(page, page.getByRole('link', { name: `保存${names[i]}二维码`, exact: true }));
    expect(file.name).toMatch(/^K3III_/);
    checkPng(file.data, expected.codes[i].payload);
    pngs.set(file.name, file.data);
  }
  const archive = await downloadBytes(page, page.locator('#download-all'));
  expect(archive.name).toBe('K3III_0012345.zip');
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
  expect(page.url()).toBe('http://127.0.0.1:4173/k1ii-qr/');
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
