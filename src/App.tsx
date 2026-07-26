import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { BootstrapInput, BootstrapResult, DnsServerPreset, DomainType, GeneratedLine, OutputSection, SetupMode, StatusCheck } from './core/types';
import { generateBootstrap } from './core/bootstrap';
import { isInBailiwick, normalizeDomain, validateDomainName, validateHostname, validateIpv4, validateIpv6 } from './core/domain';
import { parseDnskey } from './core/dnssec';
import { extractSpkiFromPem } from './core/tlsa';
import { guidanceForIntent, type HandoffGuidance } from './handoffGuidance';
import { isLanguageCode, isRtlLanguage, languageOptions, localeText, type LanguageCode, type LocaleText } from './i18n';
import { localizeBootstrapResult } from './resultLocalization';
import { readUrlPrefill } from './urlPrefill';

const HNS_DOMAIN_PLACEHOLDER = 'dane/';
const ICANN_DOMAIN_PLACEHOLDER = 'example.com';
const HNS_NAMESERVER_PLACEHOLDER = 'ns1.dane.';
const ICANN_NAMESERVER_PLACEHOLDER = 'ns1.example.com.';
const NAMESERVER_IPV4_PLACEHOLDER = '203.0.113.10';
const WEBSITE_IPV4_PLACEHOLDER = '203.0.113.20';
const DONATION_ADDRESS = 'hs1q5997733eq7f4yyk2vq2z8gz3yqyvpz422ypggh';
const DONATION_URI = `handshake:${DONATION_ADDRESS}`;
const GITHUB_REPOSITORY_URL = 'https://github.com/handshake-rs/hns-dane-bootstrap-generator';
const WEB_ADMIN_GUIDE_URL = `${GITHUB_REPOSITORY_URL}/blob/main/docs/WEB_ADMIN_GUIDE.md`;
const OS_QUICK_STARTS_URL = `${WEB_ADMIN_GUIDE_URL}#self-hosted-os-quick-starts`;
const LINODE_BEGINNER_DEPLOY_URL = `${GITHUB_REPOSITORY_URL}/blob/main/docs/linode-beginner-deploy.md`;
const LINODE_PUBLISH_URL = `${GITHUB_REPOSITORY_URL}/blob/main/docs/linode-stackscript-publish.md`;
const LINODE_STACKSCRIPT_URL = `${GITHUB_REPOSITORY_URL}/blob/main/stackscripts/linode/hns-dane-appliance-bootstrap.sh`;
const DEFAULT_LINODE_STACKSCRIPT_ID = '2158182';
const PUBLISHED_LINODE_STACKSCRIPT_ID = String(import.meta.env.VITE_LINODE_STACKSCRIPT_ID ?? DEFAULT_LINODE_STACKSCRIPT_ID).trim();
const PUBLISHED_LINODE_STACKSCRIPT_URL = PUBLISHED_LINODE_STACKSCRIPT_ID ? `https://cloud.linode.com/stackscripts/${encodeURIComponent(PUBLISHED_LINODE_STACKSCRIPT_ID)}` : '';
const CERTIFICATE_PLACEHOLDER = `-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----

or

-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----`;

interface HowToContext {
  certConnectTarget: string;
  certServerName: string;
  dnskeyQueryServer: string;
  dnskeyZone: string;
}

type FieldStatus = 'neutral' | 'needed' | 'error' | 'good';
type FieldKey = 'domain' | 'nameserverHost' | 'nameserverIpv4' | 'nameserverIpv6' | 'websiteIpv4' | 'websiteIpv6' | 'port' | 'pemInput' | 'dnskeyInput';
type TouchedFields = Partial<Record<FieldKey, boolean>>;

function withoutRootDot(value: string): string { return value.endsWith('.') ? value.slice(0, -1) : value; }

function ensureRootDot(value: string): string { return value.endsWith('.') ? value : `${value}.`; }

function isValidPort(value: number): boolean { return Number.isInteger(value) && value > 0 && value <= 65535; }

function isValidDnskeyInput(value: string): boolean {
  if (!value.trim()) return false;
  try {
    parseDnskey(value);
    return true;
  } catch {
    return false;
  }
}

function isValidPemInput(value: string): boolean {
  if (!value.trim()) return false;
  try {
    extractSpkiFromPem(value);
    return true;
  } catch {
    return false;
  }
}

function requiredStatus(value: string, touched: boolean | undefined, valid: boolean): FieldStatus {
  if (!value.trim()) return touched ? 'error' : 'needed';
  return valid ? 'good' : 'error';
}

function optionalStatus(value: string, valid: boolean): FieldStatus {
  if (!value.trim()) return 'neutral';
  return valid ? 'good' : 'error';
}

function requiredPairPrimaryStatus(primary: string, secondary: string, primaryTouched: boolean | undefined, secondaryTouched: boolean | undefined, primaryValid: boolean, secondaryValid: boolean): FieldStatus {
  if (primary.trim()) return primaryValid ? 'good' : 'error';
  if (secondary.trim() && secondaryValid) return 'neutral';
  return primaryTouched || secondaryTouched ? 'error' : 'needed';
}

function asciiHost(value: string): string {
  try {
    return new URL(`http://${withoutRootDot(value)}/`).hostname;
  } catch {
    return value;
  }
}

function hostPort(host: string, port: number): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]:${port}` : `${host}:${port}`;
}

function Field(props: { children: ReactNode; help?: string; label: string; status?: FieldStatus }) {
  const status = props.status ?? 'neutral';
  return (
    <div className={`field field-${status}`}>
      <span className="field-label">{props.label}</span>
      {props.help && <span className="field-help">{props.help}</span>}
      {props.children}
    </div>
  );
}

function FieldHowToText(props: { body: string; summary: string }) {
  return (
    <details className="field-howto">
      <summary>{props.summary}</summary>
      <p>{props.body}</p>
    </details>
  );
}

function CertificateHowTo(props: { attention?: boolean; context: HowToContext; summaryLabel?: string; t: LocaleText }) {
  return (
    <details className={props.attention ? 'attention-howto' : 'field-howto'}>
      <summary>{props.summaryLabel ?? props.t.howTo.summary}</summary>
      <p>{props.t.howTo.certIntro}</p>
      <p>{props.t.howTo.certFetch}</p>
      <pre className="inline-code">{`openssl s_client -connect ${props.context.certConnectTarget} -servername ${props.context.certServerName} -showcerts </dev/null 2>/dev/null | openssl x509 -outform PEM`}</pre>
      <p>{props.t.howTo.certFile}</p>
      <pre className="inline-code">openssl x509 -in fullchain.pem -pubkey -noout</pre>
    </details>
  );
}

function DnskeyHowTo(props: { attention?: boolean; context: HowToContext; summaryLabel?: string; t: LocaleText }) {
  return (
    <details className={props.attention ? 'attention-howto' : 'field-howto'}>
      <summary>{props.summaryLabel ?? props.t.howTo.summary}</summary>
      <p>{props.t.howTo.dnskeyIntro}</p>
      <p>{props.t.howTo.dnskeyHosted}</p>
      <p>{props.t.howTo.dnskeyQuery}</p>
      <pre className="inline-code">{`dig @${props.context.dnskeyQueryServer} ${props.context.dnskeyZone} DNSKEY +dnssec +multi`}</pre>
    </details>
  );
}

function SelfHostedQuickStarts() {
  return (
    <details className="field-howto quickstart-howto">
      <summary>Debian / Windows Server quick starts</summary>
      <p>Use these when you run your own authoritative DNS server for the DANE setup path.</p>
      <ul>
        <li><strong>Delegated authoritative DNS:</strong> parent gets nameserver/glue plus DS; the DNS server publishes the signed zone with A/AAAA and TLSA.</li>
        <li><strong>HNS SYNTH nameserver:</strong> HNS gets SYNTH4/SYNTH6 plus DS; the DNS server still publishes the signed zone with A/AAAA and TLSA.</li>
      </ul>
      <p>Choose BIND 9 or Windows Server DNS in this preset field. After records generate, expand <strong>Put this on your authoritative DNS server</strong> and select the matching tab for copy-paste commands.</p>
      <p><a href={OS_QUICK_STARTS_URL} target="_blank" rel="noreferrer">Open the full OS quick-start guide</a></p>
    </details>
  );
}

function lineText(lines: GeneratedLine[]): string {
  return lines.map((line) => line.value).join('\n\n');
}

function isTabbedOption(line: GeneratedLine): line is GeneratedLine & { presentation: NonNullable<GeneratedLine['presentation']> } {
  return Boolean(line.presentation);
}

function localizedSectionTitle(section: OutputSection, result: BootstrapResult, t: LocaleText): string {
  if (section.id === 'parent') return result.normalizedDomain && result.parentTitle.includes('HNS') ? t.output.parentHns : t.output.parentIcann;
  if (section.id === 'authoritative') return t.output.authoritative;
  if (section.id === 'steps') return t.output.steps;
  if (section.id === 'verify') return t.output.verify;
  if (section.id === 'web') return t.output.web;
  if (section.id === 'integrator') return t.output.integrator;
  if (section.id === 'server') return `${t.output.server}: ${section.title}`;
  return section.title;
}

function OutputBox(props: { section: OutputSection; result: BootstrapResult; t: LocaleText }) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);
  const tabOptions = props.section.lines.filter(isTabbedOption);
  const recordLines = tabOptions.length > 0 ? props.section.lines.filter((line) => !isTabbedOption(line)) : props.section.lines;
  const defaultTab = tabOptions.find((line) => line.presentation.defaultSelected)?.presentation.tabId ?? tabOptions[0]?.presentation.tabId ?? '';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const activeOption = tabOptions.find((line) => line.presentation.tabId === activeTab) ?? tabOptions[0];
  const recordText = lineText(recordLines);
  const tabListLabel = props.section.id === 'authoritative' ? 'Authoritative DNS entry method' : 'HNS wallet entry method';

  useEffect(() => {
    if (tabOptions.length === 0) return;
    if (!tabOptions.some((line) => line.presentation.tabId === activeTab)) setActiveTab(defaultTab);
  }, [activeTab, defaultTab, tabOptions]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  return (
    <section className={`output-card audience-${props.section.audience}${expanded ? ' expanded' : ' collapsed'}`}>
      <div className="output-heading">
        <button
          type="button"
          className="output-toggle"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((current) => !current)}
        >
          <span className="output-toggle-marker" aria-hidden="true">{expanded ? '-' : '+'}</span>
          <span>
            <span className="section-tag">{props.t.output.audiences[props.section.audience]}</span>
            <span className="output-title">{localizedSectionTitle(props.section, props.result, props.t)}</span>
          </span>
        </button>
      </div>
      <div id={contentId} className="output-content" hidden={!expanded}>
        <pre className={props.section.compact ? 'compact-pre' : undefined}>{recordText || props.t.copy.nothing}</pre>
        {!props.section.compact && (
          <div className="line-notes">
            {recordLines.map((line) => (
              <details key={line.value}>
                <summary>{line.value.split('\n')[0]}</summary>
                <p>{line.explanation}</p>
              </details>
            ))}
          </div>
        )}
        {tabOptions.length > 0 && activeOption && (
          <div className="entry-options">
            <div className="entry-tab-list" role="tablist" aria-label={tabListLabel}>
              {tabOptions.map((line) => {
                const selected = line.presentation.tabId === activeOption.presentation.tabId;
                return (
                  <button
                    type="button"
                    className={`entry-tab-button${selected ? ' active' : ''}`}
                    role="tab"
                    aria-selected={selected}
                    key={line.presentation.tabId}
                    onClick={() => setActiveTab(line.presentation.tabId)}
                  >
                    {line.presentation.tabLabel}
                  </button>
                );
              })}
            </div>
            <div className="entry-tab-panel" role="tabpanel">
              <pre>{activeOption.value}</pre>
              <p>{activeOption.explanation}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function StatusList(props: { checks: StatusCheck[]; t: LocaleText }) {
  return (
    <section className="status-card">
      <h2>{props.t.status.title}</h2>
      <div className="status-list">
        {props.checks.map((item) => (
          <div className={`status-pill ${item.status}`} key={item.label} title={item.detail}>
            <strong>{props.t.status.labels[item.label as keyof typeof props.t.status.labels] ?? item.label}</strong>
            <span>{item.status === 'ok' ? props.t.status.ok : item.status === 'warn' ? props.t.status.warn : props.t.status.missing}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SetupSummary(props: { result: BootstrapResult; t: LocaleText }) {
  const mode = props.result.diagnostics.mode === 'hns-inline' ? props.t.summary.hnsInline : props.t.summary.delegated;
  const glue = props.result.diagnostics.needsGlue ? props.t.summary.glueRequired : props.t.summary.externalNameserver;
  const ds = props.result.diagnostics.hasDs ? props.t.summary.dsReady : props.t.summary.dsPlaceholder;
  const tlsa = props.result.diagnostics.hasTlsa ? props.t.summary.tlsaReady : props.t.summary.tlsaPlaceholder;
  return (
    <section className="summary-strip" aria-label={props.t.summary.aria}>
      <span>{props.result.displayDomain}</span>
      <span>{mode}</span>
      {props.result.diagnostics.mode === 'delegated' && <span>{glue}</span>}
      {props.result.diagnostics.mode === 'delegated' && <span>{ds}</span>}
      {props.result.diagnostics.mode === 'delegated' && <span>{tlsa}</span>}
    </section>
  );
}

function HandoffCard(props: { guidance: HandoffGuidance | null }) {
  if (!props.guidance) return null;
  return (
    <section className="handoff-card" aria-label="Report handoff">
      <p className="section-tag">{props.guidance.badge}</p>
      <h2>{props.guidance.title}</h2>
      <p>{props.guidance.body}</p>
      <ul>
        {props.guidance.next.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function LinodeSkipCard(props: { onOpen: () => void; t: LocaleText }) {
  return (
    <section className="linode-skip-card" aria-label="Linode Akamai one-click provisioning">
      <p className="section-tag">{props.t.linode.provisioningTag}</p>
      <a
        href="#linode-hosting"
        onClick={(event) => {
          event.preventDefault();
          props.onOpen();
        }}
      >
        {props.t.linode.cardLink}
      </a>
      <p>{props.t.linode.cardBody}</p>
    </section>
  );
}

function LinodeGuideCard(props: { onBack: () => void; t: LocaleText }) {
  const primaryHref = PUBLISHED_LINODE_STACKSCRIPT_URL || LINODE_PUBLISH_URL;
  const primaryLabel = PUBLISHED_LINODE_STACKSCRIPT_URL ? props.t.linode.beginHosting : props.t.linode.publishSetup;

  return (
    <section className="deploy-card linode-guide-card" id="linode-hosting" aria-label="Linode Akamai deployment tutorial">
      <div className="linode-guide-top">
        <button type="button" className="secondary" onClick={props.onBack}>Back</button>
        <div className="linode-guide-title">
          <p className="section-tag">{props.t.linode.provisioningTag}</p>
          <h1>{props.t.linode.deployTitle}</h1>
        </div>
        <a className="button-link" href={primaryHref} target="_blank" rel="noreferrer">{primaryLabel}</a>
      </div>

      <div className="deploy-copy">
        <h2>Recommended Linode settings</h2>
        <dl className="linode-settings">
          <div>
            <dt>Create From</dt>
            <dd>StackScripts - HNS DANE One-Name Server</dd>
          </div>
          <div>
            <dt>Region</dt>
            <dd>Choose the closest core region to your users.</dd>
          </div>
          <div>
            <dt>Image</dt>
            <dd>Debian 13</dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd>Shared CPU - Nanode 1 GB</dd>
          </div>
          <div>
            <dt>Label</dt>
            <dd><code>hns-dane-YOURNAME</code></dd>
          </div>
          <div>
            <dt>IPv6</dt>
            <dd>No, unless you plan to publish AAAA and GLUE6 records.</dd>
          </div>
          <div>
            <dt>Authentication</dt>
            <dd>
              <p>SSH key recommended. Root password only if you do not have an SSH key.</p>
              <p>Generate a key:</p>
              <pre className="inline-code">ssh-keygen -t ed25519 -C "hns-dane-linode" -f ~/.ssh/hns-dane_linode</pre>
              <p>Show the public key for Linode:</p>
              <pre className="inline-code">cat ~/.ssh/hns-dane_linode.pub</pre>
              <p>Back up the key:</p>
              <pre className="inline-code">mkdir -p ~/hns-dane-backups && cp ~/.ssh/hns-dane_linode ~/.ssh/hns-dane_linode.pub ~/hns-dane-backups/</pre>
            </dd>
          </div>
          <div>
            <dt>Firewall</dt>
            <dd>Can skip and set as No firewall because it is handled by UFW.</dd>
          </div>
          <div>
            <dt>Backups</dt>
            <dd>Optional</dd>
          </div>
        </dl>
      </div>

      <div className="linode-after-card">
        <h2>After deployment</h2>
        <ol>
          <li>Open the dashboard.</li>
          <li>Copy the generated HNS resource commands.</li>
          <li>Publish GLUE/NS/DS in your wallet.</li>
          <li>Verify A, DNSKEY, DS, TLSA, and DANE status.</li>
        </ol>
        <div className="deploy-actions">
          <a className="button-link secondary" href={LINODE_BEGINNER_DEPLOY_URL} target="_blank" rel="noreferrer">{props.t.linode.guide}</a>
          <a className="button-link secondary" href={LINODE_STACKSCRIPT_URL} target="_blank" rel="noreferrer">{props.t.linode.stackScript}</a>
        </div>
      </div>
    </section>
  );
}

function App() {
  const urlPrefill = useMemo(() => readUrlPrefill(), []);
  const [language, setLanguage] = useState<LanguageCode>(() => {
    if (typeof window === 'undefined') return 'en';
    const saved = window.localStorage.getItem('hns-dane-language');
    return isLanguageCode(saved) ? saved : 'en';
  });
  const [domainType, setDomainType] = useState<DomainType>(urlPrefill.domainType);
  const [setupMode, setSetupMode] = useState<SetupMode>(urlPrefill.setupMode);
  const [domainInput, setDomainInput] = useState(urlPrefill.domainInput);
  const [nameserverHost, setNameserverHost] = useState(urlPrefill.nameserverHost);
  const [nameserverIpv4, setNameserverIpv4] = useState(urlPrefill.nameserverIpv4);
  const [nameserverIpv6, setNameserverIpv6] = useState(urlPrefill.nameserverIpv6);
  const [websiteIpv4, setWebsiteIpv4] = useState(urlPrefill.websiteIpv4);
  const [websiteIpv6, setWebsiteIpv6] = useState(urlPrefill.websiteIpv6);
  const [port, setPort] = useState(urlPrefill.port);
  const [pemInput, setPemInput] = useState(urlPrefill.pemInput);
  const [dnskeyInput, setDnskeyInput] = useState(urlPrefill.dnskeyInput);
  const [dnsServerPreset, setDnsServerPreset] = useState<DnsServerPreset>(urlPrefill.dnsServerPreset);
  const [showLinodeGuide, setShowLinodeGuide] = useState(false);
  const [touchedFields, setTouchedFields] = useState<TouchedFields>({});
  const [result, setResult] = useState<BootstrapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = localeText[language];

  const input = useMemo<BootstrapInput>(() => ({
    domainType,
    setupMode,
    domainInput,
    nameserverHost,
    nameserverIpv4,
    nameserverIpv6,
    websiteIpv4,
    websiteIpv6,
    port,
    protocol: 'tcp',
    pemInput,
    dnskeyInput,
    ttl: 3600,
    tlsaUsage: 3,
    tlsaSelector: 1,
    tlsaMatchingType: 1,
    dnsServerPreset,
    dsDigestType: 2
  }), [domainType, setupMode, domainInput, nameserverHost, nameserverIpv4, nameserverIpv6, websiteIpv4, websiteIpv6, port, pemInput, dnskeyInput, dnsServerPreset]);

  useEffect(() => {
    if (domainType === 'icann' && setupMode === 'hns-inline') setSetupMode('delegated');
  }, [domainType, setupMode]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtlLanguage(language) ? 'rtl' : 'ltr';
    window.localStorage.setItem('hns-dane-language', language);
  }, [language]);

  useEffect(() => {
    if (!domainInput.trim()) {
      setResult(null);
      setError(null);
      return;
    }

    let cancelled = false;
    generateBootstrap(input)
      .then((generated) => {
        if (!cancelled) {
          setResult(generated);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult(null);
          setError(err instanceof Error ? err.message : 'Unable to generate records.');
        }
      });
    return () => { cancelled = true; };
  }, [input]);

  function markTouched(field: FieldKey) {
    setTouchedFields((current) => current[field] ? current : { ...current, [field]: true });
  }

  const displayResult = useMemo(() => result ? localizeBootstrapResult(result, input, language) : null, [input, language, result]);
  const sections = useMemo(() => displayResult?.sections ?? [], [displayResult]);
  const handoffGuidance = useMemo(() => guidanceForIntent(urlPrefill.intent), [urlPrefill.intent]);
  const domainPlaceholder = domainType === 'hns' ? HNS_DOMAIN_PLACEHOLDER : ICANN_DOMAIN_PLACEHOLDER;
  const nameserverPlaceholder = domainType === 'hns' ? HNS_NAMESERVER_PLACEHOLDER : ICANN_NAMESERVER_PLACEHOLDER;
  const fieldStatuses = useMemo(() => {
    let normalizedDomain: string | null = null;
    try {
      const candidate = normalizeDomain(domainInput, domainType);
      if (validateDomainName(candidate)) normalizedDomain = candidate;
    } catch {
      normalizedDomain = null;
    }

    const nameserverHostValid = nameserverHost.trim() ? validateHostname(nameserverHost) : false;
    let nameserverAddressRequired = setupMode === 'hns-inline' && domainType === 'hns';
    if (setupMode === 'delegated') {
      try {
        nameserverAddressRequired = normalizedDomain && nameserverHostValid
          ? isInBailiwick(nameserverHost, normalizedDomain)
          : true;
      } catch {
        nameserverAddressRequired = true;
      }
    }

    const nameserverIpv4Valid = validateIpv4(nameserverIpv4);
    const nameserverIpv6Valid = validateIpv6(nameserverIpv6);
    const websiteIpv4Valid = validateIpv4(websiteIpv4);
    const websiteIpv6Valid = validateIpv6(websiteIpv6);

    return {
      certificate: requiredStatus(pemInput, touchedFields.pemInput, isValidPemInput(pemInput)),
      dnskey: requiredStatus(dnskeyInput, touchedFields.dnskeyInput, isValidDnskeyInput(dnskeyInput)),
      dnsServerPreset: 'good',
      domain: requiredStatus(domainInput, touchedFields.domain, Boolean(normalizedDomain)),
      domainType: 'good',
      nameserverHost: setupMode === 'delegated' ? requiredStatus(nameserverHost, touchedFields.nameserverHost, nameserverHostValid) : 'neutral',
      nameserverIpv4: nameserverAddressRequired
        ? requiredPairPrimaryStatus(nameserverIpv4, nameserverIpv6, touchedFields.nameserverIpv4, touchedFields.nameserverIpv6, nameserverIpv4Valid, nameserverIpv6Valid)
        : optionalStatus(nameserverIpv4, nameserverIpv4Valid),
      nameserverIpv6: optionalStatus(nameserverIpv6, nameserverIpv6Valid),
      port: isValidPort(port) ? 'good' : touchedFields.port ? 'error' : 'needed',
      setupMode: 'good',
      websiteIpv4: requiredPairPrimaryStatus(websiteIpv4, websiteIpv6, touchedFields.websiteIpv4, touchedFields.websiteIpv6, websiteIpv4Valid, websiteIpv6Valid),
      websiteIpv6: optionalStatus(websiteIpv6, websiteIpv6Valid)
    } satisfies Record<string, FieldStatus>;
  }, [domainInput, domainType, dnskeyInput, nameserverHost, nameserverIpv4, nameserverIpv6, pemInput, port, setupMode, touchedFields, websiteIpv4, websiteIpv6]);
  const howToContext = useMemo<HowToContext>(() => {
    const fallbackDomain = domainInput.trim() ? ensureRootDot(asciiHost(domainInput.trim())) : '<domain>.';
    const dnskeyZone = result?.normalizedDomain ?? fallbackDomain;
    const certServerName = withoutRootDot(result?.normalizedDomain ?? fallbackDomain);
    const certHost = websiteIpv4.trim() || websiteIpv6.trim() || certServerName;
    const dnskeyQueryServer = nameserverIpv4.trim() || nameserverIpv6.trim() || (nameserverHost.trim() ? ensureRootDot(asciiHost(nameserverHost.trim())) : '<nameserver-or-ip>');

    return {
      certConnectTarget: hostPort(certHost, port || 443),
      certServerName,
      dnskeyQueryServer,
      dnskeyZone
    };
  }, [domainInput, nameserverHost, nameserverIpv4, nameserverIpv6, port, result?.normalizedDomain, websiteIpv4, websiteIpv6]);

  if (showLinodeGuide) {
    return (
      <main>
        <LinodeGuideCard onBack={() => setShowLinodeGuide(false)} t={t} />
      </main>
    );
  }

  return (
    <main>
      <header className="hero">
        <div className="hero-top">
          <p className="eyebrow">{t.hero.eyebrow}</p>
          <label className="language-select">
            <span>{t.languageLabel}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as LanguageCode)}>
              {languageOptions.map((option) => (
                <option value={option.code} key={option.code}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <h1>{t.hero.title}</h1>
        <p className="hero-standard">
          ({t.hero.standard}) <a href="https://www.rfc-editor.org/info/rfc6698/">RFC 6698</a>
        </p>
        <ul className="hero-steps">
          <li>{t.hero.steps.enter}</li>
          <li>{t.hero.steps.send}</li>
          <li>{t.hero.steps.zone}</li>
          <li>{t.hero.steps.done}</li>
        </ul>
      </header>

      <HandoffCard guidance={handoffGuidance} />

      <section className="panel grid">
        <div className="form-card">
          <h2>{t.sections.domain}</h2>
          <LinodeSkipCard onOpen={() => setShowLinodeGuide(true)} t={t} />
          <Field label={t.fields.domain} help={domainType === 'hns' ? t.fields.hnsDomainHelp : t.fields.domainHelp} status={fieldStatuses.domain}>
            <input
              value={domainInput}
              onBlur={() => markTouched('domain')}
              onChange={(event) => {
                markTouched('domain');
                setDomainInput(event.target.value);
              }}
              placeholder={domainPlaceholder}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              pattern={domainType === 'hns' ? '[a-z0-9](?:(?:[a-z0-9]|_|-){0,61}[a-z0-9])?/' : undefined}
              title={domainType === 'hns' ? t.fields.hnsDomainHelp : undefined}
            />
            <FieldHowToText summary={t.faq.domainSummary} body={t.faq.domainBody} />
            {domainType === 'icann' && <FieldHowToText summary={t.faq.idnSummary} body={t.faq.idnBody} />}
          </Field>
          <Field label={t.fields.domainType} help={t.fields.domainTypeHelp} status={fieldStatuses.domainType}>
            <select
              value={domainType}
              onChange={(event) => setDomainType(event.target.value as DomainType)}
            >
              <option value="hns">{t.options.hns}</option>
              <option value="icann">{t.options.icann}</option>
            </select>
            <FieldHowToText summary={t.faq.splitSummary} body={t.faq.splitBody} />
          </Field>
          <Field label={t.fields.setupMode} help={t.fields.setupModeHelp} status={fieldStatuses.setupMode}>
            <select
              value={setupMode}
              onChange={(event) => setSetupMode(event.target.value as SetupMode)}
            >
              <option value="delegated">{t.options.delegated}</option>
              <option value="hns-inline" disabled={domainType !== 'hns'}>{t.options.hnsInline}</option>
            </select>
            <FieldHowToText summary={t.faq.setupModeSummary} body={t.faq.setupModeBody} />
          </Field>
        </div>

        <div className="form-card">
          <h2>{t.sections.server}</h2>
          <Field label={t.fields.dnsServerPreset} help={t.fields.dnsServerPresetHelp} status={fieldStatuses.dnsServerPreset}>
            <select value={dnsServerPreset} onChange={(event) => setDnsServerPreset(event.target.value as DnsServerPreset)}>
              <option value="generic-zone">{t.options.genericZone}</option>
              <option value="hosted-dns">{t.options.hostedDns}</option>
              <option value="powerdns">{t.options.powerdns}</option>
              <option value="knot">{t.options.knot}</option>
              <option value="bind">{t.options.bind}</option>
              <option value="windows-server">{t.options.windowsServer}</option>
              <option value="nsd">{t.options.nsd}</option>
            </select>
            <FieldHowToText summary={t.faq.presetSummary} body={t.faq.presetBody} />
            <SelfHostedQuickStarts />
            <FieldHowToText summary={t.faq.hostedSummary} body={t.faq.hostedBody} />
          </Field>
          {setupMode !== 'hns-inline' && (
            <Field label={t.fields.nameserverHost} help={t.fields.nameserverHostHelp} status={fieldStatuses.nameserverHost}>
              <input
                value={nameserverHost}
                onBlur={() => markTouched('nameserverHost')}
                onChange={(event) => {
                  markTouched('nameserverHost');
                  setNameserverHost(event.target.value);
                }}
                placeholder={nameserverPlaceholder}
                autoComplete="off"
              />
            </Field>
          )}
          <Field label={t.fields.nameserverIpv4} help={t.fields.nameserverIpv4Help} status={fieldStatuses.nameserverIpv4}>
            <input
              value={nameserverIpv4}
              onBlur={() => markTouched('nameserverIpv4')}
              onChange={(event) => {
                markTouched('nameserverIpv4');
                setNameserverIpv4(event.target.value);
              }}
              placeholder={NAMESERVER_IPV4_PLACEHOLDER}
              autoComplete="off"
            />
            <FieldHowToText summary={t.faq.nameserverIpv4Summary} body={t.faq.nameserverIpv4Body} />
          </Field>
          <Field label={t.fields.nameserverIpv6} help={t.fields.nameserverIpv6Help} status={fieldStatuses.nameserverIpv6}>
            <input
              value={nameserverIpv6}
              onBlur={() => markTouched('nameserverIpv6')}
              onChange={(event) => {
                markTouched('nameserverIpv6');
                setNameserverIpv6(event.target.value);
              }}
              autoComplete="off"
            />
          </Field>
          <Field label={t.fields.websiteIpv4} help={t.fields.websiteIpv4Help} status={fieldStatuses.websiteIpv4}>
            <input
              value={websiteIpv4}
              onBlur={() => markTouched('websiteIpv4')}
              onChange={(event) => {
                markTouched('websiteIpv4');
                setWebsiteIpv4(event.target.value);
              }}
              placeholder={WEBSITE_IPV4_PLACEHOLDER}
              autoComplete="off"
            />
            <FieldHowToText summary={t.faq.websiteIpv4Summary} body={t.faq.websiteIpv4Body} />
          </Field>
          <Field label={t.fields.websiteIpv6} help={t.fields.websiteIpv6Help} status={fieldStatuses.websiteIpv6}>
            <input
              value={websiteIpv6}
              onBlur={() => markTouched('websiteIpv6')}
              onChange={(event) => {
                markTouched('websiteIpv6');
                setWebsiteIpv6(event.target.value);
              }}
              autoComplete="off"
            />
          </Field>
        </div>

        <div className="form-card">
          <h2>{t.sections.dane}</h2>
          <Field label={t.fields.port} help={t.fields.portHelp} status={fieldStatuses.port}>
            <input
              type="number"
              min="1"
              max="65535"
              value={port}
              onBlur={() => markTouched('port')}
              onChange={(event) => {
                markTouched('port');
                setPort(Number(event.target.value));
              }}
            />
          </Field>
          <Field label={t.fields.certificate} help={t.fields.certificateHelp} status={fieldStatuses.certificate}>
            <textarea
              rows={7}
              value={pemInput}
              onBlur={() => markTouched('pemInput')}
              onChange={(event) => {
                markTouched('pemInput');
                setPemInput(event.target.value);
              }}
              placeholder={CERTIFICATE_PLACEHOLDER}
            />
            <CertificateHowTo context={howToContext} t={t} />
          </Field>
          <Field label={t.fields.dnskey} help={t.fields.dnskeyHelp} status={fieldStatuses.dnskey}>
            <textarea
              rows={4}
              value={dnskeyInput}
              onBlur={() => markTouched('dnskeyInput')}
              onChange={(event) => {
                markTouched('dnskeyInput');
                setDnskeyInput(event.target.value);
              }}
              placeholder={`${howToContext.dnskeyZone} 3600 IN DNSKEY 257 3 13 ...`}
            />
            <DnskeyHowTo context={howToContext} t={t} />
          </Field>
        </div>
      </section>

      {error && <section className="error-card">{error}</section>}

      {displayResult && (
        <section className="outputs">
          <SetupSummary result={displayResult} t={t} />
          <StatusList checks={displayResult.statusChecks} t={t} />

          {sections.map((section) => <OutputBox key={section.id} section={section} result={displayResult} t={t} />)}
        </section>
      )}

      <footer className="site-footer">
        <span>Donation:</span>
        <a href={DONATION_URI}>{DONATION_ADDRESS}</a>
        <span>GitHub:</span>
        <a href={GITHUB_REPOSITORY_URL}>handshake-rs/hns-dane-bootstrap-generator</a>
        <span>Docs:</span>
        <a href={WEB_ADMIN_GUIDE_URL}>Web admin guide</a>
      </footer>
    </main>
  );
}

export default App;
