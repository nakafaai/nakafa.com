import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { decodePublishedQuranMarkdown } from "@repo/backend/client/quran/markdown";
import type { api } from "@repo/backend/convex/_generated/api";
import { describe, expect, it } from "@repo/testing/effect";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranMarkdownResult = FunctionReturnType<
  typeof api.contentRelease.quran.markdown
>;
const source = {
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  activeReleaseId: "quran-release",
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceOrigin: { kind: "git" as const, sha: "c".repeat(40) },
  sourceRevision: "c".repeat(40),
};
describe("signed Quran markdown decoder", () => {
  it.live("preserves the exact fields rendered by markdown consumers", () =>
    Effect.gen(function* () {
      const markdown = yield* decodePublishedQuranMarkdown(markdownResult(), {
        appLocale: "en",
        surahNumber: 1,
      });
      expect(markdown.surah.revelation).toEqual({ place: "Meccan" });
      expect(markdown.verses[0]).toEqual({
        arabic: "بِسْمِ اللّٰهِ",
        number: { inSurah: 1 },
        translation: { footnotes: "Source note.", text: "In Allah's name." },
      });
    })
  );
  it.live("fails with typed errors for missing and mismatched markdown", () =>
    Effect.gen(function* () {
      const missing = yield* Effect.result(
        decodePublishedQuranMarkdown(
          { ...markdownResult(), surah: null, verses: [] },
          { appLocale: "en", surahNumber: 1 }
        )
      );
      const mismatched = yield* Effect.result(
        decodePublishedQuranMarkdown(markdownResult(), {
          appLocale: "en",
          surahNumber: 2,
        })
      );
      expect(missing).toMatchObject({
        _tag: "Failure",
        failure: { _tag: "QuranPublicationError", operation: "markdown" },
      });
      expect(mismatched).toMatchObject({
        _tag: "Failure",
        failure: { _tag: "QuranPublicationError", operation: "markdown" },
      });
    })
  );
  it.live("accepts only the requested exact markdown verse prefix", () =>
    Effect.gen(function* () {
      const bounded = markdownResult(82, 80);
      expect(
        yield* decodePublishedQuranMarkdown(bounded, {
          appLocale: "en",
          surahNumber: 1,
          verseLimit: 80,
        })
      ).toMatchObject({ toVerse: 80, verses: { length: 80 } });
      expect(
        yield* Effect.result(
          decodePublishedQuranMarkdown(
            { ...bounded, toVerse: 81 },
            { appLocale: "en", surahNumber: 1, verseLimit: 80 }
          )
        )
      ).toMatchObject({
        _tag: "Failure",
        failure: { _tag: "QuranPublicationError", operation: "markdown" },
      });
    })
  );
});
/** Builds one complete app-locale signed markdown response. */
function markdownResult(
  numberOfVerses = 1,
  toVerse = numberOfVerses
): QuranMarkdownResult {
  return {
    ...source,
    appLocale: "en",
    surah: {
      name: { translation: "The Opening", transliteration: "Al-Fatihah" },
      number: 1,
      numberOfVerses,
      revelation: { place: "Meccan" },
    },
    tafsirAccess: null,
    toVerse,
    verses: Array.from({ length: toVerse }, (_, index) => ({
      arabic: "بِسْمِ اللّٰهِ",
      number: { inSurah: index + 1 },
      translation: { footnotes: "Source note.", text: "In Allah's name." },
    })),
  };
}
