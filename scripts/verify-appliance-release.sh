#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: verify-appliance-release.sh --expected-commit SHA --candidate-dir DIR

Rebuilds an appliance candidate from the exact clean commit and proves that its
archive, checksum list, and provenance file are byte-for-byte reproducible.
EOF
}

expected_commit=""
candidate_dir=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expected-commit) expected_commit="${2:-}"; shift 2 ;;
    --candidate-dir) candidate_dir="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

[[ "$expected_commit" =~ ^[0-9a-f]{40}$ ]] || {
  echo "--expected-commit must be one lowercase 40-character Git commit." >&2
  exit 2
}
[[ -d "$candidate_dir" ]] || {
  echo "--candidate-dir must name an existing directory." >&2
  exit 2
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
candidate_dir="$(cd "$candidate_dir" && pwd -P)"
cd "$repo_root"

version="$(git show "${expected_commit}:appliance/VERSION" | tr -d '[:space:]')"
archive_name="hns-dane-appliance-${version}.tar.gz"
expected_files="$(printf '%s\n' "$archive_name" PROVENANCE.json SHA256SUMS | LC_ALL=C sort)"
actual_files="$(find "$candidate_dir" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)"
[[ "$actual_files" == "$expected_files" ]] || {
  echo "Candidate directory must contain exactly the archive, PROVENANCE.json, and SHA256SUMS." >&2
  diff -u <(printf '%s\n' "$expected_files") <(printf '%s\n' "$actual_files") || true
  exit 1
}

(
  cd "$candidate_dir"
  sha256sum -c SHA256SUMS
)

embedded_commit="$(gzip -cd "${candidate_dir}/${archive_name}" | git get-tar-commit-id)"
[[ "$embedded_commit" == "$expected_commit" ]] || {
  echo "Candidate archive carries ${embedded_commit:-no commit}, expected ${expected_commit}." >&2
  exit 1
}

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/hns-dane-appliance-verify.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT
scripts/release-appliance.sh \
  --expected-commit "$expected_commit" \
  --output-dir "$tmp_dir" \
  >/dev/null

for candidate_name in "$archive_name" SHA256SUMS PROVENANCE.json; do
  cmp --silent "${candidate_dir}/${candidate_name}" "${tmp_dir}/${candidate_name}" || {
    echo "Candidate is not reproducible: ${candidate_name} differs from the exact-source rebuild." >&2
    exit 1
  }
done

printf 'Verified deterministic appliance candidate %s from commit %s.\n' "$version" "$expected_commit"
