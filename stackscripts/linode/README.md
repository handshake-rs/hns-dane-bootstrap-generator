# Linode/Akamai StackScript

`hns-dane-appliance-bootstrap.sh` is intentionally thin. It installs only bootstrap dependencies, downloads the versioned `hns-dane-appliance-vX.Y.Z.tar.gz` GitHub Release asset, verifies its SHA256, and runs `appliance/install.sh` with StackScript UDF values.

For v0.2.2, the project-built minimal Release asset is canonical; GitHub's generated tag source archive is not. Build and reproduce the candidate for an exact clean `main` commit with the credential-free `appliance-release-preflight.yml` workflow, upload those exact bytes only after release authorization, and render the template with the digest from `SHA256SUMS`. Development testing can run `appliance/install.sh` directly from a checkout; do not publish an unverified StackScript for beginners.

The StackScript UDF values must not contain wallet seeds, private keys, Linode API tokens, cloud API tokens, registrar credentials, or payment data. The `hsd_wallet_id` and `hsd_account_name` fields are non-secret local hsd routing hints used only in generated wallet instructions. The normal hsd defaults are wallet ID `primary` and account name `default`.

For v0.2.2 source, the StackScript always installs the single-node appliance. Two-node mode is documented as a future design target. The checked-in bootstrap intentionally retains a fail-closed placeholder hash; only a rendered script pinned to the read-back Release asset may be published.

Use `scripts/publish-linode-stackscript.sh` to publish this StackScript from a release hash. After publishing, build the web app with `VITE_LINODE_STACKSCRIPT_ID=<id>` so the UI can show an `Open Linode` button.

The public v0.2.1 StackScript remains historical ID `2158182` and used the legacy GitHub-generated tag archive mechanism. Do not repoint it. The v0.2.2 migration creates and validates a replacement StackScript with a new ID before the browser app default changes. See [Publish The Linode StackScript](../../docs/linode-stackscript-publish.md) for the exact commit/tree/checksum/provenance contract and historical tag evidence.
