#!/usr/bin/env bash

if [[ -z "${BASH_VERSION:-}" ]]; then
  echo "hns-dane-appliance requires bash" >&2
  exit 2
fi

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPLIANCE_SRC_DIR="${APPLIANCE_SRC_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"

if [[ -f "$APPLIANCE_SRC_DIR/VERSION" ]]; then
  HNS_DANE_VERSION="$(tr -d '[:space:]' < "$APPLIANCE_SRC_DIR/VERSION")"
else
  HNS_DANE_VERSION="${HNS_DANE_VERSION:-v0.2.2}"
fi

: "${HNS_DANE_ETC:=/etc/hns-dane-appliance}"
: "${HNS_DANE_STATE:=/var/lib/hns-dane-appliance}"
: "${HNS_DANE_LOG_DIR:=/var/log/hns-dane-appliance}"
: "${HNS_DANE_ROOT:=/root/hns-dane-appliance}"
: "${HNS_DANE_WEB:=/var/www/hns-dane}"
: "${HNS_DANE_CONFIG:=$HNS_DANE_ETC/config.json}"
: "${HNS_DANE_OUTPUT_DIR:=$HNS_DANE_ROOT/output}"
: "${HNS_DANE_BACKUP_DIR:=$HNS_DANE_ROOT/backups}"
: "${HNS_DANE_TLS_DIR:=$HNS_DANE_ETC/tls}"
: "${HNS_DANE_ZONE_DIR:=$HNS_DANE_STATE/zones}"
: "${HNS_DANE_FILES_DIR:=$HNS_DANE_WEB/files}"
: "${HNS_DANE_KNOT_CONF:=/etc/knot/knot.conf}"
: "${HNS_DANE_DNSDIST_CONF:=/etc/dnsdist/dnsdist.conf}"
: "${HNS_DANE_DNSDIST_LISTEN:=127.0.0.1:8053}"
: "${HNS_DANE_NGINX_AVAILABLE:=/etc/nginx/sites-available/hns-dane}"
: "${HNS_DANE_NGINX_ENABLED:=/etc/nginx/sites-enabled/hns-dane}"
: "${HNS_DANE_SYSTEMD_DIR:=/etc/systemd/system}"

log() {
  printf '[hns-dane] %s\n' "$*" >&2
}

fail() {
  printf '[hns-dane] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command is missing: $1"
}

require_root() {
  if [[ "${HNS_DANE_TEST:-0}" != "1" && "$(id -u)" != "0" ]]; then
    fail "Run this command as root."
  fi
}

utc_now() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

ensure_dir() {
  local mode="$1"
  local path="$2"
  install -d -m "$mode" "$path"
}

write_atomic() {
  local path="$1"
  local dir
  local tmp
  dir="$(dirname "$path")"
  ensure_dir 0755 "$dir"
  tmp="$(mktemp "$dir/.tmp.$(basename "$path").XXXXXX")"
  cat > "$tmp"
  mv "$tmp" "$path"
}

json_get() {
  local filter="$1"
  jq -r "$filter // empty" "$HNS_DANE_CONFIG"
}

json_set() {
  local tmp
  tmp="$(mktemp "$(dirname "$HNS_DANE_CONFIG")/.config.XXXXXX")"
  jq "$@" "$HNS_DANE_CONFIG" > "$tmp"
  chmod --reference="$HNS_DANE_CONFIG" "$tmp" 2>/dev/null || chmod 0600 "$tmp"
  mv "$tmp" "$HNS_DANE_CONFIG"
}

is_valid_ipv4() {
  [[ "$1" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || return 1
  local IFS=.
  local -a parts
  read -r -a parts <<< "$1"
  local part
  for part in "${parts[@]}"; do
    [[ "$part" =~ ^[0-9]+$ ]] || return 1
    [[ "$part" == "0" || ! "$part" =~ ^0[0-9]+$ ]] || return 1
    (( part >= 0 && part <= 255 )) || return 1
  done
}

is_valid_ipv6() {
  python3 - "$1" <<'PY'
import ipaddress
import sys
try:
    ipaddress.IPv6Address(sys.argv[1])
except Exception:
    raise SystemExit(1)
PY
}

config_required() {
  [[ -f "$HNS_DANE_CONFIG" ]] || fail "Missing config: $HNS_DANE_CONFIG. Run install.sh or generate-config.sh first."
}

selected_wallet_path() {
  local style
  style="$(json_get '.hns.walletStyle')"
  case "$style" in
    bob) printf '%s/wallet-bob.md\n' "$HNS_DANE_OUTPUT_DIR" ;;
    hsd-cli) printf '%s/wallet-hsd-cli.md\n' "$HNS_DANE_OUTPUT_DIR" ;;
    *) printf '%s/wallet-generic.md\n' "$HNS_DANE_OUTPUT_DIR" ;;
  esac
}

safe_systemctl() {
  if command -v systemctl >/dev/null 2>&1 && [[ "${HNS_DANE_TEST:-0}" != "1" ]]; then
    systemctl "$@" || return 1
  fi
}

copy_public_file() {
  local source="$1"
  local dest="$2"
  ensure_dir 0755 "$(dirname "$dest")"
  install -m 0644 "$source" "$dest"
}
