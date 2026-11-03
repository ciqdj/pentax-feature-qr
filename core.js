import { MODELS } from './models.js';
export { MODELS, FEATURES } from './models.js';
const encoder = new TextEncoder();

export function getModel(id) {
  if (!Object.hasOwn(MODELS, id)) throw new Error('请选择支持的相机型号');
  return MODELS[id];
}
const HASH_ROUNDS = 0x1617;
// Match Python str.strip(), including its additional control whitespace.
const space = '[\\u0009-\\u000d\\u001c-\\u0020\\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028-\\u2029\\u202f\\u205f\\u3000]';
const surroundingSpace = new RegExp(`^${space}+|${space}+$`, 'g');

export function normalizeSerial(value) {
  const serial = typeof value === 'string' ? value.replace(surroundingSpace, '') : '';
  if (!/^[0-9]{1,20}$/.test(serial)) {
    throw new Error('请输入 1–20 位数字序列号');
  }
  return serial; // Leading zeroes are significant; never parse as a number.
}

function concat(...parts) {
  const output = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function uint32LE(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

async function sha256(bytes) {
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
}

export async function generateCodes(input, onProgress = () => {}, modelId = 'k1ii') {
  const model = getModel(modelId);
  if (!model.features.length) throw new Error('该机型暂无已验证的功能二维码');
  const serial = normalizeSerial(input);
  if (!globalThis.crypto?.subtle) {
    throw new Error('请使用 HTTPS 链接或本地预览打开网页');
  }
  const serialBytes = new Uint8Array(20);
  serialBytes.set(encoder.encode(serial));
  const modelHash = await sha256(concat(encoder.encode('g05gdn4z621s33z2woiyxny0ehj2qh2a'), uint32LE(model.modelWord)));
  const serialHash = await sha256(concat(encoder.encode('urj4rwz08lyr637pzabdu8pvdo995hbs'), serialBytes));
  const codes = [];
  for (const feature of model.features) {
    const featureHash = await sha256(concat(encoder.encode('pcig9piz9825bd2iz0j4oe2tszkefde5'), uint32LE(feature.id)));
    let digest = await sha256(concat(modelHash, featureHash, serialHash));
    for (let i = 0; i < HASH_ROUNDS; i++) digest = await sha256(digest);
    const payload = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    codes.push({ ...feature, payload });
    onProgress(codes.length, model.features.length);
  }
  return { serial, codes, modelId, modelName: model.name, filePrefix: model.filePrefix };
}
