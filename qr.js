import { qrcodegen } from './qrcodegen.ts';

export function drawQr(canvas, payload) {
  if (!/^[0-9a-f]{64}$/.test(payload)) throw new Error('Invalid QR payload');
  const segments = [qrcodegen.QrSegment.makeBytes(new TextEncoder().encode(payload))];
  const qr = qrcodegen.QrCode.encodeSegments(segments, qrcodegen.QrCode.Ecc.LOW, 5, 5, -1, false);
  const scale = 12;
  const border = 4;
  canvas.width = canvas.height = (qr.size + border * 2) * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.getModule(x, y)) ctx.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
    }
  }
}

export function canvasPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png');
  });
}
