# Publish The Linode StackScript

The beginner UI becomes fully integrated only after a maintainer publishes a
release-pinned StackScript to Linode and configures the app with its new ID.
This is a maintainer release procedure, not something beginners should do.

## v0.2.2 artifact contract

The canonical appliance payload is the project-built GitHub Release asset:

```text
https://github.com/handshake-rs/hns-dane-bootstrap-generator/releases/download/v0.2.2/hns-dane-appliance-v0.2.2.tar.gz
```

It is a minimal archive containing `LICENSE`, appliance documentation, the
versioned installer and uninstaller, runtime libraries, and templates. It does
not contain the browser app, development tests, release tooling, or
StackScripts. GitHub's automatically generated tag source archives are not the
v0.2.2 appliance payload.

An appliance candidate consists of exactly three files:

```text
hns-dane-appliance-v0.2.2.tar.gz
SHA256SUMS
PROVENANCE.json
```

`PROVENANCE.json` deterministically records the version, artifact name, size,
SHA256, archive root, canonical repository, `refs/heads/main`, exact commit,
exact tree, commit time, and fixed source paths. This is source-binding
metadata, not a third-party signature or SLSA attestation.

No `v0.2.2` tag, GitHub Release, release asset, or replacement public
StackScript exists until a maintainer completes the authorized steps below.

## 1. Select an exact qualified main commit

Start from the exact clean commit on `main` that passed both routine CI and
CodeQL. Record the full commit and tree; never package an abbreviated SHA or an
uncommitted checkout.

```bash
git switch main
git status --short
expected_commit="$(git rev-parse HEAD)"
expected_tree="$(git show -s --format=%T "$expected_commit")"
printf 'commit=%s\ntree=%s\n' "$expected_commit" "$expected_tree"
gh run list --commit "$expected_commit"
```

The CI and CodeQL rows for that exact commit must be successful. A successful
run on an ancestor does not qualify a successor.

## 2. Build the credential-free candidate in GitHub Actions

Dispatch the manual workflow from that same `main` commit:

```bash
gh workflow run appliance-release-preflight.yml \
  --ref main \
  -f expected_commit="$expected_commit"
```

The workflow has only `contents: read`, persists no checkout credentials, does
not install npm dependencies, and cannot tag, release, publish, or deploy. It
refuses a fork, a ref other than canonical `main`, or a commit other than the
selected `main` tip; verifies version metadata and shell syntax; builds the
deterministic minimal archive twice; compares the bytes; validates the embedded
Git commit; renders a hash-pinned StackScript; and retains the three candidate
files for seven days.

Record the successful workflow run ID, then download its exact artifact:

```bash
run_id=<successful-preflight-run-id>
candidate_dir="$(mktemp -d)"
gh run download "$run_id" \
  --name "hns-dane-appliance-candidate-${expected_commit}" \
  --dir "$candidate_dir"
```

From the same exact clean source checkout, independently reproduce and inspect
the candidate:

```bash
scripts/verify-appliance-release.sh \
  --expected-commit "$expected_commit" \
  --candidate-dir "$candidate_dir"

jq -e --arg commit "$expected_commit" --arg tree "$expected_tree" \
  'select(.applianceVersion == "v0.2.2" and
          .source.ref == "refs/heads/main" and
          .source.commit == $commit and
          .source.tree == $tree)' \
  "$candidate_dir/PROVENANCE.json"
```

Keep the downloaded candidate unchanged. The tarball named in `SHA256SUMS` is
the exact file that must later become the GitHub Release asset.

## 3. Create the tag and GitHub Release only when authorized

Tagging and publishing are separate, externally visible maintainer actions.
After explicit release authorization, create an annotated tag that resolves to
the qualified commit, push that tag, and upload the already-verified candidate
bytes:

```bash
version="$(tr -d '[:space:]' < appliance/VERSION)"
test "$version" = "v0.2.2"
git tag -a "$version" "$expected_commit" -m "Release $version"
test "$(git rev-list -n 1 "$version")" = "$expected_commit"
git push origin "$version"

gh release create "$version" \
  "$candidate_dir/hns-dane-appliance-${version}.tar.gz" \
  "$candidate_dir/SHA256SUMS" \
  "$candidate_dir/PROVENANCE.json" \
  --verify-tag \
  --title "$version" \
  --notes "HNS DANE appliance $version"
```

Do not rebuild the tarball after approval and do not substitute the generated
`/archive/refs/tags/...` download. The tagged source and custom appliance asset
serve different purposes.

Read the public asset back before using it in a StackScript:

```bash
verify_dir="$(mktemp -d)"
gh release download "$version" \
  --pattern "hns-dane-appliance-${version}.tar.gz" \
  --pattern SHA256SUMS \
  --pattern PROVENANCE.json \
  --dir "$verify_dir"
(cd "$verify_dir" && sha256sum -c SHA256SUMS)
cmp "$candidate_dir/hns-dane-appliance-${version}.tar.gz" \
  "$verify_dir/hns-dane-appliance-${version}.tar.gz"
```

## 4. Publish and test a private Linode StackScript

Take the lowercase digest from the verified `SHA256SUMS` and render the
release-pinned source:

```bash
release_sha256="$(awk '{print $1}' "$verify_dir/SHA256SUMS")"
scripts/render-linode-stackscript.sh \
  --version "$version" \
  --sha256 "$release_sha256" \
  > /tmp/hns-dane-appliance-stackscript.sh
bash -n /tmp/hns-dane-appliance-stackscript.sh
```

Use a maintainer token with only the necessary StackScripts write permission.
Never put this token in the web UI, a StackScript UDF, a repo file, or
user-facing documentation. Publishing without `--public` creates a private
StackScript for deployment and readback testing:

```bash
export LINODE_API_TOKEN=...
scripts/publish-linode-stackscript.sh \
  --version "$version" \
  --sha256 "$release_sha256"
```

Only after the private revision installs the read-back GitHub asset and passes
the deployment checks should a maintainer deliberately publish a replacement
with `--public`. Linode treats public publication as irreversible. A
replacement receives a new API-assigned ID; do not assume it will reuse the
historical public ID.

### Cloud Manager form values

If publishing manually from `https://cloud.linode.com/stackscripts/create`, use:

```text
StackScript Label:
HNS DANE One-Name Server

Description:
One-click HNS DANE server for a single Handshake name. Installs Knot DNS authoritative DNSSEC, dnsdist authoritative DoH, TLSA, nginx dashboard, local verification, and copy-paste HNS resource commands. Never asks for wallet seeds, Linode API tokens, registrar credentials, or payment data.

Target Images:
Debian 13
Debian 12
Ubuntu 24.04 LTS

Revision Note:
v0.2.2
```

Paste `/tmp/hns-dane-appliance-stackscript.sh` into the `Script` field. Never
paste the committed template directly: its placeholder hash intentionally
fails closed. The generated fields ask for the Handshake domain, wallet
instruction format, hsd wallet ID, hsd account name, and IPv6 preference. The
normal hsd defaults are wallet ID `primary` and account name `default`; these
are non-secret routing hints used only to render local `hsw-rpc` instructions.

## 5. Configure the browser app after publication

The app intentionally keeps the prior public StackScript ID as its default
until the complete replacement release, private test, public publication, and
Linode readback have succeeded:

```text
2158182
```

Build a future app release with the verified replacement ID:

```bash
VITE_LINODE_STACKSCRIPT_ID=<replacement-stackscript-id> npm run build
```

The user still deploys inside their own Linode account, and Linode bills them
directly. The browser app must not ask for a Linode API token.

## Historical v0.2.1 deployment and migration

Preserve the existing public deployment as historical evidence:

- Public StackScript ID `2158182` is `HNS DANE One-Name Server`.
- Annotated tag `v0.2.1` resolves to commit
  `f8ad194609708ba0fdec1f5884ad6871557cdec2` and tree
  `c61e2cb21f275163d7f5ececf4010b50592684fa`.
- Its tagged StackScript template used the legacy GitHub-generated tag archive
  URL
  `https://github.com/denuoweb/hns-dane-bootstrap-generator/archive/refs/tags/${APPLIANCE_VERSION}.tar.gz`.

That historical generated source archive is not the canonical v0.2.2 appliance
asset, and its unknown published StackScript checksum must not be inferred from
a later download. Do not repoint or rewrite the already-public v0.2.1
StackScript. Publish v0.2.2 as a replacement with a new ID, validate it, then
move the app default in a later exact-source release.
