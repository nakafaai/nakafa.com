// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { defaultParseSearch } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import { QueryText } from "@/lib/routing/search";

describe("QueryText", () => {
  it("keeps a text value", () => {
    expect(Schema.decodeSync(QueryText)("algebra")).toBe("algebra");
  });

  it("writes a text back as the same text", () => {
    expect(Schema.encodeSync(QueryText)("1.50")).toBe("1.50");
  });

  it("reads each canonical scalar that TanStack parses from JSON as its text", () => {
    expect(Schema.decodeSync(QueryText)(2024)).toBe("2024");
    expect(Schema.decodeSync(QueryText)(-3.5)).toBe("-3.5");
    expect(Schema.decodeSync(QueryText)(false)).toBe("false");
    expect(Schema.decodeSync(QueryText)(null)).toBe("null");
  });

  it("reads a non-canonical numeral as its canonical text, so the address 1.50 reads as 1.5", () => {
    const Search = Schema.Struct({ q: QueryText });
    expect(
      Schema.decodeUnknownSync(Search)(defaultParseSearch("?q=1.50"))
    ).toEqual({ q: "1.5" });
  });

  it("fails a value of another shape, which the reader decides", () => {
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(QueryText)(["algebra", "physics"])
      )
    ).toBe(true);
    expect(
      Option.isNone(Schema.decodeUnknownOption(QueryText)({ q: "a" }))
    ).toBe(true);
  });
});
