import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { readSearchQuery, SearchInput } from "@/lib/search/input";

describe("SearchInput", () => {
  it.effect("reads the query of the URL", () =>
    Effect.gen(function* () {
      const search = yield* Schema.decodeEffect(SearchInput)({
        q: "algebra",
      });
      expect(search).toEqual({ q: "algebra" });
    })
  );

  it.effect("searches for nothing when the URL carries no query", () =>
    Effect.gen(function* () {
      const search = yield* Schema.decodeEffect(SearchInput)({});
      expect(search).toEqual({ q: "" });
    })
  );

  it.effect("searches for nothing when the query is not one text", () =>
    Effect.gen(function* () {
      const search = yield* Schema.decodeUnknownEffect(SearchInput)({
        q: ["algebra", "physics"],
      });
      expect(search).toEqual({ q: "" });
    })
  );
});

describe("readSearchQuery", () => {
  it("reads a number that TanStack parsed as the text the URL carries", () => {
    expect(readSearchQuery({ q: 2024 })).toBe("2024");
    expect(readSearchQuery({ q: true })).toBe("true");
  });

  it("reads an absent or unsupported query as no search", () => {
    expect(readSearchQuery({})).toBe("");
    expect(readSearchQuery({ q: { text: "algebra" } })).toBe("");
  });
});
