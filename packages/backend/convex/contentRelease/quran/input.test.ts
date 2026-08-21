import {
  validateQuranReference,
  validateQuranSurah,
} from "@repo/backend/convex/contentRelease/quran/input";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

/** Runs one input validator and exposes its typed failure for assertions. */
function result<A, E>(program: Effect.Effect<A, E>) {
  return Effect.result(program);
}
describe("contentRelease/quran/input", () => {
  it.live(
    "accepts canonical surahs and rejects invalid numeric identities",
    () =>
      Effect.gen(function* () {
        expect(yield* validateQuranSurah(114)).toBe(114);
        expect(yield* result(validateQuranSurah(0))).toMatchObject({
          _tag: "Failure",
          failure: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
        });
        expect(yield* result(validateQuranSurah(1.5))).toMatchObject({
          _tag: "Failure",
          failure: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
        });
      })
  );
  it.live("normalizes bounded references and rejects unsafe ranges", () =>
    Effect.gen(function* () {
      expect(
        yield* validateQuranReference({ fromVerse: 2, surahNumber: 1 })
      ).toEqual({ fromVerse: 2, surahNumber: 1, toVerse: 2 });
      expect(
        yield* result(
          validateQuranReference({ fromVerse: 2, surahNumber: 1, toVerse: 1 })
        )
      ).toMatchObject({
        _tag: "Failure",
        failure: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
      });
      expect(
        yield* result(
          validateQuranReference({ fromVerse: 1, surahNumber: 1, toVerse: 51 })
        )
      ).toMatchObject({
        _tag: "Failure",
        failure: { code: "CONTENT_RELEASE_LIMIT" },
      });
    })
  );
});
