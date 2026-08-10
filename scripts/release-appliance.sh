#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: release-appliance.sh --expected-commit SHA [--output-dir DIR]

Builds the deterministic, minimal appliance candidate for one exact clean
commit. It does not create a tag, GitHub Release, or Linode StackScript.
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 2
  }
}

expected_commit=""
out_dir="dist-release"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expected-commit) expected_commit="${2:-}"; shift 2 ;;
    --output-dir) out_dir="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

[[ "$expected_commit" =~ ^[0-9a-f]{40}$ ]] || {
  echo "--expected-commit must be one lowercase 40-character Git commit." >&2
  exit 2
}
[[ -n "$out_dir" ]] || {
  echo "--output-dir must not be empty." >&2
  exit 2
}

for command_name in git gzip sha256sum stat mktemp mv; do
  require_cmd "$command_name"
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$repo_root"

canonical_repository="https://github.com/handshake-rs/hns-dane-bootstrap-generator"
origin_url="$(git remote get-url origin 2>/dev/null)" || {
  echo "The release source must have a canonical origin remote." >&2
  exit 1
}
normalized_origin_url="${origin_url%/}"
normalized_origin_url="${normalized_origin_url%.git}"
case "$normalized_origin_url" in
  "${canonical_repository}"|git@github.com:handshake-rs/hns-dane-bootstrap-generator|ssh://git@github.com/handshake-rs/hns-dane-bootstrap-generator) ;;
  *)
    echo "origin does not identify the canonical handshake-rs/hns-dane-bootstrap-generator repository: ${origin_url}" >&2
    exit 1
    ;;
esac

resolved_commit="$(git rev-parse --verify "${expected_commit}^{commit}")"
[[ "$resolved_commit" == "$expected_commit" ]] || {
  echo "--expected-commit must name a commit directly, not a tag or another object." >&2
  exit 1
}
[[ "$(git rev-parse HEAD)" == "$expected_commit" ]] || {
  echo "HEAD does not match --expected-commit." >&2
  exit 1
}
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || {
  echo "The release source checkout must be clean, including untracked files." >&2
  exit 1
}

origin_main_ref="refs/remotes/origin/main"
git rev-parse --verify "${origin_main_ref}^{commit}" >/dev/null 2>&1 || {
  echo "Missing fetched origin/main history. Fetch the canonical main branch before building." >&2
  exit 1
}
git merge-base --is-ancestor "$expected_commit" "$origin_main_ref" || {
  echo "--expected-commit is not contained in the fetched canonical origin/main history." >&2
  exit 1
}

version="$(git show "${expected_commit}:appliance/VERSION" | tr -d '[:space:]')"
[[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  echo "appliance/VERSION at the requested commit is not a stable v-prefixed semantic version." >&2
  exit 1
}

archive_name="hns-dane-appliance-${version}.tar.gz"
archive_root="hns-dane-appliance-${version}/"
checksum_name="SHA256SUMS"
provenance_name="PROVENANCE.json"
tree="$(git show -s --format=%T "$expected_commit")"
commit_time="$(git show -s --format=%cI "$expected_commit")"

mkdir -p "$out_dir"
out_dir="$(cd "$out_dir" && pwd -P)"
for output_name in "$archive_name" "$checksum_name" "$provenance_name"; do
  [[ ! -e "${out_dir}/${output_name}" ]] || {
    echo "Refusing to overwrite existing candidate file: ${out_dir}/${output_name}" >&2
    exit 1
  }
done

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/hns-dane-appliance-release.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT
archive="${tmp_dir}/${archive_name}"
archive_tar="${tmp_dir}/hns-dane-appliance-${version}.tar"

git -c tar.umask=0022 archive \
  --format=tar \
  --prefix="$archive_root" \
  "$expected_commit" \
  -- \
  LICENSE \
  appliance/README.md \
  appliance/VERSION \
  appliance/install.sh \
  appliance/uninstall.sh \
  appliance/lib \
  appliance/templates \
  > "$archive_tar"

embedded_commit="$(git get-tar-commit-id < "$archive_tar")"
[[ "$embedded_commit" == "$expected_commit" ]] || {
  echo "Generated archive does not carry the expected Git commit." >&2
  exit 1
}
gzip -n -9 < "$archive_tar" > "$archive"

archive_sha256="$(sha256sum "$archive" | awk '{print $1}')"
archive_size="$(stat -c '%s' "$archive")"
printf '%s  %s\n' "$archive_sha256" "$archive_name" > "${tmp_dir}/${checksum_name}"

cat > "${tmp_dir}/${provenance_name}" <<EOF
{
  "schemaVersion": 1,
  "artifact": {
    "filename": "${archive_name}",
    "sha256": "${archive_sha256}",
    "size": ${archive_size}
  },
  "applianceVersion": "${version}",
  "archiveRoot": "${archive_root}",
  "source": {
    "repository": "${canonical_repository}",
    "ref": "refs/heads/main",
    "commit": "${expected_commit}",
    "tree": "${tree}",
    "commitTime": "${commit_time}"
  },
  "sourcePaths": [
    "LICENSE",
    "appliance/README.md",
    "appliance/VERSION",
    "appliance/install.sh",
    "appliance/uninstall.sh",
    "appliance/lib",
    "appliance/templates"
  ]
}
EOF

mv "$archive" "${out_dir}/${archive_name}"
mv "${tmp_dir}/${checksum_name}" "${out_dir}/${checksum_name}"
mv "${tmp_dir}/${provenance_name}" "${out_dir}/${provenance_name}"

printf '%s\n' "${out_dir}/${archive_name}"
printf '%s\n' "${out_dir}/${checksum_name}"
printf '%s\n' "${out_dir}/${provenance_name}"
