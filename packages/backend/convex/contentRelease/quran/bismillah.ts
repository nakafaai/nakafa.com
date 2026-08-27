import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { QuranChunkRowSchema } from "@nakafa/aksara-contracts/quran/snapshot/row";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { quranChunkIdentity } from "@repo/backend/convex/contentRelease/quran/facts";
import { readQuranRow } from "@repo/backend/convex/contentRelease/quran/row";
import { readQuranTranslationDocument } from "@repo/backend/convex/contentRelease/quran/translation";
import { v } from "convex/values";
import { Effect } from "effect";

const BISMILLAH_SURAH_NUMBER = 1;
const BISMILLAH_VERSE_NUMBER = 1;
const SURAH_WITHOUT_OPENING_BISMILLAH = 9;

/** Exact signed Bismillah presentation projected from Al-Fatihah verse 1. */
export const quranBismillahValidator = v.object({
  arabic: v.string(),
  translation: v.string(),
});

/** Reads one locale's canonical Bismillah from authenticated source rows. */
export const readQuranBismillah = Effect.fn(
  "contentRelease.readQuranBismillah"
)(function* (
  ctx: QueryCtx,
  snapshotId: string,
  appLocale: AppLocaleCode,
  surahNumber: number,
  fromVerse: number
) {
  if (
    fromVerse !== BISMILLAH_VERSE_NUMBER ||
    surahNumber === BISMILLAH_SURAH_NUMBER ||
    surahNumber === SURAH_WITHOUT_OPENING_BISMILLAH
  ) {
    return null;
  }
  const row = yield* readQuranRow(
    ctx,
    snapshotId,
    quranChunkIdentity(BISMILLAH_SURAH_NUMBER, BISMILLAH_VERSE_NUMBER),
    QuranChunkRowSchema
  );
  const verse = row.payload.verses[0];
  if (
    row.payload.surahNumber !== BISMILLAH_SURAH_NUMBER ||
    row.payload.firstVerse !== BISMILLAH_VERSE_NUMBER ||
    verse === undefined ||
    verse.number.inSurah !== BISMILLAH_VERSE_NUMBER
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "The signed Quran Bismillah identity is inconsistent."
    );
  }
  const { document } = yield* readQuranTranslationDocument(verse, appLocale);
  const [translation] = document.segments;
  if (
    document.notes.length !== 0 ||
    document.segments.length !== 1 ||
    translation === undefined ||
    translation.kind !== "text"
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `The signed Quran Bismillah has unsupported ${appLocale} translation notes.`
    );
  }
  return { arabic: verse.text.arabic, translation: translation.value };
});

/** Fails closed when a surah expected to have a Bismillah cannot be split. */
export const verifyQuranBismillah = Effect.fn(
  "contentRelease.verifyQuranBismillah"
)(function* (expected: object | null, projected: object | null) {
  if (expected !== null && projected === null) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "The signed Quran Bismillah prefix is inconsistent."
    );
  }
});
