#!/bin/bash
# <UDF name="hns_name" label="Handshake domain" example="denuoweb or denuoweb/" />
# <UDF name="wallet_style" label="Wallet instruction format" oneOf="hsd-cli,generic,bob" default="hsd-cli" />
# <UDF name="hsd_wallet_id" label="hsd wallet ID" default="primary" example="primary" />
# <UDF name="hsd_account_name" label="hsd account name" default="default" example="default" />
# <UDF name="enable_ipv6" label="Enable IPv6" oneOf="no,yes" default="no" />

set -Eeuo pipefail

LOG_FILE="/root/hns-dane-bootstrap.log"
exec > >(tee -a "$LOG_FILE") 2>&1

export DEBIAN_FRONTEND=noninteractive

APPLIANCE_VERSION="v0.2.1"
APPLIANCE_ARCHIVE_URL="https://github.com/handshake-rs/hns-dane-bootstrap-generator/archive/refs/tags/${APPLIANCE_VERSION}.tar.gz"
APPLIANCE_ARCHIVE_SHA256="REPLACE_WITH_RELEASE_TARBALL_SHA256"

if [[ "${APPLIANCE_ARCHIVE_SHA256}" == "REPLACE_WITH_RELEASE_TARBALL_SHA256" ]]; then
  echo "This StackScript is pinned to ${APPLIANCE_VERSION}, but the release archive SHA256 has not been filled in yet." >&2
  echo "Build a release, compute the tarball hash with scripts/sha256-release.sh, then update this file." >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl tar

WORK_DIR="$(mktemp -d)"
ARCHIVE="${WORK_DIR}/hns-dane-appliance.tar.gz"
curl -fsSL "$APPLIANCE_ARCHIVE_URL" -o "$ARCHIVE"
echo "${APPLIANCE_ARCHIVE_SHA256}  ${ARCHIVE}" | sha256sum -c -

tar -xzf "$ARCHIVE" -C "$WORK_DIR"
INSTALLER="$(find "$WORK_DIR" -type f -path '*/appliance/install.sh' | head -n 1)"
if [[ -z "$INSTALLER" ]]; then
  echo "Could not find appliance/install.sh in release archive." >&2
  exit 1
fi

bash "$INSTALLER" \
  --hns-name "${HNS_NAME}" \
  --wallet-style "${WALLET_STYLE}" \
  --hsd-wallet-id "${HSD_WALLET_ID:-primary}" \
  --hsd-account-name "${HSD_ACCOUNT_NAME:-default}" \
  --enable-ipv6 "${ENABLE_IPV6}"
