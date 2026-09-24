// Verify decoded *packaged* outputs, not the source manifest. Use bundletool
// dump manifest for the AAB, and aapt dump xmltree/resources for the APK.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const [aabFile, apkTreeFile, apkResourcesFile, expectedCode = '2'] = process.argv.slice(2);
if (!aabFile || !apkTreeFile || !apkResourcesFile) {
  throw Error('Usage: node verify-native-manifest.cjs <aab-manifest.xml> <apk-manifest-tree.txt> <apk-resources.txt> [versionCode]');
}
const component = 'com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity';
const metadata = 'android.support.customtabs.trusted.MANAGE_SPACE_URL';
const aab = fs.readFileSync(aabFile, 'utf8');
assert.match(aab, /package="com\.cheffodoggo\.app"/);
assert.ok(aab.includes(`android:versionCode="${expectedCode}"`), 'Unexpected AAB version');
assert.ok(aab.includes(`android:manageSpaceActivity="${component}"`), 'Missing application manage-space component');
const activities = [...aab.matchAll(/<activity\b([^>]*)(?:\/>|>([\s\S]*?)<\/activity>)/g)];
const activity = activities.filter(m => m[1].includes(`android:name="${component}"`));
assert.equal(activity.length, 1, 'Required manage-data activity must be packaged exactly once');
for (const [name, value] of Object.entries({ exported: 'false', enabled: 'true', excludeFromRecents: 'true' })) {
  assert.ok(activity[0][1].includes(`android:${name}="${value}"`), `Incorrect activity ${name}`);
}
assert.match(activity[0][2], /android:name="android\.support\.customtabs\.trusted\.MANAGE_SPACE_URL"[^>]*android:value="@string\/launch_url"/);
assert.ok(activity[0][2].includes('android.intent.action.APPLICATION_PREFERENCES'));

// aapt xmltree retains each element's indentation and typed attribute values.
function tree(text) {
  const roots = [], stack = [];
  for (const line of text.split(/\r?\n/)) {
    const element = line.match(/^(\s*)E: (\S+)/);
    if (element) {
      const node = { name: element[2], indent: element[1].length, attrs: {}, children: [] };
      while (stack.length && stack.at(-1).indent >= node.indent) stack.pop();
      (stack.length ? stack.at(-1).children : roots).push(node);stack.push(node);continue;
    }
    const attribute = line.match(/^\s*A: ([\w:]+)(?:\([^)]*\))?=(.*)$/);
    if (attribute && stack.length) stack.at(-1).attrs[attribute[1]] = attribute[2].trim();
  }
  return roots;
}
const apk = tree(fs.readFileSync(apkTreeFile, 'utf8'));
const manifest = apk.find(n => n.name === 'manifest');
const value = (node, name) => {
  const raw = node?.attrs[name];
  if (raw?.startsWith('"')) return JSON.parse(raw.match(/^"(?:\\.|[^"\\])*"/)[0]);
  return raw;
};
assert.equal(value(manifest, 'package'), 'com.cheffodoggo.app');
assert.equal(value(manifest, 'android:versionCode'), `(type 0x10)0x${Number(expectedCode).toString(16)}`);
const app = manifest.children.find(n => n.name === 'application');
assert.equal(value(app, 'android:manageSpaceActivity'), component);
const matching = app.children.filter(n => n.name === 'activity' && value(n, 'android:name') === component);
assert.equal(matching.length, 1, 'APK lacks the required activity');
assert.equal(value(matching[0], 'android:exported'), '(type 0x12)0x0');
assert.equal(value(matching[0], 'android:enabled'), '(type 0x12)0xffffffff');
assert.equal(value(matching[0], 'android:excludeFromRecents'), '(type 0x12)0xffffffff');
const urlMeta = matching[0].children.find(n => n.name === 'meta-data' && value(n, 'android:name') === metadata);
const resources = fs.readFileSync(apkResourcesFile, 'utf8');
const launchId = resources.match(/spec resource (0x[0-9a-f]+) [^\r\n]*:string\/launch_url:/)?.[1];
assert.ok(launchId, 'Packaged launch URL resource not found');
assert.equal(value(urlMeta, 'android:value'), '@' + launchId);
assert.match(resources, /https:\/\/cheffodoggo\.com\/\?distribution=google-play/);
console.log(JSON.stringify({ passed: true, package: 'com.cheffodoggo.app', versionCode: Number(expectedCode), requiredActivity: component, exported: false, compiledAabAndApkChecked: true }));
