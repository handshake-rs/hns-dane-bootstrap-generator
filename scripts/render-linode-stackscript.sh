#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: render-linode-stackscript.sh --sha256 SHA256 [--version v0.2.2]

Writes the release-pinned StackScript to stdout.
EOF
}

version="$(tr -d '[:space:]' < appliance/VERSION)"
sha256=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sha256) sha256="${2:-}"; shift 2 ;;
    --version) version="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

[[ "$sha256" =~ ^[A-Fa-f0-9]{64}$ ]] || {
  echo "--sha256 must be a 64-character SHA256 digest." >&2
  exit 2
}
[[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  echo "--version must be a stable v-prefixed semantic version." >&2
  exit 2
}

sha256="${sha256,,}"

sed \
  -e "s/APPLIANCE_VERSION=\"[^\"]*\"/APPLIANCE_VERSION=\"${version}\"/" \
  -e "s/APPLIANCE_ARCHIVE_SHA256=\"REPLACE_WITH_RELEASE_TARBALL_SHA256\"/APPLIANCE_ARCHIVE_SHA256=\"${sha256}\"/" \
  stackscripts/linode/hns-dane-appliance-bootstrap.sh
