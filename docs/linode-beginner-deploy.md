# Linode Beginner Deploy

This path is for a user who wants Linode/Akamai to bill them directly and wants to paste the final HNS records into their own wallet.

## Flow

1. Open the project UI and enter one Handshake domain, such as `denuoweb` or `denuoweb/`.
2. Choose the Linode/Akamai deployment path.
3. Create a Debian 13 Linode with the pinned HNS DANE StackScript. If the project maintainer has published the StackScript, use the app's `Open Linode` button.
4. Wait for the StackScript to finish.
5. SSH to the server and read `/root/hns-dane-appliance/README-FIRST.txt`, or run `hns-dane print-wallet-instructions`.
6. Copy the NS, GLUE, and DS records into the wallet that owns the HNS name.
7. Submit the HNS update yourself.
8. After the update confirms and the name resolves, open the generated `https://<name>/` dashboard and check verification status.

The appliance deliberately removes TCP 80 access. Its nginx dashboard is
name-bound HTTPS on TCP 443, so the raw server IPv4 address is not a supported
dashboard URL.

## StackScript wallet fields

The StackScript asks for public, non-secret hsd wallet routing fields so the generated `hsw-rpc` command points at the right local wallet and account.

Use `hsd_wallet_id=primary` and `hsd_account_name=default` for a normal hsd wallet. Change them only when the owning name is stored in a different local hsd wallet or account.

Do not put a wallet seed, private key, or wallet password in either field.

## What the appliance never asks for

Do not paste these into the UI, StackScript UDF fields, SSH session, or dashboard:

```text
HNS wallet seed
HNS private key
Linode API token
Cloud provider API token
Credit card/payment data
Registrar login
TLS private key supplied by user
DNSSEC private key supplied by user
```

The VPS generates its own TLS and DNSSEC keys locally. The public dashboard shows only public DNS records and status.

## Beginner mode

The v0.2.1 StackScript always provisions `single-node`; it does not expose a
deployment-mode field. The resulting appliance creates:

```text
ns1.<name>. -> server IPv4
NS + GLUE4 + DS for the HNS wallet
TLSA _443._tcp.<name>. from the local HTTPS key
```

Terraform/OpenTofu and SYNTH records are not part of the beginner path.
