import type { DnsServerPreset, DomainType, SetupMode } from './core/types';

export interface UrlPrefill {
  hasPrefill: boolean;
  intent: string;
  domainType: DomainType;
  setupMode: SetupMode;
  domainInput: string;
  nameserverHost: string;
  nameserverIpv4: string;
  nameserverIpv6: string;
  websiteIpv4: string;
  websiteIpv6: string;
  port: number;
  pemInput: string;
  dnskeyInput: string;
  dnsServerPreset: DnsServerPreset;
}

const DNS_SERVER_PRESETS: DnsServerPreset[] = ['generic-zone', 'hosted-dns', 'powerdns', 'knot', 'bind', 'windows-server', 'nsd'];

const DEFAULT_PREFILL: UrlPrefill = {
  hasPrefill: false,
  intent: '',
  domainType: 'hns',
  setupMode: 'delegated',
  domainInput: '',
  nameserverHost: '',
  nameserverIpv4: '',
  nameserverIpv6: '',
  websiteIpv4: '',
  websiteIpv6: '',
  port: 443,
  pemInput: '',
  dnskeyInput: '',
  dnsServerPreset: 'generic-zone'
};

function valueFor(params: URLSearchParams, keys: string[]): string {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return '';
}

function normalizeDomainType(value: string): DomainType | null {
  const normalized = value.toLowerCase().replaceAll('_', '-');
  if (normalized === 'hns' || normalized === 'handshake') return 'hns';
  if (normalized === 'icann' || normalized === 'dns') return 'icann';
  return null;
}

function normalizeSetupMode(value: string): SetupMode | null {
  const normalized = value.toLowerCase().replaceAll('_', '-');
  if (['delegated', 'named', 'ns', 'glue'].includes(normalized)) return 'delegated';
  if (['hns-inline', 'inline', 'synth', 'synth4', 'synth6'].includes(normalized)) return 'hns-inline';
  return null;
}

function setupModeFromIntent(intent: string): SetupMode | null {
  const normalized = intent.toLowerCase().replaceAll('_', '-');
  if (normalized.includes('synth')) return 'hns-inline';
  if (normalized.includes('glue') || normalized.includes('ns') || normalized.includes('doh')) return 'delegated';
  return null;
}

function inferDomainType(domain: string): DomainType {
  const clean = domain.trim().replace(/^https?:\/\//i, '').replace(/^hns:\/\//i, '');
  const host = clean.split(/[/?#]/, 1)[0] ?? '';
  if (!clean || clean.endsWith('/') || !host.includes('.')) return 'hns';
  return 'icann';
}

function normalizeDomainInput(value: string, domainType: DomainType): string {
  if (domainType !== 'hns') return value;
  const clean = value.trim();
  if (!clean) return clean;
  const withoutProtocol = clean.replace(/^https?:\/\//i, '').replace(/^hns:\/\//i, '');
  const root = withoutProtocol.split(/[/?#]/, 1)[0];
  if (!root || root.includes('.')) return clean;
  return `${root}/`;
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : DEFAULT_PREFILL.port;
}

function parsePreset(value: string): DnsServerPreset {
  return (DNS_SERVER_PRESETS as string[]).includes(value) ? value as DnsServerPreset : DEFAULT_PREFILL.dnsServerPreset;
}

export function readUrlPrefillFromSearch(search: string): UrlPrefill {
  const params = new URLSearchParams(search);
  if (!Array.from(params.keys()).length) return {...DEFAULT_PREFILL};

  const rawDomainInput = valueFor(params, ['domain', 'name', 'domainInput', 'domain_input']);
  const intent = valueFor(params, ['intent', 'action', 'next_step']);
  const explicitDomainType = normalizeDomainType(valueFor(params, ['domainType', 'domain_type', 'type']));
  const domainType = explicitDomainType ?? inferDomainType(rawDomainInput);
  const domainInput = normalizeDomainInput(rawDomainInput, domainType);
  const explicitMode = normalizeSetupMode(valueFor(params, ['setupMode', 'setup_mode', 'mode']));
  let setupMode = explicitMode ?? setupModeFromIntent(intent) ?? DEFAULT_PREFILL.setupMode;
  if (domainType === 'icann' && setupMode === 'hns-inline') setupMode = 'delegated';

  return {
    hasPrefill: true,
    intent,
    domainType,
    setupMode,
    domainInput,
    nameserverHost: valueFor(params, ['nameserver', 'nameserverHost', 'nameserver_host', 'ns', 'ns_host']),
    nameserverIpv4: valueFor(params, ['nameserverIpv4', 'nameserver_ipv4', 'ns4', 'glue4']),
    nameserverIpv6: valueFor(params, ['nameserverIpv6', 'nameserver_ipv6', 'ns6', 'glue6']),
    websiteIpv4: valueFor(params, ['websiteIpv4', 'website_ipv4', 'website4', 'a', 'ipv4']),
    websiteIpv6: valueFor(params, ['websiteIpv6', 'website_ipv6', 'website6', 'aaaa', 'ipv6']),
    port: parsePort(valueFor(params, ['port'])),
    pemInput: valueFor(params, ['pem', 'cert', 'certificate', 'publicKey', 'public_key']),
    dnskeyInput: valueFor(params, ['dnskey', 'dnskeyInput', 'dnskey_input']),
    dnsServerPreset: parsePreset(valueFor(params, ['preset', 'dnsServerPreset', 'dns_server_preset']))
  };
}

export function readUrlPrefill(): UrlPrefill {
  if (typeof window === 'undefined') return {...DEFAULT_PREFILL};
  return readUrlPrefillFromSearch(window.location.search);
}
