# Onboarding interface

## Product framing

The page is a two-output wizard:

1. `Put this in your HNS wallet / registrar`
2. `Put this on your authoritative DNS server`

Everything else supports those two boxes.

## Default layout

### Header

Fields:

- Language selector

Supported UI languages:

- English
- Spanish
- French
- German
- Portuguese
- Japanese
- Arabic
- Persian
- Hebrew

The selected language localizes the app shell and persists in local browser storage. Arabic, Persian, and Hebrew set the document direction to RTL. Generated records and command snippets are not translated.

### 1. Domain

Fields:

- Domain type: HNS or ICANN
- Setup mode: delegated authoritative DNS or HNS SYNTH nameserver
- Domain input: placeholder starts as `dane/` for HNS or `example.com` for ICANN; the field is blank until filled.

Help copy:

> Delegated authoritative DNS is the DANE setup path when the wallet or registrar should point at a nameserver hostname. SYNTH stores authoritative nameserver IPs in HNS. Both modes still need signed authoritative DNS for website and TLSA records.

The setup-mode help should walk users through the delegated path: create or choose an authoritative DNS zone, point the wallet or registrar at its nameserver hostname, add glue if the hostname is inside the same name or zone, enable DNSSEC, publish DS at the parent, and keep website `A`/`AAAA` plus `TLSA` in the signed authoritative zone.

Internationalized input:

> Unicode domain input is accepted when it can be converted to IDNA ASCII A-labels. Generated records use `xn--...` labels.

### 2. Server

Fields:

- DNS server preset
- Inline Debian / Windows Server quick-start disclosure
- Nameserver hostname
- DNS server IP
- Website IP
- Nameserver IPv6 (optional)
- Website IPv6 (optional)

Help copy for HNS delegated mode:

> If your nameserver is inside the same HNS name, such as `ns1.dane.` for `dane/`, your HNS wallet needs GLUE4 or GLUE6 so resolvers can find that nameserver.

Nameserver-hostname guidance should distinguish provider-assigned nameservers from vanity/in-name nameservers. Provider nameservers normally need only an `NS` delegation. In-name nameservers such as `ns1.dane.` or `ns1.example.com.` need address records on the authoritative service and parent-side glue.

Generated HNS delegated output also includes an **Authoritative DoH on HTTPS 443** guidance section:

- An in-zone nameserver the owner operates gets a DNSSEC-signed RFC 9461 `_dns.<NS>` SVCB record advertising `alpn=h2` and `dohpath=/dns-query{?dns}`. RFC 8484 is served through HTTPS on TCP 443; omitting the SVCB `port` parameter selects DoH's default port 443.
- An external nameserver does not get a fabricated record in the website zone. Its operator controls `_dns.<NS>` and must publish the signed service binding and HTTPS endpoint, or the website owner must adopt an in-zone DoH-capable nameserver.
- The browser normally discovers `_dns.<NS>` through authoritative port 53. The standards record cannot bootstrap itself on a network where port 53 is completely intercepted; another authenticated DNS path must first retrieve it.
- The guidance states that the alternate transport only carries DNS messages. The client continues local HNS/DNSSEC chain validation and TLSA/DANE enforcement.

An `intent=authoritative_doh` URL handoff displays these same ownership, bootstrap, and validation rules before the generated output. It also explains the browser's non-standard, implementation-specific standalone option: a proof-anchored HNS parent `hnsdns=1` TXT declaration with proven glue and a separately verified TLSA `3 1 1` SPKI pin for the DoH endpoint. The UI must not add a placeholder declaration to broadcastable parent output, derive the pin from the website TLSA field, or imply that the website TLSA key is automatically the DoH endpoint key.

Preset choices:

- Hosted DNS provider panel
- Generic zone file
- BIND 9
- Windows Server DNS
- PowerDNS Authoritative
- Knot DNS
- NSD

Preset output must remind self-hosting admins that authoritative service still needs UDP/TCP 53 reachability, recursion disabled, firewall access, SOA serial discipline, DNSSEC signature refresh, authenticated denial records, and validation after parent DS publication.

The DNS server preset field should visibly link to Debian/BIND and Windows Server DNS quick starts before users generate output. The footer should also link to the web admin guide. The quick-start copy should explain that delegated authoritative DNS and HNS SYNTH use the same signed authoritative zone; only the parent-side referral changes.

## Compatibility Matrix

| Domain type | Setup mode | Parent-side output | Authoritative DNS output | DNSSEC + DANE support |
| --- | --- | --- | --- | --- |
| HNS | Delegated authoritative DNS | `NS`, plus `GLUE4`/`GLUE6` when the nameserver is in-zone, plus `DS` | `NS`, `A`/`AAAA`, conditional RFC 9461 `SVCB`, `TLSA`, signed zone | Yes |
| HNS | SYNTH nameserver | `SYNTH4`/`SYNTH6`, plus `DS` | Synthetic `NS`, `A`/`AAAA`, `TLSA`, signed zone | Yes |
| ICANN | Delegated authoritative DNS | Registrar nameserver/glue, plus `DS` | `NS`, `A`/`AAAA`, `TLSA`, signed zone | Yes |
| ICANN | SYNTH nameserver | Not applicable | Falls back to delegated authoritative DNS | Not an ICANN mode |

`SYNTH4` and `SYNTH6` are not website address records. They encode authoritative nameserver IPs and produce synthetic `_..._synth.` nameserver names.

### 3. DANE

Fields:

- HTTPS port (defaults to 443 for normal HTTPS)
- Certificate or PUBLIC KEY
- DNSKEY

Help copy:

> Paste the leaf certificate or a PEM PUBLIC KEY. The output uses TLSA 3 1 1.

Field-level help:

- TLSA certificate or PUBLIC KEY includes a `How to get this` disclosure with OpenSSL examples and private-key warnings. The command uses the current website IP or domain, current HTTPS port, and current normalized domain for SNI.
- DNSKEY includes a `How to get this` disclosure that explains when to enable DNSSEC, where hosted DNS panels expose DNSKEY/DS, and how to query DNSKEY with `dig`. The command uses the current nameserver IP or hostname and current normalized zone name.
- Generated web notes must warn that TLSA `3 1 1` pins the service public key, key rollover needs current + next TLSA records across TTL windows, and DANE is enforced only by clients that validate DNSSEC and check TLSA.

## Field Validation

Validation is shown on the input fields instead of a separate attention card:

- Green fields are valid or already usable.
- Yellow fields are required for the current domain type and setup mode but have not been touched yet.
- Red fields are malformed, or required and still blank after user interaction.
- Optional blank fields stay neutral.
- In delegated mode, Nameserver IPv4/IPv6 is required until the nameserver is known to be external. In-zone delegated nameservers need glue; external delegated nameservers do not.

## Verification behavior

Generated verification commands must separate two checks:

1. Direct authoritative checks with `dig @server ... +norecurse`, which prove the DNS server answers.
2. Chain-validation checks with `delv`, AD-bit checks through a validating recursive resolver, or HNS-aware validating resolver checks, which prove DNSSEC validation.

The UI should explain that `dig +dnssec` alone does not prove validation and that `SERVFAIL` from a validating resolver commonly means a parent DS mismatch, missing DNSKEY/RRSIG/NSEC/NSEC3 data, expired signatures, unsupported algorithms, or authoritative reachability problems.

## Output order

1. Setup summary
2. Setup status
3. Parent-side records
4. Authoritative DNS records with server preset tabs
5. Authoritative DoH guidance when applicable
6. Verify commands
7. Web server note
8. Integrator JSON

## Output interaction policy

Output boxes show plain text records and commands without browser clipboard actions. Users can select the text they need from the expanded output.

Output cards default to collapsed. The heading row expands or collapses the card content.

## Tone policy

Use short operational labels:

- Needed
- OK
- Check
- Parent-side
- Authoritative DNS
- Glue
- DS
- TLSA

Avoid long paragraphs on the main path. Put deeper explanations in collapsible blocks.

## Field-Level Hint Topics

- Domain type: what goes in the wallet or registrar versus the DNS server.
- Setup mode: delegated nameserver mode versus HNS `SYNTH`.
- Domain: HNS slash form, ICANN DNS names, and IDNA handling.
- DNS server preset: hosted DNS, generic zone file, and server-specific examples.
- Nameserver IPv4: nameserver address use for `SYNTH4` and parent-side `GLUE4`.
- Website IPv4: website `A` records versus nameserver `SYNTH`/glue.
- DANE certificate/PUBLIC KEY: how to fetch or extract the TLSA source material.
- DNSKEY: when to paste DNSKEY and how to query it after DNSSEC signing.
