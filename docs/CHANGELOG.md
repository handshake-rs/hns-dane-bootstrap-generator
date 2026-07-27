# Changelog

## Unreleased

- Added an `authoritative_doh` browser handoff and default HNS delegated guidance for RFC 9461 discovery, its port 53 bootstrap limit, RFC 8484 on HTTPS 443, local DNSSEC/DANE validation, external-nameserver ownership, and the separately pinned implementation-specific HNS parent bootstrap.
- Bumped the Linode StackScript and appliance release pin to `v0.2.1`.
- Updated Vite and Vitest to the latest patch releases and renamed the npm package to `hns-dane-bootstrap-generator`.
- Set the public Linode StackScript default to `2158182` for `HNS DANE One-Name Server`.
- Closed appliance HTTP serving on TCP 80 so the dashboard is exposed only through the HTTPS DANE endpoint.
- Removed stale appliance UFW `80/tcp` allow rules during upgrades.
- Replaced generated HNS authoritative DoH TXT declarations with RFC 9461 `_dns.<nameserver>` SVCB discovery records in the authoritative DNS zone.
- Added dnsdist-backed RFC 8484 `/dns-query` appliance support behind nginx for delegated authoritative nameservers.
- Simplified Linode StackScript setup fields by removing site title and deployment mode, renaming the domain field, and defaulting hsd wallet routing to `primary` / `default`.
- Added explicit `NS` records to appliance HNS resources so new wallet updates replace old delegated resources cleanly.
- Corrected appliance wallet CLI commands to call `hsw-rpc selectwallet` before raw wallet RPC methods such as `sendupdate`.
- Added inline HNS wallet CLI submit commands to the appliance dashboard.
- Fixed generated appliance dashboard contrast in dark-mode browsers by using explicit light-theme colors.
- Added HNS DANE appliance StackScript fields for hsd wallet id and hsd account name, with account-aware `hsw-rpc sendupdate` instructions.
- Removed the experimental HNS `TXT "hnsdns=1;..."` transport declaration from generated HNS resource JSON.
- Replaced raw browser base64 decode errors with field-specific PEM/DNSKEY validation messages.
- Clarified the DANE certificate/public-key field as the TLSA source and shows its how-to instructions whenever TLSA is missing.
- Added production DANE/DNSSEC guidance for validation, authoritative nameserver hardening, DNSSEC lifecycle, TLSA rollover, client enforcement, service scope, and pasted-input correctness.
- Expanded generated verification commands to distinguish direct authoritative answers from DNSSEC chain validation with `delv`, AD-bit checks, and HNS-aware resolver checks.
- Added generated web-server notes for TLSA current/next key rollover and DANE client-support limits.
- Added authoritative-server operational checklists to server presets.
- Added hosted DNS provider preset for web admins using a DNS host instead of running an authoritative daemon.
- Added Windows Server DNS preset and Debian/Windows OS quick starts for delegated authoritative DANE and HNS SYNTH nameserver setup.
- Linked the OS quick starts from the website footer and DNS server preset field so users can find them before generating records.
- Expanded setup-mode guidance with a nameserver hostname walkthrough, glue/DNSSEC/DS/TLSA placement, and provider-specific DNSSEC/TLSA caveats.
- Added IDNA normalization for internationalized domain input and documented i18n standards.
- Expanded new-admin FAQ coverage for DNSKEY timing, parent/server record split, TLSA provider support, and DANE web-server requirements.
- Removed the DANE basic/advanced toggle, made optional fields visible by default, always shows integrator JSON, and added focused field-level "How to get this" help for certificate/PUBLIC KEY and DNSKEY inputs.
- Audited the "How to get this" command examples so certificate and DNSKEY help updates with the current domain, website IP, nameserver, and HTTPS port.
- Added UI localization with a persisted language selector for English, Spanish, French, German, Portuguese, Japanese, Arabic, Persian, and Hebrew.
- Localized generated guidance, notices, setup-status details, output explanations, web-server notes, and help tips through a result-localization pass.

## 0.2.1

- Refactored the scaffold into a focused first production version.
- Added output sections for verification commands and optional integrator JSON.
- Added NSD preset.
- Hardened DNSKEY parsing for parenthesized/multiline zone-file input.
- Improved TLSA PEM handling and private-key rejection.
- Replaced long visible explanations with concise help text.
- Pinned dependency versions in `package.json`.
- Added tests for integrator output and multiline DNSKEY parsing.

## 0.2.0

- Added the onboarding UI, server presets, Docker/Nginx deployment files, and production docs.

## 0.1.0

- Initial HNS/ICANN DNSSEC + DANE bootstrap scaffold.
