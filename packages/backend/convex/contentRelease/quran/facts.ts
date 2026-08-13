import type { QuranSnapshotRow } from "@nakafa/aksara-contracts/quran/spec";

type QuranSearch = Extract<
  QuranSnapshotRow["payload"],
  { readonly kind: "quran-search" }
>;

interface QuranRowFacts {
  readonly firstVerse?: number;
  readonly identity: string;
  readonly kind: QuranSnapshotRow["payload"]["kind"];
  readonly locale?: QuranSearch["locale"];
  readonly surahNumber?: number;
}

/** Derives the canonical identity for one localized Quran search row. */
export function quranSearchIdentity(
  locale: QuranSearch["locale"],
  surahNumber: QuranSearch["surahNumber"]
) {
  return `search:${locale}:${surahNumber}`;
}

/** Derives the immutable indexed facts stored beside one signed Quran row. */
export function quranRowFacts(record: QuranSnapshotRow): QuranRowFacts {
  const { payload } = record;
  if (payload.kind === "quran-attribution") {
    return {
      identity: `attribution:${payload.sources.map(({ id }) => id).join(":")}`,
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
      identity: `chunk:${payload.surahNumber}:${payload.firstVerse}`,
      kind: payload.kind,
      surahNumber: payload.surahNumber,
    };
  }
  return {
    identity: quranSearchIdentity(payload.locale, payload.surahNumber),
    kind: payload.kind,
    locale: payload.locale,
    surahNumber: payload.surahNumber,
  };
}

/** Derives one searchable projection from an authenticated search payload. */
export function quranSearchFacts(payload: QuranSearch) {
  return {
    assetId: payload.graph.assetId,
    identity: quranSearchIdentity(payload.locale, payload.surahNumber),
    locale: payload.locale,
    surahNumber: payload.surahNumber,
    text: payload.text,
  };
}
