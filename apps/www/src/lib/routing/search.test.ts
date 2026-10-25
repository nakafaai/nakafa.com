// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Option, Schema } from "effect";
import { QueryText } from "@/lib/routing/search";

describe("QueryText", () => {
  it("keeps a text value", () => {
    expect(Schema.decodeSync(QueryText)("algebra")).toBe("algebra");
  });

  it("reads each scalar that TanStack parses from JSON as the text the URL carries", () => {
    expect(Schema.decodeSync(QueryText)(2024)).toBe("2024");
    expect(Schema.decodeSync(QueryText)(-3.5)).toBe("-3.5");
    expect(Schema.decodeSync(QueryText)(false)).toBe("false");
    expect(Schema.decodeSync(QueryText)(null)).toBe("null");
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
