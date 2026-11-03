import { normalizeSerial, getModel, MODELS } from './core.js';
import { drawQr, canvasPng } from './qr.js';
import { zipSync } from 'fflate';

const form = document.querySelector('#generator');
const requestForm = document.querySelector('#model-request');
const requestedModel = document.querySelector('#requested-model');
requestForm.addEventListener('submit', event => {
  event.preventDefault();
  const model = requestedModel.value.trim();
  if (!model) return;
  const draft = new URL('https://github.com/nahtaki/pentax-feature-qr/issues/new');
  draft.searchParams.set('title', `机型请求：${model}`);
  draft.searchParams.set('body', `希望支持的机型：${model}`);
  window.open(draft.href, '_blank', 'noopener,noreferrer');
});
const serialInput = document.querySelector('#serial');
const modelInput = document.querySelector('#model');
const serialControls = document.querySelector('#serial-controls');
for (const [id, model] of Object.entries(MODELS)) {
  const group = modelInput.querySelector(model.features.length ? '#can-generate' : '#checked-models');
  group.append(new Option('PENTAX ' + (model.label ?? model.name), id));
}
const modelNote = document.querySelector('#model-note');
const resultModel = document.querySelector('#result-model');
const generateButton = document.querySelector('#generate');
const status = document.querySelector('#status');
const progress = document.querySelector('#progress');
const results = document.querySelector('#results');
const cards = document.querySelector('#cards');
const resultSerial = document.querySelector('#result-serial');
const downloadAll = document.querySelector('#download-all');
const qrViewer = document.querySelector('#qr-viewer');
const viewerHeader = document.querySelector('#qr-viewer-header');
const viewerTitle = document.querySelector('#qr-viewer-title');
const viewerMeta = document.querySelector('#qr-viewer-meta');
const viewerStage = document.querySelector('#qr-viewer-stage');
const viewerCanvas = document.querySelector('#qr-viewer-canvas');
const viewerClose = document.querySelector('#qr-viewer-close');
let worker;
let deadline;
let generation = 0;
let urls = [];

function fitQrViewer() {
  if (!qrViewer.open) return;
  const available = Math.min(viewerStage.clientWidth, viewerStage.clientHeight);
  // Keep the complete square and quiet zone, using all available screen space.
  // Pixelated rendering preserves the QR's hard edges when scaling the canvas.
  const side = Math.max(1, Math.floor(available));
  viewerCanvas.style.width = `${side}px`;
  viewerCanvas.style.height = `${side}px`;
}

function clearQrViewer() {
  if (qrViewer.open) return;
  document.body.classList.remove('qr-viewer-open');
  viewerCanvas.getContext('2d').clearRect(0, 0, viewerCanvas.width, viewerCanvas.height);
  viewerTitle.textContent = '';
  viewerMeta.textContent = '';
}

function closeQrViewer() {
  if (qrViewer.open) qrViewer.close();
  clearQrViewer();
}

function openQrViewer(code, result) {
  viewerTitle.textContent = code.name;
  viewerMeta.textContent = `${result.modelName} · 序列号 ${result.serial}`;
  viewerCanvas.setAttribute('aria-label', `${code.name}二维码大图`);
  drawQr(viewerCanvas, code.payload);
  document.body.classList.add('qr-viewer-open');
  qrViewer.showModal();
  fitQrViewer();
}

new ResizeObserver(fitQrViewer).observe(viewerStage);
viewerClose.addEventListener('click', closeQrViewer);
qrViewer.addEventListener('cancel', event => {
  event.preventDefault();
  closeQrViewer();
});
qrViewer.addEventListener('close', clearQrViewer);
qrViewer.addEventListener('click', event => {
  if ([qrViewer, viewerStage, viewerHeader].includes(event.target)) closeQrViewer();
});

function stopWorker() {
  worker?.terminate();
  worker = undefined;
  clearTimeout(deadline);
}

function setBusy(busy) {
  generateButton.disabled = busy || !getModel(modelInput.value).features.length;
  generateButton.textContent = busy ? '正在生成…' : '生成二维码';
  form.setAttribute('aria-busy', String(busy));
  progress.hidden = !busy;
}

function invalidate() {
  generation++;
  closeQrViewer();
  stopWorker();
  setBusy(false);
  results.hidden = true;
  cards.replaceChildren();
  downloadAll.removeAttribute('href');
  downloadAll.removeAttribute('download');
  for (const url of urls) URL.revokeObjectURL(url);
  urls = [];
  status.textContent = '';
  status.classList.remove('error');
  serialInput.removeAttribute('aria-invalid');
}

function fail(message, inputError = false) {
  invalidate();
  status.textContent = message;
  status.classList.add('error');
  if (inputError) {
    serialInput.setAttribute('aria-invalid', 'true');
    serialInput.focus();
  }
}

async function render(result, token) {
  const fragment = document.createDocumentFragment();
  const files = {};
  const prepared = [];
  for (const [index, code] of result.codes.entries()) {
    const card = document.createElement('article');
    card.className = 'qr-card';
    const heading = document.createElement('h3');
    heading.textContent = code.name;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${code.name}二维码`);
    drawQr(canvas, code.payload);
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'qr-preview';
    preview.setAttribute('aria-label', `放大${code.name}二维码`);
    preview.setAttribute('aria-haspopup', 'dialog');
    preview.title = '点击放大';
    preview.append(canvas);
    preview.addEventListener('click', () => openQrViewer(code, result));
    const blob = await canvasPng(canvas);
    const filename = `${result.filePrefix}_${String(index + 1).padStart(2, '0')}_${code.name.replaceAll(' ', '')}_${result.serial}.png`;
    files[filename] = new Uint8Array(await blob.arrayBuffer());
    const link = document.createElement('a');
    link.className = 'save-link';
    link.textContent = '保存 PNG';
    link.download = filename;
    link.setAttribute('aria-label', `保存${code.name}二维码`);
    card.append(heading, preview, link);
    fragment.append(card);
    prepared.push({ link, blob });
  }
  // The user may edit the serial while asynchronous PNG export is in progress.
  if (token !== generation) return;
  const archive = new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
  for (const { link, blob } of prepared) {
    link.href = URL.createObjectURL(blob);
    urls.push(link.href);
  }
  downloadAll.href = URL.createObjectURL(archive);
  urls.push(downloadAll.href);
  downloadAll.download = `${result.filePrefix}_${result.serial}.zip`;
  cards.replaceChildren(fragment);
  resultModel.textContent = result.modelName;
  resultSerial.textContent = result.serial;
  results.hidden = false;
  setBusy(false);
  status.textContent = `${result.codes.length} 个二维码已生成`;
}

serialInput.addEventListener('input', invalidate);
function showSelectedModel() {
  invalidate();
  const model = getModel(modelInput.value);
  const count = model.features.length;
  serialControls.hidden = !count;
  serialInput.disabled = !count;
  if (!count) {
    modelNote.textContent = `${model.name}（固件 ${model.firmware}）：0 项已验证的功能二维码，无需输入序列号。`;
    return;
  }
  progress.max = count;
  modelNote.textContent = modelInput.value === 'k1ii' ? `可生成 ${count} 个功能二维码。`
    : `${model.name}：可生成 ${count} 个功能二维码，已完成离线校验，尚待真机扫码确认。`;
}
modelInput.addEventListener('change', showSelectedModel);
window.addEventListener('pageshow', showSelectedModel);
showSelectedModel();
window.addEventListener('pagehide', invalidate);
form.addEventListener('submit', event => {
  event.preventDefault();
  invalidate();
  const count = getModel(modelInput.value).features.length;
  if (!count) return;
  let serial;
  try {
    serial = normalizeSerial(serialInput.value);
  } catch (error) {
    fail(error.message, true);
    return;
  }
  if (!globalThis.crypto?.subtle || !globalThis.Worker) {
    fail('请用最新版浏览器，通过 HTTPS 链接或本地预览打开网页');
    return;
  }
  const token = generation;
  setBusy(true);
  progress.value = 0;
  status.textContent = `正在生成 0 / ${count}`;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    deadline = setTimeout(() => {
      if (token === generation) fail('生成超时，请重试');
    }, 60000);
    worker.onerror = event => {
      event.preventDefault();
      if (token === generation) fail('生成失败，请刷新页面后重试');
    };
    worker.onmessage = async ({ data }) => {
      if (token !== generation) return;
      if (data.type === 'progress') {
        progress.value = data.done;
        status.textContent = `正在生成 ${data.done} / ${data.total}`;
      } else if (data.type === 'complete') {
        stopWorker();
        try {
          await render(data.result, token);
        } catch {
          if (token === generation) fail('图片生成失败，请重试');
        }
      } else if (data.type === 'error') {
        fail('生成失败，请刷新页面后重试');
      }
    };
    worker.postMessage({ serial, modelId: modelInput.value });
  } catch {
    fail('无法启动生成器，请刷新页面后重试');
  }
});
