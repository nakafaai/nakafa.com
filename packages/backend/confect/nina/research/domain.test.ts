import { describe, expect, it } from "@effect/vitest";
import {
  extractDomain,
  extractHostname,
  HostnameSchema,
  isRegistrableHostname,
} from "@repo/backend/confect/nina/research/domain";
import { Option, Result, Schema } from "effect";

describe("extractDomain", () => {
  it("extracts the registrable domain label from full and partial URLs", () => {
    expect(extractDomain("https://www.react.dev/reference/react")).toBe(
      "react"
    );
    expect(extractDomain("nextjs.org/docs")).toBe("nextjs");
  });

  it("returns an empty label for invalid or public-suffix-only values", () => {
    expect(extractDomain("not a url")).toBe("");
    expect(extractDomain("gov.uk")).toBe("");
  });
});

describe("isRegistrableHostname", () => {
  it.each([
    "bbc.com",
    "www.bbc.com",
    "snpmb.bppp.kemdikbud.go.id",
    "xn--bcher-kva.de",
    "user.github.io",
  ])("accepts %s, a site someone registered", (hostname) => {
    expect(isRegistrableHostname(hostname)).toBe(true);
  });

  it.each([
    ["a public suffix alone", "go.id"],
    ["a private suffix alone", "github.io"],
    ["a single word", "kemdikbud"],
    ["localhost", "localhost"],
    ["an IPv4 address", "93.184.216.34"],
    ["an IPv6 address", "[2001:4860:4860::8888]"],
    ["a label with an underscore", "a_b.com"],
  ])("refuses %s", (_name, hostname) => {
    expect(isRegistrableHostname(hostname)).toBe(false);
  });
});

describe("extractHostname", () => {
  it.each([
    ["a hostname", "snpmb.bppp.kemdikbud.go.id", "snpmb.bppp.kemdikbud.go.id"],
    ["a hostname in capitals", "BBC.com", "bbc.com"],
    [
      "a host with a path and no scheme",
      "kemdikbud.go.id/berita",
      "kemdikbud.go.id",
    ],
    [
      "an address with a scheme, a path, a query and a fragment",
      "https://www.bbc.com/news/world?page=2#top",
      "www.bbc.com",
    ],
    ["an address with a port", "https://bbc.com:8080/news", "bbc.com"],
    ["a host with a port and no scheme", "bbc.com:8080", "bbc.com"],
    [
      "an address with a login, which is never kept",
      "https://reader:secret@bbc.com/news",
      "bbc.com",
    ],
    ["a hostname with a root dot", "bbc.com.", "bbc.com"],
    [
      "a hostname written in its own script",
      "https://bücher.de/",
      "xn--bcher-kva.de",
    ],
    [
      "a public suffix alone, which a search can be limited to",
      "go.id",
      "go.id",
    ],
    ["a private suffix alone", "github.io", "github.io"],
  ])("reads the hostname of %s", (_name, address, hostname) => {
    expect(extractHostname(address)).toEqual(Option.some(hostname));
  });

  it.each([
    ["an empty text", ""],
    ["a path", "/news"],
    ["words", "two words"],
    ["a scheme with nothing after it", "https://"],
    ["an address that has no host", "file:///etc/passwd"],
    // The platform URL parser accepts each of these as a host. The public
    // suffix list reader does not, and the provider takes hostnames only.
    ["two hostnames in one text", "bbc.com,cnn.com"],
    ["a hostname and a semicolon", "bbc.com;x"],
    ["a label with an underscore", "a_b.com"],
    ["a wildcard", "*.bbc.com"],
    ["a leading dot", ".go.id"],
    ["an empty label", "bbc..com"],
    ["a label that starts with a hyphen", "-bbc.com"],
    ["a single word", "kemdikbud"],
    ["a name whose last label is no listed suffix", "bbc.con"],
    ["localhost", "localhost"],
    ["a reserved name", "bbc.test"],
    ["an IPv4 address", "93.184.216.34"],
    ["an IPv6 address", "[2001:4860:4860::8888]"],
  ])("gives none for %s", (_name, address) => {
    expect(extractHostname(address)).toEqual(Option.none());
  });
});

describe("HostnameSchema", () => {
  const decode = Schema.decodeResult(HostnameSchema);

  it("keeps a hostname, reduces an address to its hostname, and ignores the space around it", () => {
    expect(Result.getOrThrow(decode("snpmb.bppp.kemdikbud.go.id"))).toBe(
      "snpmb.bppp.kemdikbud.go.id"
    );
    expect(
      Result.getOrThrow(decode("  https://www.BBC.com/news?page=2\n"))
    ).toBe("www.bbc.com");
  });

  it.each([
    "",
    "   ",
    "/news",
    "https://",
    "two words",
    "BBC Indonesia",
    "bbc.com,cnn.com",
    "kemdikbud",
    "localhost",
  ])("refuses %j with its own message", (text) => {
    const message = Result.match(decode(text), {
      onFailure: (error) => error.message,
      onSuccess: () => "decoded",
    });
    expect(message).toContain("Expected a hostname, such as bbc.com.");
  });

  it("encodes a hostname as it is", () => {
    expect(Schema.encodeSync(HostnameSchema)("bbc.com")).toBe("bbc.com");
  });
});
