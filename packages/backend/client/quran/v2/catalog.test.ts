import {
  GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { QuranPublicationError } from "@repo/backend/client/quran/publication";
import { decodePublishedQuranCatalogV2 } from "@repo/backend/client/quran/v2/catalog";
import {
  encodeLegacyQuranRow,
  encodeTestQuranRow,
  makeLegacyQuranSurah,
  makeQuranSurah,
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

describe("signed Quran V2 catalog decoder", () => {
  it.live("decodes the complete ordered current catalog", () =>
    Effect.gen(function* () {
      const catalog = yield* decodePublishedQuranCatalogV2(
        catalogResult((index) =>
          encodeTestQuranRow(source.snapshotId, makeQuranSurah(index + 1))
        )
      );

      expect(catalog.surahs).toHaveLength(114);
      expect(catalog.surahs.at(0)?.name.meaning).toEqual({
        appLocale: "en",
        text: "Technical meaning 1",
      });
      expect(catalog.surahs.at(-1)?.number).toBe(114);
    })
  );

  it.live("upgrades authentic 0.15.1 surahs into canonical V2", () =>
    Effect.gen(function* () {
      const catalog = yield* decodePublishedQuranCatalogV2(
        catalogResult((index) =>
          encodeLegacyQuranRow(
            source.snapshotId,
            makeLegacyQuranSurah(index + 1)
          )
        )
      );

      expect(catalog.surahs[0]?.name.meaning).toEqual({
        appLocale: "en",
        text: "Technical meaning 1",
      });
    })
  );

  it.live("fails closed for malformed and cross-snapshot rows", () =>
    Effect.gen(function* () {
      const malformed = yield* Effect.result(
        decodePublishedQuranCatalogV2({ ...source, rowJson: ["not-json"] })
      );
      const otherSnapshotId = Sha256HashSchema.make(`sha256:${"d".repeat(64)}`);
      const wrongSnapshot = yield* Effect.result(
        decodePublishedQuranCatalogV2(
          catalogResult((index) =>
            encodeTestQuranRow(otherSnapshotId, makeQuranSurah(index + 1))
          )
        )
      );

      for (const result of [malformed, wrongSnapshot]) {
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
