import { describe, expect, it } from "vitest";
import { mergeVaryHeader, negotiateMediaType } from "./accept";

const HTML = "text/html";
const MARKDOWN = "text/markdown";

describe("HTTP Accept negotiation", () => {
  it.each([
    [null, HTML],
    ["*/*", HTML],
    ["text/*", HTML],
    ["text/markdown", MARKDOWN],
    ["text/html;q=0.5, text/markdown;q=0.9", MARKDOWN],
    ["text/html;q=0.9, text/markdown;q=0.5", HTML],
    ["text/html;q=0.8, text/markdown;q=0.8", HTML],
    ["text/*;q=0.8, text/markdown;q=0.8", HTML],
    [" text/markdown ; q=0.7 , text/html ; q=0.6 ", MARKDOWN],
    ["text/html;level=1;q=0.8, text/markdown;q=0.7", MARKDOWN],
    ["text/html;q=0.4, text/html;q=0.8", HTML],
    ["text/html;q=0.8, text/html;q=0.8", HTML],
    ["TEXT/MARKDOWN", MARKDOWN],
  ])("selects %s as %s", (accept, expected) => {
    expect(negotiateMediaType(accept, [HTML, MARKDOWN])).toBe(expected);
  });

  it.each([
    "text/html;q=0, text/markdown;q=0",
    "",
    "application/json",
    "broken",
    ",",
    "*/html",
    "text/html;q=0.8;q=0.7",
    "text/html;q=broken, text/markdown;q=nope",
  ])("rejects unsupported or unacceptable ranges in %s", (accept) => {
    expect(negotiateMediaType(accept, [HTML, MARKDOWN])).toBeNull();
  });

  it("lets a specific exclusion override a permissive wildcard", () => {
    expect(
      negotiateMediaType("text/markdown;q=0, */*;q=1", [MARKDOWN])
    ).toBeNull();
  });

  it("uses specificity to resolve each representation before a server tie", () => {
    expect(
      negotiateMediaType("text/*;q=0.4, text/html;q=0, */*;q=0.9", [
        HTML,
        MARKDOWN,
      ])
    ).toBe(MARKDOWN);
  });

  it("matches media parameters and quoted delimiters only when offered", () => {
    const parameterizedHtml = String.raw`text/html;profile="wide\,screen"`;

    expect(
      negotiateMediaType(`${parameterizedHtml};q=0.9, text/markdown;q=0.7`, [
        parameterizedHtml,
        MARKDOWN,
      ])
    ).toBe(parameterizedHtml);
    expect(
      negotiateMediaType("text/html;q=0.9;level=1, text/markdown;q=0.7", [
        HTML,
        MARKDOWN,
      ])
    ).toBe(MARKDOWN);
  });

  it("preserves media parameter value casing for exact matching", () => {
    expect(
      negotiateMediaType("text/html;profile=Wide, text/markdown;q=0.8", [
        "text/html;profile=wide",
        MARKDOWN,
      ])
    ).toBe(MARKDOWN);
  });

  it.each([
    "text/html;level, text/markdown;q=0.5",
    "text/html;bad name=wide, text/markdown;q=0.5",
    "text/html;profile=?, text/markdown;q=0.5",
    "text/html;profile=wide;profile=screen, text/markdown;q=0.5",
    'text/html;profile="a""b", text/markdown;q=0.5',
    'text/html;profile="wide\rline", text/markdown;q=0.5',
    'text/html;profile="wide\nline", text/markdown;q=0.5',
  ])("ignores a malformed range in %s", (accept) => {
    expect(negotiateMediaType(accept, [HTML, MARKDOWN])).toBe(MARKDOWN);
  });

  it("rejects an unterminated quoted list", () => {
    expect(
      negotiateMediaType('text/html;profile="unterminated', [HTML, MARKDOWN])
    ).toBeNull();
  });

  it("rejects malformed supported representations", () => {
    expect(
      negotiateMediaType("*/*", [
        "text",
        "text/",
        "*/html",
        "text/html;q=0.5",
        'text/html;profile="unterminated',
      ])
    ).toBeNull();
  });
});

describe("Vary merging", () => {
  it("preserves router fields and adds missing negotiation fields once", () => {
    expect(
      mergeVaryHeader("rsc, Next-Router-Prefetch, accept", [
        "Accept",
        "Accept-Encoding",
      ])
    ).toBe("rsc, Next-Router-Prefetch, accept, Accept-Encoding");
  });

  it("creates a Vary header when no prior fields exist", () => {
    expect(mergeVaryHeader(null, ["Accept", "Accept-Encoding"])).toBe(
      "Accept, Accept-Encoding"
    );
    expect(mergeVaryHeader("", ["Accept", "Accept-Encoding"])).toBe(
      "Accept, Accept-Encoding"
    );
  });

  it("preserves the wildcard Vary contract", () => {
    expect(mergeVaryHeader("*", ["Accept", "Accept-Encoding"])).toBe("*");
  });
});
