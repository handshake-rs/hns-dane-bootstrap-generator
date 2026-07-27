import type { BootstrapInput, BootstrapNotice, BootstrapResult, DnsServerPreset, DsRecord, GeneratedLine, HnsParentRecordDraft, OutputSection, StatusCheck } from './types';
import { displayDomain, isInBailiwick, normalizeDomain, normalizeHostname, synthNameserverName, tlsaOwnerName, validateDomainName, validateHostname, validateIpv4, validateIpv6, validateTtl } from './domain';
import { dnskeyWarnings, formatDsRecord, generateDsRecord } from './dnssec';
import { DNS_SERVER_PRESETS, generateServerPreset, recommendedPresetTip, serverPresetLabel, serverPresetTabLabel, type ServerPresetInput } from './serverPresets';
import { generateTlsaRecord } from './tlsa';

function optionalLine(condition: boolean, line: GeneratedLine): GeneratedLine[] {
  return condition ? [line] : [];
}

function check(label: string, status: StatusCheck['status'], detail: string): StatusCheck {
  return { label, status, detail };
}

function notice(severity: BootstrapNotice['severity'], message: string): BootstrapNotice {
  return { severity, message };
}

function nonEmpty(value?: string): value is string {
  return Boolean(value?.trim());
}

function containsNonAscii(value?: string): boolean {
  return Boolean(value && /[^\x00-\x7F]/.test(value));
}

function stripRecordPrefix(record: string, prefix: string): string {
  return record.startsWith(prefix) ? record.slice(prefix.length) : record;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function estimateHnsResourceSize(records: HnsParentRecordDraft[]): number {
  return new TextEncoder().encode(JSON.stringify({ records })).length;
}

function dsToDraft(ds: DsRecord): HnsParentRecordDraft {
  return {
    type: 'DS',
    keyTag: ds.keyTag,
    algorithm: ds.algorithm,
    digestType: ds.digestType,
    digest: ds.digestHex
  };
}

function validateInputs(input: BootstrapInput, domain: string): BootstrapNotice[] {
  const notices: BootstrapNotice[] = [];

  if (!validateDomainName(domain)) notices.push(notice('error', 'Domain format is not valid for DNS output.'));
  if (containsNonAscii(input.domainInput) || containsNonAscii(input.nameserverHost)) {
    notices.push(notice('info', 'Internationalized domain input is converted to DNS ASCII A-labels such as xn--... in generated records.'));
  }
  if (!validateTtl(input.ttl ?? 3600)) notices.push(notice('warning', 'TTL should normally be between 60 and 86400 seconds.'));

  if (input.setupMode === 'hns-inline' && input.domainType !== 'hns') {
    notices.push(notice('warning', 'SYNTH nameserver mode is HNS-only. ICANN output uses named DNS delegation.'));
  }

  if (nonEmpty(input.websiteIpv4) && !validateIpv4(input.websiteIpv4)) notices.push(notice('error', 'Website IPv4 address is not valid.'));
  if (nonEmpty(input.websiteIpv6) && !validateIpv6(input.websiteIpv6)) notices.push(notice('error', 'Website IPv6 address is not valid.'));
  if (nonEmpty(input.nameserverIpv4) && !validateIpv4(input.nameserverIpv4)) notices.push(notice('error', 'Nameserver IPv4 address is not valid.'));
  if (nonEmpty(input.nameserverIpv6) && !validateIpv6(input.nameserverIpv6)) notices.push(notice('error', 'Nameserver IPv6 address is not valid.'));

  if (input.setupMode === 'delegated') {
    if (!nonEmpty(input.nameserverHost)) notices.push(notice('error', 'Delegated mode needs a nameserver hostname.'));
    else if (!validateHostname(input.nameserverHost)) notices.push(notice('error', 'Nameserver hostname is not valid.'));
  }

  if (input.setupMode === 'hns-inline' && input.domainType === 'hns' && !nonEmpty(input.nameserverIpv4) && !nonEmpty(input.nameserverIpv6)) {
    notices.push(notice('error', 'HNS SYNTH mode needs at least one nameserver IP address.'));
  }

  if (!nonEmpty(input.websiteIpv4) && !nonEmpty(input.websiteIpv6)) notices.push(notice('error', 'No website IPv4 or IPv6 address was supplied.'));

  if (input.setupMode === 'delegated' && nonEmpty(input.nameserverHost) && isInBailiwick(input.nameserverHost, domain) && !nonEmpty(input.nameserverIpv4) && !nonEmpty(input.nameserverIpv6)) {
    notices.push(notice('error', 'The nameserver is inside the same zone, so glue is required. Add at least one nameserver IP address.'));
  }

  if (nonEmpty(input.dnskeyInput)) {
    try {
      dnskeyWarnings(input.dnskeyInput).forEach((message) => notices.push(notice('warning', message)));
    } catch {
      // DS generation will produce the exact parser message.
    }
  }

  if (!nonEmpty(input.dnskeyInput) && nonEmpty(input.pemInput) && ['delegated', 'hns-inline'].includes(input.setupMode)) {
    notices.push(notice('warning', 'TLSA is generated, but DNSSEC is incomplete until you publish a parent-side DS record.'));
  }

  if (input.tlsaUsage !== undefined && input.tlsaUsage !== 3) {
    notices.push(notice('warning', 'TLSA usage 3 is the default for this onboarding flow. Other usages are advanced and depend on CA/TA handling.'));
  }

  return notices;
}

function rootless(name: string): string {
  return name.endsWith('.') ? name.slice(0, -1) : name;
}

function authoritativeDohSvcbOwner(ns: string): string {
  return `_dns.${ns}`;
}

function authoritativeDohSvcbRecord(ns: string, ttl: number): GeneratedLine {
  return {
    value: `${authoritativeDohSvcbOwner(ns)} ${ttl} IN SVCB 1 ${ns} alpn=h2 dohpath=/dns-query{?dns}`,
    explanation: 'RFC 9461 DNS-server SVCB record advertising the nameserver RFC 8484 DoH endpoint. With h2 and no explicit port parameter, DoH uses HTTPS 443. Publish this in the signed authoritative DNS zone, not in the HNS parent resource; clients still validate DNSSEC and DANE locally.'
  };
}

function authoritativeDohGuidance(domainType: BootstrapInput['domainType'], setupMode: BootstrapInput['setupMode'], domain: string, nameserver: string, inBailiwickNameserver: boolean): GeneratedLine[] {
  if (domainType !== 'hns' || setupMode !== 'delegated') return [];

  const owner = authoritativeDohSvcbOwner(nameserver);
  const endpoint = `https://${rootless(nameserver)}/dns-query`;
  const bootstrapLine: GeneratedLine = {
    value: `Bootstrap limit: the browser normally queries ${owner} through authoritative port 53, so this SVCB record alone cannot recover when port 53 is completely intercepted; it becomes usable only after an authenticated DNS path can retrieve it.`,
    explanation: 'Direct authoritative DNS, an opted-in proof-backed relay, or an explicitly configured recursive HNS DoH path must first authenticate the signed SVCB response.'
  };
  const validationLine: GeneratedLine = {
    value: 'Validation remains local: authoritative DoH carries DNS messages over HTTPS; the client must still validate the HNS/DNSSEC chain and enforce TLSA/DANE.',
    explanation: 'Do not treat the DoH server as a trusted recursive validator. Its response is authenticated by the same local DNSSEC and DANE policy as a direct authoritative answer.'
  };

  if (inBailiwickNameserver) {
    return [
      {
        value: `Discovery: publish the generated DNSSEC-signed RFC 9461 record at ${owner}.`,
        explanation: `The signed ${domain} zone controls ${owner}, so the name owner can publish this service binding.`
      },
      {
        value: `Transport: serve RFC 8484 at ${endpoint} over HTTPS on TCP 443 with a certificate valid for ${rootless(nameserver)}.`,
        explanation: 'The generated SVCB record advertises alpn=h2 and dohpath=/dns-query{?dns}. RFC 9461 assigns DoH its default HTTPS port 443 when the port parameter is omitted.'
      },
      bootstrapLine,
      validationLine
    ];
  }

  return [
    {
      value: `External nameserver ownership: ${nameserver} controls ${owner}; the ${rootless(domain)}/ owner cannot publish that record inside the external nameserver’s zone.`,
      explanation: 'The DNS operator that controls the nameserver hostname must publish and DNSSEC-sign its RFC 9461 service binding.'
    },
    {
      value: `Standards path: ask the ${nameserver} operator to serve RFC 8484 at ${endpoint} on HTTPS 443 and publish ${owner}, or adopt an in-zone DoH-capable nameserver you control.`,
      explanation: 'Changing records in the website zone cannot authenticate a service binding whose owner name belongs to an external nameserver zone.'
    },
    bootstrapLine,
    validationLine
  ];
}

function defaultHelpTips(domainType: BootstrapInput['domainType'], setupMode: BootstrapInput['setupMode'], preset: DnsServerPreset, domain: string, nameserver: string, inBailiwickNameserver: boolean): string[] {
  const tips = [
    'Fastest reliable path: create the authoritative zone, enable DNSSEC signing, paste DNSKEY here, then copy the generated DS to the wallet or registrar.',
    recommendedPresetTip(preset),
    'TLSA 3 1 1 pins the service public key with SHA-256. Certificate renewal can be easy if the server keeps the same keypair.',
    'Parent records and server records are different. The wallet or registrar delegates. The DNS server publishes the site records and TLSA.',
    'Internationalized names are accepted as input, but DNS records use IDNA A-labels such as xn--bcher-kva.example.'
  ];

  if (domainType === 'hns' && setupMode === 'delegated') {
    tips.push(`For HNS delegated mode, GLUE4/GLUE6 is needed when the nameserver lives under the HNS name itself, such as ${nameserver} for ${rootless(domain)}/.`);
    if (inBailiwickNameserver) {
      tips.push(`Serve RFC 8484 at https://${rootless(nameserver)}/dns-query on HTTPS 443 and publish the DNSSEC-signed RFC 9461 DNS-server SVCB record ${authoritativeDohSvcbOwner(nameserver)}. The browser normally retrieves that record through authoritative port 53, so it is not a standalone bootstrap when port 53 is completely intercepted. The alternate transport does not replace local DNSSEC or DANE validation.`);
    } else {
      tips.push(`${nameserver} is external, so its operator controls ${authoritativeDohSvcbOwner(nameserver)}. Ask that operator to publish RFC 9461 discovery for RFC 8484 on HTTPS 443, or adopt an in-zone DoH-capable nameserver; the site owner cannot publish the external nameserver’s record. The browser normally discovers SVCB through port 53, so the record alone cannot bootstrap complete port 53 interception. DNSSEC and DANE validation remain local.`);
    }
  }

  if (setupMode === 'hns-inline') {
    tips.push('HNS SYNTH mode stores nameserver IPs in the HNS resource. Website A/AAAA records and TLSA records still live on the authoritative DNS server.');
  }

  return tips;
}

function buildQuickSteps(input: BootstrapInput, effectiveMode: BootstrapInput['setupMode'], hasDs: boolean, hasTlsa: boolean): GeneratedLine[] {
  if (effectiveMode === 'hns-inline') {
    return [
      { value: '1. Put the server records on the authoritative DNS server.', explanation: 'SYNTH points resolvers to nameserver IPs; the zone still serves website A/AAAA records and TLSA records.' },
      { value: '2. Enable DNSSEC signing on the zone.', explanation: 'The DNS server should manage the signing keys and signed zone.' },
      { value: hasDs ? '3. Send SYNTH and DS records to the HNS wallet.' : '3. Paste the DNSKEY here, then send SYNTH and DS records to the HNS wallet.', explanation: 'SYNTH is the parent-side referral; DS connects DNSSEC to the signed zone.' },
      { value: hasTlsa ? '4. Serve the matching HTTPS certificate/key.' : '4. Paste the leaf certificate or PUBLIC KEY to generate TLSA.', explanation: 'TLSA goes on the authoritative DNS server.' }
    ];
  }

  return [
    { value: '1. Put the server records on the authoritative DNS server.', explanation: 'Use the selected server preset or the generic zone-file output.' },
    { value: '2. Enable DNSSEC signing on the zone.', explanation: 'The DNS server should manage the signing keys and signed zone.' },
    { value: hasDs ? '3. Copy the DS into the wallet or registrar.' : '3. Paste the DNSKEY here, then copy the generated DS into the wallet or registrar.', explanation: 'The DS connects the parent layer to the signed child zone.' },
    { value: hasTlsa ? '4. Serve the matching HTTPS certificate/key.' : '4. Paste the leaf certificate or PUBLIC KEY to generate TLSA.', explanation: 'TLSA goes on the authoritative DNS server.' },
    { value: input.domainType === 'hns' ? '5. Submit the HNS name-resource update.' : '5. Save registrar nameserver, glue, and DS settings.', explanation: 'This activates the parent-side delegation path.' }
  ];
}

function buildStatusChecks(input: BootstrapInput, effectiveMode: BootstrapInput['setupMode'], inBailiwickNameserver: boolean, hasDs: boolean, hasTlsa: boolean): StatusCheck[] {
  const checks: StatusCheck[] = [
    check('Domain', input.domainInput.trim() ? 'ok' : 'missing', input.domainInput.trim() ? 'Domain is normalized for DNS output.' : 'Enter the HNS name or ICANN domain.'),
    check('Website IP', nonEmpty(input.websiteIpv4) || nonEmpty(input.websiteIpv6) ? 'ok' : 'missing', nonEmpty(input.websiteIpv4) || nonEmpty(input.websiteIpv6) ? 'Website A/AAAA records can be generated.' : 'Add at least one website IPv4 or IPv6 address.')
  ];

  if (effectiveMode === 'hns-inline') {
    checks.push(check('Nameserver', nonEmpty(input.nameserverIpv4) || nonEmpty(input.nameserverIpv6) ? 'ok' : 'missing', nonEmpty(input.nameserverIpv4) || nonEmpty(input.nameserverIpv6) ? 'SYNTH nameserver IP can be generated.' : 'Add at least one nameserver IPv4 or IPv6 address.'));
    checks.push(check('DS', hasDs ? 'ok' : 'missing', hasDs ? 'Parent-side DS is generated from DNSKEY.' : 'Paste DNSKEY after signing the authoritative zone.'));
    checks.push(check('TLSA', hasTlsa ? 'ok' : 'missing', hasTlsa ? 'TLSA is generated from certificate/public key.' : 'Paste a certificate or PUBLIC KEY in the DANE section to generate TLSA.'));
    return checks;
  }

  checks.push(check('Nameserver', nonEmpty(input.nameserverHost) ? 'ok' : 'missing', nonEmpty(input.nameserverHost) ? 'Delegation target is present.' : 'Add the authoritative nameserver hostname.'));
  checks.push(check('Glue', inBailiwickNameserver ? (nonEmpty(input.nameserverIpv4) || nonEmpty(input.nameserverIpv6) ? 'ok' : 'missing') : 'ok', inBailiwickNameserver ? 'Nameserver is inside the zone, so glue must be in the parent records.' : 'Nameserver is external, so glue is handled by its own parent.'));
  checks.push(check('DS', hasDs ? 'ok' : 'missing', hasDs ? 'Parent-side DS is generated from DNSKEY.' : 'Paste DNSKEY after signing the authoritative zone.'));
  checks.push(check('TLSA', hasTlsa ? 'ok' : 'missing', hasTlsa ? 'TLSA is generated from certificate/public key.' : 'Paste a certificate or PUBLIC KEY in the DANE section to generate TLSA.'));

  return checks;
}

function buildVerificationCommands(input: BootstrapInput, effectiveMode: BootstrapInput['setupMode'], domain: string, ns: string, owner: string): GeneratedLine[] {
  const addressType = input.websiteIpv4 ? 'A' : input.websiteIpv6 ? 'AAAA' : 'A';

  if (effectiveMode === 'hns-inline') {
    return [{
      value: [
        `dig @${input.nameserverIpv4 || input.nameserverIpv6 || '<nameserver-ip>'} ${domain} SOA +norecurse`,
        ...(input.websiteIpv4 ? [`dig @${input.nameserverIpv4 || input.nameserverIpv6 || '<nameserver-ip>'} ${domain} A +dnssec +norecurse`] : []),
        ...(input.websiteIpv6 ? [`dig @${input.nameserverIpv4 || input.nameserverIpv6 || '<nameserver-ip>'} ${domain} AAAA +dnssec +norecurse`] : []),
        `dig @${input.nameserverIpv4 || input.nameserverIpv6 || '<nameserver-ip>'} ${owner} TLSA +dnssec +norecurse`,
        '# Direct authoritative queries above prove the server answers; they do not prove DNSSEC chain validation.',
        '# After the HNS update confirms, test full-chain resolution with an HNS-aware resolver/browser.',
        `dig @<hns-validating-recursive-resolver> ${domain} ${addressType} +dnssec`,
        `dig @<hns-validating-recursive-resolver> ${owner} TLSA +dnssec`,
        '# Confirm the validating response has status NOERROR and the ad flag; SERVFAIL usually means a broken DNSSEC chain, expired RRSIGs, or parent DS mismatch.'
      ].join('\n'),
      explanation: 'Commands to check that the SYNTH-addressed authoritative server answers before and after the HNS update.'
    }];
  }

  const atServer = input.nameserverIpv4 || input.nameserverIpv6 || ns;
  const lines = [
    `dig @${atServer} ${domain} SOA +norecurse`,
    ...(input.websiteIpv4 ? [`dig @${atServer} ${domain} A +dnssec +norecurse`] : []),
    ...(input.websiteIpv6 ? [`dig @${atServer} ${domain} AAAA +dnssec +norecurse`] : []),
    `dig @${atServer} ${owner} TLSA +dnssec +norecurse`,
    '# Direct authoritative queries above prove the server answers; they do not prove DNSSEC chain validation.',
    input.domainType === 'icann'
      ? [
        `delv ${domain} ${addressType}`,
        `delv ${owner} TLSA`,
        `dig @<validating-recursive-resolver> ${owner} TLSA +dnssec`,
        '# Confirm the validating response has status NOERROR and the ad flag; SERVFAIL usually means a broken DNSSEC chain, expired RRSIGs, or parent DS mismatch.'
      ].join('\n')
      : [
        '# For HNS full-chain tests, query through your HNS-aware resolver after the wallet update confirms.',
        `dig @<hns-validating-recursive-resolver> ${domain} ${addressType} +dnssec`,
        `dig @<hns-validating-recursive-resolver> ${owner} TLSA +dnssec`,
        '# Confirm the validating response has status NOERROR and the ad flag; SERVFAIL usually means a broken DNSSEC chain, expired RRSIGs, or parent DS mismatch.'
      ].join('\n')
  ];

  return [{
    value: lines.join('\n'),
    explanation: 'Commands to check that the authoritative server answers before and after parent-side delegation.'
  }];
}

function buildIntegrationRecord(parentDraft: HnsParentRecordDraft[], input: BootstrapInput, effectiveMode: BootstrapInput['setupMode'], parentRecords: GeneratedLine[], authoritativeRecords: GeneratedLine[]): GeneratedLine[] {
  const payload = input.domainType === 'hns'
    ? {
      type: 'hns-parent-record-draft',
      note: 'Use this as an integration schema. Confirm exact wallet/SDK field names before broadcasting.',
      records: parentDraft
    }
    : {
      type: 'icann-parent-record-summary',
      note: 'Registrar panels vary. Use the human-readable parent box for actual entry.',
      records: parentRecords.map((record) => record.value)
    };

  return [{
    value: JSON.stringify({
      mode: effectiveMode,
      parent: payload,
      authoritative: authoritativeRecords.map((record) => record.value)
    }, null, 2),
    explanation: 'Machine-readable output for wallets, future APIs, or integration tests. It is not automatically submitted anywhere.'
  }];
}

function buildHnsWalletCommand(parentDraft: HnsParentRecordDraft[], domain: string): GeneratedLine {
  const name = shellQuote(rootless(domain));
  const resource = parentDraft.length > 0
    ? shellQuote(JSON.stringify({ records: parentDraft }))
    : '<resource-json-from-concrete-parent-records>';

  return {
    value: [
      '# Optional if this name is not in the primary wallet:',
      'hsw-cli rpc selectwallet <wallet-id>',
      '',
      '# Create an UPDATE transaction JSON without broadcasting:',
      `hsw-cli rpc createupdate ${name} ${resource}`,
      '',
      '# Broadcast the UPDATE from the selected wallet:',
      `hsw-cli rpc sendupdate ${name} ${resource}`,
      '',
      '# After mining and a tree interval, inspect the resource seen by hsd:',
      `hsd-cli rpc getnameresource ${name}`
    ].join('\n'),
    explanation: parentDraft.length > 0
      ? 'hsw-cli creates or broadcasts the HNS name UPDATE from the wallet. hsd-cli checks the name resource after confirmation and the tree interval.'
      : 'Fill in concrete NS, GLUE, SYNTH, or DS records before broadcasting an HNS name UPDATE. Do not send an empty records array unless you mean to clear the name resource.',
    presentation: {
      kind: 'hns-wallet-option',
      tabId: 'cli',
      tabLabel: 'hsw-cli / hsd-cli',
      defaultSelected: true
    }
  };
}

function formatHnsRecordForUi(record: HnsParentRecordDraft): string {
  switch (record.type) {
    case 'GLUE4':
    case 'GLUE6':
      return `${record.type}: ns=${record.ns ?? '<nameserver>'} address=${record.address ?? '<address>'}`;
    case 'NS':
      return `NS: ns=${record.ns ?? '<nameserver>'}`;
    case 'SYNTH4':
    case 'SYNTH6':
      return `${record.type}: address=${record.address ?? '<address>'}`;
    case 'DS':
      return `DS: keyTag=${record.keyTag ?? '<keytag>'} algorithm=${record.algorithm ?? '<algorithm>'} digestType=${record.digestType ?? '<digest-type>'} digest=${record.digest ?? '<digest>'}`;
    case 'TXT':
      return `TXT: ${(record.txt ?? ['<text>']).map((value) => `"${value}"`).join(' ')}`;
    default:
      return `Record: ${JSON.stringify(record)}`;
  }
}

function buildShakeWalletExample(parentDraft: HnsParentRecordDraft[], domain: string): string[] {
  if (parentDraft.length === 0) return [];
  const name = JSON.stringify(rootless(domain));
  const records = JSON.stringify(parentDraft, null, 2);

  return [
    '',
    'Shake Wallet dapp/API equivalent:',
    'const wallet = await shake.connect();',
    `const tx = await wallet.sendUpdate(${name}, ${records});`
  ];
}

function hnsUiRecordLines(parentDraft: HnsParentRecordDraft[]): string[] {
  return parentDraft.length > 0
    ? parentDraft.map((record) => `- ${formatHnsRecordForUi(record)}`)
    : ['- Fill in concrete NS, GLUE, SYNTH, or DS records first. Do not submit an empty name resource unless you mean to clear existing records.'];
}

function buildBobWalletOption(parentDraft: HnsParentRecordDraft[], domain: string): GeneratedLine {
  const name = rootless(domain);

  return {
    value: [
      'Bob Wallet desktop UI:',
      `1. Open Bob Wallet and let the node/wallet sync for ${name}.`,
      '2. Open Name Management / Domains, select the name, then open DNS records.',
      '3. Add the concrete HNS parent records below, confirm the wallet prompt, and wait for confirmation plus the tree interval.',
      '',
      'Concrete parent records to enter:',
      ...hnsUiRecordLines(parentDraft)
    ].join('\n'),
    explanation: parentDraft.length > 0
      ? 'Bob Wallet can update the same HNS name resource through its desktop UI. Use the concrete parent records shown here and confirm the wallet prompt before broadcasting.'
      : 'Fill in concrete NS, GLUE, SYNTH, or DS records before using a wallet UI. Do not submit an empty name resource unless you mean to clear existing records.',
    presentation: {
      kind: 'hns-wallet-option',
      tabId: 'bob',
      tabLabel: 'Bob Wallet'
    }
  };
}

function buildShakeWalletOption(parentDraft: HnsParentRecordDraft[], domain: string): GeneratedLine {
  const name = rootless(domain);

  return {
    value: [
      'Shake Wallet / LearnHNS browser wallet UI:',
      `1. Open the extension and unlock the wallet that owns ${name}.`,
      '2. Select the name, open the on-chain records/update view, and add the same concrete records.',
      '3. Confirm the update popup before broadcasting.',
      '',
      'Concrete parent records to enter:',
      ...hnsUiRecordLines(parentDraft),
      ...buildShakeWalletExample(parentDraft, domain)
    ].join('\n'),
    explanation: parentDraft.length > 0
      ? 'Shake Wallet and LearnHNS Wallet can update the same HNS name resource through the browser extension UI. Use the concrete parent records shown here and confirm the wallet prompt before broadcasting.'
      : 'Fill in concrete NS, GLUE, SYNTH, or DS records before using a wallet UI. Do not submit an empty name resource unless you mean to clear existing records.',
    presentation: {
      kind: 'hns-wallet-option',
      tabId: 'shake',
      tabLabel: 'Shake Wallet'
    }
  };
}

function buildAuthoritativeDnsOptions(baseInput: Omit<ServerPresetInput, 'preset'>, selectedPreset: DnsServerPreset): GeneratedLine[] {
  return DNS_SERVER_PRESETS.flatMap((serverPreset) => generateServerPreset({ ...baseInput, preset: serverPreset }).map((line) => ({
    ...line,
    presentation: {
      kind: 'authoritative-dns-option',
      tabId: serverPreset,
      tabLabel: serverPresetTabLabel(serverPreset),
      ...(serverPreset === selectedPreset ? { defaultSelected: true } : {})
    }
  })));
}

function buildSections(result: Omit<BootstrapResult, 'sections'>): OutputSection[] {
  const sections: OutputSection[] = [
    { id: 'parent', title: result.parentTitle, audience: 'parent', lines: result.parentRecords },
    { id: 'authoritative', title: result.authoritativeTitle, audience: 'authoritative', lines: result.authoritativeRecords }
  ];

  if (result.authoritativeDohNotes.length > 0) {
    sections.push({ id: 'authoritative-doh', title: 'Authoritative DoH on HTTPS 443', audience: 'authoritative', lines: result.authoritativeDohNotes, compact: true });
  }
  sections.push({ id: 'verify', title: result.verificationTitle, audience: 'verify', lines: result.verificationCommands, compact: true });
  sections.push({ id: 'web', title: 'Web server note', audience: 'web', lines: result.webServerNotes, compact: true });
  sections.push({ id: 'integrator', title: result.integrationTitle, audience: 'integrator', lines: result.integrationRecords });
  return sections;
}

export async function generateBootstrap(input: BootstrapInput): Promise<BootstrapResult> {
  const ttl = input.ttl ?? 3600;
  const preset = input.dnsServerPreset ?? 'generic-zone';
  const normalizedDomain = normalizeDomain(input.domainInput, input.domainType);
  const readableDomain = displayDomain(input.domainInput, input.domainType);
  const effectiveMode = input.domainType === 'icann' && input.setupMode === 'hns-inline' ? 'delegated' : input.setupMode;
  const owner = tlsaOwnerName(normalizedDomain, input.port, input.protocol);
  const notices = validateInputs({ ...input, setupMode: effectiveMode, ttl }, normalizedDomain);

  const parentRecords: GeneratedLine[] = [];
  const authoritativeRecords: GeneratedLine[] = [];
  const parentDraft: HnsParentRecordDraft[] = [];
  const webServerNotes: GeneratedLine[] = [];

  let tlsaRecord: string | undefined;
  let dsRecordText: string | undefined;
  let dsRecord: DsRecord | undefined;
  let inBailiwickNameserver = false;
  let ns = 'ns1.dane.';
  let authoritativeNsHosts: string[] = [];

  if (nonEmpty(input.pemInput)) {
    try {
      tlsaRecord = await generateTlsaRecord({
        pemInput: input.pemInput,
        ownerName: owner,
        ttl,
        usage: input.tlsaUsage ?? 3,
        selector: input.tlsaSelector ?? 1,
        matchingType: input.tlsaMatchingType ?? 1
      });
    } catch (error) {
      notices.push(notice('error', error instanceof Error ? error.message : 'Unable to generate TLSA record.'));
    }
  }

  if (nonEmpty(input.dnskeyInput)) {
    try {
      dsRecord = await generateDsRecord(normalizedDomain, input.dnskeyInput, input.dsDigestType ?? 2);
      dsRecordText = formatDsRecord(dsRecord);
    } catch (error) {
      notices.push(notice('error', error instanceof Error ? error.message : 'Unable to generate DS record from DNSKEY input.'));
    }
  }

  if (effectiveMode === 'hns-inline') {
    let hasSynthRecord = false;
    if (nonEmpty(input.nameserverIpv4) && validateIpv4(input.nameserverIpv4)) {
      parentRecords.push({ value: `SYNTH4 ${input.nameserverIpv4}`, explanation: 'HNS wallet-side synthetic IPv4 nameserver referral.' });
      parentDraft.push({ type: 'SYNTH4', address: input.nameserverIpv4 });
      authoritativeNsHosts.push(synthNameserverName(input.nameserverIpv4));
      hasSynthRecord = true;
    }
    if (nonEmpty(input.nameserverIpv6) && validateIpv6(input.nameserverIpv6)) {
      parentRecords.push({ value: `SYNTH6 ${input.nameserverIpv6}`, explanation: 'HNS wallet-side synthetic IPv6 nameserver referral.' });
      parentDraft.push({ type: 'SYNTH6', address: input.nameserverIpv6 });
      authoritativeNsHosts.push(synthNameserverName(input.nameserverIpv6));
      hasSynthRecord = true;
    }
    if (!hasSynthRecord) {
      parentRecords.push({ value: 'SYNTH4 <nameserver-ipv4>', explanation: 'Placeholder: add at least one nameserver IPv4 or IPv6 address to generate a concrete HNS SYNTH referral before the DS record.' });
    }
    ns = authoritativeNsHosts[0] ?? ns;
    if (dsRecord && dsRecordText) {
      parentRecords.push({ value: dsRecordText, explanation: 'HNS wallet-side DNSSEC delegation signer record derived from the child-zone DNSKEY.' });
      parentDraft.push(dsToDraft(dsRecord));
    } else {
      parentRecords.push({ value: 'DS <keytag> <algorithm> 2 <sha256-digest>', explanation: 'Placeholder: paste your authoritative-zone DNSKEY to generate the exact parent-side DS record.' });
    }
  } else {
    ns = input.nameserverHost ? normalizeHostname(input.nameserverHost) : `ns1.${normalizedDomain}`;
    inBailiwickNameserver = input.nameserverHost ? isInBailiwick(ns, normalizedDomain) : true;
    authoritativeNsHosts = [ns];

    if (input.domainType === 'hns') {
      let hasConcreteNameserverBootstrap = !inBailiwickNameserver;
      parentRecords.push({ value: `NS ${ns}`, explanation: 'HNS wallet-side delegation record naming your authoritative nameserver.' });
      if (inBailiwickNameserver) {
        let hasGlueRecord = false;
        if (nonEmpty(input.nameserverIpv4)) {
          parentRecords.push({ value: `GLUE4 ${ns} ${input.nameserverIpv4}`, explanation: 'HNS wallet-side glue record for the IPv4 address of your in-name authoritative nameserver.' });
          parentDraft.push({ type: 'GLUE4', ns, address: input.nameserverIpv4 });
          hasGlueRecord = true;
          hasConcreteNameserverBootstrap = true;
        }
        if (nonEmpty(input.nameserverIpv6)) {
          parentRecords.push({ value: `GLUE6 ${ns} ${input.nameserverIpv6}`, explanation: 'HNS wallet-side glue record for the IPv6 address of your in-name authoritative nameserver.' });
          parentDraft.push({ type: 'GLUE6', ns, address: input.nameserverIpv6 });
          hasGlueRecord = true;
          hasConcreteNameserverBootstrap = true;
        }
        if (!hasGlueRecord) {
          const placeholderHost = nonEmpty(input.nameserverHost) ? ns : '<nameserver-host>';
          parentRecords.push({ value: `GLUE4 ${placeholderHost} <nameserver-ipv4>`, explanation: 'Placeholder: delegated HNS needs an NS or GLUE referral before the DS record. If the nameserver is inside this name, add GLUE4 or GLUE6 with its address; if it is external, use an NS record.' });
        }
      }
      if (hasConcreteNameserverBootstrap) {
        parentDraft.unshift({ type: 'NS', ns });
      }
      if (dsRecord && dsRecordText) {
        parentRecords.push({ value: dsRecordText, explanation: 'HNS wallet-side DNSSEC delegation signer record derived from the child-zone DNSKEY.' });
        parentDraft.push(dsToDraft(dsRecord));
      } else {
        parentRecords.push({ value: 'DS <keytag> <algorithm> 2 <sha256-digest>', explanation: 'Placeholder: paste your authoritative-zone DNSKEY to generate the exact parent-side DS record.' });
      }
    } else {
      parentRecords.push({ value: `Nameserver: ${ns}`, explanation: 'Registrar-side nameserver delegation.' });
      parentRecords.push(
        ...optionalLine(inBailiwickNameserver && nonEmpty(input.nameserverIpv4), {
          value: `Glue IPv4: ${input.nameserverIpv4}`,
          explanation: 'Registrar-side glue is needed because the nameserver is inside the delegated domain.'
        }),
        ...optionalLine(inBailiwickNameserver && nonEmpty(input.nameserverIpv6), {
          value: `Glue IPv6: ${input.nameserverIpv6}`,
          explanation: 'Registrar-side IPv6 glue is needed because the nameserver is inside the delegated domain.'
        })
      );
      parentRecords.push({
        value: dsRecordText ? `DS: ${stripRecordPrefix(dsRecordText, 'DS ')}` : 'DS: <keytag> <algorithm> 2 <sha256-digest>',
        explanation: dsRecordText ? 'Registrar-side DS record derived from the child-zone DNSKEY.' : 'Placeholder: paste your authoritative-zone DNSKEY to generate the exact registrar-side DS record.'
      });
    }

  }

  if (input.domainType === 'hns') {
    parentRecords.push(buildHnsWalletCommand(parentDraft, normalizedDomain));
    parentRecords.push(buildBobWalletOption(parentDraft, normalizedDomain));
    parentRecords.push(buildShakeWalletOption(parentDraft, normalizedDomain));
  }

  if (effectiveMode === 'delegated' || effectiveMode === 'hns-inline') {
    authoritativeNsHosts.forEach((nameserver) => {
      authoritativeRecords.push({ value: `${normalizedDomain} ${ttl} IN NS ${nameserver}`, explanation: 'Authoritative-zone NS record naming a server responsible for this zone.' });
    });
    authoritativeRecords.push(
      ...optionalLine(nonEmpty(input.websiteIpv4), {
        value: `${normalizedDomain} ${ttl} IN A ${input.websiteIpv4}`,
        explanation: 'Authoritative-zone IPv4 address for the website apex.'
      }),
      ...optionalLine(nonEmpty(input.websiteIpv6), {
        value: `${normalizedDomain} ${ttl} IN AAAA ${input.websiteIpv6}`,
        explanation: 'Authoritative-zone IPv6 address for the website apex.'
      })
    );

    if (tlsaRecord) authoritativeRecords.push({ value: tlsaRecord, explanation: 'Authoritative-zone DANE/TLSA record for the TLS service.' });
    else authoritativeRecords.push({ value: `${owner} ${ttl} IN TLSA 3 1 1 <spki-sha256>`, explanation: 'Placeholder: paste a PEM certificate or PUBLIC KEY to generate the exact TLSA association data.' });

    if (input.domainType === 'hns' && isInBailiwick(ns, normalizedDomain)) {
      authoritativeRecords.push(authoritativeDohSvcbRecord(ns, ttl));
    }
  }

  webServerNotes.push({
    value: 'Serve the certificate whose public key matches the TLSA SPKI hash.',
    explanation: 'If the certificate key changes, publish the new TLSA record before switching the web server to the new key.'
  });
  webServerNotes.push({
    value: 'For key rollover, publish current and next TLSA records, wait at least one TTL, switch the server key, then remove the old TLSA after another TTL.',
    explanation: 'TLSA 3 1 1 pins the service public key, so DANE clients can fail while caches still hold only the old association.'
  });
  webServerNotes.push({
    value: 'Nginx/Apache/Caddy do not need a DANE plugin; DANE lives in DNS.',
    explanation: 'The TLS server serves a normal certificate. A DANE-aware client verifies the DNSSEC-protected TLSA record.'
  });
  webServerNotes.push({
    value: 'DANE is enforced only by clients that validate DNSSEC and check TLSA records; ordinary HTTPS clients may ignore the published TLSA policy.',
    explanation: 'Publishing TLSA is necessary for DANE, but client software must actually perform DNSSEC validation and DANE authentication.'
  });

  const serverPresetInput: Omit<ServerPresetInput, 'preset'> | undefined = effectiveMode === 'delegated' || effectiveMode === 'hns-inline'
    ? {
      domain: normalizedDomain,
      nameserverHost: ns,
      nameserverHosts: authoritativeNsHosts,
      ...(input.nameserverIpv4 !== undefined ? { nameserverIpv4: input.nameserverIpv4 } : {}),
      ...(input.nameserverIpv6 !== undefined ? { nameserverIpv6: input.nameserverIpv6 } : {}),
      ttl,
      tlsaOwner: owner,
      ...(input.websiteIpv4 !== undefined ? { websiteIpv4: input.websiteIpv4 } : {}),
      ...(input.websiteIpv6 !== undefined ? { websiteIpv6: input.websiteIpv6 } : {}),
      ...(tlsaRecord !== undefined ? { tlsaRecord } : {})
    }
    : undefined;
  const serverPresetRecords = serverPresetInput ? generateServerPreset({ ...serverPresetInput, preset }) : [];
  const authoritativeDnsOptions = serverPresetInput ? buildAuthoritativeDnsOptions(serverPresetInput, preset) : [];

  const hasDs = Boolean(dsRecordText);
  const hasTlsa = Boolean(tlsaRecord);
  const statusChecks = buildStatusChecks(input, effectiveMode, inBailiwickNameserver, hasDs, hasTlsa);
  const quickSteps = buildQuickSteps(input, effectiveMode, hasDs, hasTlsa);
  const verificationCommands = buildVerificationCommands(input, effectiveMode, normalizedDomain, ns, owner);
  const authoritativeDohNotes = authoritativeDohGuidance(input.domainType, effectiveMode, normalizedDomain, ns, inBailiwickNameserver);
  const integrationRecords = buildIntegrationRecord(parentDraft, input, effectiveMode, parentRecords, authoritativeRecords);
  authoritativeRecords.push(...authoritativeDnsOptions);
  const hnsResourceSizeBytes = input.domainType === 'hns' ? estimateHnsResourceSize(parentDraft) : undefined;

  if (input.domainType === 'hns' && hnsResourceSizeBytes !== undefined && hnsResourceSizeBytes > 512) {
    notices.push(notice('warning', `Estimated HNS parent-resource draft is ${hnsResourceSizeBytes} bytes. Keep HNS name resources small.`));
  }
  const resultWithoutSections: Omit<BootstrapResult, 'sections'> = {
    normalizedDomain,
    displayDomain: readableDomain,
    tlsaOwner: owner,
    parentTitle: input.domainType === 'hns' ? 'Put this in your HNS wallet / name resource' : 'Put this at your registrar / parent zone',
    parentRecords,
    authoritativeTitle: 'Put this on your authoritative DNS server',
    authoritativeRecords,
    serverPresetTitle: serverPresetLabel(preset),
    serverPresetRecords,
    verificationTitle: 'Verify with these commands',
    verificationCommands,
    authoritativeDohNotes,
    integrationTitle: 'Integrator JSON',
    integrationRecords,
    webServerNotes,
    quickSteps,
    notices,
    warnings: notices.filter((item) => item.severity !== 'info').map((item) => item.message),
    helpTips: defaultHelpTips(input.domainType, effectiveMode, preset, normalizedDomain, ns, inBailiwickNameserver),
    statusChecks,
    diagnostics: {
      inBailiwickNameserver,
      needsGlue: inBailiwickNameserver && effectiveMode === 'delegated',
      hasTlsa,
      hasDs,
      mode: effectiveMode,
      dnsServerPreset: preset,
      parentRecordCount: parentRecords.length,
      ...(hnsResourceSizeBytes !== undefined ? { hnsResourceSizeBytes } : {})
    }
  };

  return {
    ...resultWithoutSections,
    sections: buildSections(resultWithoutSections)
  };
}
