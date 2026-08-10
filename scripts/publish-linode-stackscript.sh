#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: publish-linode-stackscript.sh --sha256 SHA256 [--public] [--version v0.2.2]

Maintainer-only helper. Requires LINODE_API_TOKEN with stackscripts:read_write.
It publishes the thin, release-hash-pinned StackScript to the maintainer's Linode account.
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 2
  }
}

version="$(tr -d '[:space:]' < appliance/VERSION)"
sha256=""
make_public="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sha256) sha256="${2:-}"; shift 2 ;;
    --version) version="${2:-}"; shift 2 ;;
    --public) make_public="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage; echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

[[ -n "${LINODE_API_TOKEN:-}" ]] || {
  echo "Set LINODE_API_TOKEN in your shell. Do not put it in StackScript UDFs, repo files, or the web UI." >&2
  exit 2
}
[[ "$sha256" =~ ^[A-Fa-f0-9]{64}$ ]] || {
  echo "--sha256 must be a 64-character SHA256 digest." >&2
  exit 2
}

require_cmd curl
require_cmd jq

script_body="$(scripts/render-linode-stackscript.sh --version "$version" --sha256 "$sha256")"

payload="$(jq -n \
  --slurpfile manifest stackscripts/linode/stackscript.manifest.json \
  --arg script "$script_body" \
  --arg version "$version" \
  --argjson isPublic "$make_public" \
  '($manifest[0]) + {
    script: $script,
    is_public: $isPublic,
    rev_note: $version
  }')"

response="$(curl -fsS \
  -H "Authorization: Bearer ${LINODE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -X POST \
  --data "$payload" \
  https://api.linode.com/v4/linode/stackscripts)"

id="$(jq -r '.id' <<< "$response")"
label="$(jq -r '.label' <<< "$response")"

jq -n \
  --arg id "$id" \
  --arg label "$label" \
  --arg cloudUrl "https://cloud.linode.com/stackscripts/${id}" \
  --arg envLine "VITE_LINODE_STACKSCRIPT_ID=${id}" \
  '{
    id: ($id | tonumber),
    label: $label,
    cloudUrl: $cloudUrl,
    appEnv: $envLine
  }'
