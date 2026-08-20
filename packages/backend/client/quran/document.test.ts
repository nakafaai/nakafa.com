import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { decodePublishedQuranDocument } from "@repo/backend/client/quran/document";
import type { api } from "@repo/backend/convex/_generated/api";
import { describe, expect, it } from "@repo/testing/effect";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranDocumentResult = FunctionReturnType<
  typeof api.contentRelease.quran.document
>;
const source = {
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  activeReleaseId: "quran-release",
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
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
      expect(document.verses).toEqual([
        {
          arabic: "بِسْمِ اللّٰهِ",
          number: { inQuran: 1, inSurah: 1 },
          translation: { footnotes: "Catatan.", text: "Dengan nama Allah." },
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
              snapshotId: null,
              sourceRevision: null,
              surah: null,
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
    surah: {
      kind: "quran-surah",
      name: {
        arabic: "الفاتحة",
        translation: "Pembukaan",
        transliteration: "Al-Fatihah",
      },
      number: 1,
      numberOfVerses: 1,
      revelation: { order: 5, place: "Meccan" },
    },
    verses: [
      {
        arabic: "بِسْمِ اللّٰهِ",
        number: { inQuran: 1, inSurah: 1 },
        translation: { footnotes: "Catatan.", text: "Dengan nama Allah." },
      },
    ],
  };
}
