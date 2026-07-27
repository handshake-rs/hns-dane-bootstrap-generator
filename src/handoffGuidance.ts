export interface HandoffGuidance {
  badge: string;
  title: string;
  body: string;
  next: string[];
}

function normalizeIntent(intent: string): string {
  return intent.trim().toLowerCase().replaceAll('_', '-');
}

const GUIDANCE: Record<string, HandoffGuidance> = {
  'generate-tlsa': {
    badge: 'HNScrawler handoff',
    title: 'Generate TLSA next',
    body: 'HNScrawler found DNSSEC material but no verified DANE result. Fill in the current HTTPS certificate or public key to generate TLSA 3 1 1.',
    next: ['Confirm the domain and nameserver fields.', 'Paste the current certificate or PUBLIC KEY.', 'Copy the TLSA record to authoritative DNS, then verify.']
  },
  'missing-glue': {
    badge: 'HNScrawler handoff',
    title: 'Fix nameserver bootstrap',
    body: 'HNScrawler found delegation that cannot be bootstrapped in strict HNS yet. Add the authoritative nameserver IP address so GLUE or SYNTH records can be generated.',
    next: ['Confirm the nameserver hostname.', 'Add at least one nameserver IPv4 or IPv6 address.', 'Publish the generated parent-side records through the wallet.']
  },
  'authoritative-doh': {
    badge: 'HNS browser handoff',
    title: 'Configure authoritative DoH on HTTPS 443',
    body: 'A DNSSEC-signed RFC 9461 _dns.<NS> SVCB record is the standards-based way to advertise RFC 8484 DoH on HTTPS 443, but the browser normally discovers that record through authoritative port 53. It cannot bootstrap itself when port 53 is completely intercepted.',
    next: [
      'Confirm who operates the delegated nameserver.',
      'For an in-zone nameserver you operate, serve /dns-query on HTTPS 443 and publish the generated _dns.<NS> SVCB record in the signed authoritative zone.',
      'For an external nameserver, ask its operator to publish _dns.<NS>, or adopt an in-zone DoH-capable nameserver; the site owner cannot publish records inside the external nameserver’s zone.',
      'For a standalone bypass of completely intercepted port 53, the browser also supports a non-standard, implementation-specific HNS parent TXT declaration using hnsdns=1, proven nameserver glue, and a TLSA 3 1 1 pin for the DoH endpoint.',
      'Supply the actual DoH endpoint hostname and its independently measured SPKI SHA-256 pin before publishing that parent TXT; never publish a placeholder or reuse the website TLSA key by assumption.',
      'Keep client-side DNSSEC chain validation and TLSA/DANE verification enabled.'
    ]
  },
  'ds-dnskey-mismatch': {
    badge: 'HNScrawler handoff',
    title: 'Regenerate or check DS',
    body: 'HNScrawler found that the parent-side DS does not match the delegated DNSKEY. Use the current DNSKEY from the signed authoritative zone.',
    next: ['Query or paste the current DNSKEY.', 'Generate the DS record.', 'Replace the stale parent-side DS and re-check DNSSEC.']
  },
  'dnssec-fix': {
    badge: 'HNScrawler handoff',
    title: 'Repair DNSSEC before DANE',
    body: 'HNScrawler found DNSSEC validation trouble. DANE cannot be trusted until the DNSSEC chain validates.',
    next: ['Check DNSKEY, DS, and RRSIG freshness.', 'Generate a corrected DS if the key changed.', 'Verify with the generated commands before adding TLSA.']
  },
  'stale-tlsa': {
    badge: 'HNScrawler handoff',
    title: 'Replace stale TLSA',
    body: 'HNScrawler found TLSA data that does not match the current HTTPS certificate public key.',
    next: ['Paste the currently served certificate or PUBLIC KEY.', 'Generate the new TLSA 3 1 1 value.', 'Publish it on authoritative DNS and keep certificate key reuse in mind.']
  },
  'synth-setup': {
    badge: 'HNScrawler handoff',
    title: 'Complete SYNTH nameserver setup',
    body: 'HNScrawler found SYNTH nameserver bootstrap. Website A/AAAA records and TLSA records still belong on the authoritative DNS server.',
    next: ['Confirm SYNTH nameserver IPs.', 'Add website A/AAAA records to authoritative DNS.', 'Add DNSSEC and TLSA when ready.']
  },
  'dnssec-dane': {
    badge: 'HNScrawler handoff',
    title: 'Plan DNSSEC and DANE',
    body: 'HNScrawler found strict-HNS bootstrap material. The next adoption step is signing the zone, publishing DS, and adding TLSA.',
    next: ['Confirm authoritative DNS settings.', 'Enable DNSSEC and generate DS from DNSKEY.', 'Generate TLSA from the HTTPS public key.']
  },
  review: {
    badge: 'HNScrawler handoff',
    title: 'Review setup',
    body: 'HNScrawler opened this name for manual review. Use this generator to build the parent and authoritative DNS records needed for strict HNS and DANE.',
    next: ['Confirm the setup mode.', 'Fill missing nameserver and website fields.', 'Generate records and run the verification commands.']
  }
};

export function guidanceForIntent(intent: string): HandoffGuidance | null {
  const normalized = normalizeIntent(intent);
  if (!normalized) return null;
  return GUIDANCE[normalized] ?? {
    badge: 'HNScrawler handoff',
    title: 'Continue setup',
    body: 'HNScrawler opened this generator with a report-specific next-step hint.',
    next: ['Review the prefilled domain and mode.', 'Fill any missing nameserver, website, DNSKEY, and certificate fields.', 'Generate records and verify before publishing.']
  };
}
