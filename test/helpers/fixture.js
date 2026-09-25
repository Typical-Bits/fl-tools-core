import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const fixtureDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
  'fetlife',
);

export async function loadFixture(name, url) {
  const html = await readFile(resolve(fixtureDirectory, `${name}.html`), 'utf8');
  return new JSDOM(html, { url });
}
