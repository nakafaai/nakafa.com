import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { SearchInput } from "@/lib/nuqs/search";

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
