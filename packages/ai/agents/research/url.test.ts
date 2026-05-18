import {
  isBlockedIpAddress,
  isIpAddress,
  isPublicHttpUrlSyntax,
  normalizeHostname,
} from "@repo/ai/agents/research/url";
import { describe, expect, it } from "vitest";

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
