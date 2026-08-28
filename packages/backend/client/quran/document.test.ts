import { describe, expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { decodePublishedQuranDocument } from "@repo/backend/client/quran/document";
import type { api } from "@repo/backend/convex/_generated/api";
import {
  makeQuranLocaleSources,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranDocumentResult = FunctionReturnType<
  typeof api.contentRelease.quran.surah
>;
const source = {
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  activeReleaseId: "quran-release",
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceOrigin: { kind: "git" as const, sha: "c".repeat(40) },
  sourceRevision: "c".repeat(40),
};
describe("signed Quran document decoder", () => {
  it.live("preserves the exact app-locale document projection", () =>
    Effect.gen(function* () {
      const document = yield* decodePublishedQuranDocument(documentResult(), {
        appLocale: "id",
        surahNumber: 1,
      });
      expect(document.surah.revelation).toEqual({ order: 5, place: "Meccan" });
      expect(document.surah.name.meaning).toEqual({
        appLocale: "en",
        text: "The Opening",
      });
      expect(document.verses).toEqual([
        {
          arabic: "بِسْمِ اللّٰهِ",
          number: { inQuran: 1, inSurah: 1 },
          translation: {
            notes: [],
            segments: [
              { kind: "text", offset: 0, value: "Dengan nama Allah." },
            ],
          },
        },
      ]);
    })
  );
  it.live(
    "fails with typed errors for inactive and inconsistent documents",
    () =>
      Effect.gen(function* () {
        const inactive = yield* Effect.result(
          decodePublishedQuranDocument(
            {
              activeManifestHash: null,
              activeReleaseId: null,
              appLocale: "id",
              managed: false,
              preBismillah: null,
              snapshotId: null,
              sourceOrigin: null,
              sourceRevision: null,
              sources: null,
              surah: null,
              tafsirAccess: null,
              verses: [],
            },
            { appLocale: "id", surahNumber: 1 }
          )
        );
        const inconsistent = yield* Effect.result(
          decodePublishedQuranDocument(documentResult(), {
            appLocale: "en",
            surahNumber: 1,
          })
        );
        expect(inactive).toMatchObject({
          _tag: "Failure",
          failure: { _tag: "QuranPublicationError", operation: "document" },
        });
        expect(inconsistent).toMatchObject({
          _tag: "Failure",
          failure: { _tag: "QuranPublicationError", operation: "document" },
        });
      })
  );
});
/** Builds one complete app-locale signed document response. */
function documentResult(): QuranDocumentResult {
  return {
    ...source,
    appLocale: "id",
    preBismillah: null,
    sources: makeQuranLocaleSources("id"),
    surah: {
      kind: "quran-surah",
      name: {
        arabic: "الفاتحة",
        sourceMeaning: { appLocale: "en", text: "The Opening" },
        transliteration: "Al-Fatihah",
      },
      number: 1,
      numberOfVerses: 1,
      revelation: { order: 5, place: "Meccan" },
    },
    tafsirAccess: makeQuranTafsirProjection("id"),
    verses: [
      {
        arabic: "بِسْمِ اللّٰهِ",
        number: { inQuran: 1, inSurah: 1 },
        translation: {
          notes: [],
          segments: [{ kind: "text", offset: 0, value: "Dengan nama Allah." }],
        },
      },
    ],
  };
}
