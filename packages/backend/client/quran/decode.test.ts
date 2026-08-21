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
  encodeTestQuranRow,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran-rows";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

const source = {
  activeManifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
  activeReleaseId: ReleaseIdSchema.make("quran-release"),
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceRevision: GitCommitShaSchema.make("c".repeat(40)),
};
const otherSnapshotId = Sha256HashSchema.make(`sha256:${"d".repeat(64)}`);
describe("signed Quran decoder", () => {
  it.live("decodes the complete ordered signed catalog", () =>
    Effect.gen(function* () {
      const catalog = yield* decodePublishedQuranCatalog(catalogResult());
      expect(catalog.surahs).toHaveLength(114);
      expect(catalog.surahs.at(0)?.number).toBe(1);
      expect(catalog.surahs.at(-1)?.number).toBe(114);
      expect(catalog.activeReleaseId).toBe("quran-release");
    })
  );
  it.live("selects the exact bounded signed reference verses", () =>
    Effect.gen(function* () {
      const chunk = makeQuranChunk({
        firstQuranNumber: 1,
        firstVerse: 1,
        surahNumber: 1,
        verseCount: 6,
      });
      const reference = yield* decodePublishedQuranReference(
        {
          ...source,
          chunkJson: [encodeTestQuranRow(source.snapshotId, chunk)],
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
        { appLocale: "en", surahNumber: 1 }
      );
      expect(reference.verses.map((verse) => verse.number.inSurah)).toEqual([
        2, 3,
      ]);
    })
  );
  it.live(
    "fails closed for inactive, malformed, or inconsistent publication data",
    () =>
      Effect.gen(function* () {
        const inactive = yield* Effect.result(
          decodePublishedQuranCatalog({
            activeManifestHash: null,
            activeReleaseId: null,
            managed: false,
            rowJson: [],
            snapshotId: null,
            sourceRevision: null,
          })
        );
        const malformed = yield* Effect.result(
          decodePublishedQuranCatalog({
            ...source,
            rowJson: ["not-json"],
          })
        );
        const wrongSnapshot = yield* Effect.result(
          decodePublishedQuranCatalog({
            ...source,
            rowJson: Array.from({ length: 114 }, (_, index) =>
              encodeTestQuranRow(otherSnapshotId, makeQuranSurah(index + 1))
            ),
          })
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
function catalogResult() {
  return {
    ...source,
    rowJson: Array.from({ length: 114 }, (_, index) =>
      encodeTestQuranRow(source.snapshotId, makeQuranSurah(index + 1))
    ),
  };
}
