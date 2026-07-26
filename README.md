# HNS DANE Bootstrap Generator

A focused web app for producing the few records a domain owner needs to connect an HNS or ICANN domain to authoritative DNS, DNSSEC, and DANE/TLSA.

Canonical source: [`handshake-rs/hns-dane-bootstrap-generator`](https://github.com/handshake-rs/hns-dane-bootstrap-generator).

Within the Handshake Rust ecosystem, this is an operator-facing control-plane
tool. It generates deployment inputs and verification commands; it does not
resolve browser requests, classify HNS versus ICANN, crawl the public
namespace, or act as consensus authority. Browser enforcement belongs to
`hns-dane-engine` and its browser consumers, while observational discovery
belongs to `hns-dane-crawler`.

Canonical source governance does not require the service or appliance
publisher to change. Denuo Web LLC may continue to operate, publish, or sign
artifacts from this repository, provided each release identifies its exact
canonical `handshake-rs` source commit or tag.

The app keeps the workflow simple:

1. Enter domain, nameserver, server IP, and certificate/public key.
2. Send generated records to the HNS wallet or ICANN registrar.
3. Copy zone records onto the authoritative DNS server.
4. Enable DNSSEC on the zone and publish the DS at the parent.
5. Verify with the generated `dig`/`delv` commands.

## Main outputs

- **HNS wallet / registrar**: NS, GLUE, DS, and SYNTH records as appropriate.
- **Authoritative DoH discovery**: RFC 9461 DNS-server SVCB records such as `_dns.ns1 IN SVCB 1 ns1 alpn=h2 dohpath=/dns-query{?dns}` for nameservers that also serve RFC 8484 DoH.
- **Authoritative DNS server**: tabbed starter config for hosted DNS panels, Generic zone file, BIND, Windows Server DNS, PowerDNS, Knot, or NSD, including NS, A, AAAA, SVCB, and TLSA records.
- **Verify commands**: `dig`/`delv` checks.
- **Integrator JSON**: optional machine-readable output for wallets and future APIs.

## Linode/Akamai appliance path

This repo now includes an early production-MVP appliance path for beginners who want a self-hosted authoritative DNSSEC + DANE server on a Linode they own:

- `stackscripts/linode/hns-dane-appliance-bootstrap.sh` is a thin, hash-verified StackScript bootstrapper.
- `appliance/install.sh` is the real versioned installer.
- `/etc/hns-dane-appliance/config.json` is the server source of truth.
- Knot DNS signs the authoritative zone with manual parent-facing rollover.
- dnsdist exposes the Knot authoritative service as RFC 8484 DoH behind nginx `/dns-query`.
- nginx serves a static dashboard with public GLUE, DS, TLSA, wallet instructions, and verification status.
- private TLS/DNSSEC material and backups stay on the VPS, outside `/var/www`.
- two-node reliable mode is documented as a future assisted flow and intentionally not claimed complete.

Start with [Linode Beginner Deploy](docs/linode-beginner-deploy.md), [Publish The Linode StackScript](docs/linode-stackscript-publish.md), and [Appliance README](appliance/README.md). The appliance does not take payment, touch ICANN registrars, request wallet seeds, submit HNS transactions, or require Terraform/OpenTofu for the beginner path.

## Supported modes

### HNS delegated DNS mode

Full DNSSEC + DANE path for a Handshake domain:

```zone
# HNS wallet / name resource
NS ns1.dane.
GLUE4 ns1.dane. 203.0.113.10
DS 12345 13 2 7A1B...F09C

# Authoritative DNS server
dane. 3600 IN NS ns1.dane.
_dns.ns1.dane. 3600 IN SVCB 1 ns1.dane. alpn=h2 dohpath=/dns-query{?dns}
dane. 3600 IN A 203.0.113.20
_443._tcp.dane. 3600 IN TLSA 3 1 1 9B2C...A811
```

### HNS SYNTH nameserver mode

Compact HNS referral to an authoritative nameserver IP. The website address and TLSA record still live on the authoritative DNS server:

```zone
# HNS wallet / name resource
SYNTH4 203.0.113.10
DS 12345 13 2 7A1B...F09C

# Authoritative DNS server
dane. 3600 IN NS _pc0722g._synth.
dane. 3600 IN A 203.0.113.20
_443._tcp.dane. 3600 IN TLSA 3 1 1 9B2C...A811
```

### Authoritative DoH discovery

For delegated HNS nameserver setups, the generator emits RFC 9461 DNS-server SVCB records in the authoritative DNS zone when the delegated nameserver host is in-zone:

```zone
_dns.ns1.dane. 3600 IN SVCB 1 ns1.dane. alpn=h2 dohpath=/dns-query{?dns}
```

This is still delegated DNS. The HNS parent resource proves the `NS`, `GLUE4`/`GLUE6`, and `DS` delegation; the signed authoritative zone advertises the nameserver's RFC 8484 DoH path. Website `A`/`AAAA`, HTTPS/SVCB, and TLSA records still live in the signed authoritative DNS zone and still validate against the HNS DS chain. RFC 9539 is a separate experimental specification for opportunistic recursive-to-authoritative DoT/DoQ on port 853, not an HNS TXT convention for DoH.

### ICANN delegated DNSSEC mode

Registrar + DNSSEC setup:

```text
# Registrar / parent-zone panel
Nameserver: ns1.example.com.
Glue IPv4: 203.0.113.10
DS: 12345 13 2 7A1B...F09C

# Authoritative DNS server
example.com. 3600 IN NS ns1.example.com.
example.com. 3600 IN A 203.0.113.20
_443._tcp.example.com. 3600 IN TLSA 3 1 1 9B2C...A811
```

## TLSA behavior

Default TLSA output:

```zone
TLSA 3 1 1 <sha256-of-spki>
```

Input accepted:

- PEM `PUBLIC KEY`
- PEM `CERTIFICATE`

Private keys are not needed. The app extracts or accepts SubjectPublicKeyInfo and hashes it locally in the browser.

## DNSSEC behavior

Paste the zone DNSKEY after the authoritative DNS server signs the zone. The app computes DS digest type 2 by default:

```zone
DS <keytag> <algorithm> 2 <sha256-digest>
```

The app does not sign zones and does not store private keys. DNSSEC signing remains the DNS server’s job.

## Nameserver hostname walkthrough

For DANE setup, choose **Delegated authoritative DNS** when the wallet or registrar should point at a nameserver hostname. The practical setup is:

1. Choose an authoritative DNS provider or run your own authoritative nameserver.
2. Create the DNS zone for the HNS name or ICANN domain.
3. Use the provider-assigned nameserver hostnames, or create an in-name hostname such as `ns1.dane.` / `ns1.example.com.`.
4. If the nameserver hostname is inside the same name or zone, publish glue at the parent: `GLUE4`/`GLUE6` in HNS, or registrar glue for ICANN.
5. Put the website `A`/`AAAA` records and `_443._tcp` `TLSA` record in the authoritative DNS zone.
6. Enable DNSSEC signing on that authoritative zone.
7. Publish the DS at the parent: HNS wallet/name resource for HNS, registrar/parent zone for ICANN.

Provider fit matters. The DNS host must support authoritative DNS, DNSSEC signing, DS or DNSKEY export, and custom `TLSA` records. Cloudflare, Amazon Route 53, Google Cloud DNS, and DNSimple document DNSSEC plus TLSA-capable DNS paths. DigitalOcean DNS is not a fit for this DANE path as of its June 2026 docs because it does not support DNSSEC. Registrars such as Namecheap or GoDaddy may still be usable as the parent-side place to enter DS records while another DNS host serves the signed TLSA zone.

For self-hosted examples, see the Debian/BIND and Windows Server DNS quick starts in [Web Admin Guide](docs/WEB_ADMIN_GUIDE.md).

## Operational requirements

This tool generates bootstrap records. A working delegated authoritative DNS and DANE deployment still depends on the operator running and validating the DNS service correctly.

### Authoritative nameserver baseline

If you run your own authoritative nameserver:

- Listen publicly on both UDP/53 and TCP/53.
- Disable recursion on the authoritative service. Do not expose an open recursive resolver.
- Allow DNS through the host firewall, network firewall, and hosting-provider security groups.
- Keep the SOA serial increasing for every zone-file change.
- Prefer at least two authoritative nameservers on separate hosts or networks.
- Monitor DNSSEC signature freshness and re-sign before RRSIG expiration.
- Publish authenticated denial of existence with NSEC or NSEC3, depending on the signer/server policy.

The server presets are starter snippets, not complete daemon hardening or service-management guides.

### DNSSEC validation

`dig +dnssec` shows DNSSEC records in the answer. It does not, by itself, prove that the delegation chain validates. After publishing the parent DS, also test with a validating resolver.

For ICANN DNS:

```bash
delv example.com. A
delv _443._tcp.example.com. TLSA
dig @<validating-recursive-resolver> _443._tcp.example.com. TLSA +dnssec
```

In a validating `dig` response, confirm `status: NOERROR` and the `ad` flag. `SERVFAIL` commonly means a broken DNSSEC chain, expired signatures, unsupported algorithms, a wrong parent DS, or a missing DNSKEY/RRSIG/NSEC/NSEC3 record.

For HNS names, perform the same checks through an HNS-aware validating resolver after the wallet/name-resource update confirms:

```bash
dig @<hns-validating-recursive-resolver> example. A +dnssec
dig @<hns-validating-recursive-resolver> _443._tcp.example. TLSA +dnssec
```

### DNSSEC signing lifecycle

A production signer normally separates the key-signing key (KSK, usually flags 257) from the zone-signing key (ZSK, usually flags 256), though some managed systems hide that detail. Parent DS records are normally derived from the KSK. Keep the parent DS, child DNSKEY, and signed child zone in sync, and follow TTL-safe rollover order when changing keys:

1. Publish the new DNSKEY in the child zone and wait for caches.
2. Add or update the parent DS.
3. Confirm validation succeeds.
4. Remove old DNSKEY/DS material only after the old TTL and signature windows are safely past.

### TLSA rollover

The default `TLSA 3 1 1` record pins the TLS service public key. If the web server changes to a new key before resolvers can see the new TLSA association, DANE-aware clients can fail authentication.

Safe key rollover:

1. Publish TLSA records for both the current key and next key.
2. Wait at least the relevant DNS TTL and any operational cache window.
3. Switch the TLS service to the new key/certificate.
4. Verify live TLSA matching.
5. Remove the old TLSA record after another TTL window.

### Client support and service scope

Publishing TLSA creates a DANE policy in DNS. It is enforced only by clients that validate DNSSEC and implement DANE checks. Mainstream HTTPS browser behavior is not uniform, so distinguish "TLSA is published and signed" from "the client actually enforces DANE."

This package is apex-HTTPS focused by default, for example `_443._tcp.example.`. Other services need their own TLSA owners:

- `www.example.` on HTTPS: `_443._tcp.www.example.`
- SMTP over STARTTLS for an MX host: `_25._tcp.mail.example.`
- IMAP over TLS: `_993._tcp.imap.example.`
- SRV-based services: follow the service-specific DANE owner-name rules.

SMTP DANE is a separate workflow defined by RFC 7672 and is not implemented by this generator yet.

### Input correctness

The app computes DS from the DNSKEY you paste and TLSA from the PEM certificate or public key you paste. Before publishing:

- Confirm the DNSKEY is from the exact signed child zone and normally from the KSK/SEP key.
- Confirm the parent DS matches the active child DNSKEY after signing.
- Confirm the certificate or PUBLIC KEY is the exact key served for the hostname, port, protocol, and SNI name represented by the TLSA owner.
- Confirm the live service still presents a certificate chain compatible with the selected TLSA usage.

## Internationalized domain names

Unicode domain input is accepted when the browser can convert it through IDNA processing. Generated DNS, wallet, registrar, server, and verification output uses ASCII A-labels such as `xn--bcher-kva.example.`.

The app shell includes English, Spanish, French, German, Portuguese, Japanese, Arabic, Persian, and Hebrew UI localization. The language selector translates the interface; Arabic, Persian, and Hebrew use RTL page direction, while generated records and command snippets remain unchanged.

See [Internationalization standards](docs/I18N_STANDARDS.md) for the UI localization policy plus IDNA, Punycode, UTS #46, and future email internationalization references.

## Input guidance

The app keeps setup guidance beside the field it explains:

- **Domain type** explains the wallet/registrar versus authoritative DNS split.
- **Setup mode** walks through delegated DNS versus HNS `SYNTH`, including nameserver hostname, glue, DNSSEC, DS, and TLSA placement.
- **Domain** explains HNS slash form, ICANN DNS names, and IDNA handling.
- **DNS server preset** explains when to use hosted DNS, generic zone files, or server-specific examples.
- **Nameserver hostname** explains provider-assigned nameservers versus in-name `ns1.yourname.` hostnames that require glue.
- **Nameserver IPv4** explains `SYNTH4` and `GLUE4` nameserver address use.
- **Website IPv4** explains that website `A` records are separate from nameserver `SYNTH`/glue.

### DNS server preset

Use **Hosted DNS provider panel** if your provider supports DNSSEC signing, DS or DNSKEY export, and custom TLSA records. Use **Generic zone file** when adapting records into another authoritative server. Use **BIND 9** for a Debian/Linux quick start. Use **Windows Server DNS** for PowerShell-driven Windows Server setup. Use **PowerDNS** when you want API/database-backed DNS. If the provider cannot publish TLSA records in a signed zone, it cannot complete this DANE setup.

### What goes in the wallet or registrar?

Only parent-side delegation material: nameserver, glue when needed, and DS. TLSA goes on the authoritative DNS server, not in the wallet or registrar.

### Is SYNTH a website IP shortcut?

No. HNS `SYNTH4` and `SYNTH6` encode nameserver IPs for a synthetic `_..._synth.` nameserver. The authoritative DNS server still publishes website `A`/`AAAA`, `TLSA`, and signed DNSSEC records.

### When do I paste DNSKEY?

After the authoritative zone is signed. Paste the public DNSKEY into this app to generate the DS record for the parent.

### Does the web server need a DANE plugin?

No. Nginx, Apache, and Caddy serve the normal certificate and private key. DANE-aware clients verify TLSA through DNSSEC.

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

Static output goes to `dist/`.

Docker:

```bash
docker build -t hns-dane-bootstrap-generator .
docker run --rm -p 8080:80 hns-dane-bootstrap-generator
```

## Core library

```ts
import { generateBootstrap } from './core/bootstrap';

const result = await generateBootstrap({
  domainType: 'hns',
  setupMode: 'delegated',
  domainInput: 'dane/',
  nameserverHost: 'ns1.dane.',
  nameserverIpv4: '203.0.113.10',
  websiteIpv4: '203.0.113.20',
  port: 443,
  protocol: 'tcp',
  pemInput: '-----BEGIN PUBLIC KEY-----...',
  dnsServerPreset: 'generic-zone'
});
```

## URL prefill

The UI accepts query parameters so HNScrawler or another report can hand off a specific next step:

```text
/dane-generator/?domain=example&intent=generate_tlsa
/dane-generator/?domain=example&mode=synth&ns4=203.0.113.10&a=203.0.113.20
```

When `intent` is present, the UI shows a report handoff card that explains the next action, such as generating TLSA, fixing missing GLUE, checking DS/DNSKEY mismatch, replacing stale TLSA, or completing SYNTH DNS setup.

Accepted aliases:

- Domain: `domain`, `name`, `domainInput`, `domain_input`
- Domain type: `domainType`, `domain_type`, `type` with `hns` or `icann`
- Setup mode: `setupMode`, `setup_mode`, `mode` with `delegated` or `synth`/`hns-inline`
- Next-step hint: `intent`, `action`, `next_step`
- Nameserver: `nameserver`, `nameserverHost`, `ns`
- Nameserver IPs: `ns4`, `ns6`, `glue4`, `glue6`
- Website IPs: `a`, `aaaa`, `websiteIpv4`, `websiteIpv6`
- Other fields: `port`, `preset`, `dnskey`, `pem`, `cert`, `certificate`

## Design rules

- **DRY**: one generator core feeds the UI, docs examples, tests, and integrator JSON.
- **KISS**: no wallet broadcasting, registrar automation, DNS hosting panel, or live resolver dependency.
- **SOLID**: domain normalization, DNSSEC, TLSA, server presets, and UI rendering are separate modules.

## Standards anchors

- DNSSEC: RFC 4034, RFC 4509.
- DANE/TLSA: RFC 6698, RFC 7671.
- DNSSEC algorithm guidance: IANA DNS Security Algorithm Numbers, IANA DS Digest Algorithms, RFC 9904, RFC 9905.
- IDNA/i18n: RFC 5890-5894, RFC 3492, Unicode UTS #46.
- Future email i18n scope: RFC 6530-6533.
- Handshake resources: HNS `NS`, `DS`, `GLUE4`, `GLUE6`, `SYNTH4`, `SYNTH6`.

## Donation

Donation: [hs1q5997733eq7f4yyk2vq2z8gz3yqyvpz422ypggh](handshake:hs1q5997733eq7f4yyk2vq2z8gz3yqyvpz422ypggh)
