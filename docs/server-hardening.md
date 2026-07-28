# Server Hardening

The appliance applies conservative hardening that should not lock out a new Linode user.

Implemented baseline:

- apt package installation during setup
- unattended security upgrades
- UFW default deny incoming and default allow outgoing
- UFW allows OpenSSH, DNS TCP/UDP 53, and HTTPS 443
- any stale UFW allow rule for TCP 80 is removed during setup or upgrade
- fail2ban enabled when available
- Knot runs through the distribution service account
- nginx runs through the distribution service account
- TLS private keys use restrictive permissions
- private backups stay under `/root/hns-dane-appliance/backups/`
- basic sysctl network hardening
- logrotate config for appliance logs

The appliance does not change the SSH port, disable root login, or disable password login by default. Those changes can lock out beginners if they do not already have working SSH key access.

The appliance does not install or expose a recursive resolver.
