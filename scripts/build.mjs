import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(projectRoot, 'dist');

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

await build({
  bundle: true,
  entryPoints: [resolve(projectRoot, 'src/index.js')],
  format: 'esm',
  legalComments: 'external',
  minify: false,
  outfile: resolve(outputDirectory, 'fl-tools-core.js'),
  platform: 'browser',
  sourcemap: true,
  target: ['chrome120', 'edge120'],
});
