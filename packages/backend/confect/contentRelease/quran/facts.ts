import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QuranSearchRowSchema } from "@nakafa/aksara-contracts/quran/snapshot/row";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { PublishedQuranRow } from "@repo/backend/content/quran/contract";
import { Array as Arr, pipe } from "effect";

type QuranSnapshotRow = PublishedQuranRow["record"];
type QuranSearch = typeof QuranSearchRowSchema.Type;
/** Indexed facts stored beside one signed Quran row. */
type QuranRowFacts = Pick<
  Docs["quranRows"],
  "appLocale" | "firstVerse" | "identity" | "surahNumber"
> &
  Pick<QuranSnapshotRow["payload"], "kind">;

/** Derives the canonical identity for one localized Quran search row. */
export function quranSearchIdentity(
  appLocale: AppLocaleCode,
  surahNumber: QuranSearch["surahNumber"]
) {
  return `search:${appLocale}:${surahNumber}`;
}

/** Derives the canonical identity for one immutable Quran chunk row. */
export function quranChunkIdentity(surahNumber: number, firstVerse: number) {
  return `chunk:${surahNumber}:${firstVerse}`;
}

/** Derives the immutable indexed facts stored beside one signed Quran row. */
export function quranRowFacts(record: QuranSnapshotRow): QuranRowFacts {
  const { payload } = record;
  if (payload.kind === "quran-attribution") {
    return {
      identity: `attribution:${pipe(
        payload.sources,
        Arr.map(({ id }) => id),
        Arr.join(":")
      )}`,
      kind: payload.kind,
    };
  }
  if (payload.kind === "quran-surah") {
    return {
      identity: `surah:${payload.number}`,
      kind: payload.kind,
      surahNumber: payload.number,
    };
  }
  if (payload.kind === "quran-chunk") {
    return {
      firstVerse: payload.firstVerse,
      identity: quranChunkIdentity(payload.surahNumber, payload.firstVerse),
      kind: payload.kind,
      surahNumber: payload.surahNumber,
    };
  }
  return {
    appLocale: payload.appLocale,
    identity: quranSearchIdentity(payload.appLocale, payload.surahNumber),
    kind: payload.kind,
    surahNumber: payload.surahNumber,
  };
}

/** Derives one searchable projection from an authenticated search payload. */
export function quranSearchFacts(payload: QuranSearch) {
  return {
    appLocale: payload.appLocale,
    assetId: payload.graph.assetId,
    identity: quranSearchIdentity(payload.appLocale, payload.surahNumber),
    surahNumber: payload.surahNumber,
    text: payload.text,
  };
}
