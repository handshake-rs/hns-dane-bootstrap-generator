# Linode/Akamai StackScript

`hns-dane-appliance-bootstrap.sh` is intentionally thin. It installs only bootstrap dependencies, downloads a pinned tagged release archive, verifies the archive SHA256, and runs `appliance/install.sh` with StackScript UDF values.

Before publishing the StackScript, replace `REPLACE_WITH_RELEASE_TARBALL_SHA256` with the real SHA256 for the tagged GitHub archive. Development testing can run `appliance/install.sh` directly from a checkout; do not publish an unverified StackScript for beginners.

The StackScript UDF values must not contain wallet seeds, private keys, Linode API tokens, cloud API tokens, registrar credentials, or payment data. The `hsd_wallet_id` and `hsd_account_name` fields are non-secret local hsd routing hints used only in generated wallet instructions. The normal hsd defaults are wallet ID `primary` and account name `default`.

For v0.2.2 source, the StackScript always installs the single-node appliance. Two-node mode is documented as a future design target. The checked-in bootstrap intentionally retains a fail-closed placeholder hash; only a rendered, exact-tag script may be published.

Use `scripts/publish-linode-stackscript.sh` to publish this StackScript from a release hash. After publishing, build the web app with `VITE_LINODE_STACKSCRIPT_ID=<id>` so the UI can show an `Open Linode` button.
