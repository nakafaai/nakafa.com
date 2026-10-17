import { describe, expect, it } from "@effect/vitest";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import type { QuranRowHashError } from "@nakafa/aksara-contracts/quran/snapshot/row/hash";
import {
  decodePublishedQuranCatalog,
  decodePublishedQuranSurah,
} from "@repo/backend/client/quran/catalog";
import { QuranPublicationError } from "@repo/backend/client/quran/publication";
import {
  encodeTestQuranRow,
  makeQuranMeaning,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { Array as Arr, Effect, Option } from "effect";

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
        yield* catalogResult((index) =>
          encodeTestQuranRow(source.snapshotId, makeQuranSurah(index + 1))
        )
      );

      expect(catalog.surahs).toHaveLength(114);
      expect(Option.getOrThrow(Arr.head(catalog.surahs)).name.meaning).toEqual(
        makeQuranMeaning(1)
      );
      expect(Option.getOrThrow(Arr.last(catalog.surahs)).number).toBe(114);
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
          yield* catalogResult((index) =>
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

  it.live("fails closed for incomplete and unordered catalogs", () =>
    Effect.gen(function* () {
      const incomplete = yield* Effect.result(
        decodePublishedQuranCatalog({
          ...source,
          rowJson: yield* Effect.forEach(
            Arr.makeBy(113, (index) => index),
            (index) =>
              encodeTestQuranRow(source.snapshotId, makeQuranSurah(index + 1))
          ),
        })
      );
      const unordered = yield* Effect.result(
        decodePublishedQuranCatalog(
          yield* catalogResult((index) => {
            const surahNumber = index < 2 ? 2 - index : index + 1;
            return encodeTestQuranRow(
              source.snapshotId,
              makeQuranSurah(surahNumber)
            );
          })
        )
      );

      for (const result of [incomplete, unordered]) {
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
            arabic: "الفاتحة",
            sourceMeaning: {
              de: "Die Eröffnende",
              en: "The Opening",
              id: "Pembuka",
            },
            transliteration: "Al-Fatihah",
          },
          number: 1,
        },
        "view"
      );

      expect(decoded.name).toEqual({
        arabic: "الفاتحة",
        meaning: {
          de: "Die Eröffnende",
          en: "The Opening",
          id: "Pembuka",
        },
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
              arabic: "الفاتحة",
              sourceMeaning: { en: "The Opening" },
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
const catalogResult = Effect.fn("test.quran.catalogResult")(function* (
  row: (index: number) => Effect.Effect<string, QuranRowHashError>
) {
  return {
    ...source,
    rowJson: yield* Effect.forEach(
      Arr.makeBy(114, (index) => index),
      row
    ),
  };
});
