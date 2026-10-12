import { describe, expect, it } from "@effect/vitest";
import {
  extractDomain,
  extractHostname,
} from "@repo/backend/confect/nina/research/domain";
import { Option } from "effect";

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
      "a hostname written in its own script",
      "https://bücher.de/",
      "xn--bcher-kva.de",
    ],
  ])("reads the hostname of %s", (_name, address, hostname) => {
    expect(extractHostname(address)).toEqual(Option.some(hostname));
  });

  it.each([
    ["an empty text", ""],
    ["a path", "/news"],
    ["words", "two words"],
    ["a scheme with nothing after it", "https://"],
    ["an address that has no host", "file:///etc/passwd"],
  ])("gives none for %s", (_name, address) => {
    expect(extractHostname(address)).toEqual(Option.none());
  });
});
