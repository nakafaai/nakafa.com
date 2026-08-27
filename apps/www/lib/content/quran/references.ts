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
  const selected = [
    sources.arabic,
    sources.translation,
    ...(tafsirAccess === null ? [] : [tafsirAccess.source]),
  ];
  return selected.map(toReference);
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
