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

function expectIncludes(label, contents, expected) {
  if (!contents.includes(expected)) {
    failures.push(`${label}: expected to find ${JSON.stringify(expected)}`);
  }
}

function expectExcludes(label, contents, forbidden) {
  if (contents.includes(forbidden)) {
    failures.push(`${label}: must not contain ${JSON.stringify(forbidden)}`);
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
const releaseAssetName = `hns-dane-appliance-${taggedVersion}.tar.gz`;
const releaseAssetUrl = `https://github.com/handshake-rs/hns-dane-bootstrap-generator/releases/download/${taggedVersion}/${releaseAssetName}`;
const releaseAssetUrlTemplate = 'https://github.com/handshake-rs/hns-dane-bootstrap-generator/releases/download/${APPLIANCE_VERSION}/hns-dane-appliance-${APPLIANCE_VERSION}.tar.gz';
const installReleaseAssetUrlTemplate = 'https://github.com/${APPLIANCE_REPO}/releases/download/${APPLIANCE_VERSION}/hns-dane-appliance-${APPLIANCE_VERSION}.tar.gz';
expectEqual('package-lock.json version', packageLock.version, version);
expectEqual('package-lock.json root package version', packageLock.packages?.['']?.version, version);
expectEqual('package.json private publication guard', packageJson.private, true);
expectEqual('appliance/VERSION', read('appliance/VERSION').trim(), taggedVersion);

const installScript = read('appliance/install.sh');
expectEqual(
  'appliance/install.sh default',
  capture('appliance/install.sh default', installScript, /^APPLIANCE_VERSION="\$\{APPLIANCE_VERSION:-([^}]+)\}"$/m),
  taggedVersion
);
expectIncludes('appliance/install.sh Release asset fallback', installScript, installReleaseAssetUrlTemplate);
expectExcludes('appliance/install.sh generated tag archive fallback', installScript, '/archive/refs/tags/');

const commonScript = read('appliance/lib/common.sh');
expectEqual(
  'appliance/lib/common.sh fallback',
  capture('appliance/lib/common.sh fallback', commonScript, /HNS_DANE_VERSION="\$\{HNS_DANE_VERSION:-([^}]+)\}"/),
  taggedVersion
);

const applianceReadme = read('appliance/README.md');
expectEqual(
  'appliance/README.md supported version',
  capture('appliance/README.md supported version', applianceReadme, /^## Supported v(\d+\.\d+\.\d+) source path$/m),
  version
);
expectIncludes('appliance/README.md release asset', applianceReadme, releaseAssetName);
expectIncludes('appliance/README.md version-pinned documentation', applianceReadme, `/blob/${taggedVersion}/docs/`);

const stackscript = read('stackscripts/linode/hns-dane-appliance-bootstrap.sh');
expectEqual(
  'StackScript appliance pin',
  capture('StackScript appliance pin', stackscript, /^APPLIANCE_VERSION="([^"]+)"$/m),
  taggedVersion
);
expectEqual(
  'StackScript Release asset URL',
  capture('StackScript Release asset URL', stackscript, /^APPLIANCE_ARCHIVE_URL="([^"]+)"$/m),
  releaseAssetUrlTemplate
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
  'StackScript publish release version guard',
  capture('StackScript publish release version guard', publishDocs, /test "\$version" = "(v\d+\.\d+\.\d+)"/),
  taggedVersion
);
expectEqual(
  'StackScript Release asset URL version',
  capture('StackScript Release asset URL version', publishDocs, /\/releases\/download\/(v\d+\.\d+\.\d+)\/hns-dane-appliance-v\d+\.\d+\.\d+\.tar\.gz/),
  taggedVersion
);
expectIncludes('StackScript Release asset URL', publishDocs, releaseAssetUrl);
expectIncludes('StackScript candidate artifact name', publishDocs, releaseAssetName);
expectEqual(
  'StackScript revision note',
  capture('StackScript revision note', publishDocs, /Revision Note:\s*\n(v\d+\.\d+\.\d+)/),
  taggedVersion
);

const releaseScript = read('scripts/release-appliance.sh');
for (const releaseContract of [
  '--expected-commit',
  'git -c tar.umask=0022 archive',
  'gzip -n -9',
  'SHA256SUMS',
  'PROVENANCE.json',
  'git get-tar-commit-id < "$archive_tar"',
  'git remote get-url origin',
  'refs/remotes/origin/main',
  'git merge-base --is-ancestor',
  'https://github.com/handshake-rs/hns-dane-bootstrap-generator',
  'refs/heads/main',
  'appliance/install.sh',
  'appliance/lib',
  'appliance/templates',
]) {
  expectIncludes(`release appliance contract (${releaseContract})`, releaseScript, releaseContract);
}

const verifyReleaseScript = read('scripts/verify-appliance-release.sh');
for (const verificationContract of [
  '--expected-commit',
  '--candidate-dir',
  'sha256sum -c SHA256SUMS',
  'git get-tar-commit-id < "$candidate_tar"',
  'cmp --silent',
  'scripts/release-appliance.sh',
]) {
  expectIncludes(`verify appliance contract (${verificationContract})`, verifyReleaseScript, verificationContract);
}
expectExcludes('release appliance pipefail-prone commit reader', releaseScript, '| git get-tar-commit-id');
expectExcludes('verify appliance pipefail-prone commit reader', verifyReleaseScript, '| git get-tar-commit-id');

const releaseWorkflow = read('.github/workflows/appliance-release-preflight.yml');
expectIncludes('release workflow manual dispatch', releaseWorkflow, '  workflow_dispatch:');
expectIncludes('release workflow read-only permission', releaseWorkflow, '  contents: read');
expectIncludes('release workflow exact commit input', releaseWorkflow, 'expected_commit:');
expectIncludes('release workflow canonical repository', releaseWorkflow, 'test "$GITHUB_REPOSITORY" = "handshake-rs/hns-dane-bootstrap-generator"');
expectIncludes('release workflow credential-free checkout', releaseWorkflow, 'persist-credentials: false');
expectIncludes('release workflow complete main history', releaseWorkflow, 'fetch-depth: 0');
expectIncludes('release workflow candidate builder', releaseWorkflow, 'scripts/release-appliance.sh');
expectIncludes('release workflow reproducibility verifier', releaseWorkflow, 'scripts/verify-appliance-release.sh');
expectIncludes('release workflow short retention', releaseWorkflow, 'retention-days: 7');
expectExcludes('release workflow push trigger', releaseWorkflow, '\n  push:');
expectExcludes('release workflow pull-request trigger', releaseWorkflow, '\n  pull_request:');
expectExcludes('release workflow npm install', releaseWorkflow, 'npm ci');
expectExcludes('release workflow tag creation', releaseWorkflow, 'git tag');
expectExcludes('release workflow GitHub Release mutation', releaseWorkflow, 'gh release');
expectExcludes('release workflow Linode publication', releaseWorkflow, 'publish-linode-stackscript.sh');

expectIncludes('public release readback verifier', publishDocs, '--candidate-dir "$verify_dir"');
expectIncludes(
  'public release readback all candidate files',
  publishDocs,
  'for candidate_name in "hns-dane-appliance-${version}.tar.gz" SHA256SUMS PROVENANCE.json; do'
);
expectExcludes('README transient retained-candidate status', readme, 'built as a retained appliance candidate');

expectIncludes(
  'historical v0.2.1 tag commit',
  publishDocs,
  'f8ad194609708ba0fdec1f5884ad6871557cdec2'
);
expectIncludes(
  'historical v0.2.1 tree',
  publishDocs,
  'c61e2cb21f275163d7f5ececf4010b50592684fa'
);
expectIncludes('historical public StackScript ID', publishDocs, '2158182');
expectIncludes(
  'historical v0.2.1 generated archive URL',
  publishDocs,
  'https://github.com/denuoweb/hns-dane-bootstrap-generator/archive/refs/tags/${APPLIANCE_VERSION}.tar.gz'
);

if (failures.length > 0) {
  console.error('Version consistency check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Version metadata is consistent for ${version}.`);
}
