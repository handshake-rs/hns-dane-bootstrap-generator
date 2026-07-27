# RFC and standards audit

This file records the standards assumptions used by the scaffold.

## Stable core

### DNSSEC records

Use RFC 4034 as the base for DNSKEY, DS, RRSIG, and NSEC formatting and DS/key-tag derivation. The scaffold implements DNSKEY parsing, DNSKEY RDATA construction, key-tag computation, canonical owner-name encoding, and DS digest construction.

Operational documentation now distinguishes DNSSEC record presence from DNSSEC validation. `dig +dnssec` can show DNSSEC material without proving that a validator accepts the parent-to-child chain. Validation guidance points operators to `delv`, validating-recursive-resolver AD-bit checks, and HNS-aware validation for Handshake names.

### DS digest

Use digest type 2, SHA-256, as the default DS digest. SHA-256 DS is the conservative default. Digest type 4, SHA-384, is structurally supported in the helper and can be exposed later.

### TLSA / DANE

Use RFC 6698 plus RFC 7671. The scaffold defaults to:

```zone
TLSA 3 1 1 <spki-sha256>
```

That is DANE-EE, selector SPKI, matching SHA-256.

Operational documentation now calls out that DANE is enforced only by clients that validate DNSSEC and perform TLSA checks. Publishing a signed TLSA record is necessary, but not sufficient to guarantee that every HTTPS client enforces DANE.

The default flow remains apex HTTPS oriented. Other TLS services need service-specific TLSA owner names, and SMTP DANE remains a separate RFC 7672 workflow.

### Authoritative DoH discovery

Use RFC 8484 for the DoH exchange: HTTPS requests carry DNS wire-format messages with the `application/dns-message` media type.

Use RFC 9461 for DNS-server discovery. When an in-zone nameserver also serves DoH, generated authoritative-zone output includes:

```zone
_dns.ns1.<name>. IN SVCB 1 ns1.<name>. alpn=h2 dohpath=/dns-query{?dns}
```

With an HTTP ALPN and no explicit `port` SvcParam, RFC 9461 uses DoH's default HTTPS port 443. The target serves RFC 8484 DNS wire messages at the expanded `dohpath`, using an HTTPS certificate valid for the authentication name.

The standards-default HNS parent resource remains only delegation material: `NS`, `GLUE4`/`GLUE6`, and `DS` for delegated mode, or `SYNTH4`/`SYNTH6` plus `DS` for SYNTH mode. Authoritative DoH changes transport only: the browser or resolver still validates the HNS/DNSSEC chain and applies TLSA/DANE locally.

The zone containing the SVCB owner controls publication. A site owner can publish `_dns.ns1.<name>` for an in-zone nameserver, but only the external nameserver operator can publish `_dns.<external-nameserver>`. For an external delegation, the generator provides operator/adoption guidance instead of emitting an unauthoritative SVCB record in the website zone. The generator no longer emits experimental HNS TXT records for authoritative DoH transport.

RFC 9461 does not define the browser's initial route to the SVCB record. The current browser queries `_dns.<NS>` through authoritative port 53 and DNSSEC-validates the result. A signed SVCB record therefore cannot bootstrap itself when port 53 is completely intercepted; it is usable only after an authenticated DNS path can retrieve it.

The browser also implements a separate, non-standard HNS-only bootstrap convention for that failure mode: a proof-anchored parent TXT declaration beginning with `hnsdns=1`, naming the proven nameserver and actual DoH endpoint, with a TLSA `3 1 1` SHA-256 SPKI pin for that DoH endpoint. This is implementation-specific metadata, not an RFC 9461 record and not an ordinary TLSA RR. The generator does not add it to broadcastable parent output. A publisher must separately supply and verify the real endpoint hostname, HTTPS 443 path, and endpoint SPKI pin; a placeholder is unsafe, and the website TLSA key must not be reused by assumption.

RFC 9539 is a separate experimental mechanism for unilateral opportunistic recursive-to-authoritative encryption using DoT or DoQ on port 853. It is not a DoH discovery format and does not add fields to HNS resources.

### Internationalized domain names

Use IDNA2008 as the standards anchor:

- RFC 5890 for definitions and the IDNA document framework.
- RFC 5891 for the IDNA protocol.
- RFC 5892 for IDNA code point tables.
- RFC 5893 for right-to-left label rules.
- RFC 5894 for rationale and registry guidance.
- RFC 3492 for Punycode A-label encoding.
- Unicode UTS #46 for compatibility mapping behavior used by browsers and URL implementations.

The app accepts Unicode domain input when it can be converted by the runtime URL implementation, then emits DNS owner names in ASCII A-label form. See [Internationalization standards](I18N_STANDARDS.md).

### UI localization

The app localizes the UI shell with a static translation table plus a result-localization pass. Localized text covers field labels, short help, status labels, notices, generated guidance, output explanations, field-level hints, and field-level "How to get this" guidance. Generated DNS records, command snippets, JSON, and protocol keywords are not translated.

## Future-proofing decisions

1. Keep usage/selector/matching fields in the model even though the UI defaults to `3 1 1`.
2. Keep digest type as a typed option and avoid SHA-1 generation.
3. Do not hard-code RSA assumptions. DNSSEC algorithm number is preserved from the DNSKEY input.
4. Warn when a DNSKEY does not look like a normal KSK/SEP key, but do not block advanced users.
5. Make HNS parent output separate from ICANN registrar output. HNS resource records are not ordinary registrar UI fields.
6. Keep server presets small. DNS server installation and service management are OS-specific.
7. Document authoritative-server hardening requirements without pretending to manage the OS, firewall, daemon, or secondary nameserver topology.
8. Treat automated live validation as a future phase. The current scaffold emits validation commands but does not query resolvers itself.
9. Document certificate/key rollover order now. The UI should eventually support current + next TLSA generation so users can rotate keys without outage.
10. Keep Unicode labels out of generated DNS text. DNS output, verification commands, wallet fields, registrar fields, and server presets use A-labels.

## Next RFC features to consider

- SMTP DANE mode and MX-derived TLSA owner names.
- TLSA with SRV records.
- SVCB/HTTPS and DANE-adjacent service binding work if browser bootstrap grows toward HTTP/3.
- CDS/CDNSKEY automation for future parent DS update workflows.
- EAI/SMTPUTF8 support if mail presets are added. Track RFC 6530, RFC 6531, RFC 6532, and RFC 6533.

## Explicitly deferred

- Full DNSSEC zone signing.
- Authoritative server management.
- Automated live resolver validation.
- HNS proof verification.
- Automatic wallet or registrar updates.
- Private-key persistence.
- Registry-specific IDN policy checks.
- Confusable-character warnings.
