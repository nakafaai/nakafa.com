import {
  GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  decodePublishedQuranCatalog,
  decodePublishedQuranPage,
  decodePublishedQuranReference,
  QuranPublicationError,
} from "@repo/backend/client/quran/decode";
import {
  encodeTestQuranRow,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran-rows";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const source = {
  activeManifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
  activeReleaseId: ReleaseIdSchema.make("quran-release"),
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceRevision: GitCommitShaSchema.make("c".repeat(40)),
};
const otherSnapshotId = Sha256HashSchema.make(`sha256:${"d".repeat(64)}`);

describe("signed Quran decoder", () => {
  it("decodes the complete ordered signed catalog", async () => {
    const catalog = await Effect.runPromise(
      decodePublishedQuranCatalog(catalogResult())
    );

    expect(catalog.surahs).toHaveLength(114);
    expect(catalog.surahs.at(0)?.number).toBe(1);
    expect(catalog.surahs.at(-1)?.number).toBe(114);
    expect(catalog.activeReleaseId).toBe("quran-release");
  });

  it("decodes pages and selects the exact bounded reference verses", async () => {
    const chunk = makeQuranChunk({
      firstQuranNumber: 1,
      firstVerse: 1,
      surahNumber: 1,
      verseCount: 6,
    });
    const page = await Effect.runPromise(
      decodePublishedQuranPage(pageResult(chunk), {
        locale: "en",
        surahNumber: 1,
      })
    );
    const reference = await Effect.runPromise(
      decodePublishedQuranReference(
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
        { locale: "en", surahNumber: 1 }
      )
    );

    expect(page.verses).toHaveLength(6);
    expect(reference.verses.map((verse) => verse.number.inSurah)).toEqual([
      2, 3,
    ]);
  });

  it("fails closed for inactive, malformed, or inconsistent publication data", async () => {
    const inactive = await Effect.runPromise(
      Effect.either(
        decodePublishedQuranCatalog({
          activeManifestHash: null,
          activeReleaseId: null,
          managed: false,
          rowJson: [],
          snapshotId: null,
          sourceRevision: null,
        })
      )
    );
    const malformed = await Effect.runPromise(
      Effect.either(
        decodePublishedQuranCatalog({
          ...source,
          rowJson: ["not-json"],
        })
      )
    );
    const inconsistent = await Effect.runPromise(
      Effect.either(
        decodePublishedQuranPage(
          {
            ...source,
            chunkJson: [],
            nextSurahJson: null,
            prevSurahJson: null,
            searchJson: encodeTestQuranRow(
              source.snapshotId,
              makeQuranSearch("id", 1)
            ),
            surahJson: encodeTestQuranRow(source.snapshotId, makeQuranSurah(1)),
          },
          { locale: "en", surahNumber: 1 }
        )
      )
    );
    const wrongSnapshot = await Effect.runPromise(
      Effect.either(
        decodePublishedQuranCatalog({
          ...source,
          rowJson: Array.from({ length: 114 }, (_, index) =>
            encodeTestQuranRow(otherSnapshotId, makeQuranSurah(index + 1))
          ),
        })
      )
    );

    for (const result of [inactive, malformed, inconsistent, wrongSnapshot]) {
      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left).toBeInstanceOf(QuranPublicationError);
      }
    }
  });
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

/** Builds one complete signed page response around the supplied chunk. */
function pageResult(chunk: ReturnType<typeof makeQuranChunk>) {
  return {
    ...source,
    chunkJson: [encodeTestQuranRow(source.snapshotId, chunk)],
    nextSurahJson: encodeTestQuranRow(source.snapshotId, makeQuranSurah(2)),
    prevSurahJson: null,
    searchJson: encodeTestQuranRow(source.snapshotId, makeQuranSearch("en", 1)),
    surahJson: encodeTestQuranRow(
      source.snapshotId,
      makeQuranSurah(1, chunk.verses.length)
    ),
  };
}
