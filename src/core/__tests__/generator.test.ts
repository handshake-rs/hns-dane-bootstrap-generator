import { describe, expect, it } from 'vitest';
import { generateBootstrap } from '../bootstrap';
import { normalizeDomain, normalizeHostname, isInBailiwick, synthNameserverName, tlsaOwnerName, validateIpv6 } from '../domain';
import { parseDnskey, dnskeyKeyTag, canonicalNameWire } from '../dnssec';
import { extractSpkiFromPem, generateTlsaRecord } from '../tlsa';
import { guidanceForIntent } from '../../handoffGuidance';
import { isRtlLanguage, languageOptions } from '../../i18n';
import { readUrlPrefillFromSearch } from '../../urlPrefill';

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE7Z2aT5FJk4M3UgR6pW/8T4zQIErB
4dTvQ7x/0f9uGVLEh4wmc6Vh+mbXoN3b9nQ7bYrYdK6bskh9lT3mf7m/7Q==
-----END PUBLIC KEY-----`;

describe('domain normalization', () => {
  it('normalizes HNS slash notation', () => {
    expect(normalizeDomain('dane/', 'hns')).toBe('dane.');
  });

  it('keeps numeric HNS slash roots as labels instead of IPv4 hosts', () => {
    expect(normalizeDomain('192/', 'hns')).toBe('192.');
  });

  it('rejects HNS names that hsd would reject', () => {
    expect(() => normalizeDomain('dane', 'hns')).toThrow('end with /');
    expect(() => normalizeDomain('Dane/', 'hns')).toThrow('lowercase');
    expect(() => normalizeDomain('da/ne/', 'hns')).toThrow('cannot contain /');
    expect(() => normalizeDomain('www.dane/', 'hns')).toThrow('without dots');
    expect(() => normalizeDomain('bücher/', 'hns')).toThrow('ASCII');
    expect(() => normalizeDomain('-dane/', 'hns')).toThrow('cannot begin or end');
    expect(() => normalizeDomain('dane!/', 'hns')).toThrow('may only contain');
    expect(() => normalizeDomain('example/', 'hns')).toThrow('reserved');
  });

  it('normalizes ICANN domains', () => {
    expect(normalizeDomain('Example.COM', 'icann')).toBe('example.com.');
  });

  it('normalizes IDNA input to DNS ASCII labels', () => {
    expect(normalizeDomain('bücher.example', 'icann')).toBe('xn--bcher-kva.example.');
    expect(normalizeHostname('ns1.bücher.example')).toBe('ns1.xn--bcher-kva.example.');
  });

  it('detects in-bailiwick nameservers', () => {
    expect(isInBailiwick('ns1.dane.', 'dane.')).toBe(true);
    expect(isInBailiwick('ns1.provider.net.', 'dane.')).toBe(false);
  });

  it('builds TLSA owner names', () => {
    expect(tlsaOwnerName('dane.', 443, 'tcp')).toBe('_443._tcp.dane.');
  });

  it('rejects malformed IPv6', () => {
    expect(validateIpv6('2001:db8::1')).toBe(true);
    expect(validateIpv6(':::')).toBe(false);
  });

  it('encodes HNS SYNTH nameserver names from IP addresses', () => {
    expect(synthNameserverName('45.77.219.32')).toBe('_5l6tm80._synth.');
    expect(synthNameserverName('203.0.113.10')).toBe('_pc0722g._synth.');
  });

  it('exposes verification commands and integrator JSON for delegated HNS', async () => {
    const result = await generateBootstrap({
      domainType: 'hns',
      setupMode: 'delegated',
      domainInput: 'dane/',
      nameserverHost: 'ns1.dane.',
      nameserverIpv4: '203.0.113.10',
      websiteIpv4: '203.0.113.20',
      port: 443,
      protocol: 'tcp',
      pemInput: PUBLIC_KEY
    });

    expect(result.verificationCommands[0]!.value).toContain('dig @203.0.113.10 dane. SOA');
    expect(result.verificationCommands[0]!.value).toContain('Direct authoritative queries above prove the server answers');
    expect(result.verificationCommands[0]!.value).toContain('<hns-validating-recursive-resolver>');
    expect(result.integrationRecords[0]!.value).toContain('hns-parent-record-draft');
    expect(result.integrationRecords[0]!.value).not.toContain('Hosted DNS provider panel');
    expect(result.sections.some((section) => section.id === 'integrator')).toBe(true);
    expect(result.sections.some((section) => section.id === 'server')).toBe(false);
  });

  it('handles parenthesized multiline DNSKEY input', () => {
    const dnskey = parseDnskey(`example. 3600 IN DNSKEY (
      257 3 13 AAAA
    ) ; comment`);
    expect(dnskey.flags).toBe(257);
    expect(dnskey.algorithm).toBe(13);
  });
});

describe('URL prefill', () => {
  it('prefills a plain HNS name and TLSA intent', () => {
    const prefill = readUrlPrefillFromSearch('?domain=dane&intent=generate_tlsa');

    expect(prefill.hasPrefill).toBe(true);
    expect(prefill.domainInput).toBe('dane/');
    expect(prefill.domainType).toBe('hns');
    expect(prefill.setupMode).toBe('delegated');
    expect(prefill.intent).toBe('generate_tlsa');
  });

  it('prefills numeric HNS names without IPv4 reinterpretation', () => {
    const prefill = readUrlPrefillFromSearch('?domain=192&domain_type=hns&intent=review');

    expect(prefill.domainInput).toBe('192/');
    expect(prefill.domainType).toBe('hns');
    expect(normalizeDomain(prefill.domainInput, prefill.domainType)).toBe('192.');
  });

  it('prefills SYNTH nameserver mode with nameserver and website addresses', () => {
    const prefill = readUrlPrefillFromSearch('?domain=dane&mode=synth&ns4=203.0.113.10&a=203.0.113.20&port=8443');

    expect(prefill.domainType).toBe('hns');
    expect(prefill.setupMode).toBe('hns-inline');
    expect(prefill.nameserverIpv4).toBe('203.0.113.10');
    expect(prefill.websiteIpv4).toBe('203.0.113.20');
    expect(prefill.port).toBe(8443);
  });

  it('prefills delegated ICANN mode and rejects incompatible inline mode', () => {
    const prefill = readUrlPrefillFromSearch('?domain=example.com&domain_type=icann&mode=hns-inline&nameserver=ns1.example.com.&preset=bind');

    expect(prefill.domainType).toBe('icann');
    expect(prefill.setupMode).toBe('delegated');
    expect(prefill.nameserverHost).toBe('ns1.example.com.');
    expect(prefill.dnsServerPreset).toBe('bind');
  });

  it('prefills the authoritative DoH browser handoff as delegated HNS', () => {
    const prefill = readUrlPrefillFromSearch('?domain=shakeshift%2F&domain_type=hns&intent=authoritative_doh&nameserver=a.namenode');

    expect(prefill.domainInput).toBe('shakeshift/');
    expect(prefill.domainType).toBe('hns');
    expect(prefill.setupMode).toBe('delegated');
    expect(prefill.nameserverHost).toBe('a.namenode');
    expect(prefill.intent).toBe('authoritative_doh');
  });

  it('maps report intents to handoff guidance', () => {
    expect(guidanceForIntent('generate_tlsa')?.title).toBe('Generate TLSA next');
    expect(guidanceForIntent('missing_glue')?.title).toBe('Fix nameserver bootstrap');
    const authoritativeDoh = guidanceForIntent('authoritative_doh');
    expect(authoritativeDoh?.title).toBe('Configure authoritative DoH on HTTPS 443');
    expect(authoritativeDoh?.body).toContain('RFC 9461 _dns.<NS> SVCB');
    expect(authoritativeDoh?.body).toContain('RFC 8484');
    expect(authoritativeDoh?.body).toContain('cannot bootstrap itself');
    expect(authoritativeDoh?.next.join(' ')).toContain('external nameserver');
    expect(authoritativeDoh?.next.join(' ')).toContain('non-standard, implementation-specific HNS parent TXT');
    expect(authoritativeDoh?.next.join(' ')).toContain('hnsdns=1');
    expect(authoritativeDoh?.next.join(' ')).toContain('independently measured SPKI SHA-256 pin');
    expect(authoritativeDoh?.next.join(' ')).toContain('never publish a placeholder or reuse the website TLSA key');
    expect(authoritativeDoh?.next.join(' ')).toContain('DNSSEC chain validation and TLSA/DANE verification');
    expect(guidanceForIntent('ds_dnskey_mismatch')?.title).toBe('Regenerate or check DS');
  });

  it('returns generic handoff guidance for unknown non-empty intents', () => {
    expect(guidanceForIntent('future_intent')?.title).toBe('Continue setup');
    expect(guidanceForIntent('')).toBeNull();
  });
});

describe('localization options', () => {
  it('includes Arabic, Persian, and Hebrew as RTL language options', () => {
    expect(languageOptions.some((option) => option.code === 'ar' && option.label === 'العربية')).toBe(true);
    expect(languageOptions.some((option) => option.code === 'fa' && option.label === 'فارسی')).toBe(true);
    expect(languageOptions.some((option) => option.code === 'he' && option.label === 'עברית')).toBe(true);
    expect(isRtlLanguage('ar')).toBe(true);
    expect(isRtlLanguage('fa')).toBe(true);
    expect(isRtlLanguage('he')).toBe(true);
    expect(isRtlLanguage('en')).toBe(false);
  });
});

describe('TLSA generation', () => {
  it('extracts SPKI from PUBLIC KEY PEM', () => {
    const spki = extractSpkiFromPem(PUBLIC_KEY);
    expect(spki.length).toBeGreaterThan(32);
  });

  it('generates TLSA 3 1 1 from SPKI', async () => {
    const record = await generateTlsaRecord({
      pemInput: PUBLIC_KEY,
      ownerName: '_443._tcp.example.',
      ttl: 3600
    });
    expect(record).toMatch(/^_443\._tcp\.example\. 3600 IN TLSA 3 1 1 [0-9A-F]{64}$/);
  });

  it('reports malformed PEM base64 with field context', () => {
    expect(() => extractSpkiFromPem(`-----BEGIN PUBLIC KEY-----
AAAAA
-----END PUBLIC KEY-----`)).toThrow('PEM PUBLIC KEY has an invalid base64 length');
  });
});

describe('DNSSEC helpers', () => {
  it('parses DNSKEY rdata and computes a key tag shape', () => {
    const dnskey = parseDnskey('257 3 13 AAAA');
    expect(dnskey.flags).toBe(257);
    expect(dnskey.protocol).toBe(3);
    expect(dnskey.algorithm).toBe(13);
    expect(dnskeyKeyTag(dnskey.rdata)).toBeGreaterThanOrEqual(0);
  });

  it('parses DNSKEY with owner, ttl, class, and comments', () => {
    const dnskey = parseDnskey('example. 3600 IN DNSKEY 257 3 13 AAAA ; ksk');
    expect(dnskey.flags).toBe(257);
    expect(dnskey.publicKeyBase64).toBe('AAAA');
  });

  it('reports malformed DNSKEY base64 with field context', () => {
    expect(() => parseDnskey('257 3 13 AAAAA')).toThrow('DNSKEY public key has an invalid base64 length');
  });

  it('encodes canonical owner name wire format', () => {
    const wire = canonicalNameWire('example.');
    expect(Array.from(wire)).toEqual([7, 101, 120, 97, 109, 112, 108, 101, 0]);
  });
});

describe('bootstrap generator', () => {
  it('generates HNS delegated wallet and authoritative outputs', async () => {
    const result = await generateBootstrap({
      domainType: 'hns',
      setupMode: 'delegated',
      domainInput: 'dane/',
      nameserverHost: 'ns1.dane.',
      nameserverIpv4: '203.0.113.10',
      websiteIpv4: '203.0.113.20',
      port: 443,
      protocol: 'tcp',
      pemInput: PUBLIC_KEY
    });

    expect(result.parentRecords.some((line) => line.value.startsWith('GLUE4 ns1.dane.'))).toBe(true);
    expect(result.parentRecords.some((line) => line.value.includes('hnsdns=1'))).toBe(false);
    const walletCommand = result.parentRecords.find((line) => line.value.includes('hsw-cli rpc sendupdate'));
    expect(walletCommand?.presentation?.tabId).toBe('cli');
    expect(walletCommand?.presentation?.defaultSelected).toBe(true);
    expect(walletCommand?.value).toContain(`hsw-cli rpc sendupdate 'dane' '{"records":[{"type":"NS","ns":"ns1.dane."},{"type":"GLUE4","ns":"ns1.dane.","address":"203.0.113.10"}]}'`);
    expect(walletCommand?.value).toContain(`hsd-cli rpc getnameresource 'dane'`);
    const bobOption = result.parentRecords.find((line) => line.presentation?.tabId === 'bob');
    expect(bobOption?.value).toContain('Bob Wallet desktop UI');
    expect(bobOption?.value).toContain('GLUE4: ns=ns1.dane. address=203.0.113.10');
    expect(bobOption?.value).not.toContain('hnsdns=1');
    const shakeOption = result.parentRecords.find((line) => line.presentation?.tabId === 'shake');
    expect(shakeOption?.value).toContain('Shake Wallet / LearnHNS browser wallet UI');
    expect(shakeOption?.value).toContain('const tx = await wallet.sendUpdate("dane", [');
    expect(shakeOption?.value).toContain('"type": "GLUE4"');
    expect(shakeOption?.value).not.toContain('"type": "TXT"');
    expect(result.authoritativeRecords.some((line) => line.value.includes(' IN A 203.0.113.20'))).toBe(true);
    expect(result.authoritativeRecords.some((line) => line.value.includes(' IN TLSA 3 1 1 '))).toBe(true);
    const authoritativeDohRecord = result.authoritativeRecords.find((line) => line.value === '_dns.ns1.dane. 3600 IN SVCB 1 ns1.dane. alpn=h2 dohpath=/dns-query{?dns}');
    expect(authoritativeDohRecord).toBeDefined();
    expect(authoritativeDohRecord?.explanation).toContain('HTTPS 443');
    expect(authoritativeDohRecord?.explanation).toContain('validate DNSSEC and DANE locally');
    const zoneFileOption = result.authoritativeRecords.find((line) => line.presentation?.tabId === 'generic-zone');
    expect(zoneFileOption?.presentation?.tabLabel).toBe('Zone file');
    expect(zoneFileOption?.presentation?.defaultSelected).toBe(true);
    expect(zoneFileOption?.value).toContain('$ORIGIN dane.');
    expect(zoneFileOption?.value).toContain('_dns.ns1 3600 IN SVCB 1 ns1 alpn=h2 dohpath=/dns-query{?dns}');
    expect(result.authoritativeRecords.find((line) => line.presentation?.tabId === 'hosted-dns')?.value).toContain('Hosted DNS provider panel');
    expect(result.webServerNotes.some((line) => line.value.includes('current and next TLSA'))).toBe(true);
    expect(result.webServerNotes.some((line) => line.value.includes('ordinary HTTPS clients may ignore'))).toBe(true);
    expect(result.authoritativeDohNotes.some((line) => line.value.includes('https://ns1.dane/dns-query'))).toBe(true);
    expect(result.authoritativeDohNotes.some((line) => line.value.includes('HTTPS on TCP 443'))).toBe(true);
    expect(result.authoritativeDohNotes.some((line) => line.value.includes('SVCB record alone cannot recover'))).toBe(true);
    expect(result.authoritativeDohNotes.some((line) => line.value.includes('Validation remains local'))).toBe(true);
    expect(result.sections.some((section) => section.id === 'authoritative-doh' && section.title === 'Authoritative DoH on HTTPS 443')).toBe(true);
    expect(result.quickSteps.length).toBeGreaterThan(3);
    expect(result.sections.some((section) => section.id === 'capsule')).toBe(false);
    expect(JSON.stringify(result)).not.toContain('hnsdns=1');
  });

  it('explains authoritative DoH ownership for an external HNS nameserver', async () => {
    const result = await generateBootstrap({
      domainType: 'hns',
      setupMode: 'delegated',
      domainInput: 'shakeshift/',
      nameserverHost: 'a.namenode',
      websiteIpv4: '203.0.113.20',
      port: 443,
      protocol: 'tcp'
    });

    expect(result.diagnostics.inBailiwickNameserver).toBe(false);
    expect(result.authoritativeRecords.some((line) => line.value.startsWith('_dns.a.namenode. '))).toBe(false);
    expect(result.authoritativeRecords.filter((line) => line.presentation).every((line) => !line.value.includes('_dns.a.namenode'))).toBe(true);
    expect(result.authoritativeDohNotes.some((line) => line.value.includes('a.namenode. controls _dns.a.namenode.'))).toBe(true);
    expect(result.authoritativeDohNotes.some((line) => line.value.includes('the shakeshift/ owner cannot publish'))).toBe(true);
    expect(result.authoritativeDohNotes.some((line) => line.value.includes('adopt an in-zone DoH-capable nameserver'))).toBe(true);
    expect(result.authoritativeDohNotes.some((line) => line.value.includes('https://a.namenode/dns-query on HTTPS 443'))).toBe(true);
    expect(result.authoritativeDohNotes.some((line) => line.value.includes('SVCB record alone cannot recover'))).toBe(true);
    expect(result.authoritativeDohNotes.some((line) => line.value.includes('Validation remains local'))).toBe(true);
    expect(result.helpTips.some((tip) => tip.includes('operator controls _dns.a.namenode.'))).toBe(true);
    expect(JSON.stringify(result)).not.toContain('hnsdns=1');
  });

  it('generates HNS SYNTH nameserver outputs', async () => {
    const result = await generateBootstrap({
      domainType: 'hns',
      setupMode: 'hns-inline',
      domainInput: 'dane/',
      nameserverIpv4: '203.0.113.10',
      websiteIpv4: '203.0.113.20',
      port: 443,
      protocol: 'tcp',
      pemInput: PUBLIC_KEY
    });

    expect(result.parentRecords.map((line) => line.value)).toContain('SYNTH4 203.0.113.10');
    expect(result.parentRecords.find((line) => line.value.includes('hsw-cli rpc sendupdate'))?.value).toContain(`{"records":[{"type":"SYNTH4","address":"203.0.113.10"}]}`);
    expect(result.authoritativeRecords.some((line) => line.value === 'dane. 3600 IN NS _pc0722g._synth.')).toBe(true);
    expect(result.authoritativeRecords.some((line) => line.value === 'dane. 3600 IN A 203.0.113.20')).toBe(true);
    expect(result.authoritativeRecords.some((line) => line.value.includes(' IN TLSA 3 1 1 '))).toBe(true);
    expect(result.serverPresetRecords.length).toBeGreaterThan(0);
    expect(result.statusChecks.find((item) => item.label === 'Nameserver')?.status).toBe('ok');
    expect(result.statusChecks.find((item) => item.label === 'DS')?.status).toBe('missing');
  });

  it('generates ICANN registrar language', async () => {
    const result = await generateBootstrap({
      domainType: 'icann',
      setupMode: 'delegated',
      domainInput: 'example.com',
      nameserverHost: 'ns1.example.com.',
      nameserverIpv4: '203.0.113.10',
      websiteIpv4: '203.0.113.20',
      port: 443,
      protocol: 'tcp',
      pemInput: PUBLIC_KEY
    });

    expect(result.parentTitle).toContain('registrar');
    expect(result.parentRecords.some((line) => line.value === 'Nameserver: ns1.example.com.')).toBe(true);
    expect(result.parentRecords.some((line) => line.value === 'Glue IPv4: 203.0.113.10')).toBe(true);
  });

  it('generates a BIND starter config', async () => {
    const result = await generateBootstrap({
      domainType: 'hns',
      setupMode: 'delegated',
      domainInput: 'dane/',
      nameserverHost: 'ns1.dane.',
      nameserverIpv4: '203.0.113.10',
      websiteIpv4: '203.0.113.20',
      port: 443,
      protocol: 'tcp',
      pemInput: PUBLIC_KEY,
      dnsServerPreset: 'bind'
    });

    expect(result.serverPresetTitle).toBe('BIND 9 starter config');
    expect(result.serverPresetRecords[0]!.value).toContain('named.conf.local');
    const bindOption = result.authoritativeRecords.find((line) => line.presentation?.tabId === 'bind');
    expect(bindOption?.presentation?.defaultSelected).toBe(true);
    expect(bindOption?.value).toContain('named.conf.local');
    expect(result.serverPresetRecords[0]!.value).toContain('$ORIGIN dane.');
    expect(result.serverPresetRecords[0]!.value).toContain('ns1 3600 IN A 203.0.113.10');
    expect(result.serverPresetRecords[0]!.value).toContain('Disable recursion');
    expect(result.serverPresetRecords[0]!.value).toContain('UDP/53 and TCP/53');
    expect(result.sections.some((section) => section.id === 'server')).toBe(false);
  });

  it('generates a Windows Server DNS PowerShell quick start', async () => {
    const result = await generateBootstrap({
      domainType: 'hns',
      setupMode: 'delegated',
      domainInput: 'dane/',
      nameserverHost: 'ns1.dane.',
      nameserverIpv4: '203.0.113.10',
      websiteIpv4: '203.0.113.20',
      port: 443,
      protocol: 'tcp',
      pemInput: PUBLIC_KEY,
      dnsServerPreset: 'windows-server'
    });

    const preset = result.serverPresetRecords[0]!.value;
    expect(result.serverPresetTitle).toBe('Windows Server DNS PowerShell');
    expect(preset).toContain('Install-WindowsFeature DNS -IncludeManagementTools');
    expect(preset).toContain('Set-DnsServerRecursion -Enable $false');
    expect(preset).toContain('Add-DnsServerPrimaryZone -Name "dane" -ZoneFile "dane.dns"');
    expect(preset).toContain('Add-DnsServerResourceRecord -NS -ZoneName "dane" -Name "." -NameServer "ns1.dane."');
    expect(preset).toContain('Add-DnsServerResourceRecordA -ZoneName "dane" -Name "ns1" -IPv4Address "203.0.113.10"');
    expect(preset).toContain('Add-DnsServerResourceRecordA -ZoneName "dane" -Name "." -IPv4Address "203.0.113.20"');
    expect(preset).toContain('Add-DnsServerResourceRecord -TLSA -ZoneName "dane" -Name "_443._tcp"');
    expect(preset).toContain('-CertificateUsage DomainIssuedCertificate -Selector SubjectPublicKeyInfo -MatchingType Sha256Hash');
    expect(preset).toContain('Invoke-DnsServerZoneSign -ZoneName "dane" -SignWithDefault');
    expect(preset).toContain('Get-DnsServerResourceRecord -ZoneName "dane" -RRType DNSKEY');
    expect(preset).toContain('Get-DnsServerResourceRecord -ZoneName "dane" -RRType DS');
    const windowsOption = result.authoritativeRecords.find((line) => line.presentation?.tabId === 'windows-server');
    expect(windowsOption?.presentation?.tabLabel).toBe('Windows Server');
    expect(windowsOption?.presentation?.defaultSelected).toBe(true);
  });

  it('generates a hosted DNS provider checklist', async () => {
    const result = await generateBootstrap({
      domainType: 'icann',
      setupMode: 'delegated',
      domainInput: 'bücher.example',
      nameserverHost: 'ns1.provider.example.',
      websiteIpv4: '203.0.113.20',
      port: 443,
      protocol: 'tcp',
      pemInput: PUBLIC_KEY,
      dnsServerPreset: 'hosted-dns'
    });

    expect(result.normalizedDomain).toBe('xn--bcher-kva.example.');
    expect(result.serverPresetTitle).toBe('Hosted DNS provider checklist');
    expect(result.serverPresetRecords[0]!.value).toContain('Hosted DNS provider panel');
    expect(result.notices.some((item) => item.message.includes('Internationalized domain input'))).toBe(true);
  });

  it('reports missing DS and TLSA status when inputs are omitted', async () => {
    const result = await generateBootstrap({
      domainType: 'hns',
      setupMode: 'delegated',
      domainInput: 'dane/',
      nameserverHost: 'ns1.dane.',
      nameserverIpv4: '203.0.113.10',
      websiteIpv4: '203.0.113.20',
      port: 443,
      protocol: 'tcp'
    });

    expect(result.statusChecks.find((item) => item.label === 'DS')?.status).toBe('missing');
    expect(result.statusChecks.find((item) => item.label === 'TLSA')?.status).toBe('missing');
  });

  it('does not emit an empty HNS update command when parent records are missing', async () => {
    const result = await generateBootstrap({
      domainType: 'hns',
      setupMode: 'delegated',
      domainInput: 'dane/',
      port: 443,
      protocol: 'tcp'
    });

    expect(result.parentRecords.find((line) => line.value === 'GLUE4 <nameserver-host> <nameserver-ipv4>')).toBeDefined();
    const dsIndex = result.parentRecords.findIndex((line) => line.value.startsWith('DS '));
    const referralIndex = result.parentRecords.findIndex((line) => line.value.startsWith('GLUE4 '));
    expect(referralIndex).toBeGreaterThanOrEqual(0);
    expect(dsIndex).toBeGreaterThan(referralIndex);
    const walletCommand = result.parentRecords.find((line) => line.value.includes('hsw-cli rpc sendupdate'));
    expect(walletCommand?.value).toContain('<resource-json-from-concrete-parent-records>');
    expect(walletCommand?.value).not.toContain('{"records":[]}');
    const bobOption = result.parentRecords.find((line) => line.presentation?.tabId === 'bob');
    expect(bobOption?.value).toContain('Do not submit an empty name resource');
    const shakeOption = result.parentRecords.find((line) => line.presentation?.tabId === 'shake');
    expect(shakeOption?.value).not.toContain('sendUpdate("example", [])');
  });

  it('keeps website IP hints technically distinct from A and AAAA records', async () => {
    const missingWebsiteIp = await generateBootstrap({
      domainType: 'hns',
      setupMode: 'delegated',
      domainInput: 'dane/',
      nameserverHost: 'ns1.dane.',
      nameserverIpv4: '203.0.113.10',
      port: 443,
      protocol: 'tcp'
    });

    expect(missingWebsiteIp.notices.some((item) => item.message === 'No website IPv4 or IPv6 address was supplied.')).toBe(true);
    expect(missingWebsiteIp.notices.some((item) => item.message.includes('A or AAAA address'))).toBe(false);

    const withWebsiteIp = await generateBootstrap({
      domainType: 'hns',
      setupMode: 'delegated',
      domainInput: 'dane/',
      nameserverHost: 'ns1.dane.',
      nameserverIpv4: '203.0.113.10',
      websiteIpv4: '203.0.113.20',
      port: 443,
      protocol: 'tcp'
    });

    expect(withWebsiteIp.statusChecks.find((item) => item.label === 'Website IP')?.detail).toBe('Website A/AAAA records can be generated.');
  });
});
