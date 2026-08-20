import { validateSearchQuery } from "@repo/backend/convex/contentRelease/search/input";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

/** Runs one search validator and exposes its typed failure for assertions. */
function result(source: string, characterLimit?: number) {
  if (characterLimit === undefined) {
    return Effect.result(validateSearchQuery(source));
  }
  return Effect.result(validateSearchQuery(source, { characterLimit }));
}
describe("contentRelease/search/input", () => {
  it.live("normalizes whitespace while retaining Arabic combining marks", () =>
    Effect.gen(function* () {
      expect(yield* validateSearchQuery("  بِسْمِ   اللَّهِ الرَّحْمَنِ الرَّحِيمِ ")).toBe(
        "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ"
      );
      expect(
        yield* validateSearchQuery(
          Array.from({ length: 16 }, () => "term").join("-")
        )
      ).toBe(Array.from({ length: 16 }, () => "term").join("-"));
      expect(yield* validateSearchQuery("x".repeat(31))).toBe("x".repeat(31));
      expect(yield* validateSearchQuery("bounded", { characterLimit: 7 })).toBe(
        "bounded"
      );
    })
  );
  it.live("rejects empty, excessive, oversized, and overlong queries", () =>
    Effect.gen(function* () {
      const seventeenTerms = Array.from(
        { length: 17 },
        (_, index) => `term${index}`
      ).join("-");
      const oversizedVocalizedTerm = `ا${"ّ".repeat(16)}`;
      const hiddenSeventeenTerms = Array.from({ length: 17 }, () => "x").join(
        "\u200d"
      );
      expect(yield* result(" ")).toMatchObject({
        _tag: "Failure",
        failure: { code: "CONTENT_RELEASE_LIMIT" },
      });
      expect(yield* result(seventeenTerms)).toMatchObject({
        _tag: "Failure",
        failure: { code: "CONTENT_RELEASE_LIMIT" },
      });
      expect(yield* result(hiddenSeventeenTerms)).toMatchObject({
        _tag: "Failure",
        failure: { code: "CONTENT_RELEASE_LIMIT" },
      });
      expect(yield* result(oversizedVocalizedTerm)).toMatchObject({
        _tag: "Failure",
        failure: { code: "CONTENT_RELEASE_LIMIT" },
      });
      expect(yield* result("bounded", 6)).toMatchObject({
        _tag: "Failure",
        failure: { code: "CONTENT_RELEASE_LIMIT" },
      });
      expect(yield* result("x".repeat(32))).toMatchObject({
        _tag: "Failure",
        failure: { code: "CONTENT_RELEASE_LIMIT" },
      });
    })
  );
});
