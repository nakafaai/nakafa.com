import { describe, expect, it } from "@effect/vitest";
import {
  isPublicHttpUrlSyntax,
  judgeAddress,
  normalizeHostname,
} from "@repo/backend/confect/nina/research/url";
import {
  ADDRESS_VERDICTS,
  type GoldenAddress,
} from "@repo/backend/test/research/addresses";
import { Option } from "effect";

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

  it("judges IP literals and leaves host names unjudged", () => {
    expect(judgeLabel("93.184.216.34")).toBe("public");
    expect(judgeLabel("2001:4860:4860::8888")).toBe("public");
    expect(judgeLabel("example.com")).toBe("none");
  });

  it("refuses non-public IPv4 ranges", () => {
    expect(judgeLabel("0.0.0.0")).toBe("refused");
    expect(judgeLabel("10.0.0.1")).toBe("refused");
    expect(judgeLabel("127.0.0.1")).toBe("refused");
    expect(judgeLabel("100.64.0.1")).toBe("refused");
    expect(judgeLabel("169.254.0.1")).toBe("refused");
    expect(judgeLabel("172.16.0.1")).toBe("refused");
    expect(judgeLabel("192.0.0.1")).toBe("refused");
    expect(judgeLabel("192.88.99.1")).toBe("refused");
    expect(judgeLabel("192.168.0.1")).toBe("refused");
    expect(judgeLabel("198.18.0.1")).toBe("refused");
    expect(judgeLabel("198.51.100.1")).toBe("refused");
    expect(judgeLabel("203.0.113.1")).toBe("refused");
    expect(judgeLabel("224.0.0.1")).toBe("refused");
    expect(judgeLabel("999.0.0.1")).toBe("none");
    expect(judgeLabel("93.184.216.34")).toBe("public");
  });

  it("refuses non-public IPv6 ranges and mapped private IPv4 ranges", () => {
    expect(judgeLabel("::")).toBe("refused");
    expect(judgeLabel("::1")).toBe("refused");
    expect(judgeLabel("fc00::1")).toBe("refused");
    expect(judgeLabel("fd00::1")).toBe("refused");
    expect(judgeLabel("fe80::1")).toBe("refused");
    expect(judgeLabel("ff00::1")).toBe("refused");
    expect(judgeLabel("2001:db8::1")).toBe("refused");
    expect(judgeLabel("::ffff:127.0.0.1")).toBe("refused");
    expect(judgeLabel("::ffff:7f00:1")).toBe("refused");
    expect(judgeLabel("::ffff:zzzz:1")).toBe("none");
    expect(judgeLabel("::ffff:1")).toBe("refused");
    expect(judgeLabel("::ffff:10000:1")).toBe("none");
    expect(judgeLabel("::ffff:-1:1")).toBe("none");
    expect(judgeLabel("2001:4860:4860::8888")).toBe("public");
  });

  it("refuses the deprecated IPv4-compatible block ::/96", () => {
    expect(isPublicHttpUrlSyntax("https://[::8.8.8.8]/")).toBe(false);
    expect(judgeLabel("::127.0.0.1")).toBe("refused");
    expect(judgeLabel("::8.8.8.8")).toBe("refused");
    expect(judgeLabel("::ffff:8.8.8.8")).toBe("public");
  });

  it("refuses every IPv6 address outside the global unicast space", () => {
    expect(judgeLabel("1fff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")).toBe(
      "refused"
    );
    expect(judgeLabel("2000::")).toBe("public");
    expect(judgeLabel("3fff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")).toBe(
      "public"
    );
    expect(judgeLabel("4000::")).toBe("refused");
    expect(judgeLabel("64:ff9b::808:808")).toBe("refused");
    expect(judgeLabel("::5efe:7f00:1")).toBe("refused");
    expect(judgeLabel("::200:5efe:10.0.0.1")).toBe("refused");
    expect(isPublicHttpUrlSyntax("https://[::5efe:a9fe:a9fe]/")).toBe(false);
  });

  it("gives text the address parser does not accept no verdict", () => {
    expect(judgeLabel("")).toBe("none");
    expect(judgeLabel("not-an-address")).toBe("none");
    expect(judgeLabel("fe80::1%eth0")).toBe("none");
    expect(judgeLabel("2606:4700:4700::1111%eth0")).toBe("none");
  });
});

describe("golden address verdicts", () => {
  it.each(ADDRESS_VERDICTS)(
    "keeps the recorded verdict for %s",
    (host, url, address) => {
      expect(isPublicHttpUrlSyntax(`https://${host}/`)).toBe(url === "allowed");
      expect(judgeLabel(host)).toBe(address);
    }
  );
});

/** The golden address column for text: "none" when the address parser rejects it. */
function judgeLabel(text: string): GoldenAddress {
  return Option.match(judgeAddress(text), {
    onNone: () => "none",
    onSome: (verdict) => verdict,
  });
}
