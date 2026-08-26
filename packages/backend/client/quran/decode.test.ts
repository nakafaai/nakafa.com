import {
  GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  decodePublishedQuranCatalog,
  decodePublishedQuranReference,
  QuranPublicationError,
} from "@repo/backend/client/quran/decode";
import {
  encodeLegacyQuranRow,
  encodeTestQuranRow,
  makeLegacyQuranSurah,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import {
  encodeTestQuranRow as encodeLegacyReferenceRow,
  makeQuranChunk as makeLegacyQuranChunk,
  makeQuranSearch as makeLegacyQuranSearch,
  makeQuranSurah as makeLegacyReferenceSurah,
} from "@repo/backend/test/quran/v1";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

const source = {
  activeManifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
  activeReleaseId: ReleaseIdSchema.make("quran-release"),
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceOrigin: { kind: "git" as const, sha: "c".repeat(40) },
  sourceRevision: GitCommitShaSchema.make("c".repeat(40)),
};

describe("signed Quran V1 decoder", () => {
  it.live("decodes 0.15.1 and 0.17 surahs into immutable V1", () =>
    Effect.gen(function* () {
      const legacy = yield* decodePublishedQuranCatalog(
        catalogResult((index) =>
          encodeLegacyQuranRow(
            source.snapshotId,
            makeLegacyQuranSurah(index + 1)
          )
        )
      );
      const current = yield* decodePublishedQuranCatalog(
        catalogResult((index) =>
          encodeTestQuranRow(source.snapshotId, makeQuranSurah(index + 1))
        )
      );

      for (const catalog of [legacy, current]) {
        expect(catalog.surahs).toHaveLength(114);
        expect(catalog.surahs[0]?.name.translation).toBe("Technical meaning 1");
        expect(catalog.surahs.at(-1)?.number).toBe(114);
        expect(catalog).not.toHaveProperty("sourceOrigin");
        expect(catalog.surahs[0]?.name).not.toHaveProperty("meaning");
      }
    })
  );

  it.live("projects 0.15.1 and 0.17 references into immutable V1", () =>
    Effect.gen(function* () {
      const currentChunk = makeQuranChunk({
        firstQuranNumber: 1,
        firstVerse: 1,
        surahNumber: 1,
        verseCount: 6,
      });
      const legacyChunk = makeLegacyQuranChunk({
        firstQuranNumber: 1,
        firstVerse: 1,
        surahNumber: 1,
        verseCount: 6,
      });
      const results = [
        {
          ...source,
          chunkJson: [encodeLegacyReferenceRow(source.snapshotId, legacyChunk)],
          fromVerse: 2,
          searchJson: encodeLegacyReferenceRow(
            source.snapshotId,
            makeLegacyQuranSearch("en", 1)
          ),
          surahJson: encodeLegacyReferenceRow(
            source.snapshotId,
            makeLegacyReferenceSurah(1, 6)
          ),
          toVerse: 3,
        },
        {
          ...source,
          chunkJson: [encodeTestQuranRow(source.snapshotId, currentChunk)],
          fromVerse: 2,
          searchJson: encodeTestQuranRow(
            source.snapshotId,
            makeQuranSearch("en", 1)
          ),
          surahJson: encodeTestQuranRow(
            source.snapshotId,
            makeQuranSurah(1, 6)
          ),
          toVerse: 3,
        },
      ];

      for (const result of results) {
        const reference = yield* decodePublishedQuranReference(result, {
          appLocale: "en",
          surahNumber: 1,
        });
        expect(reference.surah.name.translation).toBe("Technical meaning 1");
        expect(reference.surah.name).not.toHaveProperty("meaning");
        expect(reference.verses.map((verse) => verse.number.inSurah)).toEqual([
          2, 3,
        ]);
      }
    })
  );

  it.live("fails closed for inactive, malformed, and cross-snapshot rows", () =>
    Effect.gen(function* () {
      const inactive = yield* Effect.result(
        decodePublishedQuranCatalog({
          activeManifestHash: null,
          activeReleaseId: null,
          managed: false,
          rowJson: [],
          snapshotId: null,
          sourceOrigin: null,
          sourceRevision: null,
        })
      );
      const malformed = yield* Effect.result(
        decodePublishedQuranCatalog({ ...source, rowJson: ["not-json"] })
      );
      const otherSnapshotId = Sha256HashSchema.make(`sha256:${"d".repeat(64)}`);
      const wrongSnapshot = yield* Effect.result(
        decodePublishedQuranCatalog(
          catalogResult((index) =>
            encodeTestQuranRow(otherSnapshotId, makeQuranSurah(index + 1))
          )
        )
      );

      for (const result of [inactive, malformed, wrongSnapshot]) {
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          expect(result.failure).toBeInstanceOf(QuranPublicationError);
        }
      }
    })
  );
});

/** Builds all 114 schema-valid signed metadata rows. */
function catalogResult(row: (index: number) => string) {
  return {
    ...source,
    rowJson: Array.from({ length: 114 }, (_, index) => row(index)),
  };
}
