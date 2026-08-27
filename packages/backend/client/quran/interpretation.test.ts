import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  decodePublishedQuranInterpretation,
  isQuranSnapshotConflict,
  type PublishedQuranInterpretation,
  QuranInterpretationRequestError,
  toQuranInterpretationRequestError,
} from "@repo/backend/client/quran/interpretation";
import { QuranPublicationError } from "@repo/backend/client/quran/publication";
import type { api } from "@repo/backend/convex/_generated/api";
import { makeQuranTafsirProjection } from "@repo/backend/test/quran/rows";
import { describe, expect, it } from "@repo/testing/effect";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { Effect } from "effect";

const source = {
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  activeReleaseId: "quran-release",
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceOrigin: { kind: "git" as const, sha: "c".repeat(40) },
  sourceRevision: "c".repeat(40),
};
type QuranInterpretationResult = FunctionReturnType<
  typeof api.contentRelease.quran.tafsir
>;
const activeInterpretation = {
  ...source,
  interpretation: "Tafsir ayat tujuh.",
  appLocale: "id",
  surahNumber: 1,
  tafsirAccess: makeQuranTafsirProjection("id"),
  verseNumber: 7,
} satisfies QuranInterpretationResult;
describe("signed Quran interpretation decoder", () => {
  it.live("preserves one exact active tafsir", () =>
    Effect.gen(function* () {
      const interpretation = yield* decodePublishedQuranInterpretation(
        activeInterpretation,
        {
          appLocale: "id",
          snapshotId: source.snapshotId,
          surahNumber: 1,
          verseNumber: 7,
        }
      );
      expect(interpretation).toMatchObject({
        interpretation: "Tafsir ayat tujuh.",
        appLocale: "id",
        surahNumber: 1,
        verseNumber: 7,
      } satisfies Partial<PublishedQuranInterpretation>);
    })
  );
  it.live("preserves tafsir from a signed rollback release", () =>
    Effect.gen(function* () {
      const interpretation = yield* decodePublishedQuranInterpretation(
        {
          ...activeInterpretation,
          sourceOrigin: {
            kind: "rollback",
            releaseId: "quran-origin-release",
          },
          sourceRevision: null,
        },
        {
          appLocale: "id",
          snapshotId: source.snapshotId,
          surahNumber: 1,
          verseNumber: 7,
        }
      );
      expect(interpretation.sourceRevision).toBeNull();
      expect(interpretation.interpretation).toBe("Tafsir ayat tujuh.");
    })
  );
  it.live(
    "fails closed for inactive, stale, mismatched, and empty responses",
    () =>
      Effect.gen(function* () {
        const inactive: QuranInterpretationResult = {
          activeManifestHash: null,
          activeReleaseId: null,
          interpretation: null,
          appLocale: "id",
          managed: false,
          snapshotId: null,
          sourceOrigin: null,
          sourceRevision: null,
          surahNumber: 1,
          tafsirAccess: null,
          verseNumber: 7,
        };
        const mismatched: QuranInterpretationResult = {
          ...activeInterpretation,
          verseNumber: 6,
        };
        const stale: QuranInterpretationResult = {
          ...activeInterpretation,
          snapshotId: Sha256HashSchema.make(`sha256:${"d".repeat(64)}`),
        };
        const empty: QuranInterpretationResult = {
          ...activeInterpretation,
          interpretation: "   ",
        };
        for (const result of [inactive, stale, mismatched, empty]) {
          const decoded = yield* Effect.result(
            decodePublishedQuranInterpretation(result, {
              appLocale: "id",
              snapshotId: source.snapshotId,
              surahNumber: 1,
              verseNumber: 7,
            })
          );
          expect(decoded._tag).toBe("Failure");
          if (decoded._tag === "Failure") {
            expect(decoded.failure).toBeInstanceOf(QuranPublicationError);
          }
        }
      })
  );
  it("recognizes only a typed snapshot conflict request failure", () => {
    const conflict = toQuranInterpretationRequestError(
      new ConvexError({
        code: "CONTENT_RELEASE_CONFLICT",
        message: "The active Quran snapshot changed.",
      })
    );
    expect(conflict).toBeInstanceOf(QuranInterpretationRequestError);
    expect(isQuranSnapshotConflict(conflict)).toBe(true);
    for (const error of [
      new Error("Network error"),
      new ConvexError({ code: "CONTENT_RELEASE_CONFLICT" }),
      toQuranInterpretationRequestError(new Error("Network error")),
      toQuranInterpretationRequestError(new ConvexError("plain")),
      toQuranInterpretationRequestError(new ConvexError(null)),
      toQuranInterpretationRequestError(new ConvexError({})),
      toQuranInterpretationRequestError(
        new ConvexError({ code: "CONTENT_RELEASE_INVALID_REQUEST" })
      ),
    ]) {
      expect(isQuranSnapshotConflict(error)).toBe(false);
    }
  });
});
