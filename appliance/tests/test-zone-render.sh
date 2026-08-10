#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=test-lib.sh
source "$SCRIPT_DIR/test-lib.sh"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
make_test_env "$tmp"
seed_config

digest="0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF"
jq --arg digest "$digest" '.network.publicIPv6 = "2001:db8::10" | .nameservers[0].ipv6 = "2001:db8::10" | .tlsa.associationData = $digest' "$HNS_DANE_CONFIG" > "$tmp/config.json"
mv "$tmp/config.json" "$HNS_DANE_CONFIG"

"$TEST_ROOT/lib/generate-zone.sh"
zone_file="$HNS_DANE_ZONE_DIR/denuoweb.zone"

assert_file_contains '$ORIGIN denuoweb.' "$zone_file" "zone origin"
assert_file_contains '@ IN NS ns1.denuoweb.' "$zone_file" "NS record"
assert_file_contains 'ns1 IN A 203.0.113.10' "$zone_file" "GLUE target A"
assert_file_contains 'ns1 IN AAAA 2001:db8::10' "$zone_file" "GLUE target AAAA"
assert_file_contains '_dns.ns1 IN SVCB 1 ns1 alpn=h2 dohpath=/dns-query{?dns}' "$zone_file" "RFC 9461 DoH SVCB record"
assert_file_contains "_443._tcp IN TLSA 3 1 1 $digest" "$zone_file" "TLSA record"
assert_file_contains '@ IN TXT "hns-dane-appliance=v0.2.2"' "$zone_file" "marker TXT"

printf 'ok - zone-render\n'
