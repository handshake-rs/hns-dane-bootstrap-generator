# HNS DANE Appliance

This directory contains the server-side appliance for a beginner HNS DANE deployment path.

The appliance turns one Debian 13 or Debian 12 Linode into:

- an authoritative Knot DNS server for one Handshake label
- a DNSSEC-signed zone with parent-facing DS export
- a dnsdist RFC 8484 DoH frontend for the authoritative zone behind nginx `/dns-query`
- an RFC 9461 `_dns.ns1` SVCB record advertising that DoH path from the signed authoritative zone
- a local HTTPS endpoint with TLSA `3 1 1`
- a static dashboard with exact HNS wallet records
- public exports for NS, GLUE, DS, authoritative DNS SVCB, TLSA, and status
- root-only backups for generated private key material

The installer does not ask for wallet seeds, wallet private keys, Linode API tokens, registrar credentials, user-supplied TLS private keys, user-supplied DNSSEC private keys, payment data, or credit card data.

## Supported v0.2.2 source path

Debian 13 is the primary Linode target. Debian 12 and Ubuntu 24.04 are accepted if the same packages and service names are available.

Beginner mode is single-node:

```bash
sudo appliance/install.sh \
  --hns-name denuoweb/ \
  --wallet-style hsd-cli \
  --hsd-wallet-id primary \
  --hsd-account-name default \
  --enable-ipv6 no
```

`--hsd-wallet-id` and `--hsd-account-name` are non-secret hints used only when rendering local hsd wallet commands. The normal hsd defaults are wallet id `primary` and account name `default`.

The generated canonical config is:

```text
/etc/hns-dane-appliance/config.json
```

All renderers use that config as their source of truth.

## Important paths

```text
/etc/hns-dane-appliance/config.json
/etc/hns-dane-appliance/tls/
/var/lib/hns-dane-appliance/
/var/log/hns-dane-appliance/
/root/hns-dane-appliance/output/
/root/hns-dane-appliance/backups/
/var/www/hns-dane/
/var/www/hns-dane/files/
```

Private backups stay under `/root/hns-dane-appliance/backups/` and are not published by nginx.

## Local CLI

The installer creates:

```text
/usr/local/bin/hns-dane
```

Supported commands:

```bash
hns-dane status
hns-dane verify
hns-dane print-hns-resource
hns-dane print-wallet-instructions
hns-dane backup
hns-dane regenerate-dashboard
hns-dane show-config
```

## Rollover defaults

DNSSEC parent-facing rollover is frozen by default. TLS private-key rotation is also frozen by default. Both are deliberate: the HNS parent resource is manually updated by the user, so changing the DNSSEC key or HTTPS key without a staged update can break validation.

Two-node reliable mode is documented as a design target in [Two-Node Reliable Mode](https://github.com/handshake-rs/hns-dane-bootstrap-generator/blob/v0.2.2/docs/two-node-mode.md). v0.2.2 fails clearly if `primary-node` or `secondary-node` is selected because redundancy is not complete yet.

## Release artifact

The v0.2.2 appliance is distributed as the project-built minimal GitHub Release
asset `hns-dane-appliance-v0.2.2.tar.gz`, not GitHub's generated tag source
archive. Its `SHA256SUMS` and deterministic `PROVENANCE.json` bind the exact
artifact to a clean `main` commit, tree, version, size, archive root, and fixed
runtime source paths. `scripts/release-appliance.sh` builds it, and the
credential-free manual preflight rebuilds it before retaining a seven-day
candidate. See [Publish The Linode StackScript](https://github.com/handshake-rs/hns-dane-bootstrap-generator/blob/v0.2.2/docs/linode-stackscript-publish.md).
