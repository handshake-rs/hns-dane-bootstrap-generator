# Server Presets

Presets are starter text, not a full DNS hosting system. The generated records remain the source of truth.

Every preset assumes the operator will still handle baseline authoritative-DNS operations:

- Public UDP/53 and TCP/53 reachability.
- Authoritative-only service with recursion disabled.
- Host/network/cloud firewall rules that allow DNS.
- Monotonic SOA serial increments for zone-source changes.
- At least two authoritative nameservers when practical.
- DNSSEC signature refresh before RRSIG expiration.
- NSEC or NSEC3 authenticated denial of existence.
- Validation through a DNSSEC-validating resolver after the parent DS is published.

`dig @server ... +dnssec +norecurse` confirms that the authoritative server responds with DNSSEC material. It does not prove that the parent-to-child DNSSEC chain validates. Use `delv` for ICANN DNS or an HNS-aware validating resolver for HNS names.

## Generic zone file

Use this when the admin will adapt the result to BIND, Knot, NSD, or a provider import tool.

The generic output includes SOA/NS/A/AAAA/TLSA records, an operational
checklist, and—only for an in-zone delegated HNS nameserver—an RFC 9461 SVCB
record advertising authoritative DoH. The admin must still configure the
daemon, disable recursion, open UDP/TCP 53, sign the zone, publish DS, and
validate the chain. The SVCB record must not be published until a real RFC
8484 endpoint is available on the advertised nameserver's HTTPS port 443.

## Hosted DNS provider panel

Good when the site already uses hosted DNS. The provider must support authoritative DNS hosting, DNSSEC signing, DS or DNSKEY export, and custom TLSA records.

Also confirm the provider signs TLSA records, refreshes signatures, serves authenticated denial records, and exposes enough DNSSEC status to diagnose validation failures.

## PowerDNS Authoritative

Good for database/API workflows. Create the zone, add NS/A/AAAA/TLSA records, enable DNSSEC, then publish the DS at the parent.

Keep PowerDNS Authoritative separate from any recursive resolver. After enabling DNSSEC, confirm DNSKEY, RRSIG, NSEC/NSEC3, and parent DS validation before relying on DANE.

## Knot DNS

Good modern default when the admin wants automatic signing with concise config.

Knot can automate signing policy, but the operator still needs to monitor RRSIG freshness, parent DS correctness, authoritative reachability, and any secondary nameserver transfer path.

## BIND 9

Useful when the admin is already on a standard Linux DNS stack or needs abundant documentation.

For an authoritative-only BIND service, set recursion policy globally, not in the zone file alone. Keep recursion disabled for public authoritative listeners.

## Windows Server DNS

Useful when the admin already operates Windows Server and wants an elevated PowerShell path for installing DNS, disabling recursion, opening DNS firewall rules, creating records, and signing the zone.

Use the generated PowerShell as a starter. After signing, publish the resulting DS at the HNS wallet or registrar and validate the DNSSEC chain from outside the server.

## NSD

Useful for a small authoritative server. Sign the zone externally, then serve the signed zone.

NSD serves the signed result. The external signer workflow must re-sign before RRSIG expiration and publish a new signed zone whenever the unsigned source changes.
