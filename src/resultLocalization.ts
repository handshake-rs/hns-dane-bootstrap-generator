import type { BootstrapInput, BootstrapNotice, BootstrapResult, DnsServerPreset, GeneratedLine, StatusCheck } from './core/types';
import type { LanguageCode } from './i18n';

type CoreCopy = {
  notices: Record<string, string>;
  statusDetails: Record<string, string>;
  explanations: Record<string, string>;
  quickSteps: {
    inline: {
      server: string;
      dnssec: string;
      dsReady: string;
      dsMissing: string;
      tlsaReady: string;
      tlsaMissing: string;
    };
    delegated: {
      server: string;
      dnssec: string;
      dsReady: string;
      dsMissing: string;
      tlsaReady: string;
      tlsaMissing: string;
      parentHns: string;
      parentIcann: string;
    };
  };
  webNotes: {
    serve: string;
    rollover: string;
    noPlugin: string;
    clientSupport: string;
  };
  verify: {
    hnsInline: string;
    expectedAddress: string;
    hnsFullChain: string;
  };
  fallbackNotice: string;
  fallbackStatusDetail: string;
  fallbackExplanation: string;
  helpTips: {
    fastPath: string;
    tlsaPin: string;
    parentSplit: string;
    idna: string;
    hnsGlue: (nameserver: string, domain: string) => string;
    hnsInline: string;
    preset: Record<DnsServerPreset, string>;
  };
};

const en: CoreCopy = {
  notices: {},
  statusDetails: {},
  explanations: {},
  quickSteps: {
    inline: {
      server: '1. Put the server records on the authoritative DNS server.',
      dnssec: '2. Enable DNSSEC signing on the zone.',
      dsReady: '3. Send SYNTH and DS records to the HNS wallet.',
      dsMissing: '3. Paste the DNSKEY here, then send SYNTH and DS records to the HNS wallet.',
      tlsaReady: '4. Serve the matching HTTPS certificate/key.',
      tlsaMissing: '4. Paste the leaf certificate or PUBLIC KEY to generate TLSA.'
    },
    delegated: {
      server: '1. Put the server records on the authoritative DNS server.',
      dnssec: '2. Enable DNSSEC signing on the zone.',
      dsReady: '3. Copy the DS into the wallet or registrar.',
      dsMissing: '3. Paste the DNSKEY here, then copy the generated DS into the wallet or registrar.',
      tlsaReady: '4. Serve the matching HTTPS certificate/key.',
      tlsaMissing: '4. Paste the leaf certificate or PUBLIC KEY to generate TLSA.',
      parentHns: '5. Submit the HNS name-resource update.',
      parentIcann: '5. Save registrar nameserver, glue, and DS settings.'
    }
  },
  webNotes: {
    serve: 'Serve the certificate whose public key matches the TLSA SPKI hash.',
    rollover: 'For key rollover, publish current and next TLSA records, wait at least one TTL, switch the server key, then remove the old TLSA after another TTL.',
    noPlugin: 'Nginx/Apache/Caddy do not need a DANE plugin; DANE lives in DNS.',
    clientSupport: 'DANE is enforced only by clients that validate DNSSEC and check TLSA records; ordinary HTTPS clients may ignore the published TLSA policy.'
  },
  verify: {
    hnsInline: '# After the HNS update confirms, test full-chain resolution with an HNS-aware resolver/browser.',
    expectedAddress: '# Expected address',
    hnsFullChain: '# For HNS full-chain tests, query through your HNS-aware resolver after the wallet update confirms.'
  },
  fallbackNotice: '',
  fallbackStatusDetail: '',
  fallbackExplanation: '',
  helpTips: {
    fastPath: 'Fastest reliable path: create the authoritative zone, enable DNSSEC signing, paste DNSKEY here, then copy the generated DS to the wallet or registrar.',
    tlsaPin: 'TLSA 3 1 1 pins the service public key with SHA-256. Certificate renewal can be easy if the server keeps the same keypair.',
    parentSplit: 'Parent records and server records are different. The wallet or registrar delegates. The DNS server publishes the site records and TLSA.',
    idna: 'Internationalized names are accepted as input, but DNS records use IDNA A-labels such as xn--bcher-kva.example.',
    hnsGlue: (nameserver, domain) => `For HNS delegated mode, GLUE4/GLUE6 is needed when the nameserver lives under the HNS name itself, such as ${nameserver} for ${domain}/.`,
    hnsInline: 'HNS SYNTH mode stores nameserver IPs in the HNS resource. Website A/AAAA records and TLSA records still live on the authoritative DNS server.',
    preset: {
      'generic-zone': 'Generic zone-file output works with BIND, Knot, NSD, and many DNS hosting import tools.',
      'hosted-dns': 'Hosted DNS is the shortest path if your provider supports DNSSEC, custom DS export, and TLSA records.',
      powerdns: 'PowerDNS is a short path when you want an admin API or database-backed DNS.',
      knot: 'Knot DNS is a clean modern authoritative server with simple DNSSEC automation.',
      bind: 'BIND 9 is widely documented and package-manager friendly, but its config is more verbose.',
      'windows-server': 'Windows Server DNS can host and sign the authoritative zone with DNS Manager or PowerShell.',
      nsd: 'NSD is small and reliable, but DNSSEC signing is usually handled by a separate signing step.'
    }
  }
};

const noticesEn = {
  invalidDomain: 'Domain format is not valid for DNS output.',
  idna: 'Internationalized domain input is converted to DNS ASCII A-labels such as xn--... in generated records.',
  ttl: 'TTL should normally be between 60 and 86400 seconds.',
  inlineIcann: 'SYNTH nameserver mode is HNS-only. ICANN output uses named DNS delegation.',
  synthNsMissing: 'HNS SYNTH mode needs at least one nameserver IP address.',
  websiteIpv4: 'Website IPv4 address is not valid.',
  websiteIpv6: 'Website IPv6 address is not valid.',
  nsIpv4: 'Nameserver IPv4 address is not valid.',
  nsIpv6: 'Nameserver IPv6 address is not valid.',
  nsMissing: 'Delegated mode needs a nameserver hostname.',
  nsInvalid: 'Nameserver hostname is not valid.',
  noWebsiteIp: 'No website IPv4 or IPv6 address was supplied.',
  glueRequired: 'The nameserver is inside the same zone, so glue is required. Add at least one nameserver IP address.',
  tlsaNoDs: 'TLSA is generated, but DNSSEC is incomplete until you publish a parent-side DS record.',
  tlsaUsage: 'TLSA usage 3 is the default for this onboarding flow. Other usages are advanced and depend on CA/TA handling.',
  tlsaError: 'Unable to generate TLSA record.',
  dsError: 'Unable to generate DS record from DNSKEY input.',
  dnskeyProtocol: 'DNSKEY protocol is normally 3. Check that the DNSKEY line was pasted correctly.',
  dnskeySep: 'The DNSKEY does not have the SEP/KSK flag. DS records are normally made from the KSK.',
  dnskeySha1: 'This DNSKEY algorithm is not recommended for new DNSSEC signing. Prefer a currently supported algorithm such as 8, 13, or 15 when the DNS server supports it.'
} as const;

const detailsEn = {
  domainOk: 'Domain is normalized for DNS output.',
  domainMissing: 'Enter the HNS name or ICANN domain.',
  websiteOk: 'Website A/AAAA records can be generated.',
  websiteMissing: 'Add at least one website IPv4 or IPv6 address.',
  synthNsOk: 'SYNTH nameserver IP can be generated.',
  synthNsMissing: 'Add at least one nameserver IPv4 or IPv6 address.',
  nsOk: 'Delegation target is present.',
  nsMissing: 'Add the authoritative nameserver hostname.',
  glueInZone: 'Nameserver is inside the zone, so glue must be in the parent records.',
  glueExternal: 'Nameserver is external, so glue is handled by its own parent.',
  dsOk: 'Parent-side DS is generated from DNSKEY.',
  dsMissing: 'Paste DNSKEY after signing the authoritative zone.',
  tlsaOk: 'TLSA is generated from certificate/public key.',
  tlsaMissing: 'Paste a certificate or PUBLIC KEY in the DANE section to generate TLSA.'
} as const;

const explanationsEn = {
  inline4: 'HNS wallet-side synthetic IPv4 nameserver referral.',
  inline6: 'HNS wallet-side synthetic IPv6 nameserver referral.',
  inlinePlaceholder: 'Placeholder: add at least one nameserver IPv4 or IPv6 address to generate a concrete HNS SYNTH referral before the DS record.',
  glue4: 'HNS wallet-side glue record for the IPv4 address of your in-name authoritative nameserver.',
  glue6: 'HNS wallet-side glue record for the IPv6 address of your in-name authoritative nameserver.',
  referralPlaceholder: 'Placeholder: delegated HNS needs an NS or GLUE referral before the DS record. If the nameserver is inside this name, add GLUE4 or GLUE6 with its address; if it is external, use an NS record.',
  hnsNs: 'HNS wallet-side delegation record pointing the name at an external authoritative nameserver.',
  hnsDs: 'HNS wallet-side DNSSEC delegation signer record derived from the child-zone DNSKEY.',
  dsPlaceholder: 'Placeholder: paste your authoritative-zone DNSKEY to generate the exact parent-side DS record.',
  hnsWalletCommands: 'hsw-cli creates or broadcasts the HNS name UPDATE from the wallet. hsd-cli checks the name resource after confirmation and the tree interval.',
  hnsWalletCommandsPlaceholder: 'Fill in concrete NS, GLUE, SYNTH, or DS records before broadcasting an HNS name UPDATE. Do not send an empty records array unless you mean to clear the name resource.',
  hnsWalletBobOption: 'Bob Wallet can update the same HNS name resource through its desktop UI. Use the concrete parent records shown here and confirm the wallet prompt before broadcasting.',
  hnsWalletGenericOption: 'These records are tool-neutral. This project does not claim that a particular browser extension can submit HNS name-resource updates; verify support in the wallet or tool\'s current documentation before broadcasting.',
  hnsWalletGenericOptionPlaceholder: 'No browser-extension name-resource update control is currently qualified by this project. Fill in concrete records and verify explicit UPDATE support before using another wallet or tool.',
  registrarNs: 'Registrar-side nameserver delegation.',
  registrarGlue4: 'Registrar-side glue is needed because the nameserver is inside the delegated domain.',
  registrarGlue6: 'Registrar-side IPv6 glue is needed because the nameserver is inside the delegated domain.',
  registrarDs: 'Registrar-side DS record derived from the child-zone DNSKEY.',
  registrarDsPlaceholder: 'Placeholder: paste your authoritative-zone DNSKEY to generate the exact registrar-side DS record.',
  authNs: 'Authoritative-zone NS record naming a server responsible for this zone.',
  authA: 'Authoritative-zone IPv4 address for the website apex.',
  authAaaa: 'Authoritative-zone IPv6 address for the website apex.',
  authTlsa: 'Authoritative-zone DANE/TLSA record for the TLS service.',
  authTlsaPlaceholder: 'Placeholder: paste a PEM certificate or PUBLIC KEY to generate the exact TLSA association data.',
  webServe: 'If the certificate key changes, publish the new TLSA record before switching the web server to the new key.',
  webRollover: 'TLSA 3 1 1 pins the service public key, so DANE clients can fail while caches still hold only the old association.',
  webNoPlugin: 'The TLS server serves a normal certificate. A DANE-aware client verifies the DNSSEC-protected TLSA record.',
  webClientSupport: 'Publishing TLSA is necessary for DANE, but client software must actually perform DNSSEC validation and DANE authentication.',
  serverPreset: 'Server-side starter snippet. Create the zone, publish NS/A/AAAA/TLSA, enable DNSSEC signing, then publish DS at the parent.',
  verifyDelegated: 'Commands to check that the authoritative server answers before and after parent-side delegation.',
  verifyInline: 'Commands to check that the SYNTH-addressed authoritative server answers before and after the HNS update.',
  integrator: 'Machine-readable output for wallets, future APIs, or integration tests. It is not automatically submitted anywhere.',
  stepInline1: 'SYNTH points resolvers to nameserver IPs; the zone still serves website A/AAAA records and TLSA records.',
  stepInline2: 'The DNS server should manage the signing keys and signed zone.',
  stepInline3: 'SYNTH is the parent-side referral; DS connects DNSSEC to the signed zone.',
  stepServer: 'Use the selected server preset or the generic zone-file output.',
  stepDnssec: 'The DNS server should manage the signing keys and signed zone.',
  stepDs: 'The DS connects the parent layer to the signed child zone.',
  stepTlsa: 'TLSA goes on the authoritative DNS server.',
  stepParent: 'This activates the parent-side delegation path.'
} as const;

function buildCopy(
  notices: Record<string, string>,
  statusDetails: Record<string, string>,
  explanations: Record<string, string>,
  rest: Omit<CoreCopy, 'notices' | 'statusDetails' | 'explanations'>
): CoreCopy {
  return {
    notices: Object.fromEntries(Object.entries(noticesEn).map(([key, value]) => [value, notices[key] ?? value])),
    statusDetails: Object.fromEntries(Object.entries(detailsEn).map(([key, value]) => [value, statusDetails[key] ?? value])),
    explanations: Object.fromEntries(Object.entries(explanationsEn).map(([key, value]) => [value, explanations[key] ?? value])),
    ...rest
  };
}

const copy: Record<LanguageCode, CoreCopy> = {
  en,
  es: buildCopy(
    {
      invalidDomain: 'El formato del dominio no es válido para salida DNS.',
      idna: 'La entrada de dominio internacionalizado se convierte a A-labels ASCII DNS como xn--... en los registros generados.',
      ttl: 'El TTL normalmente debe estar entre 60 y 86400 segundos.',
      inlineIcann: 'El modo nameserver SYNTH solo es para HNS. La salida ICANN usa delegación DNS con nombre.',
      synthNsMissing: 'El modo HNS SYNTH necesita al menos una IP de nameserver.',
      websiteIpv4: 'La dirección IPv4 del sitio web no es válida.',
      websiteIpv6: 'La dirección IPv6 del sitio web no es válida.',
      nsIpv4: 'La dirección IPv4 del servidor DNS no es válida.',
      nsIpv6: 'La dirección IPv6 del servidor DNS no es válida.',
      nsMissing: 'El modo delegado necesita un hostname de servidor DNS.',
      nsInvalid: 'El hostname del servidor DNS no es válido.',
      noWebsiteIp: 'No se indicó ninguna dirección IPv4 o IPv6 para el sitio web.',
      glueRequired: 'El servidor DNS está dentro de la misma zona, así que se requiere glue. Agrega al menos una IP del servidor DNS.',
      tlsaNoDs: 'TLSA está generado, pero DNSSEC queda incompleto hasta publicar un registro DS en el padre.',
      tlsaUsage: 'TLSA usage 3 es el valor por defecto de este flujo. Otros usos son avanzados y dependen de CA/TA.',
      tlsaError: 'No se pudo generar el registro TLSA.',
      dsError: 'No se pudo generar el registro DS desde la DNSKEY.',
      dnskeyProtocol: 'El protocolo DNSKEY normalmente es 3. Revisa que la línea DNSKEY se haya pegado correctamente.',
      dnskeySep: 'La DNSKEY no tiene la bandera SEP/KSK. Los registros DS normalmente se hacen desde la KSK.',
      dnskeySha1: 'Este algoritmo DNSKEY no se recomienda para nuevas firmas DNSSEC. Prefiere un algoritmo soportado actualmente, como 8, 13 o 15, cuando el servidor lo soporte.'
    },
    {
      domainOk: 'El dominio está normalizado para salida DNS.',
      domainMissing: 'Introduce el nombre HNS o dominio ICANN.',
      websiteOk: 'Se pueden generar registros A/AAAA del sitio web.',
      websiteMissing: 'Agrega al menos una dirección IPv4 o IPv6 del sitio web.',
      synthNsOk: 'Se puede generar la IP de nameserver SYNTH.',
      synthNsMissing: 'Agrega al menos una dirección IPv4 o IPv6 de nameserver.',
      nsOk: 'El destino de delegación está presente.',
      nsMissing: 'Agrega el hostname del servidor DNS autoritativo.',
      glueInZone: 'El servidor DNS está dentro de la zona, así que glue debe estar en los registros padre.',
      glueExternal: 'El servidor DNS es externo, así que su propio padre gestiona el glue.',
      dsOk: 'El DS del padre se generó desde DNSKEY.',
      dsMissing: 'Pega DNSKEY después de firmar la zona autoritativa.',
      tlsaOk: 'TLSA se generó desde el certificado/clave pública.',
      tlsaMissing: 'Pega un certificado o PUBLIC KEY para generar TLSA.'
    },
    {
      inline4: 'Referencia sintética IPv4 de nameserver del lado cartera HNS.',
      inline6: 'Referencia sintética IPv6 de nameserver del lado cartera HNS.',
      glue4: 'Registro glue HNS para la IPv4 de tu servidor DNS autoritativo bajo el mismo nombre.',
      glue6: 'Registro glue HNS para la IPv6 de tu servidor DNS autoritativo bajo el mismo nombre.',
      hnsNs: 'Registro de delegación HNS que apunta el nombre a un servidor DNS autoritativo externo.',
      hnsDs: 'Registro DS de delegación DNSSEC HNS derivado de la DNSKEY de la zona hija.',
      dsPlaceholder: 'Pendiente: pega la DNSKEY de tu zona autoritativa para generar el DS exacto del padre.',
      registrarNs: 'Delegación de nameserver del lado registrador.',
      registrarGlue4: 'Glue del registrador necesario porque el servidor DNS está dentro del dominio delegado.',
      registrarGlue6: 'Glue IPv6 del registrador necesario porque el servidor DNS está dentro del dominio delegado.',
      registrarDs: 'Registro DS del registrador derivado de la DNSKEY de la zona hija.',
      registrarDsPlaceholder: 'Pendiente: pega la DNSKEY de tu zona autoritativa para generar el DS exacto del registrador.',
      authNs: 'Registro NS de la zona autoritativa que nombra el servidor responsable de esta zona.',
      authA: 'Dirección IPv4 de la zona autoritativa para el apex del sitio web.',
      authAaaa: 'Dirección IPv6 de la zona autoritativa para el apex del sitio web.',
      authTlsa: 'Registro DANE/TLSA de la zona autoritativa para el servicio TLS.',
      authTlsaPlaceholder: 'Pendiente: pega un certificado PEM o PUBLIC KEY para generar los datos TLSA exactos.',
      webServe: 'Si cambia la clave del certificado, publica el nuevo TLSA antes de cambiar el servidor web a la nueva clave.',
      webNoPlugin: 'El servidor TLS entrega un certificado normal. Un cliente DANE verifica el registro TLSA protegido por DNSSEC.',
      serverPreset: 'Ejemplo inicial del lado servidor. Crea la zona, publica NS/A/AAAA/TLSA, activa DNSSEC y luego publica DS en el padre.',
      verifyDelegated: 'Comandos para comprobar que el servidor autoritativo responde antes y después de la delegación padre.',
      verifyInline: 'Comandos para comprobar que el servidor autoritativo direccionado por SYNTH responde antes y después de la actualización HNS.',
      integrator: 'Salida legible por máquina para carteras, APIs futuras o pruebas de integración. No se envía automáticamente.',
      stepInline1: 'SYNTH apunta los resolvedores a IPs de nameserver; la zona sigue sirviendo registros A/AAAA del sitio web y registros TLSA.',
      stepInline2: 'El servidor DNS debe gestionar las claves de firma y la zona firmada.',
      stepInline3: 'SYNTH es la referencia del lado padre; DS conecta DNSSEC con la zona firmada.',
      stepServer: 'Usa el preset elegido o la salida de archivo de zona genérico.',
      stepDnssec: 'El servidor DNS debe gestionar las claves de firma y la zona firmada.',
      stepDs: 'El DS conecta la capa padre con la zona hija firmada.',
      stepTlsa: 'TLSA va en el servidor DNS autoritativo.',
      stepParent: 'Esto activa la ruta de delegación del lado padre.'
    },
    {
      quickSteps: {
        inline: {
          server: '1. Pon los registros del servidor en el DNS autoritativo.',
          dnssec: '2. Activa la firma DNSSEC en la zona.',
          dsReady: '3. Envía los registros SYNTH y DS a la cartera HNS.',
          dsMissing: '3. Pega la DNSKEY aquí y luego envía los registros SYNTH y DS a la cartera HNS.',
          tlsaReady: '4. Sirve el certificado/clave HTTPS correspondiente.',
          tlsaMissing: '4. Pega el certificado de hoja o PUBLIC KEY para generar TLSA.'
        },
        delegated: {
          server: '1. Pon los registros del servidor en el DNS autoritativo.',
          dnssec: '2. Activa la firma DNSSEC en la zona.',
          dsReady: '3. Copia el DS en la cartera o registrador.',
          dsMissing: '3. Pega la DNSKEY aquí y luego copia el DS generado a la cartera o registrador.',
          tlsaReady: '4. Sirve el certificado/clave HTTPS correspondiente.',
          tlsaMissing: '4. Pega el certificado de hoja o PUBLIC KEY para generar TLSA.',
          parentHns: '5. Envía la actualización del recurso de nombre HNS.',
          parentIcann: '5. Guarda nameserver, glue y DS en el registrador.'
        }
      },
      webNotes: {
        serve: 'Sirve el certificado cuya clave pública coincide con el hash SPKI de TLSA.',
        rollover: 'Para rotar claves, publica TLSA actual y siguiente, espera al menos un TTL, cambia la clave del servidor y elimina el TLSA antiguo después de otro TTL.',
        noPlugin: 'Nginx/Apache/Caddy no necesitan plugin DANE; DANE vive en DNS.',
        clientSupport: 'DANE solo se aplica en clientes que validan DNSSEC y revisan TLSA; los clientes HTTPS comunes pueden ignorar la política TLSA publicada.'
      },
      verify: {
        hnsInline: '# Cuando confirme la actualización HNS, prueba con un resolvedor/navegador compatible con HNS.',
        expectedAddress: '# Dirección esperada',
        hnsFullChain: '# Para pruebas HNS de cadena completa, consulta con tu resolvedor compatible con HNS después de confirmar la actualización de cartera.'
      },
      fallbackNotice: 'La entrada no se pudo procesar. Revisa el campo correspondiente y vuelve a intentarlo.',
      fallbackStatusDetail: 'Revisa este elemento antes de publicar los registros.',
      fallbackExplanation: 'Línea generada para este paso. Copia el valor solo en el destino indicado por el encabezado.',
      helpTips: {
        fastPath: 'Ruta fiable más rápida: crea la zona autoritativa, activa DNSSEC, pega DNSKEY aquí y copia el DS generado a la cartera o registrador.',
        tlsaPin: 'TLSA 3 1 1 fija la clave pública del servicio con SHA-256. La renovación del certificado puede ser simple si el servidor mantiene el mismo par de claves.',
        parentSplit: 'Los registros padre y de servidor son distintos. La cartera o registrador delega. El DNS autoritativo publica los registros del sitio y TLSA.',
        idna: 'Se aceptan nombres internacionalizados, pero los registros DNS usan A-labels IDNA como xn--bcher-kva.example.',
        hnsGlue: (nameserver, domain) => `En modo HNS delegado, GLUE4/GLUE6 es necesario cuando el nameserver vive bajo el propio nombre HNS, como ${nameserver} para ${domain}/.`,
        hnsInline: 'El modo HNS SYNTH guarda IPs de nameserver en el recurso HNS. Los registros A/AAAA del sitio y los registros TLSA siguen en el servidor DNS autoritativo.',
        preset: {
          'generic-zone': 'La salida de zona genérica funciona con BIND, Knot, NSD y muchas herramientas de importación DNS.',
          'hosted-dns': 'DNS alojado es el camino más corto si tu proveedor soporta DNSSEC, exportación DS personalizada y TLSA.',
          powerdns: 'PowerDNS es un camino corto si quieres DNS con API o base de datos.',
          knot: 'Knot DNS es un valor moderno y limpio con automatización DNSSEC sencilla.',
          bind: 'BIND 9 tiene mucha documentación y paquetes disponibles, pero su configuración es más verbosa.',
          'windows-server': 'Windows Server DNS puede alojar y firmar la zona autoritativa con DNS Manager o PowerShell.',
          nsd: 'NSD es pequeño y fiable, pero la firma DNSSEC normalmente se maneja aparte.'
        }
      }
    }
  ),
  fr: buildCopy(
    {
      invalidDomain: 'Le format du domaine n’est pas valide pour une sortie DNS.',
      idna: 'Le domaine internationalisé est converti en A-labels ASCII DNS comme xn--... dans les enregistrements générés.',
      ttl: 'Le TTL devrait normalement être entre 60 et 86400 secondes.',
      inlineIcann: 'Le mode serveur de noms SYNTH est réservé à HNS. La sortie ICANN utilise une délégation DNS nommée.',
      synthNsMissing: 'Le mode HNS SYNTH nécessite au moins une adresse IP de serveur de noms.',
      websiteIpv4: 'L’adresse IPv4 du site web n’est pas valide.',
      websiteIpv6: 'L’adresse IPv6 du site web n’est pas valide.',
      nsIpv4: 'L’adresse IPv4 du serveur de noms n’est pas valide.',
      nsIpv6: 'L’adresse IPv6 du serveur de noms n’est pas valide.',
      nsMissing: 'Le mode délégué nécessite un nom de serveur de noms.',
      nsInvalid: 'Le nom du serveur de noms n’est pas valide.',
      noWebsiteIp: 'Aucune adresse IPv4 ou IPv6 du site web n’a été fournie.',
      glueRequired: 'Le serveur de noms est dans la même zone, donc la glue est requise. Ajoutez au moins une adresse IP de serveur de noms.',
      tlsaNoDs: 'TLSA est généré, mais DNSSEC reste incomplet tant qu’un DS parent n’est pas publié.',
      tlsaUsage: 'TLSA usage 3 est la valeur par défaut de ce parcours. Les autres usages sont avancés et dépendent de CA/TA.',
      tlsaError: 'Impossible de générer l’enregistrement TLSA.',
      dsError: 'Impossible de générer l’enregistrement DS depuis la DNSKEY.',
      dnskeyProtocol: 'Le protocole DNSKEY est normalement 3. Vérifiez que la ligne DNSKEY a été collée correctement.',
      dnskeySep: 'La DNSKEY n’a pas le drapeau SEP/KSK. Les DS sont normalement créés depuis la KSK.',
      dnskeySha1: 'Cet algorithme DNSKEY n’est pas recommandé pour les nouvelles signatures DNSSEC. Préférez un algorithme actuellement pris en charge, comme 8, 13 ou 15, si le serveur le prend en charge.'
    },
    {
      domainOk: 'Le domaine est normalisé pour la sortie DNS.',
      domainMissing: 'Saisissez le nom HNS ou le domaine ICANN.',
      websiteOk: 'Les enregistrements A/AAAA du site web peuvent être générés.',
      websiteMissing: 'Ajoutez au moins une adresse IPv4 ou IPv6 du site web.',
      synthNsOk: 'L’adresse IP de serveur de noms SYNTH peut être générée.',
      synthNsMissing: 'Ajoutez au moins une adresse IPv4 ou IPv6 de serveur de noms.',
      nsOk: 'La cible de délégation est présente.',
      nsMissing: 'Ajoutez le nom du serveur DNS faisant autorité.',
      glueInZone: 'Le serveur de noms est dans la zone, donc la glue doit être dans les enregistrements parent.',
      glueExternal: 'Le serveur de noms est externe, donc sa propre zone parente gère la glue.',
      dsOk: 'Le DS parent est généré depuis DNSKEY.',
      dsMissing: 'Collez DNSKEY après la signature de la zone faisant autorité.',
      tlsaOk: 'TLSA est généré depuis le certificat/la clé publique.',
      tlsaMissing: 'Collez un certificat ou une PUBLIC KEY pour générer TLSA.'
    },
    {
      serverPreset: 'Extrait serveur de départ. Créez la zone, publiez NS/A/AAAA/TLSA, activez DNSSEC, puis publiez DS chez le parent.',
      verifyDelegated: 'Commandes pour vérifier que le serveur faisant autorité répond avant et après la délégation parente.',
      inline4: 'Référence synthétique IPv4 de serveur de noms côté wallet HNS.',
      inline6: 'Référence synthétique IPv6 de serveur de noms côté wallet HNS.',
      verifyInline: 'Commandes pour vérifier que le serveur faisant autorité adressé par SYNTH répond avant et après la mise à jour HNS.',
      integrator: 'Sortie lisible par machine pour wallets, futures APIs ou tests d’intégration. Elle n’est pas soumise automatiquement.'
    },
    {
      quickSteps: {
        inline: {
          server: '1. Mettez les enregistrements serveur sur le DNS faisant autorité.',
          dnssec: '2. Activez la signature DNSSEC sur la zone.',
          dsReady: '3. Envoyez les enregistrements SYNTH et DS au wallet HNS.',
          dsMissing: '3. Collez DNSKEY ici, puis envoyez les enregistrements SYNTH et DS au wallet HNS.',
          tlsaReady: '4. Servez le certificat/la clé HTTPS correspondant.',
          tlsaMissing: '4. Collez le certificat feuille ou PUBLIC KEY pour générer TLSA.'
        },
        delegated: {
          server: '1. Mettez les enregistrements serveur sur le DNS faisant autorité.',
          dnssec: '2. Activez la signature DNSSEC sur la zone.',
          dsReady: '3. Copiez le DS dans le wallet ou le bureau d’enregistrement.',
          dsMissing: '3. Collez DNSKEY ici, puis copiez le DS généré dans le wallet ou le bureau d’enregistrement.',
          tlsaReady: '4. Servez le certificat/la clé HTTPS correspondant.',
          tlsaMissing: '4. Collez le certificat feuille ou PUBLIC KEY pour générer TLSA.',
          parentHns: '5. Soumettez la mise à jour de ressource de nom HNS.',
          parentIcann: '5. Enregistrez nameserver, glue et DS chez le bureau d’enregistrement.'
        }
      },
      webNotes: {
        serve: 'Servez le certificat dont la clé publique correspond au hachage SPKI TLSA.',
        rollover: 'Pour une rotation de clé, publiez les TLSA actuel et suivant, attendez au moins un TTL, changez la clé du serveur, puis supprimez l’ancien TLSA après un autre TTL.',
        noPlugin: 'Nginx/Apache/Caddy n’ont pas besoin de plugin DANE ; DANE vit dans DNS.',
        clientSupport: 'DANE n’est appliqué que par les clients qui valident DNSSEC et vérifient TLSA ; les clients HTTPS ordinaires peuvent ignorer la politique TLSA publiée.'
      },
      verify: {
        hnsInline: '# Après confirmation de la mise à jour HNS, testez avec un résolveur/navigateur compatible HNS.',
        expectedAddress: '# Adresse attendue',
        hnsFullChain: '# Pour les tests HNS de chaîne complète, interrogez via votre résolveur compatible HNS après confirmation du wallet.'
      },
      fallbackNotice: 'L’entrée n’a pas pu être traitée. Vérifiez le champ concerné puis réessayez.',
      fallbackStatusDetail: 'Vérifiez cet élément avant de publier les enregistrements.',
      fallbackExplanation: 'Ligne générée pour cette étape. Copiez la valeur uniquement vers la destination indiquée par le titre.',
      helpTips: {
        fastPath: 'Chemin fiable le plus rapide : créez la zone faisant autorité, activez DNSSEC, collez DNSKEY ici, puis copiez le DS généré vers le wallet ou le bureau d’enregistrement.',
        tlsaPin: 'TLSA 3 1 1 épingle la clé publique du service avec SHA-256. Le renouvellement du certificat est simple si le serveur garde la même paire de clés.',
        parentSplit: 'Les enregistrements parent et serveur sont différents. Le wallet ou le bureau d’enregistrement délègue. Le serveur DNS publie les enregistrements du site et TLSA.',
        idna: 'Les noms internationalisés sont acceptés en entrée, mais les enregistrements DNS utilisent des A-labels IDNA comme xn--bcher-kva.example.',
        hnsGlue: (nameserver, domain) => `En mode HNS délégué, GLUE4/GLUE6 est requis quand le serveur de noms est sous le nom HNS lui-même, comme ${nameserver} pour ${domain}/.`,
        hnsInline: 'Le mode HNS SYNTH stocke les IPs de serveurs de noms dans la ressource HNS. Les enregistrements A/AAAA du site web et les enregistrements TLSA restent sur le DNS faisant autorité.',
        preset: {
          'generic-zone': 'La sortie de zone générique fonctionne avec BIND, Knot, NSD et de nombreux outils DNS.',
          'hosted-dns': 'DNS hébergé est le chemin le plus court si le fournisseur prend en charge DNSSEC, l’export DS et TLSA.',
          powerdns: 'PowerDNS est un chemin court pour un DNS avec API ou base de données.',
          knot: 'Knot DNS est un choix moderne avec une automatisation DNSSEC simple.',
          bind: 'BIND 9 est très documenté et disponible, mais sa configuration est plus verbeuse.',
          'windows-server': 'Windows Server DNS peut héberger et signer la zone faisant autorité avec DNS Manager ou PowerShell.',
          nsd: 'NSD est petit et fiable, mais la signature DNSSEC est souvent séparée.'
        }
      }
    }
  ),
  de: buildCopy(
    {
      invalidDomain: 'Das Domainformat ist für DNS-Ausgabe nicht gültig.',
      idna: 'Internationalisierte Domain-Eingaben werden in DNS-ASCII-A-Labels wie xn--... umgewandelt.',
      ttl: 'TTL sollte normalerweise zwischen 60 und 86400 Sekunden liegen.',
      inlineIcann: 'SYNTH-Nameserver-Modus ist nur für HNS. ICANN-Ausgabe nutzt benannte DNS-Delegation.',
      synthNsMissing: 'HNS-SYNTH-Modus benötigt mindestens eine Nameserver-IP-Adresse.',
      websiteIpv4: 'Website-IPv4-Adresse ist ungültig.',
      websiteIpv6: 'Website-IPv6-Adresse ist ungültig.',
      nsIpv4: 'Nameserver-IPv4-Adresse ist ungültig.',
      nsIpv6: 'Nameserver-IPv6-Adresse ist ungültig.',
      nsMissing: 'Delegierter Modus benötigt einen Nameserver-Hostnamen.',
      nsInvalid: 'Nameserver-Hostname ist ungültig.',
      noWebsiteIp: 'Keine Website-IPv4- oder IPv6-Adresse angegeben.',
      glueRequired: 'Der Nameserver liegt in derselben Zone, daher ist Glue erforderlich. Fügen Sie mindestens eine Nameserver-IP hinzu.',
      tlsaNoDs: 'TLSA ist erzeugt, aber DNSSEC ist unvollständig, bis ein Parent-DS veröffentlicht wird.',
      tlsaUsage: 'TLSA usage 3 ist die Voreinstellung für diesen Ablauf. Andere Nutzungen sind fortgeschritten und hängen von CA/TA ab.',
      tlsaError: 'TLSA-Eintrag konnte nicht erzeugt werden.',
      dsError: 'DS-Eintrag konnte nicht aus DNSKEY erzeugt werden.',
      dnskeyProtocol: 'DNSKEY-Protokoll ist normalerweise 3. Prüfen Sie, ob die DNSKEY-Zeile korrekt eingefügt wurde.',
      dnskeySep: 'Die DNSKEY hat kein SEP/KSK-Flag. DS-Einträge werden normalerweise aus der KSK erstellt.',
      dnskeySha1: 'Dieser DNSKEY-Algorithmus wird für neue DNSSEC-Signaturen nicht empfohlen. Nutzen Sie einen aktuell unterstützten Algorithmus wie 8, 13 oder 15, wenn der Server ihn unterstützt.'
    },
    {},
    {
      serverPreset: 'Serverseitiger Startausschnitt. Zone erstellen, NS/A/AAAA/TLSA veröffentlichen, DNSSEC aktivieren, dann DS beim Parent veröffentlichen.',
      verifyDelegated: 'Befehle zum Prüfen, ob der autoritative Server vor und nach Parent-Delegation antwortet.',
      inline4: 'HNS-Wallet-seitige synthetische IPv4-Nameserver-Referenz.',
      inline6: 'HNS-Wallet-seitige synthetische IPv6-Nameserver-Referenz.',
      verifyInline: 'Befehle zum Prüfen, ob der per SYNTH adressierte autoritative Server vor und nach dem HNS-Update antwortet.',
      stepInline1: 'SYNTH verweist Resolver auf Nameserver-IPs; die Zone liefert weiter Website-A/AAAA-Einträge und TLSA-Einträge.',
      stepInline2: 'Der DNS-Server sollte Signaturschlüssel und signierte Zone verwalten.',
      stepInline3: 'SYNTH ist die Parent-seitige Referenz; DS verbindet DNSSEC mit der signierten Zone.',
      integrator: 'Maschinenlesbare Ausgabe für Wallets, zukünftige APIs oder Integrationstests. Sie wird nicht automatisch gesendet.'
    },
    {
      quickSteps: {
        inline: {
          server: '1. Server-Einträge auf den autoritativen DNS-Server legen.',
          dnssec: '2. DNSSEC-Signierung für die Zone aktivieren.',
          dsReady: '3. SYNTH- und DS-Einträge ans HNS-Wallet senden.',
          dsMissing: '3. DNSKEY hier einfügen, dann SYNTH- und DS-Einträge ans HNS-Wallet senden.',
          tlsaReady: '4. Passendes HTTPS-Zertifikat/Schlüssel ausliefern.',
          tlsaMissing: '4. Leaf-Zertifikat oder PUBLIC KEY einfügen, um TLSA zu erzeugen.'
        },
        delegated: {
          server: '1. Server-Einträge auf den autoritativen DNS-Server legen.',
          dnssec: '2. DNSSEC-Signierung für die Zone aktivieren.',
          dsReady: '3. DS ins Wallet oder zum Registrar kopieren.',
          dsMissing: '3. DNSKEY hier einfügen, dann den erzeugten DS ins Wallet oder zum Registrar kopieren.',
          tlsaReady: '4. Passendes HTTPS-Zertifikat/Schlüssel ausliefern.',
          tlsaMissing: '4. Leaf-Zertifikat oder PUBLIC KEY einfügen, um TLSA zu erzeugen.',
          parentHns: '5. HNS-Namensressource aktualisieren.',
          parentIcann: '5. Nameserver-, Glue- und DS-Einstellungen beim Registrar speichern.'
        }
      },
      webNotes: {
        serve: 'Liefern Sie das Zertifikat aus, dessen Public Key zum TLSA-SPKI-Hash passt.',
        rollover: 'Für Schlüsselwechsel aktuellen und nächsten TLSA veröffentlichen, mindestens eine TTL warten, Serverschlüssel wechseln und den alten TLSA nach einer weiteren TTL entfernen.',
        noPlugin: 'Nginx/Apache/Caddy brauchen kein DANE-Plugin; DANE lebt in DNS.',
        clientSupport: 'DANE wird nur von Clients erzwungen, die DNSSEC validieren und TLSA prüfen; normale HTTPS-Clients können die veröffentlichte TLSA-Richtlinie ignorieren.'
      },
      verify: {
        hnsInline: '# Nach Bestätigung des HNS-Updates mit HNS-fähigem Resolver/Browser testen.',
        expectedAddress: '# Erwartete Adresse',
        hnsFullChain: '# Für HNS-Full-Chain-Tests nach Wallet-Bestätigung über Ihren HNS-fähigen Resolver abfragen.'
      },
      fallbackNotice: 'Die Eingabe konnte nicht verarbeitet werden. Prüfen Sie das zugehörige Feld und versuchen Sie es erneut.',
      fallbackStatusDetail: 'Prüfen Sie diesen Punkt, bevor Sie die Einträge veröffentlichen.',
      fallbackExplanation: 'Für diesen Schritt erzeugte Zeile. Kopieren Sie den Wert nur an das im Titel angegebene Ziel.',
      helpTips: {
        fastPath: 'Schnellster zuverlässiger Weg: autoritative Zone erstellen, DNSSEC aktivieren, DNSKEY hier einfügen, erzeugten DS ins Wallet oder zum Registrar kopieren.',
        tlsaPin: 'TLSA 3 1 1 pinnt den Service-Public-Key mit SHA-256. Zertifikatserneuerung bleibt einfach, wenn das gleiche Schlüsselpaar bleibt.',
        parentSplit: 'Parent- und Server-Einträge sind verschieden. Wallet oder Registrar delegiert. Der DNS-Server veröffentlicht Website-Einträge und TLSA.',
        idna: 'Internationalisierte Namen werden akzeptiert, aber DNS-Einträge nutzen IDNA-A-Labels wie xn--bcher-kva.example.',
        hnsGlue: (nameserver, domain) => `Im delegierten HNS-Modus ist GLUE4/GLUE6 nötig, wenn der Nameserver unter dem HNS-Namen selbst liegt, z. B. ${nameserver} für ${domain}/.`,
        hnsInline: 'HNS-SYNTH speichert Nameserver-IPs in der HNS-Ressource. Website-A/AAAA-Einträge und TLSA-Einträge bleiben auf dem autoritativen DNS-Server.',
        preset: {
          'generic-zone': 'Generische Zonendatei-Ausgabe funktioniert mit BIND, Knot, NSD und vielen DNS-Importtools.',
          'hosted-dns': 'Hosted DNS ist der kürzeste Weg, wenn der Provider DNSSEC, DS-Export und TLSA unterstützt.',
          powerdns: 'PowerDNS ist ein kurzer Weg, wenn API- oder datenbankgestütztes DNS gewünscht ist.',
          knot: 'Knot DNS ist ein moderner Standard mit einfacher DNSSEC-Automatisierung.',
          bind: 'BIND 9 ist gut dokumentiert und paketfreundlich, aber ausführlicher konfiguriert.',
          'windows-server': 'Windows Server DNS kann die autoritative Zone mit DNS-Manager oder PowerShell hosten und signieren.',
          nsd: 'NSD ist klein und zuverlässig; DNSSEC-Signierung erfolgt meist separat.'
        }
      }
    }
  ),
  pt: buildCopy(
    {
      invalidDomain: 'O formato do domínio não é válido para saída DNS.',
      idna: 'Entrada de domínio internacionalizado é convertida para A-labels ASCII DNS como xn--... nos registros gerados.',
      ttl: 'TTL normalmente deve ficar entre 60 e 86400 segundos.',
      inlineIcann: 'Modo nameserver SYNTH é somente HNS. Saída ICANN usa delegação DNS nomeada.',
      synthNsMissing: 'Modo HNS SYNTH precisa de ao menos um endereço IP de nameserver.',
      websiteIpv4: 'O endereço IPv4 do site não é válido.',
      websiteIpv6: 'O endereço IPv6 do site não é válido.',
      nsIpv4: 'O endereço IPv4 do nameserver não é válido.',
      nsIpv6: 'O endereço IPv6 do nameserver não é válido.',
      nsMissing: 'Modo delegado precisa de um hostname de nameserver.',
      nsInvalid: 'O hostname do nameserver não é válido.',
      noWebsiteIp: 'Nenhum endereço IPv4 ou IPv6 do site foi informado.',
      glueRequired: 'O nameserver está dentro da mesma zona, então glue é obrigatório. Adicione ao menos um IP de nameserver.',
      tlsaNoDs: 'TLSA foi gerado, mas DNSSEC fica incompleto até publicar um DS no parent.',
      tlsaUsage: 'TLSA usage 3 é o padrão deste fluxo. Outros usos são avançados e dependem de CA/TA.',
      tlsaError: 'Não foi possível gerar o registro TLSA.',
      dsError: 'Não foi possível gerar o registro DS a partir da DNSKEY.',
      dnskeyProtocol: 'O protocolo DNSKEY normalmente é 3. Verifique se a linha DNSKEY foi colada corretamente.',
      dnskeySep: 'A DNSKEY não tem a flag SEP/KSK. Registros DS normalmente são feitos a partir da KSK.',
      dnskeySha1: 'Este algoritmo DNSKEY não é recomendado para novas assinaturas DNSSEC. Prefira um algoritmo suportado atualmente, como 8, 13 ou 15, quando o servidor suportar.'
    },
    {},
    {
      serverPreset: 'Trecho inicial do lado servidor. Crie a zona, publique NS/A/AAAA/TLSA, ative DNSSEC e depois publique DS no parent.',
      verifyDelegated: 'Comandos para verificar se o servidor autoritativo responde antes e depois da delegação parent.',
      inline4: 'Referência sintética IPv4 de nameserver no lado da carteira HNS.',
      inline6: 'Referência sintética IPv6 de nameserver no lado da carteira HNS.',
      verifyInline: 'Comandos para verificar se o servidor autoritativo endereçado por SYNTH responde antes e depois da atualização HNS.',
      stepInline1: 'SYNTH aponta resolvedores para IPs de nameserver; a zona ainda serve registros A/AAAA do site e registros TLSA.',
      stepInline2: 'O servidor DNS deve gerenciar as chaves de assinatura e a zona assinada.',
      stepInline3: 'SYNTH é a referência do lado parent; DS conecta DNSSEC à zona assinada.',
      integrator: 'Saída legível por máquina para carteiras, APIs futuras ou testes de integração. Não é enviada automaticamente.'
    },
    {
      quickSteps: {
        inline: {
          server: '1. Coloque os registros no servidor DNS autoritativo.',
          dnssec: '2. Ative a assinatura DNSSEC na zona.',
          dsReady: '3. Envie os registros SYNTH e DS para a carteira HNS.',
          dsMissing: '3. Cole a DNSKEY aqui e envie os registros SYNTH e DS para a carteira HNS.',
          tlsaReady: '4. Sirva o certificado/chave HTTPS correspondente.',
          tlsaMissing: '4. Cole o certificado folha ou PUBLIC KEY para gerar TLSA.'
        },
        delegated: {
          server: '1. Coloque os registros no servidor DNS autoritativo.',
          dnssec: '2. Ative a assinatura DNSSEC na zona.',
          dsReady: '3. Copie o DS para a carteira ou registrador.',
          dsMissing: '3. Cole a DNSKEY aqui e copie o DS gerado para a carteira ou registrador.',
          tlsaReady: '4. Sirva o certificado/chave HTTPS correspondente.',
          tlsaMissing: '4. Cole o certificado folha ou PUBLIC KEY para gerar TLSA.',
          parentHns: '5. Envie a atualização do recurso de nome HNS.',
          parentIcann: '5. Salve nameserver, glue e DS no registrador.'
        }
      },
      webNotes: {
        serve: 'Sirva o certificado cuja chave pública corresponde ao hash SPKI TLSA.',
        rollover: 'Para rotação de chave, publique TLSA atual e próximo, espere ao menos um TTL, troque a chave do servidor e remova o TLSA antigo depois de outro TTL.',
        noPlugin: 'Nginx/Apache/Caddy não precisam de plugin DANE; DANE fica no DNS.',
        clientSupport: 'DANE só é aplicado por clientes que validam DNSSEC e verificam TLSA; clientes HTTPS comuns podem ignorar a política TLSA publicada.'
      },
      verify: {
        hnsInline: '# Depois que a atualização HNS confirmar, teste com resolvedor/navegador compatível com HNS.',
        expectedAddress: '# Endereço esperado',
        hnsFullChain: '# Para testes HNS de cadeia completa, consulte pelo seu resolvedor HNS após a confirmação da carteira.'
      },
      fallbackNotice: 'A entrada não pôde ser processada. Revise o campo correspondente e tente novamente.',
      fallbackStatusDetail: 'Revise este item antes de publicar os registros.',
      fallbackExplanation: 'Linha gerada para esta etapa. Copie o valor apenas para o destino indicado pelo título.',
      helpTips: {
        fastPath: 'Caminho confiável mais rápido: crie a zona autoritativa, ative DNSSEC, cole DNSKEY aqui e copie o DS gerado para a carteira ou registrador.',
        tlsaPin: 'TLSA 3 1 1 fixa a chave pública do serviço com SHA-256. Renovar certificado é simples se o servidor mantiver o mesmo par de chaves.',
        parentSplit: 'Registros parent e de servidor são diferentes. Carteira ou registrador delega. O servidor DNS publica registros do site e TLSA.',
        idna: 'Nomes internacionalizados são aceitos como entrada, mas registros DNS usam A-labels IDNA como xn--bcher-kva.example.',
        hnsGlue: (nameserver, domain) => `No modo HNS delegado, GLUE4/GLUE6 é necessário quando o nameserver fica sob o próprio nome HNS, como ${nameserver} para ${domain}/.`,
        hnsInline: 'Modo HNS SYNTH guarda IPs de nameserver no recurso HNS. Registros A/AAAA do site e registros TLSA continuam no servidor DNS autoritativo.',
        preset: {
          'generic-zone': 'Saída de zona genérica funciona com BIND, Knot, NSD e muitas ferramentas DNS.',
          'hosted-dns': 'DNS hospedado é o caminho mais curto se o provedor suporta DNSSEC, exportação DS e TLSA.',
          powerdns: 'PowerDNS é um caminho curto quando se quer DNS com API ou banco de dados.',
          knot: 'Knot DNS é um padrão moderno com automação DNSSEC simples.',
          bind: 'BIND 9 é bem documentado e disponível, mas sua configuração é mais verbosa.',
          'windows-server': 'Windows Server DNS pode hospedar e assinar a zona autoritativa com DNS Manager ou PowerShell.',
          nsd: 'NSD é pequeno e confiável, mas a assinatura DNSSEC costuma ser separada.'
        }
      }
    }
  ),
  ja: buildCopy(
    {
      invalidDomain: 'DNS 出力に使えるドメイン形式ではありません。',
      idna: '国際化ドメイン入力は、生成レコード内で xn--... のような DNS ASCII A-label に変換されます。',
      ttl: 'TTL は通常 60 から 86400 秒の範囲にします。',
      inlineIcann: 'SYNTH ネームサーバーモードは HNS 専用です。ICANN 出力は名前付き DNS 委任を使います。',
      synthNsMissing: 'HNS SYNTH モードには少なくとも 1 つのネームサーバー IP アドレスが必要です。',
      websiteIpv4: 'Web サイト IPv4 アドレスが正しくありません。',
      websiteIpv6: 'Web サイト IPv6 アドレスが正しくありません。',
      nsIpv4: 'ネームサーバー IPv4 アドレスが正しくありません。',
      nsIpv6: 'ネームサーバー IPv6 アドレスが正しくありません。',
      nsMissing: '委任モードにはネームサーバー名が必要です。',
      nsInvalid: 'ネームサーバー名が正しくありません。',
      noWebsiteIp: 'Web サイトの IPv4 または IPv6 アドレスがありません。',
      glueRequired: 'ネームサーバーが同じゾーン内にあるため glue が必要です。少なくとも 1 つのネームサーバー IP を追加してください。',
      tlsaNoDs: 'TLSA は生成されていますが、親側 DS を公開するまで DNSSEC は未完了です。',
      tlsaUsage: 'TLSA usage 3 がこのフローの既定値です。他の usage は高度な設定で、CA/TA の扱いに依存します。',
      tlsaError: 'TLSA レコードを生成できませんでした。',
      dsError: 'DNSKEY 入力から DS レコードを生成できませんでした。',
      dnskeyProtocol: 'DNSKEY protocol は通常 3 です。DNSKEY 行が正しく貼り付けられているか確認してください。',
      dnskeySep: 'この DNSKEY には SEP/KSK フラグがありません。DS レコードは通常 KSK から作ります。',
      dnskeySha1: 'この DNSKEY アルゴリズムは新しい DNSSEC 署名には推奨されません。サーバーが対応している場合は 8、13、15 など現在対応されているアルゴリズムを使ってください。'
    },
    {},
    {
      serverPreset: 'サーバー側の開始用スニペットです。ゾーンを作り、NS/A/AAAA/TLSA を公開し、DNSSEC 署名を有効にしてから親側に DS を公開します。',
      verifyDelegated: '親側委任の前後で権威サーバーが応答するか確認するコマンドです。',
      inline4: 'HNS ウォレット側の合成 IPv4 ネームサーバー参照です。',
      inline6: 'HNS ウォレット側の合成 IPv6 ネームサーバー参照です。',
      verifyInline: 'SYNTH で指定された権威サーバーが HNS 更新の前後に応答するか確認するコマンドです。',
      stepInline1: 'SYNTH はリゾルバをネームサーバー IP へ向けます。ゾーンは引き続き Web サイトの A/AAAA レコードと TLSA レコードを配信します。',
      stepInline2: 'DNS サーバーが署名鍵と署名済みゾーンを管理します。',
      stepInline3: 'SYNTH は親側の参照で、DS が DNSSEC を署名済みゾーンへ接続します。',
      integrator: 'ウォレット、将来の API、統合テスト向けの機械可読出力です。自動送信はされません。'
    },
    {
      quickSteps: {
        inline: {
          server: '1. サーバーレコードを権威 DNS サーバーに入れます。',
          dnssec: '2. ゾーンで DNSSEC 署名を有効にします。',
          dsReady: '3. SYNTH と DS レコードを HNS ウォレットへ送信します。',
          dsMissing: '3. ここに DNSKEY を貼り、SYNTH と DS レコードを HNS ウォレットへ送信します。',
          tlsaReady: '4. 一致する HTTPS 証明書/鍵を配信します。',
          tlsaMissing: '4. リーフ証明書または PUBLIC KEY を貼って TLSA を生成します。'
        },
        delegated: {
          server: '1. サーバーレコードを権威 DNS サーバーに入れます。',
          dnssec: '2. ゾーンで DNSSEC 署名を有効にします。',
          dsReady: '3. DS をウォレットまたはレジストラへコピーします。',
          dsMissing: '3. ここに DNSKEY を貼り、生成された DS をウォレットまたはレジストラへコピーします。',
          tlsaReady: '4. 一致する HTTPS 証明書/鍵を配信します。',
          tlsaMissing: '4. リーフ証明書または PUBLIC KEY を貼って TLSA を生成します。',
          parentHns: '5. HNS 名前リソースの更新を送信します。',
          parentIcann: '5. レジストラで nameserver、glue、DS 設定を保存します。'
        }
      },
      webNotes: {
        serve: 'TLSA SPKI ハッシュと一致する公開鍵の証明書を配信します。',
        rollover: '鍵をロールオーバーする場合は、現在と次の TLSA を公開し、少なくとも 1 TTL 待ってからサーバー鍵を切り替え、さらに 1 TTL 後に古い TLSA を削除します。',
        noPlugin: 'Nginx/Apache/Caddy に DANE プラグインは不要です。DANE は DNS 側にあります。',
        clientSupport: 'DANE は DNSSEC を検証し TLSA を確認するクライアントだけが強制します。通常の HTTPS クライアントは公開された TLSA ポリシーを無視する場合があります。'
      },
      verify: {
        hnsInline: '# HNS 更新が確認されたら、HNS 対応リゾルバ/ブラウザでテストします。',
        expectedAddress: '# 期待されるアドレス',
        hnsFullChain: '# HNS の完全チェーン確認は、ウォレット更新後に HNS 対応リゾルバで問い合わせます。'
      },
      fallbackNotice: '入力を処理できませんでした。該当する入力欄を確認して、もう一度試してください。',
      fallbackStatusDetail: 'レコードを公開する前に、この項目を確認してください。',
      fallbackExplanation: 'この手順用に生成された行です。見出しで示された送信先にだけコピーしてください。',
      helpTips: {
        fastPath: '最短で確実な流れ: 権威ゾーンを作成し、DNSSEC 署名を有効にし、ここに DNSKEY を貼り、生成された DS をウォレットまたはレジストラへコピーします。',
        tlsaPin: 'TLSA 3 1 1 はサービス公開鍵を SHA-256 で固定します。同じ鍵ペアを保てば証明書更新は簡単です。',
        parentSplit: '親側レコードとサーバーレコードは別です。ウォレットまたはレジストラが委任し、DNS サーバーがサイトレコードと TLSA を公開します。',
        idna: '国際化名は入力できますが、DNS レコードでは xn--bcher-kva.example のような IDNA A-label を使います。',
        hnsGlue: (nameserver, domain) => `HNS 委任モードでは、${domain}/ に対する ${nameserver} のようにネームサーバーが HNS 名の下にある場合、GLUE4/GLUE6 が必要です。`,
        hnsInline: 'HNS SYNTH モードは HNS リソースにネームサーバー IP を保存します。Web サイトの A/AAAA レコードと TLSA レコードは権威 DNS サーバー側に置きます。',
        preset: {
          'generic-zone': '汎用ゾーンファイル出力は BIND、Knot、NSD、多くの DNS インポートツールで使えます。',
          'hosted-dns': 'プロバイダーが DNSSEC、DS エクスポート、TLSA をサポートするならホスト型 DNS が最短です。',
          powerdns: 'API または DB ベースの DNS が必要なら PowerDNS が短い経路です。',
          knot: 'Knot DNS は DNSSEC 自動化が簡単な現代的な既定候補です。',
          bind: 'BIND 9 は文書が多く導入しやすいですが、設定はより冗長です。',
          'windows-server': 'Windows Server DNS は DNS Manager または PowerShell で権威ゾーンをホストし署名できます。',
          nsd: 'NSD は小さく信頼できますが、DNSSEC 署名は通常別手順です。'
        }
      }
    }
  ),
  ar: buildCopy(
    {
      invalidDomain: 'تنسيق النطاق غير صالح لإخراج DNS.',
      idna: 'يتم تحويل إدخال النطاق الدولي إلى DNS ASCII A-labels مثل xn--... في السجلات المولدة.',
      ttl: 'يجب أن يكون TTL عادة بين 60 و 86400 ثانية.',
      inlineIcann: 'وضع خادم أسماء SYNTH خاص بـ HNS فقط. إخراج ICANN يستخدم تفويض DNS باسم خادم.',
      synthNsMissing: 'وضع HNS SYNTH يحتاج إلى عنوان IP واحد على الأقل لخادم الأسماء.',
      websiteIpv4: 'عنوان IPv4 للموقع غير صالح.',
      websiteIpv6: 'عنوان IPv6 للموقع غير صالح.',
      nsIpv4: 'عنوان IPv4 لخادم الأسماء غير صالح.',
      nsIpv6: 'عنوان IPv6 لخادم الأسماء غير صالح.',
      nsMissing: 'الوضع المفوض يحتاج إلى اسم مضيف لخادم الأسماء.',
      nsInvalid: 'اسم مضيف خادم الأسماء غير صالح.',
      noWebsiteIp: 'لم يتم إدخال عنوان IPv4 أو IPv6 للموقع.',
      glueRequired: 'خادم الأسماء داخل المنطقة نفسها، لذلك glue مطلوب. أضف عنوان IP واحدا على الأقل لخادم الأسماء.',
      tlsaNoDs: 'تم توليد TLSA، لكن DNSSEC لا يكتمل حتى تنشر سجل DS في جهة الأصل.',
      tlsaUsage: 'TLSA usage 3 هو الافتراضي لهذا التدفق. الاستخدامات الأخرى متقدمة وتعتمد على CA/TA.',
      tlsaError: 'تعذر توليد سجل TLSA.',
      dsError: 'تعذر توليد سجل DS من إدخال DNSKEY.',
      dnskeyProtocol: 'بروتوكول DNSKEY يكون عادة 3. تحقق من لصق سطر DNSKEY بشكل صحيح.',
      dnskeySep: 'لا يحتوي DNSKEY على علم SEP/KSK. سجلات DS تنشأ عادة من KSK.',
      dnskeySha1: 'خوارزمية DNSKEY هذه غير موصى بها لتواقيع DNSSEC الجديدة. فضّل خوارزمية مدعومة حاليا مثل 8 أو 13 أو 15 عندما يدعمها الخادم.'
    },
    {
      domainOk: 'تم تطبيع النطاق لإخراج DNS.',
      domainMissing: 'أدخل اسم HNS أو نطاق ICANN.',
      websiteOk: 'يمكن توليد سجلات A/AAAA للموقع.',
      websiteMissing: 'أضف عنوان IPv4 أو IPv6 واحدا على الأقل للموقع.',
      synthNsOk: 'يمكن توليد IP لخادم أسماء SYNTH.',
      synthNsMissing: 'أضف عنوان IPv4 أو IPv6 واحدا على الأقل لخادم الأسماء.',
      nsOk: 'هدف التفويض موجود.',
      nsMissing: 'أضف اسم مضيف خادم DNS السلطوي.',
      glueInZone: 'خادم الأسماء داخل المنطقة، لذلك يجب أن يكون glue في سجلات الأصل.',
      glueExternal: 'خادم الأسماء خارجي، لذلك يدير الأصل الخاص به glue.',
      dsOk: 'تم توليد DS في جهة الأصل من DNSKEY.',
      dsMissing: 'الصق DNSKEY بعد توقيع المنطقة السلطوية.',
      tlsaOk: 'تم توليد TLSA من الشهادة/المفتاح العام.',
      tlsaMissing: 'الصق شهادة أو PUBLIC KEY لتوليد TLSA.'
    },
    {
      serverPreset: 'مقتطف بداية لجهة الخادم. أنشئ المنطقة، وانشر NS/A/AAAA/TLSA، وفعّل DNSSEC، ثم انشر DS عند الأصل.',
      verifyDelegated: 'أوامر للتحقق من أن الخادم السلطوي يجيب قبل وبعد تفويض الأصل.',
      verifyInline: 'أوامر للتحقق من أن الخادم السلطوي الموجه عبر SYNTH يجيب قبل وبعد تحديث HNS.',
      inline4: 'إحالة خادم أسماء IPv4 اصطناعية من جهة محفظة HNS.',
      inline6: 'إحالة خادم أسماء IPv6 اصطناعية من جهة محفظة HNS.',
      stepInline1: 'SYNTH يوجه المحللات إلى عناوين IP لخادم الأسماء؛ وتبقى المنطقة تقدم سجلات A/AAAA للموقع وسجلات TLSA.',
      stepInline2: 'يجب أن يدير خادم DNS مفاتيح التوقيع والمنطقة الموقعة.',
      stepInline3: 'SYNTH هو إحالة جهة الأصل؛ و DS يصل DNSSEC بالمنطقة الموقعة.',
      integrator: 'إخراج قابل للقراءة آليا للمحافظ أو APIs مستقبلية أو اختبارات التكامل. لا يتم إرساله تلقائيا.'
    },
    {
      quickSteps: {
        inline: {
          server: '1. ضع سجلات الخادم على خادم DNS السلطوي.',
          dnssec: '2. فعّل توقيع DNSSEC على المنطقة.',
          dsReady: '3. أرسل سجلات SYNTH و DS إلى محفظة HNS.',
          dsMissing: '3. الصق DNSKEY هنا، ثم أرسل سجلات SYNTH و DS إلى محفظة HNS.',
          tlsaReady: '4. قدّم شهادة/مفتاح HTTPS المطابق.',
          tlsaMissing: '4. الصق شهادة leaf أو PUBLIC KEY لتوليد TLSA.'
        },
        delegated: {
          server: '1. ضع سجلات الخادم على خادم DNS السلطوي.',
          dnssec: '2. فعّل توقيع DNSSEC على المنطقة.',
          dsReady: '3. انسخ DS إلى المحفظة أو المحضر.',
          dsMissing: '3. الصق DNSKEY هنا، ثم انسخ DS المولد إلى المحفظة أو المحضر.',
          tlsaReady: '4. قدّم شهادة/مفتاح HTTPS المطابق.',
          tlsaMissing: '4. الصق شهادة leaf أو PUBLIC KEY لتوليد TLSA.',
          parentHns: '5. أرسل تحديث مورد اسم HNS.',
          parentIcann: '5. احفظ إعدادات nameserver و glue و DS عند المحضر.'
        }
      },
      webNotes: {
        serve: 'قدّم الشهادة التي يطابق مفتاحها العام hash TLSA SPKI.',
        rollover: 'لتدوير المفاتيح، انشر سجلات TLSA الحالية والتالية، وانتظر TTL واحدا على الأقل، ثم بدّل مفتاح الخادم واحذف TLSA القديم بعد TTL آخر.',
        noPlugin: 'لا يحتاج Nginx/Apache/Caddy إلى إضافة DANE؛ DANE موجود في DNS.',
        clientSupport: 'يتم فرض DANE فقط من العملاء الذين يتحققون من DNSSEC ويفحصون سجلات TLSA؛ وقد تتجاهل عملاء HTTPS العادية سياسة TLSA المنشورة.'
      },
      verify: {
        hnsInline: '# بعد تأكيد تحديث HNS، اختبر عبر محلل/متصفح يدعم HNS.',
        expectedAddress: '# العنوان المتوقع',
        hnsFullChain: '# لاختبارات سلسلة HNS الكاملة، استعلم عبر محلل HNS بعد تأكيد تحديث المحفظة.'
      },
      fallbackNotice: 'تعذرت معالجة الإدخال. راجع الحقل المناسب وحاول مرة أخرى.',
      fallbackStatusDetail: 'راجع هذا العنصر قبل نشر السجلات.',
      fallbackExplanation: 'سطر مولد لهذه الخطوة. انسخ القيمة فقط إلى الوجهة التي يوضحها العنوان.',
      helpTips: {
        fastPath: 'أسرع مسار موثوق: أنشئ المنطقة السلطوية، فعّل DNSSEC، الصق DNSKEY هنا، ثم انسخ DS المولد إلى المحفظة أو المحضر.',
        tlsaPin: 'TLSA 3 1 1 يثبت المفتاح العام للخدمة باستخدام SHA-256. يمكن أن يكون تجديد الشهادة سهلا إذا احتفظ الخادم بزوج المفاتيح نفسه.',
        parentSplit: 'سجلات الأصل وسجلات الخادم مختلفة. المحفظة أو المحضر يفوض. خادم DNS ينشر سجلات الموقع و TLSA.',
        idna: 'تقبل الأسماء الدولية كإدخال، لكن سجلات DNS تستخدم IDNA A-labels مثل xn--bcher-kva.example.',
        hnsGlue: (nameserver, domain) => `في وضع HNS المفوض، GLUE4/GLUE6 مطلوب عندما يعيش خادم الأسماء تحت اسم HNS نفسه، مثل ${nameserver} لـ ${domain}/.`,
        hnsInline: 'وضع HNS SYNTH يخزن عناوين IP لخوادم الأسماء في مورد HNS. سجلات A/AAAA للموقع وسجلات TLSA تبقى على خادم DNS السلطوي.',
        preset: {
          'generic-zone': 'إخراج ملف zone عام يعمل مع BIND و Knot و NSD والعديد من أدوات استيراد DNS.',
          'hosted-dns': 'DNS المستضاف هو أقصر مسار إذا كان المزود يدعم DNSSEC وتصدير DS و TLSA.',
          powerdns: 'PowerDNS مسار قصير عندما تريد DNS بواجهة API أو قاعدة بيانات.',
          knot: 'Knot DNS خادم سلطوي حديث مع أتمتة DNSSEC بسيطة.',
          bind: 'BIND 9 موثق على نطاق واسع وسهل التثبيت من الحزم، لكنه أكثر تفصيلا في الإعداد.',
          'windows-server': 'Windows Server DNS يمكنه استضافة وتوقيع المنطقة السلطوية عبر DNS Manager أو PowerShell.',
          nsd: 'NSD صغير وموثوق، لكن توقيع DNSSEC غالبا يتم بخطوة منفصلة.'
        }
      }
    }
  ),
  fa: buildCopy(
    {
      invalidDomain: 'قالب دامنه برای خروجی DNS معتبر نیست.',
      idna: 'ورودی دامنه بین‌المللی در رکوردهای تولیدشده به DNS ASCII A-label مانند xn--... تبدیل می‌شود.',
      ttl: 'TTL معمولا باید بین 60 و 86400 ثانیه باشد.',
      inlineIcann: 'حالت SYNTH nameserver فقط برای HNS است. خروجی ICANN از delegation نام‌دار DNS استفاده می‌کند.',
      synthNsMissing: 'حالت HNS SYNTH حداقل به یک IP برای nameserver نیاز دارد.',
      websiteIpv4: 'آدرس IPv4 وب‌سایت معتبر نیست.',
      websiteIpv6: 'آدرس IPv6 وب‌سایت معتبر نیست.',
      nsIpv4: 'آدرس IPv4 nameserver معتبر نیست.',
      nsIpv6: 'آدرس IPv6 nameserver معتبر نیست.',
      nsMissing: 'حالت delegated به hostname یک nameserver نیاز دارد.',
      nsInvalid: 'Hostname nameserver معتبر نیست.',
      noWebsiteIp: 'هیچ آدرس IPv4 یا IPv6 برای وب‌سایت وارد نشده است.',
      glueRequired: 'Nameserver داخل همان zone است، پس glue لازم است. حداقل یک IP برای nameserver اضافه کنید.',
      tlsaNoDs: 'TLSA تولید شده است، اما DNSSEC تا زمان انتشار DS در parent کامل نیست.',
      tlsaUsage: 'TLSA usage 3 مقدار پیش‌فرض این جریان است. usageهای دیگر پیشرفته‌اند و به CA/TA وابسته‌اند.',
      tlsaError: 'تولید رکورد TLSA ممکن نبود.',
      dsError: 'تولید رکورد DS از ورودی DNSKEY ممکن نبود.',
      dnskeyProtocol: 'پروتکل DNSKEY معمولا 3 است. بررسی کنید خط DNSKEY درست چسبانده شده باشد.',
      dnskeySep: 'این DNSKEY پرچم SEP/KSK ندارد. رکوردهای DS معمولا از KSK ساخته می‌شوند.',
      dnskeySha1: 'این الگوریتم DNSKEY برای امضای DNSSEC جدید توصیه نمی‌شود. اگر سرور پشتیبانی می‌کند از الگوریتم‌های فعلی مانند 8، 13 یا 15 استفاده کنید.'
    },
    {
      domainOk: 'دامنه برای خروجی DNS نرمال شده است.',
      domainMissing: 'نام HNS یا دامنه ICANN را وارد کنید.',
      websiteOk: 'رکوردهای A/AAAA وب‌سایت قابل تولید هستند.',
      websiteMissing: 'حداقل یک آدرس IPv4 یا IPv6 وب‌سایت اضافه کنید.',
      synthNsOk: 'IP nameserver SYNTH قابل تولید است.',
      synthNsMissing: 'حداقل یک آدرس IPv4 یا IPv6 برای nameserver اضافه کنید.',
      nsOk: 'هدف delegation موجود است.',
      nsMissing: 'Hostname سرور DNS مقتدر را اضافه کنید.',
      glueInZone: 'Nameserver داخل zone است، پس glue باید در رکوردهای parent باشد.',
      glueExternal: 'Nameserver خارجی است، پس parent خودش glue را مدیریت می‌کند.',
      dsOk: 'DS سمت parent از DNSKEY تولید شده است.',
      dsMissing: 'بعد از امضای zone مقتدر، DNSKEY را بچسبانید.',
      tlsaOk: 'TLSA از گواهی/کلید عمومی تولید شده است.',
      tlsaMissing: 'برای تولید TLSA یک گواهی یا PUBLIC KEY بچسبانید.'
    },
    {
      serverPreset: 'نمونه شروع سمت سرور. Zone را بسازید، NS/A/AAAA/TLSA را منتشر کنید، DNSSEC را فعال کنید، سپس DS را در parent منتشر کنید.',
      verifyDelegated: 'دستورهایی برای بررسی اینکه سرور مقتدر قبل و بعد از delegation parent پاسخ می‌دهد.',
      verifyInline: 'دستورهایی برای بررسی اینکه سرور مقتدر آدرس‌دهی‌شده با SYNTH قبل و بعد از به‌روزرسانی HNS پاسخ می‌دهد.',
      inline4: 'ارجاع nameserver مصنوعی IPv4 در سمت کیف پول HNS.',
      inline6: 'ارجاع nameserver مصنوعی IPv6 در سمت کیف پول HNS.',
      stepInline1: 'SYNTH resolverها را به IPهای nameserver هدایت می‌کند؛ zone همچنان رکوردهای A/AAAA وب‌سایت و TLSA را سرو می‌کند.',
      stepInline2: 'سرور DNS باید کلیدهای امضا و zone امضاشده را مدیریت کند.',
      stepInline3: 'SYNTH ارجاع سمت parent است؛ DS، DNSSEC را به zone امضاشده وصل می‌کند.',
      integrator: 'خروجی قابل خواندن توسط ماشین برای کیف پول‌ها، APIهای آینده یا تست‌های یکپارچه‌سازی. این خروجی خودکار ارسال نمی‌شود.'
    },
    {
      quickSteps: {
        inline: {
          server: '1. رکوردهای سرور را روی DNS مقتدر قرار دهید.',
          dnssec: '2. امضای DNSSEC را روی zone فعال کنید.',
          dsReady: '3. رکوردهای SYNTH و DS را به کیف پول HNS بفرستید.',
          dsMissing: '3. DNSKEY را اینجا بچسبانید، سپس رکوردهای SYNTH و DS را به کیف پول HNS بفرستید.',
          tlsaReady: '4. گواهی/کلید HTTPS مطابق را سرو کنید.',
          tlsaMissing: '4. گواهی leaf یا PUBLIC KEY را بچسبانید تا TLSA تولید شود.'
        },
        delegated: {
          server: '1. رکوردهای سرور را روی DNS مقتدر قرار دهید.',
          dnssec: '2. امضای DNSSEC را روی zone فعال کنید.',
          dsReady: '3. DS را در کیف پول یا رجیسترار کپی کنید.',
          dsMissing: '3. DNSKEY را اینجا بچسبانید، سپس DS تولیدشده را در کیف پول یا رجیسترار کپی کنید.',
          tlsaReady: '4. گواهی/کلید HTTPS مطابق را سرو کنید.',
          tlsaMissing: '4. گواهی leaf یا PUBLIC KEY را بچسبانید تا TLSA تولید شود.',
          parentHns: '5. به‌روزرسانی منبع نام HNS را ارسال کنید.',
          parentIcann: '5. تنظیمات nameserver، glue و DS را در رجیسترار ذخیره کنید.'
        }
      },
      webNotes: {
        serve: 'گواهی‌ای را سرو کنید که کلید عمومی آن با hash TLSA SPKI مطابق است.',
        rollover: 'برای rollover کلید، TLSA فعلی و بعدی را منتشر کنید، حداقل یک TTL صبر کنید، کلید سرور را عوض کنید و TLSA قدیمی را بعد از یک TTL دیگر حذف کنید.',
        noPlugin: 'Nginx/Apache/Caddy به افزونه DANE نیاز ندارند؛ DANE در DNS قرار دارد.',
        clientSupport: 'DANE فقط توسط کلاینت‌هایی اعمال می‌شود که DNSSEC را اعتبارسنجی و TLSA را بررسی می‌کنند؛ کلاینت‌های HTTPS معمولی ممکن است سیاست TLSA منتشرشده را نادیده بگیرند.'
      },
      verify: {
        hnsInline: '# بعد از تایید به‌روزرسانی HNS، با resolver/مرورگر سازگار با HNS تست کنید.',
        expectedAddress: '# آدرس مورد انتظار',
        hnsFullChain: '# برای تست کامل زنجیره HNS، بعد از تایید کیف پول از طریق resolver سازگار با HNS query بگیرید.'
      },
      fallbackNotice: 'ورودی قابل پردازش نبود. فیلد مربوطه را بررسی کنید و دوباره تلاش کنید.',
      fallbackStatusDetail: 'قبل از انتشار رکوردها این مورد را بررسی کنید.',
      fallbackExplanation: 'خط تولیدشده برای این مرحله. مقدار را فقط در مقصدی که عنوان نشان می‌دهد کپی کنید.',
      helpTips: {
        fastPath: 'سریع‌ترین مسیر قابل اعتماد: zone مقتدر را بسازید، DNSSEC را فعال کنید، DNSKEY را اینجا بچسبانید، سپس DS تولیدشده را به کیف پول یا رجیسترار کپی کنید.',
        tlsaPin: 'TLSA 3 1 1 کلید عمومی سرویس را با SHA-256 pin می‌کند. اگر سرور همان keypair را نگه دارد، تمدید گواهی ساده‌تر است.',
        parentSplit: 'رکوردهای parent و سرور متفاوت‌اند. کیف پول یا رجیسترار delegation را انجام می‌دهد. سرور DNS رکوردهای سایت و TLSA را منتشر می‌کند.',
        idna: 'نام‌های بین‌المللی به‌عنوان ورودی پذیرفته می‌شوند، اما رکوردهای DNS از IDNA A-label مانند xn--bcher-kva.example استفاده می‌کنند.',
        hnsGlue: (nameserver, domain) => `در حالت HNS delegated، وقتی nameserver زیر خود نام HNS است، مانند ${nameserver} برای ${domain}/، GLUE4/GLUE6 لازم است.`,
        hnsInline: 'حالت HNS SYNTH آدرس‌های IP nameserver را در منبع HNS ذخیره می‌کند. رکوردهای A/AAAA وب‌سایت و TLSA همچنان روی سرور DNS مقتدر قرار می‌گیرند.',
        preset: {
          'generic-zone': 'خروجی generic zone-file با BIND، Knot، NSD و بسیاری از ابزارهای import DNS کار می‌کند.',
          'hosted-dns': 'اگر ارائه‌دهنده شما DNSSEC، خروجی DS و TLSA را پشتیبانی می‌کند، Hosted DNS کوتاه‌ترین مسیر است.',
          powerdns: 'PowerDNS مسیر کوتاهی است وقتی DNS مبتنی بر API یا پایگاه داده می‌خواهید.',
          knot: 'Knot DNS یک سرور مقتدر مدرن با خودکارسازی ساده DNSSEC است.',
          bind: 'BIND 9 مستندات فراوان و نصب ساده دارد، اما پیکربندی آن طولانی‌تر است.',
          'windows-server': 'Windows Server DNS می‌تواند zone مقتدر را با DNS Manager یا PowerShell میزبانی و امضا کند.',
          nsd: 'NSD کوچک و قابل اعتماد است، اما امضای DNSSEC معمولا مرحله‌ای جداگانه دارد.'
        }
      }
    }
  ),
  he: buildCopy(
    {
      invalidDomain: 'פורמט הדומיין אינו תקין עבור פלט DNS.',
      idna: 'קלט דומיין בינלאומי מומר ל-DNS ASCII A-labels כגון xn--... ברשומות שנוצרות.',
      ttl: 'TTL צריך בדרך כלל להיות בין 60 ל-86400 שניות.',
      inlineIcann: 'מצב SYNTH nameserver מיועד ל-HNS בלבד. פלט ICANN משתמש ב-DNS delegation בשם.',
      synthNsMissing: 'מצב HNS SYNTH צריך לפחות כתובת IP אחת של nameserver.',
      websiteIpv4: 'כתובת IPv4 של האתר אינה תקינה.',
      websiteIpv6: 'כתובת IPv6 של האתר אינה תקינה.',
      nsIpv4: 'כתובת IPv4 של ה-nameserver אינה תקינה.',
      nsIpv6: 'כתובת IPv6 של ה-nameserver אינה תקינה.',
      nsMissing: 'מצב delegated צריך hostname של nameserver.',
      nsInvalid: 'hostname של ה-nameserver אינו תקין.',
      noWebsiteIp: 'לא סופקה כתובת IPv4 או IPv6 של האתר.',
      glueRequired: 'ה-nameserver נמצא בתוך אותו zone, לכן נדרש glue. הוסיפו לפחות כתובת IP אחת של nameserver.',
      tlsaNoDs: 'TLSA נוצר, אבל DNSSEC אינו שלם עד שמפרסמים רשומת DS בצד ה-parent.',
      tlsaUsage: 'TLSA usage 3 הוא ברירת המחדל לזרימה הזו. שימושים אחרים מתקדמים ותלויים ב-CA/TA.',
      tlsaError: 'לא ניתן ליצור רשומת TLSA.',
      dsError: 'לא ניתן ליצור רשומת DS מתוך קלט DNSKEY.',
      dnskeyProtocol: 'פרוטוקול DNSKEY הוא בדרך כלל 3. בדקו ששורת DNSKEY הודבקה נכון.',
      dnskeySep: 'ל-DNSKEY אין דגל SEP/KSK. רשומות DS נוצרות בדרך כלל מה-KSK.',
      dnskeySha1: 'אלגוריתם DNSKEY זה אינו מומלץ לחתימות DNSSEC חדשות. העדיפו אלגוריתם נתמך כיום כגון 8, 13 או 15 כאשר השרת תומך בו.'
    },
    {
      domainOk: 'הדומיין מנורמל עבור פלט DNS.',
      domainMissing: 'הזינו שם HNS או דומיין ICANN.',
      websiteOk: 'ניתן ליצור רשומות A/AAAA של האתר.',
      websiteMissing: 'הוסיפו לפחות כתובת IPv4 או IPv6 אחת של האתר.',
      synthNsOk: 'ניתן ליצור IP של SYNTH nameserver.',
      synthNsMissing: 'הוסיפו לפחות כתובת IPv4 או IPv6 אחת של nameserver.',
      nsOk: 'יעד ה-delegation קיים.',
      nsMissing: 'הוסיפו את hostname ה-nameserver הסמכותי.',
      glueInZone: 'ה-nameserver נמצא בתוך ה-zone, לכן glue חייב להיות ברשומות ה-parent.',
      glueExternal: 'ה-nameserver חיצוני, לכן ה-parent שלו מנהל את ה-glue.',
      dsOk: 'DS בצד ה-parent נוצר מתוך DNSKEY.',
      dsMissing: 'הדביקו DNSKEY אחרי חתימת ה-zone הסמכותי.',
      tlsaOk: 'TLSA נוצר מתוך תעודה/מפתח ציבורי.',
      tlsaMissing: 'הדביקו תעודה או PUBLIC KEY כדי ליצור TLSA.'
    },
    {
      inline4: 'הפניית nameserver סינתטית IPv4 בצד ארנק HNS.',
      inline6: 'הפניית nameserver סינתטית IPv6 בצד ארנק HNS.',
      glue4: 'רשומת glue בצד ארנק HNS עבור כתובת IPv4 של ה-nameserver הסמכותי בתוך השם.',
      glue6: 'רשומת glue בצד ארנק HNS עבור כתובת IPv6 של ה-nameserver הסמכותי בתוך השם.',
      hnsNs: 'רשומת delegation בצד ארנק HNS שמפנה את השם אל nameserver סמכותי חיצוני.',
      hnsDs: 'רשומת DNSSEC delegation signer בצד ארנק HNS שנגזרת מ-DNSKEY של ה-child zone.',
      dsPlaceholder: 'Placeholder: הדביקו DNSKEY של ה-zone הסמכותי כדי ליצור את רשומת ה-DS המדויקת בצד ה-parent.',
      registrarNs: 'delegation של nameserver בצד הרשם.',
      registrarGlue4: 'glue בצד הרשם נדרש כי ה-nameserver נמצא בתוך הדומיין המואצל.',
      registrarGlue6: 'glue IPv6 בצד הרשם נדרש כי ה-nameserver נמצא בתוך הדומיין המואצל.',
      registrarDs: 'רשומת DS בצד הרשם שנגזרת מ-DNSKEY של ה-child zone.',
      registrarDsPlaceholder: 'Placeholder: הדביקו DNSKEY של ה-zone הסמכותי כדי ליצור את רשומת ה-DS המדויקת בצד הרשם.',
      authNs: 'רשומת NS ב-zone הסמכותי שמציינת שרת שאחראי ל-zone הזה.',
      authA: 'כתובת IPv4 ב-zone הסמכותי עבור apex האתר.',
      authAaaa: 'כתובת IPv6 ב-zone הסמכותי עבור apex האתר.',
      authTlsa: 'רשומת DANE/TLSA ב-zone הסמכותי עבור שירות TLS.',
      authTlsaPlaceholder: 'Placeholder: הדביקו תעודת PEM או PUBLIC KEY כדי ליצור את נתוני TLSA המדויקים.',
      webServe: 'אם מפתח התעודה משתנה, פרסמו את ה-TLSA החדש לפני החלפת שרת ה-web למפתח החדש.',
      webRollover: 'TLSA 3 1 1 מקבע את המפתח הציבורי של השירות, לכן לקוחות DANE עלולים להיכשל בזמן שמטמונים עדיין מחזיקים רק את ה-association הישן.',
      webNoPlugin: 'שרת TLS מגיש תעודה רגילה. לקוח שתומך DANE מאמת את רשומת TLSA המוגנת ב-DNSSEC.',
      webClientSupport: 'פרסום TLSA הכרחי עבור DANE, אבל תוכנת הלקוח חייבת לבצע בפועל אימות DNSSEC ואימות DANE.',
      serverPreset: 'קטע התחלה בצד השרת. צרו את ה-zone, פרסמו NS/A/AAAA/TLSA, הפעילו DNSSEC, ואז פרסמו DS בצד ה-parent.',
      verifyDelegated: 'פקודות לבדיקה שהשרת הסמכותי עונה לפני ואחרי delegation בצד ה-parent.',
      verifyInline: 'פקודות לבדיקה שהשרת הסמכותי שאליו SYNTH מפנה עונה לפני ואחרי עדכון HNS.',
      integrator: 'פלט קריא למכונה עבור ארנקים, APIs עתידיים או בדיקות אינטגרציה. הוא לא נשלח אוטומטית לשום מקום.',
      stepInline1: 'SYNTH מפנה resolvers אל כתובות IP של nameserver; ה-zone עדיין מגיש רשומות A/AAAA של האתר ורשומות TLSA.',
      stepInline2: 'שרת ה-DNS צריך לנהל את מפתחות החתימה ואת ה-zone החתום.',
      stepInline3: 'SYNTH הוא ההפניה בצד ה-parent; DS מחבר את DNSSEC אל ה-zone החתום.',
      stepServer: 'השתמשו ב-preset השרת שנבחר או בפלט קובץ zone כללי.',
      stepDnssec: 'שרת ה-DNS צריך לנהל את מפתחות החתימה ואת ה-zone החתום.',
      stepDs: 'ה-DS מחבר את שכבת ה-parent אל ה-child zone החתום.',
      stepTlsa: 'TLSA נמצא על שרת ה-DNS הסמכותי.',
      stepParent: 'זה מפעיל את מסלול ה-delegation בצד ה-parent.'
    },
    {
      quickSteps: {
        inline: {
          server: '1. שימו את רשומות השרת על שרת ה-DNS הסמכותי.',
          dnssec: '2. הפעילו חתימת DNSSEC על ה-zone.',
          dsReady: '3. שלחו רשומות SYNTH ו-DS לארנק HNS.',
          dsMissing: '3. הדביקו כאן DNSKEY, ואז שלחו רשומות SYNTH ו-DS לארנק HNS.',
          tlsaReady: '4. הגישו את תעודת/מפתח HTTPS התואמים.',
          tlsaMissing: '4. הדביקו תעודת leaf או PUBLIC KEY כדי ליצור TLSA.'
        },
        delegated: {
          server: '1. שימו את רשומות השרת על שרת ה-DNS הסמכותי.',
          dnssec: '2. הפעילו חתימת DNSSEC על ה-zone.',
          dsReady: '3. העתיקו את ה-DS לארנק או לרשם.',
          dsMissing: '3. הדביקו כאן DNSKEY, ואז העתיקו את ה-DS שנוצר לארנק או לרשם.',
          tlsaReady: '4. הגישו את תעודת/מפתח HTTPS התואמים.',
          tlsaMissing: '4. הדביקו תעודת leaf או PUBLIC KEY כדי ליצור TLSA.',
          parentHns: '5. שלחו את עדכון משאב השם של HNS.',
          parentIcann: '5. שמרו אצל הרשם את הגדרות nameserver, glue ו-DS.'
        }
      },
      webNotes: {
        serve: 'הגישו את התעודה שהמפתח הציבורי שלה תואם ל-hash של TLSA SPKI.',
        rollover: 'ל-rollover של מפתח, פרסמו TLSA נוכחי ובא, המתינו לפחות TTL אחד, החליפו את מפתח השרת ואז הסירו את ה-TLSA הישן אחרי TTL נוסף.',
        noPlugin: 'Nginx/Apache/Caddy לא צריכים תוסף DANE; DANE נמצא ב-DNS.',
        clientSupport: 'DANE נאכף רק על ידי לקוחות שמאמתים DNSSEC ובודקים TLSA; לקוחות HTTPS רגילים עשויים להתעלם ממדיניות TLSA שפורסמה.'
      },
      verify: {
        hnsInline: '# לאחר אישור עדכון HNS, בדקו באמצעות resolver/דפדפן שתומך HNS.',
        expectedAddress: '# כתובת צפויה',
        hnsFullChain: '# לבדיקות שרשרת HNS מלאה, שאילתו דרך resolver תומך HNS לאחר אישור עדכון הארנק.'
      },
      fallbackNotice: 'לא ניתן לעבד את הקלט. בדקו את השדה המתאים ונסו שוב.',
      fallbackStatusDetail: 'בדקו פריט זה לפני פרסום הרשומות.',
      fallbackExplanation: 'שורה שנוצרה עבור שלב זה. העתיקו את הערך רק ליעד שמצוין בכותרת.',
      helpTips: {
        fastPath: 'המסלול האמין המהיר ביותר: צרו את ה-zone הסמכותי, הפעילו DNSSEC, הדביקו כאן DNSKEY, ואז העתיקו את ה-DS שנוצר לארנק או לרשם.',
        tlsaPin: 'TLSA 3 1 1 מקבע את המפתח הציבורי של השירות עם SHA-256. חידוש תעודה יכול להיות פשוט אם השרת שומר על אותו זוג מפתחות.',
        parentSplit: 'רשומות parent ורשומות שרת הן שונות. הארנק או הרשם מבצעים delegation. שרת ה-DNS מפרסם את רשומות האתר ו-TLSA.',
        idna: 'שמות בינלאומיים מתקבלים כקלט, אך רשומות DNS משתמשות ב-IDNA A-labels כגון xn--bcher-kva.example.',
        hnsGlue: (nameserver, domain) => `במצב HNS delegated, נדרש GLUE4/GLUE6 כאשר ה-nameserver נמצא תחת שם ה-HNS עצמו, למשל ${nameserver} עבור ${domain}/.`,
        hnsInline: 'מצב HNS SYNTH שומר כתובות IP של nameserver במשאב HNS. רשומות A/AAAA של האתר ורשומות TLSA עדיין נמצאות בשרת ה-DNS הסמכותי.',
        preset: {
          'generic-zone': 'פלט קובץ zone כללי עובד עם BIND, Knot, NSD וכלי import רבים של DNS.',
          'hosted-dns': 'Hosted DNS הוא המסלול הקצר ביותר אם הספק תומך ב-DNSSEC, ייצוא DS ורשומות TLSA.',
          powerdns: 'PowerDNS הוא מסלול קצר כאשר רוצים DNS עם API ניהולי או מסד נתונים.',
          knot: 'Knot DNS הוא שרת סמכותי מודרני ונקי עם אוטומציית DNSSEC פשוטה.',
          bind: 'BIND 9 מתועד היטב ונוח להתקנה דרך מנהל חבילות, אבל הקונפיגורציה שלו מפורטת יותר.',
          'windows-server': 'Windows Server DNS יכול לארח ולחתום את ה-zone הסמכותי דרך DNS Manager או PowerShell.',
          nsd: 'NSD קטן ואמין, אבל חתימת DNSSEC מטופלת בדרך כלל בשלב חתימה נפרד.'
        }
      }
    }
  )
};

function rootless(name: string): string {
  return name.endsWith('.') ? name.slice(0, -1) : name;
}

function translatedExplanation(c: CoreCopy, message: string): string {
  return (c.explanations[message] ?? c.fallbackExplanation) || message;
}

function nameserverForHelp(result: BootstrapResult): string {
  const line = result.parentRecords.find((record) => /^(GLUE4|GLUE6|NS) /.test(record.value));
  return line?.value.split(/\s+/)[1] ?? `ns1.${result.normalizedDomain}`;
}

function localizeQuickSteps(result: BootstrapResult, input: BootstrapInput, c: CoreCopy): GeneratedLine[] {
  if (result.diagnostics.mode === 'hns-inline') {
    return [
      { value: c.quickSteps.inline.server, explanation: translatedExplanation(c, explanationsEn.stepInline1) },
      { value: c.quickSteps.inline.dnssec, explanation: translatedExplanation(c, explanationsEn.stepInline2) },
      { value: result.diagnostics.hasDs ? c.quickSteps.inline.dsReady : c.quickSteps.inline.dsMissing, explanation: translatedExplanation(c, explanationsEn.stepInline3) },
      { value: result.diagnostics.hasTlsa ? c.quickSteps.inline.tlsaReady : c.quickSteps.inline.tlsaMissing, explanation: translatedExplanation(c, explanationsEn.stepTlsa) }
    ];
  }

  return [
    { value: c.quickSteps.delegated.server, explanation: translatedExplanation(c, explanationsEn.stepServer) },
    { value: c.quickSteps.delegated.dnssec, explanation: translatedExplanation(c, explanationsEn.stepDnssec) },
    { value: result.diagnostics.hasDs ? c.quickSteps.delegated.dsReady : c.quickSteps.delegated.dsMissing, explanation: translatedExplanation(c, explanationsEn.stepDs) },
    { value: result.diagnostics.hasTlsa ? c.quickSteps.delegated.tlsaReady : c.quickSteps.delegated.tlsaMissing, explanation: translatedExplanation(c, explanationsEn.stepTlsa) },
    { value: input.domainType === 'hns' ? c.quickSteps.delegated.parentHns : c.quickSteps.delegated.parentIcann, explanation: translatedExplanation(c, explanationsEn.stepParent) }
  ];
}

function localizeVerification(lines: GeneratedLine[], c: CoreCopy): GeneratedLine[] {
  return lines.map((line) => {
    let value = line.value;
    if (value.startsWith('# After the HNS update confirms')) {
      const expected = value.match(/# Expected address: (.+)$/m)?.[1] ?? '<website-ip>';
      value = `${c.verify.hnsInline}\n${c.verify.expectedAddress}: ${expected}`;
    } else {
      value = value
        .replace('# After the HNS update confirms, test full-chain resolution with an HNS-aware resolver/browser.', c.verify.hnsInline)
        .replace('# For HNS full-chain tests, query through your HNS-aware resolver after the wallet update confirms.', c.verify.hnsFullChain);
    }
    return { value, explanation: translatedExplanation(c, line.explanation) };
  });
}

function localizeLine(line: GeneratedLine, c: CoreCopy): GeneratedLine {
  return {
    ...line,
    explanation: translatedExplanation(c, line.explanation)
  };
}

function localizeNotices(notices: BootstrapNotice[], c: CoreCopy): BootstrapNotice[] {
  return notices.map((notice) => {
    const estimated = notice.message.match(/^Estimated HNS parent-resource draft is (\d+) bytes\. Keep HNS name resources small\.$/);
    if (estimated) {
      return { ...notice, message: c.fallbackNotice || `Estimated HNS parent-resource draft is ${estimated[1]} bytes. Keep HNS name resources small.` };
    }
    return { ...notice, message: (c.notices[notice.message] ?? c.fallbackNotice) || notice.message };
  });
}

function localizeStatus(checks: StatusCheck[], c: CoreCopy): StatusCheck[] {
  return checks.map((check) => ({
    ...check,
    detail: (c.statusDetails[check.detail] ?? c.fallbackStatusDetail) || check.detail
  }));
}

function localizeHelpTips(result: BootstrapResult, input: BootstrapInput, c: CoreCopy): string[] {
  const tips = [
    c.helpTips.fastPath,
    c.helpTips.preset[result.diagnostics.dnsServerPreset],
    c.helpTips.tlsaPin,
    c.helpTips.parentSplit,
    c.helpTips.idna
  ];
  if (input.domainType === 'hns' && result.diagnostics.mode === 'delegated') tips.push(c.helpTips.hnsGlue(nameserverForHelp(result), rootless(result.normalizedDomain)));
  if (result.diagnostics.mode === 'hns-inline') tips.push(c.helpTips.hnsInline);
  return tips;
}

export function localizeBootstrapResult(result: BootstrapResult, input: BootstrapInput, language: LanguageCode): BootstrapResult {
  const c = copy[language] ?? en;
  const quickSteps = localizeQuickSteps(result, input, c);
  const webServerNotes = [
    { value: c.webNotes.serve, explanation: translatedExplanation(c, explanationsEn.webServe) },
    { value: c.webNotes.rollover, explanation: translatedExplanation(c, explanationsEn.webRollover) },
    { value: c.webNotes.noPlugin, explanation: translatedExplanation(c, explanationsEn.webNoPlugin) },
    { value: c.webNotes.clientSupport, explanation: translatedExplanation(c, explanationsEn.webClientSupport) }
  ];
  const sections = result.sections.map((section) => {
    if (section.id === 'steps') return { ...section, lines: quickSteps };
    if (section.id === 'web') return { ...section, lines: webServerNotes };
    if (section.id === 'verify') return { ...section, lines: localizeVerification(section.lines, c) };
    return { ...section, lines: section.lines.map((line) => localizeLine(line, c)) };
  });
  const notices = localizeNotices(result.notices, c);

  return {
    ...result,
    quickSteps,
    webServerNotes,
    verificationCommands: localizeVerification(result.verificationCommands, c),
    notices,
    warnings: notices.filter((item) => item.severity !== 'info').map((item) => item.message),
    statusChecks: localizeStatus(result.statusChecks, c),
    helpTips: localizeHelpTips(result, input, c),
    sections
  };
}
