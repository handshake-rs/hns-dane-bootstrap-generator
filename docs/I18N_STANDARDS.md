# Internationalization standards

This project treats internationalization as two related concerns:

1. DNS/mail protocol compatibility, where generated records must keep their required wire format.
2. UI localization, where labels and help text can be translated for web admins.

## Domain names

DNS records remain ASCII on the wire. Human-entered Unicode domain labels must be converted to IDNA ASCII A-labels before they appear in generated DNS records, wallet fields, registrar fields, or server config.

Operational rule:

```text
Unicode input -> IDNA processing -> xn-- A-label DNS output
```

Relevant standards:

- IDNA2008 definitions and framework: [RFC 5890](https://datatracker.ietf.org/doc/html/rfc5890)
- IDNA2008 protocol: [RFC 5891](https://www.rfc-editor.org/info/rfc5891)
- IDNA code point tables: [RFC 5892](https://www.rfc-editor.org/info/rfc5892)
- Right-to-left label rules: [RFC 5893](https://www.rfc-editor.org/info/rfc5893)
- IDNA rationale and registry advice: [RFC 5894](https://www.rfc-editor.org/rfc/rfc5894.html)
- Punycode A-label encoding: [RFC 3492](https://datatracker.ietf.org/doc/html/rfc3492)
- Compatibility mapping used by browsers and URL implementations: [Unicode UTS #46](https://unicode.org/reports/tr46/)

## App policy

- Accept Unicode domain input when the browser/URL implementation can convert it.
- Generate DNS owner names only in ASCII A-label form.
- Show an informational notice when Unicode input is converted.
- Do not mix Unicode labels into zone files, wallet fields, registrar fields, or verification commands.
- Keep right-to-left and script-confusable safety decisions with registries, wallets, and domain policy tooling. This app only emits deterministic DNS bootstrap output.

## UI localization

The app ships a small static localization table for the main UI shell:

- English
- Spanish
- French
- German
- Portuguese
- Japanese
- Arabic
- Persian
- Hebrew

Localized UI includes field labels, short help text, setup status labels,
generated guidance, notices, output explanations, field-level hints, and
"How to get this" explanations. DNS records, command snippets, JSON, DNS
keywords, record types, and generated machine-readable values are not
translated. Output remains selectable plain text; the app does not expose
browser clipboard actions.

The selected language is stored in local browser storage and applied to the document `lang` attribute. Arabic, Persian, and Hebrew also set the document `dir` attribute to `rtl`; generated DNS records and command snippets remain left-to-right for copy safety.

## Email internationalization

Email address internationalization is out of scope for the current web/DANE flow. It becomes relevant if the app adds MX, SMTP DANE, or mail-server presets.

Relevant standards:

- Internationalized email framework: [RFC 6530](https://datatracker.ietf.org/doc/html/rfc6530)
- SMTPUTF8 transport extension: [RFC 6531](https://datatracker.ietf.org/doc/html/rfc6531)
- UTF-8 email headers: [RFC 6532](https://www.rfc-editor.org/info/rfc6532/)
- Internationalized delivery status notifications: [RFC 6533](https://www.rfc-editor.org/info/rfc6533)

## Deferred i18n work

- Unicode display-name preservation next to generated A-label output.
- Registry-specific IDN policy checks.
- Confusable-character warnings.
- Mail presets using SMTPUTF8 and SMTP DANE.
