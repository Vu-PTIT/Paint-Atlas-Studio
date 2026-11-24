import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWorld } from './build-world.mjs';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const examples = path.resolve(frontend, '../examples');
const catalog = JSON.parse(await readFile(path.join(examples, 'catalog.json'), 'utf8'));

for (const { key, title, palette, seed, subject, description, source } of catalog) {
  await buildWorld(
    path.join(frontend, 'player', 'src', 'scenes', source),
    { version: 1, title, palette, seed, subject, description },
    path.join(examples, 'worlds', key + '.html'),
  );
  console.log('Built ' + key);
}
