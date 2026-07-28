# Deployment

## Local development

```bash
npm ci
npm run dev
```

## Production build

```bash
npm ci
./scripts/check.sh
```

The qualification gate runs the dependency audit, TypeScript checks, browser
tests, appliance tests, and production build. The static site is emitted to
`dist/`.

## Linode/Akamai appliance

The appliance path lives alongside the static app:

```text
appliance/
stackscripts/linode/
docs/linode-beginner-deploy.md
```

The StackScript is intentionally thin and fails closed until a real tagged release archive SHA256 replaces `REPLACE_WITH_RELEASE_TARBALL_SHA256`.

The static app has the public StackScript ID checked in for the integrated `Open Linode` flow. To override it for a future replacement StackScript, build with:

```bash
VITE_LINODE_STACKSCRIPT_ID=<published-stackscript-id> npm run build
```

See [Publish The Linode StackScript](linode-stackscript-publish.md).

For local appliance development, run:

```bash
npm run test:appliance
```

For a real VPS install, use Debian 13 and follow [Linode Beginner Deploy](linode-beginner-deploy.md).

## Static hosting

Deploy the `dist/` directory to any static host.

Required behavior:

- Serve `index.html`.
- Serve JavaScript and CSS assets.
- No backend is required.
- No secrets are required.

## Docker

```bash
docker build -t hns-dane-bootstrap-generator .
docker run --rm -p 8080:80 hns-dane-bootstrap-generator
```

Open `http://localhost:8080`.

## Security posture

- All generation runs in the browser.
- No private key is required.
- Pasted certificates and public keys are public material.
- DNSKEY is public DNSSEC material.
- The app does not submit wallet, registrar, or DNS updates.
- The app does not need analytics, accounts, or server storage.

## Suggested production headers

The included nginx config sets:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: clipboard-write=(self)`

A stricter CSP can be added once the final hosting path and build asset names are known.
