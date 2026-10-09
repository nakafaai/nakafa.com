/**
 * Golden verdicts for research addresses. Each row is [host, URL verdict,
 * address verdict]. The address verdict is "public" (outside every refused
 * range), "refused" (inside one), or "none" (text the address parser does not
 * accept). The host is passed to the helpers as written and is also the
 * authority of https://<host>/. A boundary shared by two ranges is listed once,
 * under the first range that names it.
 *
 * The never-weaker rule governs every change to a recorded verdict:
 * - A URL verdict may change only from allowed to refused.
 * - An address verdict recorded as refused may become none or stay refused, but
 *   never public.
 * - An address verdict recorded as public may become any value.
 * - An address verdict recorded as none may stay none or become refused, but
 *   never public.
 * Any other change is a stop, not an update.
 *
 * The first recording came from the ipaddr.js 2.5.0 implementation, and every
 * later change followed the rule above. One gap is still recorded as found:
 * the URL check allows the trailing-dot name `localhost.` and the name
 * `127.0.0.1.nip.io`. The DNS check in tools/safety.ts is the only guard for
 * both.
 */
export type GoldenAddress = "none" | "public" | "refused";

type GoldenVerdict = [string, "allowed" | "refused", GoldenAddress];

export const ADDRESS_VERDICTS: readonly GoldenVerdict[] = [
  // ipaddr.js IPv4 unspecified 0.0.0.0/8
  ["0.0.0.0", "refused", "refused"],
  ["0.255.255.255", "refused", "refused"],
  ["1.0.0.0", "allowed", "public"],
  // ipaddr.js IPv4 broadcast 255.255.255.255/32
  ["255.255.255.255", "refused", "refused"],
  ["255.255.255.254", "refused", "refused"],
  // ipaddr.js IPv4 multicast 224.0.0.0/4
  ["224.0.0.0", "refused", "refused"],
  ["239.255.255.255", "refused", "refused"],
  ["240.0.0.0", "refused", "refused"],
  // ipaddr.js IPv4 linkLocal 169.254.0.0/16
  ["169.254.0.0", "refused", "refused"],
  ["169.254.255.255", "refused", "refused"],
  ["169.255.0.0", "allowed", "public"],
  // ipaddr.js IPv4 loopback 127.0.0.0/8
  ["127.0.0.0", "refused", "refused"],
  ["127.255.255.255", "refused", "refused"],
  ["128.0.0.0", "allowed", "public"],
  // ipaddr.js IPv4 carrierGradeNat 100.64.0.0/10
  ["100.64.0.0", "refused", "refused"],
  ["100.127.255.255", "refused", "refused"],
  ["100.128.0.0", "allowed", "public"],
  // ipaddr.js IPv4 private 10.0.0.0/8
  ["10.0.0.0", "refused", "refused"],
  ["10.255.255.255", "refused", "refused"],
  ["11.0.0.0", "allowed", "public"],
  // ipaddr.js IPv4 private 172.16.0.0/12
  ["172.16.0.0", "refused", "refused"],
  ["172.31.255.255", "refused", "refused"],
  ["172.32.0.0", "allowed", "public"],
  // ipaddr.js IPv4 private 192.168.0.0/16
  ["192.168.0.0", "refused", "refused"],
  ["192.168.255.255", "refused", "refused"],
  ["192.169.0.0", "allowed", "public"],
  // ipaddr.js IPv4 reserved 192.0.0.0/24
  ["192.0.0.0", "refused", "refused"],
  ["192.0.0.255", "refused", "refused"],
  ["192.0.1.0", "allowed", "public"],
  // ipaddr.js IPv4 reserved 192.0.2.0/24
  ["192.0.2.0", "refused", "refused"],
  ["192.0.2.255", "refused", "refused"],
  ["192.0.3.0", "allowed", "public"],
  // ipaddr.js IPv4 reserved 192.88.99.0/24
  ["192.88.99.0", "refused", "refused"],
  ["192.88.99.255", "refused", "refused"],
  ["192.88.100.0", "allowed", "public"],
  // ipaddr.js IPv4 reserved 198.18.0.0/15
  ["198.18.0.0", "refused", "refused"],
  ["198.19.255.255", "refused", "refused"],
  ["198.20.0.0", "allowed", "public"],
  // ipaddr.js IPv4 reserved 198.51.100.0/24
  ["198.51.100.0", "refused", "refused"],
  ["198.51.100.255", "refused", "refused"],
  ["198.51.101.0", "allowed", "public"],
  // ipaddr.js IPv4 reserved 203.0.113.0/24
  ["203.0.113.0", "refused", "refused"],
  ["203.0.113.255", "refused", "refused"],
  ["203.0.114.0", "allowed", "public"],
  // ipaddr.js IPv4 as112 192.175.48.0/24
  ["192.175.48.0", "refused", "refused"],
  ["192.175.48.255", "refused", "refused"],
  ["192.175.49.0", "allowed", "public"],
  // ipaddr.js IPv4 as112 192.31.196.0/24
  ["192.31.196.0", "refused", "refused"],
  ["192.31.196.255", "refused", "refused"],
  ["192.31.197.0", "allowed", "public"],
  // ipaddr.js IPv4 amt 192.52.193.0/24
  ["192.52.193.0", "refused", "refused"],
  ["192.52.193.255", "refused", "refused"],
  ["192.52.194.0", "allowed", "public"],
  // ipaddr.js IPv6 unspecified ::/128
  ["[::]", "refused", "refused"],
  ["[::1]", "refused", "refused"],
  // ipaddr.js IPv6 linkLocal fe80::/10
  ["[fe80::]", "refused", "refused"],
  ["[febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[fec0::]", "refused", "refused"],
  // ipaddr.js IPv6 multicast ff00::/8
  ["[ff00::]", "refused", "refused"],
  ["[ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[feff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  // ipaddr.js IPv6 loopback ::1/128
  ["[::2]", "refused", "refused"],
  // ipaddr.js IPv6 uniqueLocal fc00::/7
  ["[fc00::]", "refused", "refused"],
  ["[fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[fe00::]", "refused", "refused"],
  // ipaddr.js IPv6 ipv4Mapped ::ffff:0:0/96
  ["[::ffff:0:0]", "refused", "refused"],
  ["[::ffff:ffff:ffff]", "refused", "refused"],
  ["[::1:0:0:0]", "refused", "refused"],
  // ipaddr.js IPv6 discard 100::/64
  ["[100::]", "refused", "refused"],
  ["[100::ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[100:0:0:1::]", "refused", "refused"],
  // ipaddr.js IPv6 rfc6145 ::ffff:0:0:0/96
  ["[::ffff:0:0:0]", "refused", "refused"],
  ["[::ffff:0:ffff:ffff]", "refused", "refused"],
  ["[::ffff:1:0:0]", "refused", "refused"],
  // ipaddr.js IPv6 rfc6052 64:ff9b::/96
  ["[64:ff9b::]", "refused", "refused"],
  ["[64:ff9b::ffff:ffff]", "refused", "refused"],
  ["[64:ff9b::1:0:0]", "refused", "refused"],
  // ipaddr.js IPv6 rfc6052 64:ff9b:1::/48
  ["[64:ff9b:1::]", "refused", "refused"],
  ["[64:ff9b:1:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[64:ff9b:2::]", "refused", "refused"],
  // ipaddr.js IPv6 6to4 2002::/16
  ["[2002::]", "refused", "refused"],
  ["[2002:ffff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[2003::]", "allowed", "public"],
  // ipaddr.js IPv6 teredo 2001::/32
  ["[2001::]", "refused", "refused"],
  ["[2001:0:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[2001:1::]", "refused", "refused"],
  // ipaddr.js IPv6 benchmarking 2001:2::/48
  ["[2001:2::]", "refused", "refused"],
  ["[2001:2:0:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[2001:2:1::]", "refused", "refused"],
  // ipaddr.js IPv6 amt 2001:3::/32
  ["[2001:3::]", "refused", "refused"],
  ["[2001:3:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[2001:4::]", "refused", "refused"],
  // ipaddr.js IPv6 as112v6 2001:4:112::/48
  ["[2001:4:112::]", "refused", "refused"],
  ["[2001:4:112:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[2001:4:113::]", "refused", "refused"],
  // ipaddr.js IPv6 as112v6 2620:4f:8000::/48
  ["[2620:4f:8000::]", "refused", "refused"],
  ["[2620:4f:8000:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[2620:4f:8001::]", "allowed", "public"],
  // ipaddr.js IPv6 deprecatedOrchid 2001:10::/28
  ["[2001:10::]", "refused", "refused"],
  ["[2001:1f:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[2001:20::]", "refused", "refused"],
  // ipaddr.js IPv6 orchid2 2001:20::/28
  ["[2001:2f:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[2001:30::]", "refused", "refused"],
  // ipaddr.js IPv6 droneRemoteIdProtocolEntityTags 2001:30::/28
  ["[2001:3f:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[2001:40::]", "refused", "refused"],
  // ipaddr.js IPv6 segmentRouting 5f00::/16
  ["[5f00::]", "refused", "refused"],
  ["[5f00:ffff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[5f01::]", "refused", "refused"],
  // ipaddr.js IPv6 reserved 2001::/23
  ["[2001:1ff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[2001:200::]", "allowed", "public"],
  // ipaddr.js IPv6 reserved 2001:db8::/32
  ["[2001:db8::]", "refused", "refused"],
  ["[2001:db8:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[2001:db9::]", "allowed", "public"],
  // ipaddr.js IPv6 reserved 3fff::/20
  ["[3fff::]", "refused", "refused"],
  ["[3fff:fff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[3fff:1000::]", "allowed", "public"],
  // Ordinary public addresses.
  ["8.8.8.8", "allowed", "public"],
  ["93.184.216.34", "allowed", "public"],
  ["1.1.1.1", "allowed", "public"],
  ["[2606:4700:4700::1111]", "allowed", "public"],
  ["[2001:4860:4860::8888]", "allowed", "public"],
  ["2606:4700:4700::1111", "refused", "public"],
  // IPv4-mapped, IPv4-compatible, and translated IPv6 forms, bracketed.
  ["[::ffff:10.0.0.1]", "refused", "refused"],
  ["[::ffff:127.0.0.1]", "refused", "refused"],
  ["[::ffff:169.254.169.254]", "refused", "refused"],
  ["[::ffff:192.168.1.1]", "refused", "refused"],
  ["[::ffff:a00:1]", "refused", "refused"],
  ["[::ffff:0a00:0001]", "refused", "refused"],
  ["[0:0:0:0:0:ffff:7f00:1]", "refused", "refused"],
  ["[::FFFF:127.0.0.1]", "refused", "refused"],
  ["[::FFFF:7F00:1]", "refused", "refused"],
  ["[::ffff:8.8.8.8]", "allowed", "public"],
  ["[::ffff:0:127.0.0.1]", "refused", "refused"],
  ["[::127.0.0.1]", "refused", "refused"],
  ["[::8.8.8.8]", "refused", "refused"],
  ["[64:ff9b::7f00:1]", "refused", "refused"],
  ["[2002:7f00:1::]", "refused", "refused"],
  ["[2001:db8::1]", "refused", "refused"],
  // The same IPv6 forms unbracketed, as the helpers receive them.
  ["::ffff:127.0.0.1", "refused", "refused"],
  ["::ffff:8.8.8.8", "refused", "public"],
  ["::127.0.0.1", "refused", "refused"],
  ["::8.8.8.8", "refused", "refused"],
  ["::1", "refused", "refused"],
  ["2001:db8::1", "refused", "refused"],
  // Zone identifiers.
  ["fe80::1%eth0", "refused", "none"],
  ["2606:4700:4700::1111%eth0", "refused", "none"],
  ["[fe80::1%eth0]", "refused", "none"],
  // IPv4 decimal, octal, hexadecimal, and short forms, plus malformed ones.
  ["0", "refused", "none"],
  ["2130706433", "refused", "none"],
  ["134744072", "allowed", "none"],
  ["0177.0.0.1", "refused", "none"],
  ["127.000.000.001", "refused", "none"],
  ["127.0.0.01", "refused", "none"],
  ["010.0.0.8", "allowed", "none"],
  ["0x7f.0.0.1", "refused", "none"],
  ["0x7f.0x0.0x0.0x1", "refused", "none"],
  ["0x7f000001", "refused", "none"],
  ["017700000001", "refused", "none"],
  ["127.1", "refused", "none"],
  ["127.0.1", "refused", "none"],
  ["8.8", "allowed", "none"],
  ["0x0a.1", "refused", "none"],
  ["08.0.0.1", "refused", "none"],
  ["127.0.0.1.", "refused", "none"],
  ["127.0.0.1:80", "refused", "none"],
  ["256.0.0.1", "refused", "none"],
  ["1.2.3.4.5", "refused", "none"],
  ["0x100000000", "refused", "none"],
  [" 127.0.0.1 ", "refused", "refused"],
  // Host names that are not addresses.
  ["example.com", "allowed", "none"],
  ["localhost", "refused", "none"],
  ["LOCALHOST", "refused", "none"],
  ["admin.localhost", "refused", "none"],
  ["localhost.", "allowed", "none"],
  ["127.0.0.1.nip.io", "allowed", "none"],
  // The global unicast space 2000::/3 and the reserved space around it
  ["[1fff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", "refused"],
  ["[2000::]", "allowed", "public"],
  ["[3fff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]", "allowed", "public"],
  ["[4000::]", "refused", "refused"],
  ["[e000::1]", "refused", "refused"],
  // ISATAP interface identifiers below the zero prefix, with IPv4 inside
  ["[::5efe:7f00:1]", "refused", "refused"],
  ["[::5efe:a9fe:a9fe]", "refused", "refused"],
  ["[::200:5efe:a00:1]", "refused", "refused"],
  ["::5efe:10.0.0.1", "refused", "refused"],
  // Empty and garbage text, and zone-suffixed addresses, judged by judgeAddress.
  ["", "refused", "none"],
  ["not-an-address", "allowed", "none"],
  ["fe80::2%en0", "refused", "none"],
  ["2001:4860:4860::8888%en0", "refused", "none"],
];
