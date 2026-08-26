import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { decodePublishedQuranDocumentV2 } from "@repo/backend/client/quran/v2/document";
import type { api } from "@repo/backend/convex/_generated/api";
import {
  makeQuranLocaleSources,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import { describe, expect, it } from "@repo/testing/effect";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranDocumentResult = FunctionReturnType<
  typeof api.contentRelease.quran.documentV2
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
      const document = yield* decodePublishedQuranDocumentV2(documentResult(), {
        appLocale: "id",
        surahNumber: 1,
      });
      expect(document.surah.revelation).toEqual({ order: 5, place: "Meccan" });
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
          decodePublishedQuranDocumentV2(
            {
              activeManifestHash: null,
              activeReleaseId: null,
              appLocale: "id",
              managed: false,
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
          decodePublishedQuranDocumentV2(documentResult(), {
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
    sources: makeQuranLocaleSources("id"),
    surah: {
      kind: "quran-surah",
      name: {
        arabic: "الفاتحة",
        meaning: null,
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
