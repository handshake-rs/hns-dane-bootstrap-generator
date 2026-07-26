#!/usr/bin/env bash
set -Eeuo pipefail

APPLIANCE_VERSION="${APPLIANCE_VERSION:-v0.2.1}"
APPLIANCE_REPO="${APPLIANCE_REPO:-handshake-rs/hns-dane-bootstrap-generator}"
INSTALL_LIB_DIR="${INSTALL_LIB_DIR:-/usr/local/lib/hns-dane-appliance}"

usage() {
  cat >&2 <<'EOF'
Usage: install.sh --hns-name DOMAIN --wallet-style STYLE --hsd-wallet-id ID --hsd-account-name NAME --enable-ipv6 yes|no
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPLIANCE_SRC_DIR="$SCRIPT_DIR"
TMP_DIR=""

if [[ ! -f "$APPLIANCE_SRC_DIR/lib/common.sh" ]]; then
  TMP_DIR="$(mktemp -d)"
  archive="$TMP_DIR/source.tar.gz"
  archive_url="${APPLIANCE_ARCHIVE_URL:-https://github.com/${APPLIANCE_REPO}/archive/refs/tags/${APPLIANCE_VERSION}.tar.gz}"
  curl -fsSL "$archive_url" -o "$archive"
  if [[ -n "${APPLIANCE_ARCHIVE_SHA256:-}" ]]; then
    echo "${APPLIANCE_ARCHIVE_SHA256}  ${archive}" | sha256sum -c -
  elif [[ "${APPLIANCE_ALLOW_UNVERIFIED_DEV:-0}" != "1" ]]; then
    echo "APPLIANCE_ARCHIVE_SHA256 is required unless APPLIANCE_ALLOW_UNVERIFIED_DEV=1." >&2
    exit 1
  fi
  tar -xzf "$archive" -C "$TMP_DIR"
  APPLIANCE_SRC_DIR="$(find "$TMP_DIR" -type d -path '*/appliance' | head -n 1)"
fi

# shellcheck source=lib/common.sh
source "$APPLIANCE_SRC_DIR/lib/common.sh"

hns_name=""
site_title="HNS DANE Appliance"
deployment_mode="single-node"
wallet_style="generic"
hsd_wallet_id="primary"
hsd_account_name="default"
enable_ipv6="no"
skip_packages=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --hns-name) hns_name="${2:-}"; shift 2 ;;
    --site-title) site_title="${2:-}"; shift 2 ;;
    --deployment-mode) deployment_mode="${2:-}"; shift 2 ;;
    --wallet-style) wallet_style="${2:-}"; shift 2 ;;
    --hsd-wallet-id) hsd_wallet_id="${2:-}"; shift 2 ;;
    --hsd-account-name) hsd_account_name="${2:-}"; shift 2 ;;
    --enable-ipv6) enable_ipv6="${2:-}"; shift 2 ;;
    --skip-package-install) skip_packages=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage; fail "Unknown install option: $1" ;;
  esac
done

[[ -n "$hns_name" ]] || fail "--hns-name is required."
require_root

if [[ -r /etc/os-release ]]; then
  # shellcheck source=/dev/null
  source /etc/os-release
  case "${ID:-}:${VERSION_ID:-}" in
    debian:12|debian:13|ubuntu:24.04) ;;
    *) fail "Unsupported OS for this appliance: ${PRETTY_NAME:-unknown}. Use Debian 13, Debian 12, or Ubuntu 24.04." ;;
  esac
else
  fail "Cannot detect OS. Debian 13, Debian 12, and Ubuntu 24.04 are supported."
fi

ensure_dir 0755 "$INSTALL_LIB_DIR"
tar -C "$APPLIANCE_SRC_DIR" -cf - . | tar -C "$INSTALL_LIB_DIR" -xf -
APPLIANCE_SRC_DIR="$INSTALL_LIB_DIR"
SCRIPT_DIR="$INSTALL_LIB_DIR/lib"

if [[ "$skip_packages" != "1" ]]; then
  "$SCRIPT_DIR/install-packages.sh"
fi

"$SCRIPT_DIR/generate-config.sh" \
  --hns-name "$hns_name" \
  --site-title "$site_title" \
  --deployment-mode "$deployment_mode" \
  --wallet-style "$wallet_style" \
  --hsd-wallet-id "$hsd_wallet_id" \
  --hsd-account-name "$hsd_account_name" \
  --enable-ipv6 "$enable_ipv6"
"$SCRIPT_DIR/harden-server.sh"
"$SCRIPT_DIR/configure-firewall.sh"
"$SCRIPT_DIR/generate-tlsa.sh"
"$SCRIPT_DIR/configure-knot.sh"
"$SCRIPT_DIR/configure-dnsdist.sh"
"$SCRIPT_DIR/generate-hns-resource.sh"
"$SCRIPT_DIR/render-wallet-instructions.sh"
"$SCRIPT_DIR/configure-nginx.sh"
"$SCRIPT_DIR/verify-local.sh" || true
"$SCRIPT_DIR/verify-hns.sh" || true
"$SCRIPT_DIR/generate-dashboard.sh"
"$SCRIPT_DIR/generate-backup.sh" >/dev/null || true
"$SCRIPT_DIR/generate-ssh-instructions.sh"

cat > /usr/local/bin/hns-dane <<EOF
#!/usr/bin/env bash
exec "$INSTALL_LIB_DIR/lib/hns-dane-cli.sh" "\$@"
EOF
chmod 0755 /usr/local/bin/hns-dane

install -m 0644 "$INSTALL_LIB_DIR/templates/systemd/hns-dane-verify.service" "$HNS_DANE_SYSTEMD_DIR/hns-dane-verify.service"
install -m 0644 "$INSTALL_LIB_DIR/templates/systemd/hns-dane-verify.timer" "$HNS_DANE_SYSTEMD_DIR/hns-dane-verify.timer"
safe_systemctl daemon-reload >/dev/null 2>&1 || true
safe_systemctl enable --now hns-dane-verify.timer >/dev/null 2>&1 || true

log "Dashboard: $(json_get '.dashboard.publicUrl')"
log "Wallet instructions: $(selected_wallet_path)"
log "SSH start-here file: $HNS_DANE_ROOT/README-FIRST.txt"

if [[ -n "$TMP_DIR" ]]; then
  rm -rf "$TMP_DIR"
fi
