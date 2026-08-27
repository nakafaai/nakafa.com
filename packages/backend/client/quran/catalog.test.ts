import {
  GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  completePublishedQuranSurah,
  decodePublishedQuranCatalog,
  decodePublishedQuranSurah,
  selectPublishedQuranSurah,
} from "@repo/backend/client/quran/catalog";
import { QuranPublicationError } from "@repo/backend/client/quran/publication";
import {
  encodeTestQuranRow,
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
      expect(
        yield* selectPublishedQuranSurah(catalog, {
          operation: "view",
          snapshotId: source.snapshotId,
          surahNumber: 1,
        })
      ).toEqual(catalog.surahs[0]);
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

  it.live("rejects cross-snapshot projection metadata", () =>
    Effect.gen(function* () {
      const catalog = yield* decodePublishedQuranCatalog(
        catalogResult((index) =>
          encodeTestQuranRow(source.snapshotId, makeQuranSurah(index + 1))
        )
      );
      const selected = yield* Effect.result(
        selectPublishedQuranSurah(catalog, {
          operation: "markdown",
          snapshotId: Sha256HashSchema.make(`sha256:${"d".repeat(64)}`),
          surahNumber: 1,
        })
      );

      expect(selected).toMatchObject({
        _tag: "Failure",
        failure: {
          _tag: "QuranSnapshotChangedError",
          operation: "markdown",
        },
      });
    })
  );

  it.live("normalizes the expanded meaning and detects its predecessor", () =>
    Effect.gen(function* () {
      const expanded = yield* decodePublishedQuranSurah(
        {
          name: {
            meaning: null,
            sourceMeaning: { appLocale: "en", text: "The Opening" },
            transliteration: "Al-Fatihah",
          },
          number: 1,
        },
        "view"
      );
      const predecessor = yield* decodePublishedQuranSurah(
        {
          name: { meaning: null, transliteration: "Al-Fatihah" },
          number: 1,
        },
        "view"
      );

      expect(expanded.name).toEqual({
        meaning: { appLocale: "en", text: "The Opening" },
        transliteration: "Al-Fatihah",
      });
      expect(predecessor.name.meaning).toBeNull();
    })
  );

  it.live("fails closed for an invalid expanded meaning", () =>
    Effect.gen(function* () {
      const decoded = yield* Effect.result(
        decodePublishedQuranSurah(
          {
            name: {
              meaning: null,
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

  it.live("completes only predecessor projections from the same catalog", () =>
    Effect.gen(function* () {
      const catalog = yield* decodePublishedQuranCatalog(
        catalogResult((index) =>
          encodeTestQuranRow(source.snapshotId, makeQuranSurah(index + 1))
        )
      );
      const expanded = yield* completePublishedQuranSurah(
        {
          name: {
            meaning: makeQuranSurah(1).name.meaning,
            transliteration: "Al-Fatihah",
          },
          number: 1,
        },
        null,
        { operation: "view", snapshotId: source.snapshotId }
      );
      const predecessor = yield* completePublishedQuranSurah(
        {
          name: { meaning: null, transliteration: "Al-Fatihah" },
          number: 1,
        },
        catalog,
        { operation: "view", snapshotId: source.snapshotId }
      );
      const missing = yield* Effect.result(
        completePublishedQuranSurah(
          {
            name: { meaning: null, transliteration: "Al-Fatihah" },
            number: 1,
          },
          null,
          { operation: "view", snapshotId: source.snapshotId }
        )
      );

      expect(expanded.name.meaning.text).toBe("Technical meaning 1");
      expect(predecessor.name.meaning.text).toBe("Technical meaning 1");
      expect(missing).toMatchObject({
        _tag: "Failure",
        failure: {
          _tag: "QuranPublicationError",
          reason: "Signed Quran source meaning is missing.",
        },
      });
    })
  );

  it.live("rejects a projection outside the signed catalog", () =>
    Effect.gen(function* () {
      const catalog = yield* decodePublishedQuranCatalog(
        catalogResult((index) =>
          encodeTestQuranRow(source.snapshotId, makeQuranSurah(index + 1))
        )
      );
      const selected = yield* Effect.result(
        selectPublishedQuranSurah(catalog, {
          operation: "view",
          snapshotId: source.snapshotId,
          surahNumber: 115,
        })
      );

      expect(selected).toMatchObject({
        _tag: "Failure",
        failure: {
          _tag: "QuranPublicationError",
          operation: "view",
          reason: "Signed Quran projection has no matching catalog surah.",
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
