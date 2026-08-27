import {
  GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { QuranPublicationError } from "@repo/backend/client/quran/publication";
import { decodePublishedQuranReference } from "@repo/backend/client/quran/reference";
import {
  encodeTestQuranRow,
  makeQuranChunk,
  makeQuranLocaleSources,
  makeQuranSearch,
  makeQuranSurah,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

const source = {
  activeManifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
  activeReleaseId: ReleaseIdSchema.make("quran-release"),
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceOrigin: {
    kind: "git" as const,
    sha: GitCommitShaSchema.make("c".repeat(40)),
  },
  sourceRevision: GitCommitShaSchema.make("c".repeat(40)),
};

describe("signed Quran passage decoder", () => {
  it.live("selects exact verses with locale-matched signed sources", () =>
    Effect.gen(function* () {
      const reference = yield* decodePublishedQuranReference(
        referenceResult(),
        { appLocale: "en", surahNumber: 1 }
      );

      expect(reference.verses.map((verse) => verse.number.inSurah)).toEqual([
        2, 3,
      ]);
      expect(reference.sources.translation.id).toBe("quranenc-english");
      expect(reference.tafsirAccess).toMatchObject({
        appLocale: "en",
        kind: "external",
      });
    })
  );

  it.live("fails closed for missing and inconsistent references", () =>
    Effect.gen(function* () {
      const missing = yield* Effect.result(
        decodePublishedQuranReference(
          {
            ...referenceResult(),
            chunkJson: [],
            searchJson: null,
            sources: null,
            surahJson: null,
            tafsirAccess: null,
          },
          { appLocale: "en", surahNumber: 1 }
        )
      );
      const inconsistent = yield* Effect.result(
        decodePublishedQuranReference(referenceResult(), {
          appLocale: "de",
          surahNumber: 1,
        })
      );

      for (const result of [missing, inconsistent]) {
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          expect(result.failure).toBeInstanceOf(QuranPublicationError);
        }
      }
    })
  );
});

/** Builds one complete bounded passage response. */
function referenceResult() {
  const chunk = makeQuranChunk({
    firstQuranNumber: 1,
    firstVerse: 1,
    surahNumber: 1,
    verseCount: 6,
  });
  return {
    ...source,
    chunkJson: [encodeTestQuranRow(source.snapshotId, chunk)],
    fromVerse: 2,
    preBismillah: null,
    searchJson: encodeTestQuranRow(source.snapshotId, makeQuranSearch("en", 1)),
    sources: makeQuranLocaleSources("en"),
    surahJson: encodeTestQuranRow(source.snapshotId, makeQuranSurah(1, 6)),
    tafsirAccess: makeQuranTafsirProjection("en"),
    toVerse: 3,
  };
}
