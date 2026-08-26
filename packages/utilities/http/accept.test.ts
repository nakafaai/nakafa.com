import {
  HttpMediaTypeSchema,
  mergeVaryHeader,
  negotiateMediaType,
} from "@repo/utilities/http/accept";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

const HTML = HttpMediaTypeSchema.make("text/html; charset=utf-8");
const MARKDOWN = HttpMediaTypeSchema.make("text/markdown; charset=utf-8");
const REPRESENTATIONS = [HTML, MARKDOWN] as const;

describe("HTTP Accept negotiation", () => {
  it.each([
    [Option.none(), HTML],
    [Option.some("*/*"), HTML],
    [Option.some("text/*"), HTML],
    [Option.some("text/markdown"), MARKDOWN],
    [Option.some("text/html;q=0.5, text/markdown;q=0.9"), MARKDOWN],
    [Option.some("text/html;q=0.9, text/markdown;q=0.5"), HTML],
    [Option.some("text/html;q=0.8, text/markdown;q=0.8"), HTML],
    [Option.some("text/*;q=0.8, text/markdown;q=0.8"), HTML],
    [Option.some(" text/markdown ; q=0.7 , text/html ; q=0.6 "), MARKDOWN],
    [Option.some("text/html;q=0.4, text/html;q=0.8"), HTML],
    [Option.some("TEXT/MARKDOWN"), MARKDOWN],
    [Option.some(", text/markdown, ,"), MARKDOWN],
  ])("selects %o as %s", (accept, expected) => {
    expect(negotiateMediaType(accept, REPRESENTATIONS)).toEqual(
      Option.some(expected)
    );
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
    "text/html;q =0.8, text/markdown;q =0.7",
    "text/html;q=.8, text/markdown;q=.7",
    "text/html;q=0.1234, text/markdown;q=1.001",
  ])("returns None for unsupported or unacceptable ranges in %s", (accept) => {
    expect(negotiateMediaType(Option.some(accept), REPRESENTATIONS)).toEqual(
      Option.none()
    );
  });

  it("lets a specific exclusion override a permissive wildcard", () => {
    expect(
      negotiateMediaType(Option.some("text/markdown;q=0, */*;q=1"), [MARKDOWN])
    ).toEqual(Option.none());
  });

  it("uses specificity to resolve each representation before a server tie", () => {
    expect(
      negotiateMediaType(
        Option.some("text/*;q=0.4, text/html;q=0, */*;q=0.9"),
        REPRESENTATIONS
      )
    ).toEqual(Option.some(MARKDOWN));
  });

  it("gives a parameterized range precedence over its unparameterized peer", () => {
    const levelHtml = HttpMediaTypeSchema.make("text/html;level=1");

    expect(
      negotiateMediaType(
        Option.some("text/html;q=0.2, text/html;level=1;q=0.9"),
        [levelHtml]
      )
    ).toEqual(Option.some(levelHtml));
    expect(
      negotiateMediaType(
        Option.some("text/html;level=1;q=0.2, text/html;q=0.9"),
        [levelHtml]
      )
    ).toEqual(Option.some(levelHtml));
  });

  it("matches media parameters and quoted delimiters only when offered", () => {
    const profileHtml = HttpMediaTypeSchema.make(
      'text/html;profile="wide,screen"'
    );

    expect(
      negotiateMediaType(
        Option.some(`${profileHtml};q=0.9, text/markdown;q=0.7`),
        [profileHtml, MARKDOWN]
      )
    ).toEqual(Option.some(profileHtml));
    expect(
      negotiateMediaType(
        Option.some("text/html;q=0.9;level=1, text/markdown;q=0.7"),
        REPRESENTATIONS
      )
    ).toEqual(Option.some(MARKDOWN));
  });

  it("preserves case-sensitive media parameters for exact matching", () => {
    const profileHtml = HttpMediaTypeSchema.make("text/html;profile=wide");

    expect(
      negotiateMediaType(
        Option.some("text/html;profile=Wide, text/markdown;q=0.8"),
        [profileHtml, MARKDOWN]
      )
    ).toEqual(Option.some(MARKDOWN));
  });

  it("matches parameter names and token quoting according to RFC 9110", () => {
    const profileHtml = HttpMediaTypeSchema.make("text/html;profile=wide");

    expect(
      negotiateMediaType(Option.some('text/html;PROFILE="wide"'), [profileHtml])
    ).toEqual(Option.some(profileHtml));
  });

  it.each(["UTF-8", '"UTF-8"'])(
    "matches case-insensitive charset parameter value %s",
    (charset) => {
      expect(
        negotiateMediaType(Option.some(`text/html; charset=${charset}`), [HTML])
      ).toEqual(Option.some(HTML));
    }
  );

  it("accepts case-insensitive quality names and HTTP optional whitespace", () => {
    expect(
      negotiateMediaType(
        Option.some("text/html;\tQ=0.2,\ttext/markdown;Q=0.8"),
        REPRESENTATIONS
      )
    ).toEqual(Option.some(MARKDOWN));
  });

  it("processes q as the weight regardless of parameter ordering", () => {
    expect(
      negotiateMediaType(
        Option.some("text/html;q=1;charset=utf-8, text/markdown;q=0.5"),
        REPRESENTATIONS
      )
    ).toEqual(Option.some(HTML));
  });

  it.each([
    "text/html;level, text/markdown;q=0.5",
    "text/html;bad name=wide, text/markdown;q=0.5",
    "text/html;profile=?, text/markdown;q=0.5",
    "text/html;profile=wide;profile=screen, text/markdown;q=0.5",
    'text/html;profile="a""b", text/markdown;q=0.5',
    'text/html;profile="wide\rline", text/markdown;q=0.5',
    'text/html;profile="wide\nline", text/markdown;q=0.5',
    'text/html;profile="wide\0line", text/markdown;q=0.5',
    'text/html;profile="wide\\\nline", text/markdown;q=0.5',
  ])("ignores a malformed range in %s", (accept) => {
    expect(negotiateMediaType(Option.some(accept), REPRESENTATIONS)).toEqual(
      Option.some(MARKDOWN)
    );
  });

  it("returns None for an unterminated quoted list", () => {
    expect(
      negotiateMediaType(
        Option.some('text/html;profile="unterminated'),
        REPRESENTATIONS
      )
    ).toEqual(Option.none());
  });

  it.each([
    "text",
    "text/",
    "*/html",
    "text/*",
    "*/*",
    "text/html;q=0.5",
    "text/html;level",
    "text/html;level =1",
    "text/html;level= 1",
    'text/html;profile="unterminated',
    'text/html;profile="wide\\"',
    `text/html;profile="wide${String.fromCharCode(256)}"`,
  ])("rejects malformed offered representation %s", (mediaType) => {
    expect(HttpMediaTypeSchema.makeOption(mediaType)).toEqual(Option.none());
  });

  it("accepts empty parameter slots and quoted pairs defined by RFC 9110", () => {
    const mediaType = HttpMediaTypeSchema.make(
      String.raw`text/html; ; profile="wide\"screen";`
    );

    expect(
      negotiateMediaType(
        Option.some(String.raw`text/html;profile="wide\"screen"`),
        [mediaType]
      )
    ).toEqual(Option.some(mediaType));
  });

  it("accepts obs-text in quoted strings and quoted pairs", () => {
    const obsText = String.fromCharCode(200);
    const direct = HttpMediaTypeSchema.make(
      `text/html;profile="wide${obsText}screen"`
    );
    const escaped = HttpMediaTypeSchema.make(
      `text/html;profile="wide\\${obsText}screen"`
    );

    expect(negotiateMediaType(Option.some(direct), [direct])).toEqual(
      Option.some(direct)
    );
    expect(negotiateMediaType(Option.some(escaped), [escaped])).toEqual(
      Option.some(escaped)
    );
  });

  it("rejects a quoted pair outside the RFC field-value byte range", () => {
    const invalid = `text/html;profile="wide\\${String.fromCharCode(256)}screen"`;

    expect(HttpMediaTypeSchema.makeOption(invalid)).toEqual(Option.none());
  });

  it("fails closed if schema constructor checks are deliberately bypassed", () => {
    const invalid = HttpMediaTypeSchema.make("text", {
      disableChecks: true,
    });

    expect(negotiateMediaType(Option.none(), [invalid])).toEqual(Option.none());
  });
});

describe("Vary merging", () => {
  it("preserves router fields and adds missing negotiation fields once", () => {
    expect(
      mergeVaryHeader(Option.some("rsc, Next-Router-Prefetch, accept, RSC"), [
        "Accept",
        "Accept-Encoding",
      ])
    ).toBe("rsc, Next-Router-Prefetch, accept, Accept-Encoding");
  });

  it("normalizes only HTTP optional whitespace and repeated required names", () => {
    expect(
      mergeVaryHeader(Option.some("\tRSC\t, Accept-Encoding"), [
        "Accept",
        "accept",
        "ACCEPT-ENCODING",
      ])
    ).toBe("RSC, Accept-Encoding, Accept");
  });

  it("creates a Vary header when no prior fields exist", () => {
    expect(mergeVaryHeader(Option.none(), ["Accept", "Accept-Encoding"])).toBe(
      "Accept, Accept-Encoding"
    );
    expect(
      mergeVaryHeader(Option.some(""), ["Accept", "Accept-Encoding"])
    ).toBe("Accept, Accept-Encoding");
  });

  it("preserves the wildcard Vary contract", () => {
    expect(
      mergeVaryHeader(Option.some("RSC, *"), ["Accept", "Accept-Encoding"])
    ).toBe("*");
  });
});
