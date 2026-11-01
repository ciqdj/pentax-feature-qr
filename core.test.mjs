import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateCodes, normalizeSerial, FEATURES } from './core.js';

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
