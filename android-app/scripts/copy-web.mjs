// Copies the MindGrid web game (repo root) into android-app/www so Capacitor bundles it inside the app.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..', '..');
const www = join(here, '..', 'www');
const items = [
  'index.html', 'play.html', 'journey.html', 'archive.html', 'stats.html', 'settings.html', 'howto.html', 'privacy.html',
  'manifest.webmanifest', 'css', 'js', 'assets'
];

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
for (const item of items) cpSync(join(site, item), join(www, item), { recursive: true });
console.log(`Copied ${items.length} entries into ${www}`);
