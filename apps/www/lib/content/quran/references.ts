import type {
  QuranViewSources,
  QuranViewTafsirAccess,
} from "@repo/backend/client/quran/view";
import type { Reference } from "@repo/contents/_types/content";

type QuranReferenceSource =
  | QuranViewSources[keyof QuranViewSources]
  | QuranViewTafsirAccess["source"];

/** Projects signed Quran source metadata into the existing bibliography sheet. */
export function getQuranReferences(
  sources: QuranViewSources,
  tafsirAccess: QuranViewTafsirAccess | null
): Reference[] {
  const readingReferences = [sources.arabic, sources.translation].map(
    toReference
  );
  if (tafsirAccess === null) {
    return readingReferences;
  }
  return [...readingReferences, toTafsirReference(tafsirAccess)];
}

function toReference(source: QuranReferenceSource): Reference {
  return {
    authors: source.publisher,
    details: `${source.notice} ${source.version}`,
    publication: source.publisher,
    title: source.label,
    url: source.updateUrl,
    year: Number(source.retrievedAt.slice(0, 4)),
  };
}

/** Preserves signed Tafsir availability and terms in the bibliography entry. */
function toTafsirReference(access: QuranViewTafsirAccess): Reference {
  const source = access.source;
  const accessDetail =
    source.kind === "external"
      ? `Access: ${source.terms.access}. Terms: ${source.terms.url}`
      : `Terms: ${source.terms.url}`;
  return {
    ...toReference(source),
    details: `${access.notice} ${source.notice} ${source.version}. ${accessDetail}`,
  };
}
