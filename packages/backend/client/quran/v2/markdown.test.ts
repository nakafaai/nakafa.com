import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { decodePublishedQuranMarkdownV2 } from "@repo/backend/client/quran/v2/markdown";
import type { api } from "@repo/backend/convex/_generated/api";
import {
  makeQuranLocaleSources,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import { describe, expect, it } from "@repo/testing/effect";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";

type QuranMarkdownResult = FunctionReturnType<
  typeof api.contentRelease.quran.markdownV2
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
      const markdown = yield* decodePublishedQuranMarkdownV2(markdownResult(), {
        appLocale: "en",
        surahNumber: 1,
      });
      expect(markdown.surah.revelation).toEqual({ place: "Meccan" });
      expect(markdown.tafsirAccess).toMatchObject({
        appLocale: "en",
        kind: "external",
      });
      expect(markdown.verses[0]).toEqual({
        arabic: "بِسْمِ اللّٰهِ",
        number: { inSurah: 1 },
        translation: {
          notes: [{ number: 1, referenceOffset: 15, text: "Source note." }],
          segments: [
            { kind: "text", offset: 0, value: "In Allah's name" },
            { kind: "note", number: 1, offset: 15 },
            { kind: "text", offset: 18, value: "." },
          ],
        },
      });
    })
  );
  it.live("fails with typed errors for missing and mismatched markdown", () =>
    Effect.gen(function* () {
      const missing = yield* Effect.result(
        decodePublishedQuranMarkdownV2(missingMarkdownResult(), {
          appLocale: "en",
          surahNumber: 1,
        })
      );
      const mismatched = yield* Effect.result(
        decodePublishedQuranMarkdownV2(markdownResult(), {
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
        yield* decodePublishedQuranMarkdownV2(bounded, {
          appLocale: "en",
          surahNumber: 1,
          verseLimit: 80,
        })
      ).toMatchObject({ toVerse: 80, verses: { length: 80 } });
      expect(
        yield* Effect.result(
          decodePublishedQuranMarkdownV2(
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
  it.live("accepts temporarily unavailable Tafsir access during rollout", () =>
    Effect.gen(function* () {
      const markdown = yield* decodePublishedQuranMarkdownV2(
        { ...markdownResult(), tafsirAccess: null },
        { appLocale: "en", surahNumber: 1 }
      );

      expect(markdown.tafsirAccess).toBeNull();
      expect(markdown.verses).toHaveLength(1);
    })
  );
});
/** Builds one active-source result whose requested surah is absent. */
function missingMarkdownResult(): QuranMarkdownResult {
  return {
    ...source,
    appLocale: "en",
    sources: null,
    surah: null,
    tafsirAccess: null,
    toVerse: 0,
    verses: [],
  };
}

/** Builds one complete app-locale signed markdown response. */
function markdownResult(
  numberOfVerses = 1,
  toVerse = numberOfVerses
): QuranMarkdownResult {
  return {
    ...source,
    appLocale: "en",
    sources: makeQuranLocaleSources("en"),
    tafsirAccess: makeQuranTafsirProjection("en"),
    surah: {
      name: {
        meaning: "The Opening",
        transliteration: "Al-Fatihah",
      },
      number: 1,
      numberOfVerses,
      revelation: { place: "Meccan" },
    },
    toVerse,
    verses: Array.from({ length: toVerse }, (_, index) => ({
      arabic: "بِسْمِ اللّٰهِ",
      number: { inSurah: index + 1 },
      translation: {
        notes: [{ number: 1, referenceOffset: 15, text: "Source note." }],
        segments: [
          { kind: "text", offset: 0, value: "In Allah's name" },
          { kind: "note", number: 1, offset: 15 },
          { kind: "text", offset: 18, value: "." },
        ],
      },
    })),
  };
}
