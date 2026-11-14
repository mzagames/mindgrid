// Patches the generated Capacitor Android project: AdMob app ID, version code/name, and (1.6.0) the
// MzaBilling plugin for the one-time "Remove ads" purchase (Google Play Billing). Prints the SDK levels.
// Env: VERSION_CODE (integer), VERSION_NAME (string), ADMOB_APP_ID (optional override)
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
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

// ---- 1.6.0: "Remove ads" purchase. The plugin source lives in android-app/native and is copied in here.
const javaDir = join(android, 'app', 'src', 'main', 'java', 'com', 'mzagaming', 'mindgrid');
mkdirSync(javaDir, { recursive: true });
copyFileSync(join(here, '..', 'native', 'MzaBillingPlugin.java'), join(javaDir, 'MzaBillingPlugin.java'));
console.log('copied MzaBillingPlugin.java');
const activity = edit('app/src/main/java/com/mzagaming/mindgrid/MainActivity.java', (m) => {
  if (m.includes('MzaBillingPlugin')) return m;
  const body = [
    'public class MainActivity extends BridgeActivity {',
    '    @Override',
    '    public void onCreate(Bundle savedInstanceState) {',
    '        registerPlugin(MzaBillingPlugin.class); // local plugin: must be registered before super.onCreate',
    '        super.onCreate(savedInstanceState);',
    '    }',
    ''].join('\n');
  let out = m.replace(/public class MainActivity extends BridgeActivity\s*\{\s*\}/, body + '}');
  if (out === m) out = m.replace(/public class MainActivity extends BridgeActivity\s*\{/, body);
  if (!out.includes('import android.os.Bundle;')) out = out.replace(/(package [^;]+;)/, '$1\n\nimport android.os.Bundle;');
  return out;
});
if (!activity.includes('registerPlugin(MzaBillingPlugin.class)')) throw new Error('Could not register MzaBillingPlugin in MainActivity');
const appGradle = edit('app/build.gradle', (g) => g.includes('com.android.billingclient:billing') ? g :
  g.replace(/dependencies\s*\{/, "dependencies {\n    implementation 'com.android.billingclient:billing:9.1.0'"));
if (!appGradle.includes('com.android.billingclient:billing:9.1.0')) throw new Error('Could not add Google Play Billing to app/build.gradle');

// ---- 1.6.2: App Hive tester countdown. MzaSecure blocks screenshots for the first seconds and reports
// screenshot attempts on Android 14+ (DETECT_SCREEN_CAPTURE is a normal install-time permission).
copyFileSync(join(here, '..', 'native', 'MzaSecurePlugin.java'), join(javaDir, 'MzaSecurePlugin.java'));
console.log('copied MzaSecurePlugin.java');
const activity2 = edit('app/src/main/java/com/mzagaming/mindgrid/MainActivity.java', (m) => m.includes('MzaSecurePlugin') ? m :
  m.replace('registerPlugin(MzaBillingPlugin.class);', 'registerPlugin(MzaSecurePlugin.class);\n        registerPlugin(MzaBillingPlugin.class);'));
if (!activity2.includes('registerPlugin(MzaSecurePlugin.class)')) throw new Error('Could not register MzaSecurePlugin in MainActivity');
const manifest = edit('app/src/main/AndroidManifest.xml', (m) => m.includes('DETECT_SCREEN_CAPTURE') ? m :
  m.replace(/(<application)/, '<uses-permission android:name="android.permission.DETECT_SCREEN_CAPTURE" />\n    $1'));
if (!manifest.includes('DETECT_SCREEN_CAPTURE')) throw new Error('Could not add DETECT_SCREEN_CAPTURE');

const vars = readFileSync(join(android, 'variables.gradle'), 'utf8');
console.log('SDK levels:', (vars.match(/(minSdkVersion|compileSdkVersion|targetSdkVersion)\s*=\s*\d+/g) || []).join(', '));
console.log(`Version ${versionName} (${versionCode}), AdMob app ${appId}`);
