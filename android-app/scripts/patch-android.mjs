// Patches the generated Capacitor Android project: AdMob app ID, version code/name. Prints the SDK levels.
// Env: VERSION_CODE (integer), VERSION_NAME (string), ADMOB_APP_ID (optional override)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const android = join(here, '..', 'android');
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
const appId = process.env.ADMOB_APP_ID || 'ca-app-pub-8128005061512507~3594605896';
const versionCode = parseInt(process.env.VERSION_CODE || '1', 10);
const versionName = process.env.VERSION_NAME || pkg.version;

function edit(rel, fn) {
  const file = join(android, rel);
  const before = readFileSync(file, 'utf8');
  const after = fn(before);
  if (after === before) console.log(`(unchanged) ${rel}`); else { writeFileSync(file, after); console.log(`patched ${rel}`); }
  return after;
}

edit('app/src/main/AndroidManifest.xml', (m) => m.includes('com.google.android.gms.ads.APPLICATION_ID') ? m :
  m.replace(/<application([^>]*)>/, '<application$1>\n        <meta-data\n            android:name="com.google.android.gms.ads.APPLICATION_ID"\n            android:value="@string/admob_app_id" />'));

edit('app/src/main/res/values/strings.xml', (s) => s.includes('admob_app_id') ? s :
  s.replace('</resources>', `    <string name="admob_app_id">${appId}</string>\n</resources>`));

const gradle = edit('app/build.gradle', (g) => g
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`));
if (!gradle.includes(`versionCode ${versionCode}`)) throw new Error('Could not set versionCode in app/build.gradle');

const vars = readFileSync(join(android, 'variables.gradle'), 'utf8');
console.log('SDK levels:', (vars.match(/(minSdkVersion|compileSdkVersion|targetSdkVersion)\s*=\s*\d+/g) || []).join(', '));
console.log(`Version ${versionName} (${versionCode}), AdMob app ${appId}`);
