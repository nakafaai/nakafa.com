import {
  validateQuranReference,
  validateQuranSearch,
  validateQuranSurah,
} from "@repo/backend/convex/contentRelease/quran/input";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/** Runs one input validator and exposes its typed failure for assertions. */
function result<A, E>(program: Effect.Effect<A, E>) {
  return Effect.runPromise(Effect.either(program));
}

describe("contentRelease/quran/input", () => {
  it("accepts canonical surahs and rejects invalid numeric identities", async () => {
    await expect(Effect.runPromise(validateQuranSurah(114))).resolves.toBe(114);
    await expect(result(validateQuranSurah(0))).resolves.toMatchObject({
      _tag: "Left",
      left: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
    });
    await expect(result(validateQuranSurah(1.5))).resolves.toMatchObject({
      _tag: "Left",
      left: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
    });
  });

  it("normalizes bounded references and rejects unsafe ranges", async () => {
    await expect(
      Effect.runPromise(
        validateQuranReference({ fromVerse: 2, surahNumber: 1 })
      )
    ).resolves.toEqual({ fromVerse: 2, surahNumber: 1, toVerse: 2 });
    await expect(
      result(
        validateQuranReference({ fromVerse: 2, surahNumber: 1, toVerse: 1 })
      )
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
    });
    await expect(
      result(
        validateQuranReference({ fromVerse: 1, surahNumber: 1, toVerse: 51 })
      )
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });

  it("normalizes search whitespace and rejects empty or oversized queries", async () => {
    const sixteenTerms = Array.from({ length: 16 }, () => "a").join("-");
    const seventeenTerms = `${sixteenTerms}-a`;

    await expect(
      Effect.runPromise(validateQuranSearch("  technical   search "))
    ).resolves.toBe("technical search");
    await expect(
      Effect.runPromise(validateQuranSearch(sixteenTerms))
    ).resolves.toBe(sixteenTerms);
    await expect(
      Effect.runPromise(validateQuranSearch("é".repeat(16)))
    ).resolves.toBe("é".repeat(16));
    await expect(result(validateQuranSearch(" "))).resolves.toMatchObject({
      _tag: "Left",
      left: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
    });
    await expect(
      result(validateQuranSearch("word ".repeat(17)))
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
    });
    await expect(
      result(validateQuranSearch(seventeenTerms))
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
    });
    await expect(
      result(validateQuranSearch("é".repeat(17)))
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
    });
    await expect(
      result(validateQuranSearch("a".repeat(257)))
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
    });
  });
});
