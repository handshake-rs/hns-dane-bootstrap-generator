#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"
# shellcheck source=normalize-name.sh
source "$SCRIPT_DIR/normalize-name.sh"
# shellcheck source=detect-ip.sh
source "$SCRIPT_DIR/detect-ip.sh"

usage() {
  cat >&2 <<'EOF'
Usage: generate-config.sh --hns-name DOMAIN --wallet-style STYLE --hsd-wallet-id ID --hsd-account-name NAME --enable-ipv6 yes|no
EOF
}

validate_hsd_selector() {
  local field="$1"
  local value="$2"
  [[ -z "$value" ]] && return 0
  [[ "$value" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || fail "$field may contain only letters, numbers, dot, underscore, and hyphen."
}

generate_config() {
  local hns_name=""
  local site_title="HNS DANE Appliance"
  local deployment_mode="single-node"
  local wallet_style="generic"
  local hsd_wallet_id="primary"
  local hsd_account_name="default"
  local enable_ipv6="no"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --hns-name) hns_name="${2:-}"; shift 2 ;;
      --site-title) site_title="${2:-}"; shift 2 ;;
      --deployment-mode) deployment_mode="${2:-}"; shift 2 ;;
      --wallet-style) wallet_style="${2:-}"; shift 2 ;;
      --hsd-wallet-id) hsd_wallet_id="${2:-}"; shift 2 ;;
      --hsd-account-name) hsd_account_name="${2:-}"; shift 2 ;;
      --enable-ipv6) enable_ipv6="${2:-}"; shift 2 ;;
      -h|--help) usage; return 0 ;;
      *) usage; fail "Unknown generate-config option: $1" ;;
    esac
  done

  local label zone public_ipv4 public_ipv6 created_at admin_token_file admin_token
  label="$(normalize_hns_name "$hns_name")"
  zone="${label}."

  case "$deployment_mode" in
    single-node) ;;
    primary-node|secondary-node)
      fail "Two-node mode is documented as a design target but is not implemented in v0.2.2. Use --deployment-mode single-node."
      ;;
    *) fail "Unsupported deployment mode: $deployment_mode" ;;
  esac
  case "$wallet_style" in
    generic|bob|hsd-cli) ;;
    *) fail "Unsupported wallet style: $wallet_style" ;;
  esac
  hsd_wallet_id="${hsd_wallet_id:-primary}"
  hsd_account_name="${hsd_account_name:-default}"
  validate_hsd_selector "--hsd-wallet-id" "$hsd_wallet_id"
  validate_hsd_selector "--hsd-account-name" "$hsd_account_name"
  case "$enable_ipv6" in
    yes|no) ;;
    *) fail "--enable-ipv6 must be yes or no" ;;
  esac

  ensure_dir 0700 "$HNS_DANE_ETC"
  ensure_dir 0700 "$HNS_DANE_TLS_DIR"
  ensure_dir 0755 "$HNS_DANE_STATE"
  ensure_dir 0755 "$HNS_DANE_ZONE_DIR"
  ensure_dir 0755 "$HNS_DANE_LOG_DIR"
  ensure_dir 0700 "$HNS_DANE_ROOT"
  ensure_dir 0700 "$HNS_DANE_OUTPUT_DIR"
  ensure_dir 0700 "$HNS_DANE_BACKUP_DIR"
  ensure_dir 0755 "$HNS_DANE_WEB"
  ensure_dir 0755 "$HNS_DANE_FILES_DIR"

  public_ipv4="$(detect_public_ipv4)"
  public_ipv6="null"
  if [[ "$enable_ipv6" == "yes" ]]; then
    local detected_ipv6
    detected_ipv6="$(detect_public_ipv6 || true)"
    if [[ -n "$detected_ipv6" ]]; then
      public_ipv6="$(jq -n --arg ip "$detected_ipv6" '$ip')"
    fi
  fi

  admin_token_file="$HNS_DANE_ROOT/admin-token.txt"
  if [[ ! -f "$admin_token_file" ]]; then
    admin_token="$(openssl rand -hex 24)"
    printf '%s\n' "$admin_token" > "$admin_token_file"
    chmod 0600 "$admin_token_file"
  fi

  if [[ -f "$HNS_DANE_CONFIG" ]]; then
    created_at="$(jq -r '.deployment.createdAt // empty' "$HNS_DANE_CONFIG")"
  fi
  created_at="${created_at:-$(utc_now)}"

  jq -n \
    --arg schemaVersion "1" \
    --arg applianceVersion "$HNS_DANE_VERSION" \
    --arg mode "$deployment_mode" \
    --arg provider "linode" \
    --arg createdAt "$created_at" \
    --arg input "$hns_name" \
    --arg label "$label" \
    --arg zone "$zone" \
    --arg walletStyle "$wallet_style" \
    --arg hsdWalletId "$hsd_wallet_id" \
    --arg hsdAccountName "$hsd_account_name" \
    --arg publicIPv4 "$public_ipv4" \
    --arg siteTitle "$site_title" \
    --arg adminTokenFile "$admin_token_file" \
    --arg publicUrl "https://${label}/" \
    --arg tlsKeyPath "$HNS_DANE_TLS_DIR/${label}.key" \
    --arg tlsCertPath "$HNS_DANE_TLS_DIR/${label}.crt" \
    --arg etcPath "$HNS_DANE_ETC" \
    --arg statePath "$HNS_DANE_STATE" \
    --arg webPath "$HNS_DANE_WEB" \
    --arg filesPath "$HNS_DANE_FILES_DIR" \
    --arg outputPath "$HNS_DANE_OUTPUT_DIR" \
    --arg backupsPath "$HNS_DANE_BACKUP_DIR" \
    --arg zoneDir "$HNS_DANE_ZONE_DIR" \
    --argjson publicIPv6 "$public_ipv6" \
    '{
      schemaVersion: ($schemaVersion | tonumber),
      applianceVersion: $applianceVersion,
      deployment: {
        mode: $mode,
        role: (if $mode == "single-node" then "single" elif $mode == "primary-node" then "primary" else "secondary" end),
        provider: $provider,
        createdAt: $createdAt
      },
      hns: {
        input: $input,
        label: $label,
        zone: $zone,
        resourceMode: "delegated-dns",
        walletStyle: $walletStyle,
        hsdWalletId: $hsdWalletId,
        hsdAccountName: $hsdAccountName
      },
      site: {
        title: $siteTitle
      },
      network: {
        publicIPv4: $publicIPv4,
        publicIPv6: $publicIPv6
      },
      nameservers: [
        {
          name: ("ns1." + $zone),
          ipv4: $publicIPv4,
          ipv6: $publicIPv6,
          role: "primary"
        }
      ],
      dnssec: {
        provider: "knot",
        algorithm: "ecdsap256sha256",
        keyManagement: "manual-parent-rollover",
        parentFacingRollover: "disabled",
        ds: null
      },
      tls: {
        mode: "self-signed-local",
        privateKeyPath: $tlsKeyPath,
        certificatePath: $tlsCertPath,
        keyRotation: "disabled-unless-staged-rollover",
        spkiSha256: null
      },
      tlsa: {
        owner: ("_443._tcp." + $zone),
        usage: 3,
        selector: 1,
        matchingType: 1,
        associationData: null
      },
      dashboard: {
        publicUrl: $publicUrl,
        adminTokenFile: $adminTokenFile
      },
      paths: {
        etc: $etcPath,
        state: $statePath,
        web: $webPath,
        files: $filesPath,
        output: $outputPath,
        backups: $backupsPath,
        zoneDir: $zoneDir
      }
    }' | write_atomic "$HNS_DANE_CONFIG"
  chmod 0600 "$HNS_DANE_CONFIG"
  log "Wrote canonical config to $HNS_DANE_CONFIG"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  generate_config "$@"
fi
