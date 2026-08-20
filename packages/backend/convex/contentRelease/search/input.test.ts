import { validateSearchQuery } from "@repo/backend/convex/contentRelease/search/input";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/** Runs one search validator and exposes its typed failure for assertions. */
function result(source: string, characterLimit?: number) {
  if (characterLimit === undefined) {
    return Effect.runPromise(Effect.result(validateSearchQuery(source)));
  }
  return Effect.runPromise(
    Effect.result(validateSearchQuery(source, { characterLimit }))
  );
}
describe("contentRelease/search/input", () => {
  it("normalizes whitespace while retaining Arabic combining marks", async () => {
    await expect(
      Effect.runPromise(validateSearchQuery("  بِسْمِ   اللَّهِ الرَّحْمَنِ الرَّحِيمِ "))
    ).resolves.toBe("بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ");
    await expect(
      Effect.runPromise(
        validateSearchQuery(Array.from({ length: 16 }, () => "term").join("-"))
      )
    ).resolves.toBe(Array.from({ length: 16 }, () => "term").join("-"));
    await expect(
      Effect.runPromise(validateSearchQuery("x".repeat(31)))
    ).resolves.toBe("x".repeat(31));
    await expect(
      Effect.runPromise(validateSearchQuery("bounded", { characterLimit: 7 }))
    ).resolves.toBe("bounded");
  });
  it("rejects empty, excessive, oversized, and overlong queries", async () => {
    const seventeenTerms = Array.from(
      { length: 17 },
      (_, index) => `term${index}`
    ).join("-");
    const oversizedVocalizedTerm = `ا${"ّ".repeat(16)}`;
    const hiddenSeventeenTerms = Array.from({ length: 17 }, () => "x").join(
      "\u200d"
    );
    await expect(result(" ")).resolves.toMatchObject({
      _tag: "Failure",
      failure: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(result(seventeenTerms)).resolves.toMatchObject({
      _tag: "Failure",
      failure: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(result(hiddenSeventeenTerms)).resolves.toMatchObject({
      _tag: "Failure",
      failure: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(result(oversizedVocalizedTerm)).resolves.toMatchObject({
      _tag: "Failure",
      failure: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(result("bounded", 6)).resolves.toMatchObject({
      _tag: "Failure",
      failure: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(result("x".repeat(32))).resolves.toMatchObject({
      _tag: "Failure",
      failure: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
