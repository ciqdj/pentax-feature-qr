import { build } from 'esbuild';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

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
// Pages caches each URL independently. Version dependencies from the leaves up
// so a returning visitor never pairs new controls with an older cached script.
const siteText = name => readFile(resolve(site, name), 'utf8');
const saveText = (name, text) => writeFile(resolve(site, name), text);
function pin(text, reference, contents) {
  const literal = `"${reference}"`;
  if (!text.includes(literal)) throw Error(`Missing build reference: ${reference}`);
  const version = createHash('sha256').update(contents).digest('hex').slice(0, 16);
  return text.replaceAll(literal, `"${reference}?v=${version}"`);
}
const [catalog, workerSource, appSource, htmlSource, css] = await Promise.all(
  ['assets/models.js','assets/worker.js','assets/app.js','index.html','styles.css'].map(siteText));
const worker = pin(workerSource, './models.js', catalog);
const app = pin(pin(appSource, './models.js', catalog), './worker.js', worker);
const html = pin(pin(htmlSource, './assets/app.js', app), './styles.css', css);
await Promise.all([saveText('assets/worker.js', worker), saveText('assets/app.js', app), saveText('index.html', html)]);
const nayuki = await readFile(resolve(root, 'qrcodegen.ts'), 'utf8');
const nayukiLicense = nayuki.slice(0, nayuki.indexOf('*/') + 2);
const fflateLicense = await readFile(resolve(root, 'node_modules/fflate/LICENSE'), 'utf8');
await writeFile(resolve(site, 'THIRD-PARTY-NOTICES.txt'), `QR Code generator — Project Nayuki\n${nayukiLicense}\n\nfflate\n${fflateLicense}`, 'utf8');
await writeFile(resolve(site, '.nojekyll'), '');
console.log('Static site ready: site/');
