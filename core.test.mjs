import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateCodes, normalizeSerial, FEATURES, getModel } from './core.js';

const vectors = JSON.parse(await readFile(new URL('./vectors.json', import.meta.url), 'utf8'));

test('serial validation preserves leading zeroes and matches desktop whitespace handling', () => {
  assert.equal(normalizeSerial(' \t0012345\n'), '0012345');
  assert.equal(normalizeSerial('\u0085\u001c12345\u3000'), '12345');
  for (const value of ['', ' ', '１２３４５', '١٢٣٤٥', '12O45', '12 345', '-123', '../123', '1'.repeat(21), '123\0', '\uFEFF123', 123, null]) {
    assert.throws(() => normalizeSerial(value), /数字序列号/);
  }
  assert.equal(normalizeSerial('0'.repeat(20)), '0'.repeat(20));
});

test('feature identifiers and display labels match the desktop generator', () => {
  assert.deepEqual(FEATURES, [
    { id: 2, name: '渐变 ND' },
    { id: 11, name: '星点自动对焦' },
    { id: 14, name: '遥控对焦微动' },
    { id: 17, name: '星空影像处理' },
  ]);
});

for (const vector of vectors) {
  test(`SHA-256 output matches desktop reference: synthetic serial ${vector.serial}`, async () => {
    const progress = [];
    const result = await generateCodes(vector.serial, (done, total) => progress.push([done, total]));
    assert.equal(result.serial, vector.serial);
    assert.deepEqual(result.codes.map(({ id, payload }) => ({ id, payload })), vector.codes);
    assert.deepEqual(progress, [[1, 4], [2, 4], [3, 4], [4, 4]]);
  });
}

const k3Vectors = JSON.parse(await readFile(new URL('./k3iii-vectors.json', import.meta.url), 'utf8'));
for (const vector of k3Vectors) {
  test(`K-3 III matches original ARM and SHA-256: ${vector.serial}`, async () => {
    const result = await generateCodes(vector.serial, () => {}, 'k3iii');
    assert.equal(result.modelId, 'k3iii');
    assert.equal(result.filePrefix, 'K3III');
    assert.deepEqual(result.codes, vector.codes);
    assert.deepEqual(result.codes.map(c => c.id), [28, 31, 34, 37]);
  });
}

const k1Vectors = JSON.parse(await readFile(new URL('./k1-vectors.json', import.meta.url), 'utf8'));
for (const vector of k1Vectors) {
  test(`K-1 matches original ARM and SHA-256: ${vector.serial}`, async () => {
    const result = await generateCodes(vector.serial, () => {}, 'k1');
    assert.equal(result.modelId, 'k1');
    assert.equal(result.modelName, 'K-1');
    assert.equal(result.filePrefix, 'K1');
    assert.deepEqual(result.codes, vector.codes);
    assert.deepEqual(result.codes.map(c => c.id), [2, 11, 14, 17]);
  });
}

const monoVectors = JSON.parse(await readFile(new URL('./k3iiim-vectors.json', import.meta.url), 'utf8'));
for (const vector of monoVectors) {
  test(`Monochrome agrees with the native model branch and differs from color: ${vector.serial}`, async () => {
    const result = await generateCodes(vector.serial, () => {}, 'k3iiim');
    assert.equal(getModel('k3iiim').modelWord, 78550);
    assert.equal(result.filePrefix, 'K3IIIM');
    assert.deepEqual(result.codes, vector.codes);
    const color = k3Vectors.find(v => v.serial === vector.serial);
    assert.ok(result.codes.every((c,i) => c.id === color.codes[i].id && c.payload !== color.codes[i].payload));
  });
}

test('unknown models fail closed and model selection changes every payload', async () => {
  for (const id of ['k3ii', 'monochrome', '__proto__', 'constructor', null]) {
    assert.throws(() => getModel(id), /相机型号/);
  }
  await assert.rejects(generateCodes('1234567', () => {}, 'unknown'), /相机型号/);
  const original = vectors.find(v => v.serial === '1234567');
  const k3 = k3Vectors.find(v => v.serial === '1234567');
  assert.ok(k3.codes.every((c, i) => c.payload !== original.codes[i].payload));
  const k1 = k1Vectors.find(v => v.serial === '1234567');
  assert.deepEqual(k1.codes.map(c => c.id), original.codes.map(c => c.id));
  assert.ok(k1.codes.every((c, i) => c.payload !== original.codes[i].payload));
});

test('checked firmware with no verified QR features never hashes a serial or emits progress', async () => {
  for (const [id,version] of [['k70','1.16'],['k5iis','1.07']]) {
    const model = getModel(id);
    assert.equal(model.firmware,version);
    assert.deepEqual(model.features,[]);
    assert.equal(model.modelWord,undefined);
    await assert.rejects(generateCodes('0012345', () => assert.fail('unexpected progress'), id), /暂无已验证/);
  }
});
