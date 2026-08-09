import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { decodePublishedQuranMarkdown } from "@repo/backend/client/quran/markdown";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

type QuranMarkdownResult = FunctionReturnType<
  typeof api.contentRelease.quran.markdown
>;

const source = {
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  activeReleaseId: "quran-release",
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceRevision: "c".repeat(40),
};

describe("signed Quran markdown decoder", () => {
  it("preserves the exact fields rendered by markdown consumers", async () => {
    const markdown = await Effect.runPromise(
      decodePublishedQuranMarkdown(markdownResult(), {
        locale: "en",
        surahNumber: 1,
      })
    );

    expect(markdown.surah.revelation).toEqual({ place: "Meccan" });
    expect(markdown.verses[0]).toEqual({
      arabic: "بِسْمِ اللّٰهِ",
      number: { inSurah: 1 },
      translation: { footnotes: "Source note.", text: "In Allah's name." },
    });
  });

  it("fails with typed errors for missing and mismatched markdown", async () => {
    const missing = await Effect.runPromise(
      Effect.either(
        decodePublishedQuranMarkdown(
          { ...markdownResult(), surah: null, verses: [] },
          { locale: "en", surahNumber: 1 }
        )
      )
    );
    const mismatched = await Effect.runPromise(
      Effect.either(
        decodePublishedQuranMarkdown(markdownResult(), {
          locale: "en",
          surahNumber: 2,
        })
      )
    );

    expect(missing).toMatchObject({
      _tag: "Left",
      left: { _tag: "QuranPublicationError", operation: "markdown" },
    });
    expect(mismatched).toMatchObject({
      _tag: "Left",
      left: { _tag: "QuranPublicationError", operation: "markdown" },
    });
  });
});

/** Builds one complete locale-specific signed markdown response. */
function markdownResult(): QuranMarkdownResult {
  return {
    ...source,
    locale: "en",
    surah: {
      name: { translation: "The Opening", transliteration: "Al-Fatihah" },
      number: 1,
      numberOfVerses: 1,
      revelation: { place: "Meccan" },
    },
    verses: [
      {
        arabic: "بِسْمِ اللّٰهِ",
        number: { inSurah: 1 },
        translation: { footnotes: "Source note.", text: "In Allah's name." },
      },
    ],
  };
}
