import { describe, expect, it } from "@effect/vitest";
import {
  isBlockedIpAddress,
  isIpAddress,
  isPublicHttpUrlSyntax,
  normalizeHostname,
} from "@repo/backend/confect/nina/research/url";

describe("research URL policy", () => {
  it("accepts only public http(s) URL syntax", () => {
    expect(isPublicHttpUrlSyntax("https://example.com/docs")).toBe(true);
    expect(isPublicHttpUrlSyntax("not-a-url")).toBe(false);
    expect(isPublicHttpUrlSyntax("file:///etc/passwd")).toBe(false);
    expect(isPublicHttpUrlSyntax("https://user@example.com")).toBe(false);
    expect(isPublicHttpUrlSyntax("https://example.com:pass@example.com")).toBe(
      false
    );
    expect(isPublicHttpUrlSyntax("http://localhost:3000")).toBe(false);
    expect(isPublicHttpUrlSyntax("http://admin.localhost")).toBe(false);
    expect(isPublicHttpUrlSyntax("http://10.0.0.1")).toBe(false);
  });

  it("normalizes hostnames before range checks", () => {
    expect(normalizeHostname(" [::1] ")).toBe("::1");
    expect(normalizeHostname("EXAMPLE.COM")).toBe("example.com");
  });

  it("detects IP literals without treating domains as IPs", () => {
    expect(isIpAddress("93.184.216.34")).toBe(true);
    expect(isIpAddress("2001:4860:4860::8888")).toBe(true);
    expect(isIpAddress("example.com")).toBe(false);
  });

  it("blocks non-public IPv4 ranges", () => {
    expect(isBlockedIpAddress("0.0.0.0")).toBe(true);
    expect(isBlockedIpAddress("10.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("127.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("100.64.0.1")).toBe(true);
    expect(isBlockedIpAddress("169.254.0.1")).toBe(true);
    expect(isBlockedIpAddress("172.16.0.1")).toBe(true);
    expect(isBlockedIpAddress("192.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("192.88.99.1")).toBe(true);
    expect(isBlockedIpAddress("192.168.0.1")).toBe(true);
    expect(isBlockedIpAddress("198.18.0.1")).toBe(true);
    expect(isBlockedIpAddress("198.51.100.1")).toBe(true);
    expect(isBlockedIpAddress("203.0.113.1")).toBe(true);
    expect(isBlockedIpAddress("224.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("999.0.0.1")).toBe(false);
    expect(isBlockedIpAddress("93.184.216.34")).toBe(false);
  });

  it("blocks non-public IPv6 ranges and mapped private IPv4 ranges", () => {
    expect(isBlockedIpAddress("::")).toBe(true);
    expect(isBlockedIpAddress("::1")).toBe(true);
    expect(isBlockedIpAddress("fc00::1")).toBe(true);
    expect(isBlockedIpAddress("fd00::1")).toBe(true);
    expect(isBlockedIpAddress("fe80::1")).toBe(true);
    expect(isBlockedIpAddress("ff00::1")).toBe(true);
    expect(isBlockedIpAddress("2001:db8::1")).toBe(true);
    expect(isBlockedIpAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("::ffff:7f00:1")).toBe(true);
    expect(isBlockedIpAddress("::ffff:zzzz:1")).toBe(false);
    expect(isBlockedIpAddress("::ffff:1")).toBe(false);
    expect(isBlockedIpAddress("::ffff:10000:1")).toBe(false);
    expect(isBlockedIpAddress("::ffff:-1:1")).toBe(false);
    expect(isBlockedIpAddress("2001:4860:4860::8888")).toBe(false);
  });
});

/**
 * Golden verdicts recorded from the ipaddr.js 2.5.0 implementation before any
 * replacement. Each row is [host, URL verdict, blocked as an IP, IP literal].
 * The host is passed to the helpers as written and is also the authority of
 * https://<host>/. A boundary shared by two ranges is listed once, under the
 * first range that names it. A changed verdict is a regression, not an update.
 *
 * Some verdicts are gaps that exist today and are recorded as found. The URL
 * check allows the IPv4-compatible forms (::/96), because ipaddr.js has no range
 * for them, while the raw helper refuses ::127.0.0.1 by reading it as
 * ::ffff:127.0.0.1. The URL check also allows the trailing-dot name localhost.
 */
type GoldenVerdict = [string, "allowed" | "refused", boolean, boolean];

const goldenVerdicts: GoldenVerdict[] = [
  // ipaddr.js IPv4 unspecified 0.0.0.0/8
  ["0.0.0.0", "refused", true, true],
  ["0.255.255.255", "refused", true, true],
  ["1.0.0.0", "allowed", false, true],
  // ipaddr.js IPv4 broadcast 255.255.255.255/32
  ["255.255.255.255", "refused", true, true],
  ["255.255.255.254", "refused", true, true],
  // ipaddr.js IPv4 multicast 224.0.0.0/4
  ["224.0.0.0", "refused", true, true],
  ["239.255.255.255", "refused", true, true],
  ["240.0.0.0", "refused", true, true],
  // ipaddr.js IPv4 linkLocal 169.254.0.0/16
  ["169.254.0.0", "refused", true, true],
  ["169.254.255.255", "refused", true, true],
  ["169.255.0.0", "allowed", false, true],
  // ipaddr.js IPv4 loopback 127.0.0.0/8
  ["127.0.0.0", "refused", true, true],
  ["127.255.255.255", "refused", true, true],
  ["128.0.0.0", "allowed", false, true],
  // ipaddr.js IPv4 carrierGradeNat 100.64.0.0/10
  ["100.64.0.0", "refused", true, true],
  ["100.127.255.255", "refused", true, true],
  ["100.128.0.0", "allowed", false, true],
  // ipaddr.js IPv4 private 10.0.0.0/8
  ["10.0.0.0", "refused", true, true],
  ["10.255.255.255", "refused", true, true],
  ["11.0.0.0", "allowed", false, true],
  // ipaddr.js IPv4 private 172.16.0.0/12
  ["172.16.0.0", "refused", true, true],
  ["172.31.255.255", "refused", true, true],
  ["172.32.0.0", "allowed", false, true],
  // ipaddr.js IPv4 private 192.168.0.0/16
  ["192.168.0.0", "refused", true, true],
  ["192.168.255.255", "refused", true, true],
  ["192.169.0.0", "allowed", false, true],
  // ipaddr.js IPv4 reserved 192.0.0.0/24
  ["192.0.0.0", "refused", true, true],
  ["192.0.0.255", "refused", true, true],
  ["192.0.1.0", "allowed", false, true],
  // ipaddr.js IPv4 reserved 192.0.2.0/24
  ["192.0.2.0", "refused", true, true],
  ["192.0.2.255", "refused", true, true],
  ["192.0.3.0", "allowed", false, true],
  // ipaddr.js IPv4 reserved 192.88.99.0/24
  ["192.88.99.0", "refused", true, true],
  ["192.88.99.255", "refused", true, true],
  ["192.88.100.0", "allowed", false, true],
  // ipaddr.js IPv4 reserved 198.18.0.0/15
  ["198.18.0.0", "refused", true, true],
  ["198.19.255.255", "refused", true, true],
  ["198.20.0.0", "allowed", false, true],
  // ipaddr.js IPv4 reserved 198.51.100.0/24
  ["198.51.100.0", "refused", true, true],
  ["198.51.100.255", "refused", true, true],
  ["198.51.101.0", "allowed", false, true],
  // ipaddr.js IPv4 reserved 203.0.113.0/24
  ["203.0.113.0", "refused", true, true],
  ["203.0.113.255", "refused", true, true],
  ["203.0.114.0", "allowed", false, true],
  // ipaddr.js IPv4 as112 192.175.48.0/24
  ["192.175.48.0", "refused", true, true],
  ["192.175.48.255", "refused", true, true],
  ["192.175.49.0", "allowed", false, true],
  // ipaddr.js IPv4 as112 192.31.196.0/24
  ["192.31.196.0", "refused", true, true],
  ["192.31.196.255", "refused", true, true],
  ["192.31.197.0", "allowed", false, true],
  // ipaddr.js IPv4 amt 192.52.193.0/24
  ["192.52.193.0", "refused", true, true],
  ["192.52.193.255", "refused", true, true],
  ["192.52.194.0", "allowed", false, true],
  // ipaddr.js IPv6 unspecified ::/128
  ["[::]", "refused", true, true],
  ["[::1]", "refused", true, true],
  // ipaddr.js IPv6 linkLocal fe80::/10
  ["[fe80::]", "refused", true, true],
  ["[febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[fec0::]", "refused", true, true],
  // ipaddr.js IPv6 multicast ff00::/8
  ["[ff00::]", "refused", true, true],
  ["[ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[feff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  // ipaddr.js IPv6 loopback ::1/128
  ["[::2]", "allowed", false, true],
  // ipaddr.js IPv6 uniqueLocal fc00::/7
  ["[fc00::]", "refused", true, true],
  ["[fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[fe00::]", "allowed", false, true],
  // ipaddr.js IPv6 ipv4Mapped ::ffff:0:0/96
  ["[::ffff:0:0]", "refused", true, true],
  ["[::ffff:ffff:ffff]", "refused", true, true],
  ["[::1:0:0:0]", "allowed", false, true],
  // ipaddr.js IPv6 discard 100::/64
  ["[100::]", "refused", true, true],
  ["[100::ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[100:0:0:1::]", "allowed", false, true],
  // ipaddr.js IPv6 rfc6145 ::ffff:0:0:0/96
  ["[::ffff:0:0:0]", "refused", true, true],
  ["[::ffff:0:ffff:ffff]", "refused", true, true],
  ["[::ffff:1:0:0]", "allowed", false, true],
  // ipaddr.js IPv6 rfc6052 64:ff9b::/96
  ["[64:ff9b::]", "refused", true, true],
  ["[64:ff9b::ffff:ffff]", "refused", true, true],
  ["[64:ff9b::1:0:0]", "allowed", false, true],
  // ipaddr.js IPv6 rfc6052 64:ff9b:1::/48
  ["[64:ff9b:1::]", "refused", true, true],
  ["[64:ff9b:1:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[64:ff9b:2::]", "allowed", false, true],
  // ipaddr.js IPv6 6to4 2002::/16
  ["[2002::]", "refused", true, true],
  ["[2002:ffff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[2003::]", "allowed", false, true],
  // ipaddr.js IPv6 teredo 2001::/32
  ["[2001::]", "refused", true, true],
  ["[2001:0:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[2001:1::]", "refused", true, true],
  // ipaddr.js IPv6 benchmarking 2001:2::/48
  ["[2001:2::]", "refused", true, true],
  ["[2001:2:0:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[2001:2:1::]", "refused", true, true],
  // ipaddr.js IPv6 amt 2001:3::/32
  ["[2001:3::]", "refused", true, true],
  ["[2001:3:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[2001:4::]", "refused", true, true],
  // ipaddr.js IPv6 as112v6 2001:4:112::/48
  ["[2001:4:112::]", "refused", true, true],
  ["[2001:4:112:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[2001:4:113::]", "refused", true, true],
  // ipaddr.js IPv6 as112v6 2620:4f:8000::/48
  ["[2620:4f:8000::]", "refused", true, true],
  ["[2620:4f:8000:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[2620:4f:8001::]", "allowed", false, true],
  // ipaddr.js IPv6 deprecatedOrchid 2001:10::/28
  ["[2001:10::]", "refused", true, true],
  ["[2001:1f:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[2001:20::]", "refused", true, true],
  // ipaddr.js IPv6 orchid2 2001:20::/28
  ["[2001:2f:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[2001:30::]", "refused", true, true],
  // ipaddr.js IPv6 droneRemoteIdProtocolEntityTags 2001:30::/28
  ["[2001:3f:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[2001:40::]", "refused", true, true],
  // ipaddr.js IPv6 segmentRouting 5f00::/16
  ["[5f00::]", "refused", true, true],
  ["[5f00:ffff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[5f01::]", "allowed", false, true],
  // ipaddr.js IPv6 reserved 2001::/23
  ["[2001:1ff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[2001:200::]", "allowed", false, true],
  // ipaddr.js IPv6 reserved 2001:db8::/32
  ["[2001:db8::]", "refused", true, true],
  ["[2001:db8:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[2001:db9::]", "allowed", false, true],
  // ipaddr.js IPv6 reserved 3fff::/20
  ["[3fff::]", "refused", true, true],
  ["[3fff:fff:ffff:ffff:ffff:ffff:ffff:ffff]", "refused", true, true],
  ["[3fff:1000::]", "allowed", false, true],
  // Ordinary public addresses.
  ["8.8.8.8", "allowed", false, true],
  ["93.184.216.34", "allowed", false, true],
  ["1.1.1.1", "allowed", false, true],
  ["[2606:4700:4700::1111]", "allowed", false, true],
  ["[2001:4860:4860::8888]", "allowed", false, true],
  ["2606:4700:4700::1111", "refused", false, true],
  // IPv4-mapped, IPv4-compatible, and translated IPv6 forms, bracketed.
  ["[::ffff:10.0.0.1]", "refused", true, true],
  ["[::ffff:127.0.0.1]", "refused", true, true],
  ["[::ffff:169.254.169.254]", "refused", true, true],
  ["[::ffff:192.168.1.1]", "refused", true, true],
  ["[::ffff:a00:1]", "refused", true, true],
  ["[::ffff:0a00:0001]", "refused", true, true],
  ["[0:0:0:0:0:ffff:7f00:1]", "refused", true, true],
  ["[::FFFF:127.0.0.1]", "refused", true, true],
  ["[::FFFF:7F00:1]", "refused", true, true],
  ["[::ffff:8.8.8.8]", "allowed", false, true],
  ["[::ffff:0:127.0.0.1]", "refused", true, true],
  ["[::127.0.0.1]", "allowed", true, true],
  ["[::8.8.8.8]", "allowed", false, true],
  ["[64:ff9b::7f00:1]", "refused", true, true],
  ["[2002:7f00:1::]", "refused", true, true],
  ["[2001:db8::1]", "refused", true, true],
  // The same IPv6 forms unbracketed, as the helpers receive them.
  ["::ffff:127.0.0.1", "refused", true, true],
  ["::ffff:8.8.8.8", "refused", false, true],
  ["::127.0.0.1", "refused", true, true],
  ["::8.8.8.8", "refused", false, true],
  ["::1", "refused", true, true],
  ["2001:db8::1", "refused", true, true],
  // Zone identifiers.
  ["fe80::1%eth0", "refused", true, true],
  ["2606:4700:4700::1111%eth0", "refused", false, true],
  ["[fe80::1%eth0]", "refused", true, true],
  // IPv4 decimal, octal, hexadecimal, and short forms, plus malformed ones.
  ["0", "refused", true, true],
  ["2130706433", "refused", true, true],
  ["134744072", "allowed", false, true],
  ["0177.0.0.1", "refused", true, true],
  ["127.000.000.001", "refused", true, true],
  ["127.0.0.01", "refused", true, true],
  ["010.0.0.8", "allowed", false, true],
  ["0x7f.0.0.1", "refused", true, true],
  ["0x7f.0x0.0x0.0x1", "refused", true, true],
  ["0x7f000001", "refused", true, true],
  ["017700000001", "refused", true, true],
  ["127.1", "refused", true, true],
  ["127.0.1", "refused", true, true],
  ["8.8", "allowed", false, true],
  ["0x0a.1", "refused", true, true],
  ["08.0.0.1", "refused", false, false],
  ["127.0.0.1.", "refused", false, false],
  ["127.0.0.1:80", "refused", false, false],
  ["256.0.0.1", "refused", false, false],
  ["1.2.3.4.5", "refused", false, false],
  ["0x100000000", "refused", false, false],
  [" 127.0.0.1 ", "refused", true, true],
  // Host names that are not addresses.
  ["example.com", "allowed", false, false],
  ["localhost", "refused", false, false],
  ["LOCALHOST", "refused", false, false],
  ["admin.localhost", "refused", false, false],
  ["localhost.", "allowed", false, false],
  ["127.0.0.1.nip.io", "allowed", false, false],
];

describe("golden verdicts recorded from ipaddr.js", () => {
  it.each(goldenVerdicts)(
    "keeps the recorded verdict for %s",
    (host, url, blocked, ip) => {
      expect(isPublicHttpUrlSyntax(`https://${host}/`)).toBe(url === "allowed");
      expect(isBlockedIpAddress(host)).toBe(blocked);
      expect(isIpAddress(host)).toBe(ip);
    }
  );
});
