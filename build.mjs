import { build } from 'esbuild';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const site = resolve(root, 'site');
await mkdir(resolve(site, 'assets'), { recursive: true });
await copyFile(resolve(root, 'models.js'), resolve(site, 'assets/models.js'));
for (const name of ['index.html', 'styles.css', 'favicon.svg']) {
  await copyFile(resolve(root, name), resolve(site, name));
}
await build({
  absWorkingDir: root,
  entryPoints: { app: 'app.js', worker: 'worker.js' },
  outdir: 'site/assets',
  bundle: true,
  external: ['./models.js'], // The UI and its worker read the same model catalog.
  format: 'esm',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  legalComments: 'none',
  sourcemap: false,
  logLevel: 'info',
});
const nayuki = await readFile(resolve(root, 'qrcodegen.ts'), 'utf8');
const nayukiLicense = nayuki.slice(0, nayuki.indexOf('*/') + 2);
const fflateLicense = await readFile(resolve(root, 'node_modules/fflate/LICENSE'), 'utf8');
await writeFile(resolve(site, 'THIRD-PARTY-NOTICES.txt'), `QR Code generator — Project Nayuki\n${nayukiLicense}\n\nfflate\n${fflateLicense}`, 'utf8');
await writeFile(resolve(site, '.nojekyll'), '');
console.log('Static site ready: site/');
