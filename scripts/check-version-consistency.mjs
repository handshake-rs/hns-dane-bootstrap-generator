import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

const failures = [];

function expectEqual(label, actual, expected) {
  if (actual !== expected) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function capture(label, contents, pattern) {
  const match = contents.match(pattern);
  if (!match) {
    failures.push(`${label}: version declaration was not found`);
    return undefined;
  }
  return match[1];
}

const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const version = packageJson.version;

if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
  failures.push(`package.json version: expected a stable semver, got ${JSON.stringify(version)}`);
}

const taggedVersion = `v${version}`;
expectEqual('package-lock.json version', packageLock.version, version);
expectEqual('package-lock.json root package version', packageLock.packages?.['']?.version, version);
expectEqual('appliance/VERSION', read('appliance/VERSION').trim(), taggedVersion);

const installScript = read('appliance/install.sh');
expectEqual(
  'appliance/install.sh default',
  capture('appliance/install.sh default', installScript, /^APPLIANCE_VERSION="\$\{APPLIANCE_VERSION:-([^}]+)\}"$/m),
  taggedVersion
);

const commonScript = read('appliance/lib/common.sh');
expectEqual(
  'appliance/lib/common.sh fallback',
  capture('appliance/lib/common.sh fallback', commonScript, /HNS_DANE_VERSION="\$\{HNS_DANE_VERSION:-([^}]+)\}"/),
  taggedVersion
);

const stackscript = read('stackscripts/linode/hns-dane-appliance-bootstrap.sh');
expectEqual(
  'StackScript appliance pin',
  capture('StackScript appliance pin', stackscript, /^APPLIANCE_VERSION="([^"]+)"$/m),
  taggedVersion
);

const stackscriptManifest = readJson('stackscripts/linode/stackscript.manifest.json');
expectEqual('StackScript manifest revision', stackscriptManifest.rev_note, taggedVersion);

for (const scriptPath of ['scripts/render-linode-stackscript.sh', 'scripts/publish-linode-stackscript.sh']) {
  expectEqual(
    `${scriptPath} usage version`,
    capture(`${scriptPath} usage version`, read(scriptPath), /--version (v\d+\.\d+\.\d+)\]/),
    taggedVersion
  );
}

const changelog = read('docs/CHANGELOG.md');
expectEqual(
  'docs/CHANGELOG.md candidate heading',
  capture('docs/CHANGELOG.md candidate heading', changelog, /^## (\d+\.\d+\.\d+) \(release candidate\)$/m),
  version
);

const readme = read('README.md');
expectEqual(
  'README.md current source version',
  capture('README.md current source version', readme, /Current source is the private-package `([^`]+)` application\/appliance release\s+candidate\./),
  version
);

const publishDocs = read('docs/linode-stackscript-publish.md');
expectEqual(
  'StackScript publish tag command',
  capture('StackScript publish tag command', publishDocs, /git tag (v\d+\.\d+\.\d+)/),
  taggedVersion
);
expectEqual(
  'StackScript release archive URL',
  capture('StackScript release archive URL', publishDocs, /\/refs\/tags\/(v\d+\.\d+\.\d+)\.tar\.gz/),
  taggedVersion
);
expectEqual(
  'StackScript revision note',
  capture('StackScript revision note', publishDocs, /Revision Note:\s*\n(v\d+\.\d+\.\d+)/),
  taggedVersion
);

if (failures.length > 0) {
  console.error('Version consistency check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Version metadata is consistent for ${version}.`);
}
