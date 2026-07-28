# Two-Node Reliable Mode

Two-node mode is a design target, not a completed v0.2.1 feature. The installer fails clearly if `primary-node` or `secondary-node` is selected so the appliance does not pretend to provide redundancy before it actually does.

## Target architecture

```text
ns1.<zone> primary authoritative DNS
ns2.<zone> secondary authoritative DNS
TSIG-protected AXFR/IXFR
same signed zone
HNS resource includes NS plus GLUE4/GLUE6 for both nameservers, plus one DS
```

## Assisted flow

The beginner path must not ask for a Linode API token and must not place TSIG secrets in StackScript user-data.

The intended future flow is:

1. User deploys a primary node with `mode=primary-node`.
2. Primary generates the zone, DNSSEC keys, TSIG join token, and secondary setup instructions.
3. User deploys a secondary node with `mode=secondary-node`.
4. User opens the secondary setup page and pastes the join token.
5. Secondary configures itself as a Knot secondary.
6. Primary updates the generated HNS resource JSON to include both `ns1` and `ns2` NS and GLUE records plus the DS.

## v0.2.1 status

Implemented:

- single-node deployment
- canonical config shape with deployment mode and role fields
- a StackScript that exposes no deployment-mode field and always selects
  `single-node`
- an installer/configuration guard that rejects `primary-node` and
  `secondary-node`
- documentation for the assisted design

Not implemented:

- TSIG join token generation
- secondary setup page
- Knot primary/secondary transfer configuration
- HNS resource update with `ns2`
- dashboard verification for both nodes
