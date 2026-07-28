# Web Admin Guide

This tool answers two questions:

1. What do I put in the wallet or registrar?
2. What do I put on my DNS server?

## Recommended first setup

Use **Delegated authoritative DNS** for the DANE setup path when the wallet or registrar should point at a nameserver hostname.

For an HNS name such as `dane/`:

1. Run an authoritative DNS server.
2. Use a nameserver name such as `ns1.dane.`.
3. Publish `NS ns1.dane.` in the HNS wallet, plus `GLUE4` or `GLUE6` for that in-zone nameserver.
4. Put the web server IP and TLSA record in the DNS zone.
5. Enable DNSSEC signing.
6. Publish the DS record in the HNS wallet.

For HNS names, **SYNTH nameserver** is also supported. It stores the authoritative nameserver IP in the HNS resource as `SYNTH4` or `SYNTH6`; the DNS server still publishes the website `A`/`AAAA`, `TLSA`, and signed DNSSEC records.

## Easiest DNS server choice

- **Hosted DNS provider panel**: easiest if the provider supports DNSSEC signing, DS/DNSKEY export, and custom TLSA records.
- **Generic zone file**: best neutral output; works as a base for most DNS servers.
- **PowerDNS Authoritative**: easiest for API/database workflows.
- **Knot DNS**: clean modern authoritative server with good DNSSEC automation.
- **BIND 9**: widely documented and available everywhere; more verbose.
- **Windows Server DNS**: good when the operator already manages Windows Server infrastructure and wants DNS Manager or PowerShell.
- **NSD**: small authoritative server; signing is usually a separate step.

If you are unsure, start with **Hosted DNS provider panel** when you already use a DNS host. Start with **Generic zone file** when you are running your own authoritative server.

## Delegated nameserver walkthrough

Use this path when a wallet, registrar, or parent zone should point at a nameserver hostname.

### Provider-assigned nameservers

This is the easiest hosted-DNS path:

1. Create the authoritative zone at a DNS provider that supports DNSSEC signing and custom `TLSA` records.
2. Copy the provider-assigned nameserver hostnames, for example `alice.ns.provider.example.` and `bob.ns.provider.example.`.
3. Put those nameserver hostnames in the HNS wallet/name resource or registrar nameserver settings.
4. In the provider's DNS zone, create the website `A`/`AAAA` records and the generated `_443._tcp` `TLSA` record.
5. Enable DNSSEC signing for the zone.
6. Copy the provider's DS record to the HNS wallet/name resource or registrar. If the provider exposes DNSKEY instead of DS, paste DNSKEY into this app and publish the generated DS.
7. Verify direct authoritative answers first, then verify DNSSEC chain validation and TLSA.

### Your own nameserver hostname

Use this when you want a hostname such as `ns1.dane.` or `ns1.example.com.`:

1. Run an authoritative DNS server, or use a provider feature that supports branded/vanity nameservers.
2. Create the child zone on that authoritative service.
3. Give the nameserver hostname an address: `ns1.dane. A 203.0.113.10` or `ns1.example.com. A 203.0.113.10`.
4. Because that nameserver hostname is inside the same name or zone it serves, publish glue at the parent: `GLUE4`/`GLUE6` in HNS, or registrar glue for ICANN.
5. Publish the website `A`/`AAAA`, `TLSA`, and signed DNSSEC records from the authoritative service.
6. Publish DS at the parent after signing.

Do not put website IPs in glue. Glue only helps resolvers find the nameserver. Website `A`/`AAAA` and `TLSA` remain in the authoritative DNS zone.

## Self-hosted OS quick starts

Delegated authoritative DNS and HNS SYNTH use the same DNS-server job: serve the signed zone with `NS`, website `A`/`AAAA`, `TLSA`, `DNSKEY`, `RRSIG`, and authenticated denial records. The parent-side step is what changes:

- **Delegated authoritative DNS**: parent gets `NS`, plus `GLUE4`/`GLUE6` when the nameserver is in-zone, plus `DS`.
- **HNS SYNTH nameserver**: HNS parent gets `SYNTH4`/`SYNTH6`, plus `DS`.

### Authoritative DoH is a separate HTTPS service

For an in-zone nameserver in delegated HNS mode, generated zone output also
includes RFC 9461 `_dns.<NS>` SVCB discovery for RFC 8484 DoH on
`https://<NS>/dns-query`. Publish that record only when the nameserver really
serves the advertised HTTP/2 DoH endpoint on TCP 443 with a certificate valid
for the nameserver hostname.

The BIND and Windows quick starts below configure authoritative DNS on
UDP/TCP 53; they do not create an HTTPS DoH frontend. Add and validate a
separate DoH frontend before publishing the generated SVCB record, or omit
that record until the endpoint exists. The repository's Linode appliance is
the provided path that configures Knot, dnsdist, and nginx together.

### Debian with BIND 9: delegated authoritative DANE

Example values:

```text
Zone: dane.
Nameserver hostname: ns1.dane.
Nameserver IPv4: 203.0.113.10
Website IPv4: 203.0.113.20
TLSA owner: _443._tcp.dane.
```

Install BIND and DNS tools:

```bash
sudo apt update
sudo apt install bind9 bind9-utils dnsutils
sudo install -d -o bind -g bind /etc/bind/zones
```

In `/etc/bind/named.conf.options`, make the service authoritative-only:

```conf
options {
  directory "/var/cache/bind";
  listen-on { any; };
  listen-on-v6 { any; };
  allow-query { any; };
  recursion no;
  allow-recursion { none; };
};
```

In `/etc/bind/named.conf.local`, define the signed zone:

```conf
zone "dane" {
  type primary;
  file "/etc/bind/zones/db.dane";
  dnssec-policy default;
  inline-signing yes;
  allow-transfer { none; };
};
```

Create `/etc/bind/zones/db.dane`:

```zone
$ORIGIN dane.
$TTL 3600
@ 3600 IN SOA ns1.dane. hostmaster.dane. (
  2026070401 ; serial
  3600       ; refresh
  900        ; retry
  1209600    ; expire
  3600       ; minimum
)
@         3600 IN NS    ns1.dane.
ns1       3600 IN A     203.0.113.10
@         3600 IN A     203.0.113.20
_443._tcp 3600 IN TLSA  3 1 1 <spki-sha256>
```

Check, start, and query:

```bash
sudo named-checkconf
sudo named-checkzone dane /etc/bind/zones/db.dane
sudo systemctl enable --now bind9
sudo systemctl reload bind9
dig @127.0.0.1 dane. SOA +dnssec +norecurse
dig @127.0.0.1 _443._tcp.dane. TLSA +dnssec +norecurse
dig @127.0.0.1 dane. DNSKEY +dnssec +multi
```

Then paste the public DNSKEY into this app and publish `NS ns1.dane.`,
`GLUE4 ns1.dane. 203.0.113.10`, and the generated `DS` in the HNS wallet. For
ICANN, use the registrar's nameserver, glue, and DS fields instead.

### Debian with BIND 9: HNS SYNTH nameserver

Use this only for HNS names when the HNS resource should store the nameserver IP directly.

1. In the app, choose **HNS SYNTH nameserver** and enter the authoritative DNS server IP.
2. Use the generated synthetic `NS` name in the zone output, for example `_pc0722g._synth.`.
3. Configure BIND with the same `named.conf.options` and `dnssec-policy default` zone block shown above.
4. In the zone file, use the generated `NS`, website `A`/`AAAA`, and `TLSA` records.
5. Query DNSKEY after signing and publish `SYNTH4`/`SYNTH6` plus `DS` in the HNS wallet.

Example SYNTH zone content:

```zone
$ORIGIN dane.
$TTL 3600
@ 3600 IN SOA _pc0722g._synth. hostmaster.dane. (
  2026070401 3600 900 1209600 3600
)
@         3600 IN NS    _pc0722g._synth.
@         3600 IN A     203.0.113.20
_443._tcp 3600 IN TLSA  3 1 1 <spki-sha256>
```

Do not add `GLUE4` for SYNTH mode. The HNS resource gets `SYNTH4 203.0.113.10`; the authoritative DNS server still serves the signed zone.

### Windows Server DNS: delegated authoritative DANE

Run these commands in an elevated PowerShell session on the DNS server:

```powershell
Install-WindowsFeature DNS -IncludeManagementTools
Set-DnsServerRecursion -Enable $false
New-NetFirewallRule -DisplayName "DNS UDP 53" -Direction Inbound -Protocol UDP -LocalPort 53 -Action Allow
New-NetFirewallRule -DisplayName "DNS TCP 53" -Direction Inbound -Protocol TCP -LocalPort 53 -Action Allow

Add-DnsServerPrimaryZone -Name "dane" -ZoneFile "dane.dns"
Add-DnsServerResourceRecord -NS -ZoneName "dane" -Name "." -NameServer "ns1.dane." -TimeToLive (New-TimeSpan -Seconds 3600)
Add-DnsServerResourceRecordA -ZoneName "dane" -Name "ns1" -IPv4Address "203.0.113.10" -TimeToLive (New-TimeSpan -Seconds 3600)
Add-DnsServerResourceRecordA -ZoneName "dane" -Name "." -IPv4Address "203.0.113.20" -TimeToLive (New-TimeSpan -Seconds 3600)
Add-DnsServerResourceRecord -TLSA -ZoneName "dane" -Name "_443._tcp" -CertificateUsage DomainIssuedCertificate -Selector SubjectPublicKeyInfo -MatchingType Sha256Hash -CertificateAssociationData "<spki-sha256>" -TimeToLive (New-TimeSpan -Seconds 3600)

Invoke-DnsServerZoneSign -ZoneName "dane" -SignWithDefault -PassThru -Verbose
Get-DnsServerResourceRecord -ZoneName "dane" -RRType DNSKEY
Get-DnsServerResourceRecord -ZoneName "dane" -RRType DS
```

Then publish the parent-side material:

- HNS delegated: `NS ns1.dane.`, `GLUE4 ns1.dane. 203.0.113.10`, and `DS` in the HNS wallet.
- ICANN delegated: nameserver `ns1.example.com.`, registrar glue if in-zone, plus `DS`.

### Windows Server DNS: HNS SYNTH nameserver

Use the same Windows DNS Server role, firewall, recursion, zone signing, and TLSA commands. Change only the parent-side setup and the zone `NS` target:

```powershell
Add-DnsServerPrimaryZone -Name "dane" -ZoneFile "dane.dns"
Add-DnsServerResourceRecord -NS -ZoneName "dane" -Name "." -NameServer "_pc0722g._synth." -TimeToLive (New-TimeSpan -Seconds 3600)
Add-DnsServerResourceRecordA -ZoneName "dane" -Name "." -IPv4Address "203.0.113.20" -TimeToLive (New-TimeSpan -Seconds 3600)
Add-DnsServerResourceRecord -TLSA -ZoneName "dane" -Name "_443._tcp" -CertificateUsage DomainIssuedCertificate -Selector SubjectPublicKeyInfo -MatchingType Sha256Hash -CertificateAssociationData "<spki-sha256>" -TimeToLive (New-TimeSpan -Seconds 3600)
Invoke-DnsServerZoneSign -ZoneName "dane" -SignWithDefault -PassThru -Verbose
```

The HNS wallet gets `SYNTH4 203.0.113.10` and `DS`. It does not get website `A` records or `TLSA`.

## Provider notes

Provider support changes, so confirm the current docs before committing a production name. For this app's DANE flow, the DNS host must support authoritative DNS, DNSSEC signing, DS or DNSKEY export, and custom `TLSA` records.

- **Cloudflare DNS**: create the zone, use Cloudflare's assigned nameservers or an eligible custom-nameserver setup, add `A`/`AAAA` plus `TLSA`, enable DNSSEC, then copy Cloudflare's DS record to the parent. Cloudflare documents DNSSEC signing and supported DNS record types including `TLSA`.
- **Amazon Route 53**: create a public hosted zone, use its assigned NS set, add `A`/`AAAA` plus `TLSA`, enable DNSSEC signing with a KSK/KMS setup, then publish the DS values Route 53 provides. Route 53 documents `TLSA` as a supported record type.
- **Google Cloud DNS**: create a public managed zone, add `A`/`AAAA` plus `TLSA`, enable DNSSEC on the managed zone, then publish the DS at the parent. Google documents `TLSA` and warns to use it only in DNSSEC-secured zones.
- **DNSimple**: use DNSimple nameservers, enable DNSSEC, and add `TLSA` in the DNS record editor. DNSimple notes TLSA support is for DNSimple nameservers.
- **DigitalOcean DNS**: not suitable for this exact DNSSEC + DANE path as of DigitalOcean's June 2026 support docs because DigitalOcean DNS does not support DNSSEC. You can still host the web server or an authoritative DNS daemon on DigitalOcean infrastructure, but use a DNS service that signs the zone and publishes `TLSA`.
- **Namecheap, GoDaddy, and similar registrars**: treat these as the parent-side control panel when DNS is hosted elsewhere. Enter custom nameservers and DS records there, but put `TLSA` on the authoritative DNS host. Do not assume the registrar's bundled DNS product can host DANE unless its current record-type list includes `TLSA` and DNSSEC signing.

Provider reference docs:

- [Cloudflare DNSSEC](https://developers.cloudflare.com/dns/dnssec/) and [Cloudflare DNS record types](https://developers.cloudflare.com/dns/manage-dns-records/reference/dns-record-types/)
- [Amazon Route 53 DNSSEC signing](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-configuring-dnssec-enable-signing.html) and [Route 53 record types](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/ResourceRecordTypes.html)
- [Google Cloud DNSSEC](https://docs.cloud.google.com/dns/docs/dnssec) and [Google Cloud DNS record types](https://docs.cloud.google.com/dns/docs/records-overview)
- [DNSimple DNSSEC](https://support.dnsimple.com/articles/dnssec/) and [DNSimple TLSA records](https://support.dnsimple.com/articles/manage-tlsa-record/)
- [DigitalOcean DNSSEC support status](https://docs.digitalocean.com/support/does-digitalocean-support-dnssec/)
- [Namecheap custom-DNS DNSSEC](https://www.namecheap.com/support/knowledgebase/article.aspx/9722/2232/managing-dnssec-for-domains-pointed-to-custom-dns/) and [GoDaddy DNSSEC](https://www.godaddy.com/help/turn-dnssec-on-or-off-6420)
- [BIND 9 DNSSEC key and signing policy](https://kb.isc.org/docs/dnssec-key-and-signing-policy)
- [Microsoft DNSSEC zone signing](https://learn.microsoft.com/en-us/windows-server/networking/dns/sign-dnssec-zone), [Invoke-DnsServerZoneSign](https://learn.microsoft.com/en-us/powershell/module/dnsserver/invoke-dnsserverzonesign), and [Add-DnsServerResourceRecord TLSA parameters](https://learn.microsoft.com/en-us/powershell/module/dnsserver/add-dnsserverresourcerecord)

## Wallet / registrar side

Parent-side records only tell resolvers where authority starts.

HNS parent examples:

```zone
NS ns1.dane.
GLUE4 ns1.dane. 203.0.113.10
DS 12345 13 2 7A1B...F09C
```

ICANN registrar examples:

```text
Nameserver: ns1.example.com.
Glue IPv4: 203.0.113.10
DS: 12345 13 2 7A1B...F09C
```

## DNS server side

The authoritative DNS server publishes the website and DANE records:

```zone
dane. 3600 IN NS ns1.dane.
dane. 3600 IN A 203.0.113.20
_443._tcp.dane. 3600 IN TLSA 3 1 1 <spki-sha256>
# Publish only when ns1.dane. actually serves RFC 8484 on HTTPS 443:
_dns.ns1.dane. 3600 IN SVCB 1 ns1.dane. alpn=h2 dohpath=/dns-query{?dns}
```

## Running your own authoritative nameserver

If you run the nameserver yourself, the generated records are only the zone content. The service still needs baseline authoritative-DNS operations:

- Listen publicly on both UDP/53 and TCP/53. DNSSEC responses are often larger, and TCP fallback must work.
- Disable recursion on the authoritative service. Do not expose an open resolver from the same listener.
- Allow DNS through host firewalls, network firewalls, cloud security groups, and upstream provider filters.
- Keep the SOA serial increasing for every zone-source change.
- Prefer at least two authoritative nameservers on separate hosts, networks, or providers.
- Monitor logs and query behavior for lame delegation, refused queries, truncation, and TCP failures.
- Re-sign before RRSIG expiration and ensure the signer publishes DNSKEY, RRSIG, and NSEC or NSEC3 records.

The presets are intentionally starter snippets. They are not complete OS package, service manager, firewall, monitoring, or multi-primary/secondary replication guides.

## DNSSEC lifecycle

DNSSEC needs more than a one-time "enable signing" switch.

Typical key roles:

- **KSK**: key-signing key. This normally has DNSKEY flags `257` and is the key used to create the parent DS.
- **ZSK**: zone-signing key. This normally has DNSKEY flags `256` and signs ordinary zone data.

Some DNS providers and modern servers automate this, but the parent DS still needs to match the child zone's active KSK. Validation fails when the parent and child disagree.

Safe initial DS order:

1. Create the authoritative zone and publish the unsigned records.
2. Enable DNSSEC signing on the child zone.
3. Confirm the child zone serves DNSKEY and RRSIG records.
4. Generate or copy the DS from the active KSK.
5. Publish the DS in the HNS name resource or registrar/parent panel.
6. Validate through a DNSSEC-validating resolver.

Common `SERVFAIL` causes:

- Parent DS points at the wrong DNSKEY.
- DNSKEY was pasted from a different zone.
- RRSIG records expired or the signer stopped refreshing them.
- Signed negative answers are missing or broken because NSEC/NSEC3 is not being served correctly.
- A resolver does not support the chosen DNSSEC algorithm.
- The authoritative server is unreachable over TCP/53 after UDP truncation.

## Validation commands

Direct authoritative queries prove the server answers; they do not prove the DNSSEC chain validates:

```bash
dig @203.0.113.10 example. SOA +norecurse
dig @203.0.113.10 example. A +dnssec +norecurse
dig @203.0.113.10 _443._tcp.example. TLSA +dnssec +norecurse
```

After the parent DS is published, use a validating resolver. For ICANN DNS:

```bash
delv example.com. A
delv _443._tcp.example.com. TLSA
dig @<validating-recursive-resolver> _443._tcp.example.com. TLSA +dnssec
```

In the `dig` response from a validating resolver, check for `status: NOERROR` and the `ad` flag. If validation fails, many validating resolvers return `SERVFAIL`.

For HNS, use an HNS-aware validating resolver after the wallet update confirms:

```bash
dig @<hns-validating-recursive-resolver> example. A +dnssec
dig @<hns-validating-recursive-resolver> _443._tcp.example. TLSA +dnssec
```

## TLSA key rollover

The default TLSA shape is `3 1 1`, which pins the TLS service public key with SHA-256. Certificate renewal is simple only when the server keeps the same keypair. If the key changes before clients can see the new TLSA record, DANE-aware clients can fail authentication.

Safe rollover:

1. Generate the next certificate/keypair.
2. Publish TLSA records for both the current public key and next public key.
3. Wait at least one TTL, and longer if your DNS provider or resolver path caches aggressively.
4. Switch the web server to the next certificate/keypair.
5. Verify the live TLS service matches the new TLSA record.
6. Remove the old TLSA record after another TTL window.

## Web server side

Nginx, Apache, and Caddy do not need a DANE plugin. They serve the normal certificate and private key. DANE-aware clients verify the TLSA record through DNSSEC.

Publishing TLSA does not mean every client enforces DANE. The client must validate DNSSEC and implement DANE/TLSA checking. This matters especially for HTTPS, where mainstream browser enforcement is not uniform. Treat "TLSA is published and signed" and "the application enforces DANE" as separate checks.

## Services and hostnames

The default web flow targets apex HTTPS, such as:

```zone
_443._tcp.example. 3600 IN TLSA 3 1 1 <spki-sha256>
```

Each hostname, service, and port that should use DANE needs its own TLSA owner name. Examples:

```zone
_443._tcp.www.example. 3600 IN TLSA 3 1 1 <spki-sha256>
_25._tcp.mail.example. 3600 IN TLSA 3 1 1 <spki-sha256>
_993._tcp.imap.example. 3600 IN TLSA 3 1 1 <spki-sha256>
```

SMTP DANE uses MX hostnames and is a separate RFC 7672 workflow. This generator does not yet build MX-derived SMTP DANE sets.

## Input correctness checks

The app cannot know whether pasted material came from the live server or the exact signed zone. Before publishing:

- Confirm DNSKEY came from the exact child zone being delegated.
- Prefer the KSK/SEP DNSKEY, usually flags `257`, when deriving parent DS.
- Confirm the parent-side DS matches the active child DNSKEY after signing.
- Confirm the pasted certificate or PUBLIC KEY is the exact public key served for the hostname, port, protocol, and SNI name represented by the TLSA owner.
- Confirm the live TLS service presents the intended certificate chain for the selected TLSA usage.

## Internationalized names

Use the Unicode spelling for human-facing notes, but use the generated ASCII `xn--` A-labels in DNS records, wallet fields, registrar fields, server configs, and verification commands.

Examples:

```text
Unicode input: an internationalized domain name
DNS output:    xn--... A-label form
```

The standards tracked by this project are in [Internationalization standards](I18N_STANDARDS.md).

## FAQ

### Do I need glue?

Delegated mode always needs an `NS` record. When that nameserver is inside the
same zone, it also needs glue: for `dane/` using `ns1.dane.`, publish `NS`
plus `GLUE4` or `GLUE6` in the HNS wallet. An external provider nameserver
needs `NS` without glue.

### Is SYNTH the website IP?

No. `SYNTH4` and `SYNTH6` are HNS nameserver referrals. They tell resolvers how to reach the authoritative DNS server. The website IP belongs in the authoritative zone as `A` or `AAAA`.

### When do I paste DNSKEY?

Paste DNSKEY after DNSSEC signing is enabled on the authoritative zone. The app uses the public DNSKEY to generate the parent-side DS record.

### What if my DNS provider cannot create TLSA?

Use a provider or authoritative DNS server that supports custom TLSA records. Without TLSA in the signed zone, the DANE part is not complete.

### What if my DNS provider hides DNSKEY and only gives DS?

Use the provider's DS directly at the parent. This app can generate DS from DNSKEY, but provider-managed DNSSEC sometimes gives you the final DS instead.

### Does this replace DNSSEC signing tools?

No. The DNS server or DNS provider signs the zone. This app only prepares records and checks the parent/server split.

### Does `dig +dnssec` mean validation succeeded?

No. It means DNSSEC-related records were requested and may be present. Use `delv` for ICANN DNS or a DNSSEC-validating recursive resolver and confirm the `ad` flag. For HNS, use an HNS-aware validating resolver.

### Why did a validating resolver return SERVFAIL?

For a signed zone, `SERVFAIL` often means the DNSSEC chain is broken: wrong DS, missing DNSKEY, expired RRSIGs, unsupported algorithms, broken NSEC/NSEC3 denial records, or authoritative reachability problems.

### Do I need one TLSA record for every service?

Yes, for every TLS service you expect DANE-aware clients to authenticate. Apex HTTPS, `www`, mail MX hosts, IMAP, and SRV-based services have different owner names.
