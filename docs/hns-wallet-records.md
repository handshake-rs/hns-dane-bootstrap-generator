# HNS Wallet Records

The appliance generates public HNS records in:

```text
/root/hns-dane-appliance/output/hns-resource.json
/var/www/hns-dane/files/hns-resource.json
```

Single-node mode emits:

```json
{
  "records": [
    {
      "type": "NS",
      "ns": "ns1.denuoweb."
    },
    {
      "type": "GLUE4",
      "ns": "ns1.denuoweb.",
      "address": "203.0.113.10"
    },
    {
      "type": "DS",
      "keyTag": 12345,
      "algorithm": 13,
      "digestType": 2,
      "digest": "ABCDEF..."
    }
  ]
}
```

If IPv6 is enabled and detected, a `GLUE6` record is included.

An HNS update replaces the complete resource. Old records that are not present in this generated JSON are removed when the update confirms.

The appliance does not submit HNS transactions, sign wallet updates, custody funds, or request wallet seeds. The user copies the records and submits the update from their own wallet.

SYNTH mode is outside the single-node appliance path.
