# Deploy To denuoweb-vm

The public generator is deployed manually to the Google Cloud VM `denuoweb-vm` in zone `us-west1-b`.

Live URL:

```text
https://hns.denuoweb.com/dane-generator/
```

Remote web root:

```text
/var/www/denuoweb/dane-generator
```

The web root is a static artifact deployment, not a Git checkout. Build and
test the exact committed source locally, then upload its `dist/` output. Do not
run `git pull` inside the web root.

Build locally:

```bash
npm ci
npm test
npm run build
```

Deploy the contents of `dist/` to the VM web root, replacing old generated assets and keeping a timestamped backup on the VM first.

The VM firewall requires an Identity-Aware Proxy tunnel for administrator SSH:

```bash
gcloud compute ssh denuoweb-vm \
  --project denuo-web-site \
  --zone us-west1-b \
  --tunnel-through-iap
```

Use `gcloud compute scp --tunnel-through-iap` to upload a commit-stamped staging
directory. On the VM, move the current web root to a timestamped backup before
moving the complete staged directory into place. Verify the deployed file
hashes and the live HTTPS response before removing any backup.

This repository intentionally does not use GitHub Actions for deployment. Do not add `.github/workflows/*`; deployment should stay explicit from the maintainer shell with `gcloud compute ssh` and `gcloud compute scp`.
