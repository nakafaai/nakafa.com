import { describe, expect, it } from "@effect/vitest";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  decodePublishedQuranCatalog,
  decodePublishedQuranSurah,
} from "@repo/backend/client/quran/catalog";
import { QuranPublicationError } from "@repo/backend/client/quran/publication";
import {
  encodeTestQuranRow,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
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

describe("signed Quran catalog decoder", () => {
  it.live("decodes the complete ordered current catalog", () =>
    Effect.gen(function* () {
      const catalog = yield* decodePublishedQuranCatalog(
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

  it.live("fails closed for malformed and cross-snapshot rows", () =>
    Effect.gen(function* () {
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

      for (const result of [malformed, wrongSnapshot]) {
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          expect(result.failure).toBeInstanceOf(QuranPublicationError);
        }
      }
    })
  );

  it.live("normalizes the required source meaning", () =>
    Effect.gen(function* () {
      const decoded = yield* decodePublishedQuranSurah(
        {
          name: {
            sourceMeaning: { appLocale: "en", text: "The Opening" },
            transliteration: "Al-Fatihah",
          },
          number: 1,
        },
        "view"
      );

      expect(decoded.name).toEqual({
        meaning: { appLocale: "en", text: "The Opening" },
        transliteration: "Al-Fatihah",
      });
    })
  );

  it.live("fails closed for an invalid source meaning", () =>
    Effect.gen(function* () {
      const decoded = yield* Effect.result(
        decodePublishedQuranSurah(
          {
            name: {
              sourceMeaning: { appLocale: "id", text: "Pembukaan" },
              transliteration: "Al-Fatihah",
            },
            number: 1,
          },
          "view"
        )
      );

      expect(decoded).toMatchObject({
        _tag: "Failure",
        failure: {
          _tag: "QuranPublicationError",
          operation: "view",
          reason: "Signed Quran source meaning is invalid.",
        },
      });
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
