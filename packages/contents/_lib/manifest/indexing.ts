import { getExerciseSetPathsFromSlugs } from "@repo/contents/_lib/exercises/collection";
import type {
  ContentManifestRouteEntry,
  LocaleSlugEntry,
} from "@repo/contents/_lib/manifest/schema";
import type { ContentRoot } from "@repo/contents/_types/content";

/** Returns Pagefind source entries for one MDX content root. */
export function getIndexedEntries(
  localeSlugs: readonly LocaleSlugEntry[],
  root: ContentRoot
) {
  const entries: ContentManifestRouteEntry[] = [];

  for (const { locale, slugs } of localeSlugs) {
    for (const slug of slugs) {
      const [slugRoot] = slug.split("/");

      if (slugRoot === root) {
        entries.push({ locale, slug });
      }
    }
  }

  return entries;
}

/** Returns Pagefind source entries for exercise set pages. */
export function getIndexedExerciseSetEntries(
  localeSlugs: readonly LocaleSlugEntry[]
) {
  const entries: ContentManifestRouteEntry[] = [];

  for (const { locale, slugs } of localeSlugs) {
    for (const slug of getExerciseSetPathsFromSlugs(slugs)) {
      entries.push({ locale, slug });
    }
  }

  return entries;
}
