import { getMDXSlugsForLocale } from "@repo/contents/_lib/cache";
import {
  clearFolderChildNamesCache,
  getFolderChildNames,
  getFolderChildNamesCacheVersion,
} from "@repo/contents/_lib/fs/cache";
import { getNestedSlugs } from "@repo/contents/_lib/fs/nested-slugs";
import { QURAN_ROOT } from "@repo/contents/_lib/manifest/constants";
import { getAllSurah } from "@repo/contents/_lib/quran";
import { Effect } from "effect";

/** Reads source data needed by the content route manifest. */
export class ContentRouteSource extends Effect.Service<ContentRouteSource>()(
  "@repo/contents/ContentRouteSource",
  {
    accessors: true,
    succeed: {
      clearFolderCache: Effect.suspend(clearFolderChildNamesCache),
      getFolderCacheVersion: Effect.suspend(getFolderChildNamesCacheVersion),
      getFolderNames: (folder: string) => getFolderChildNames(folder),
      getMdxSlugs: (locale: string) =>
        Effect.sync(() => getMDXSlugsForLocale(locale)),
      getNestedSlugParts: (folder: string) => getNestedSlugs(folder),
      getQuranRoutes: Effect.sync(() =>
        getAllSurah().map((surah) => `/${QURAN_ROOT}/${surah.number}`)
      ),
    },
  }
) {}

/** Reads folder names while treating missing folders as empty route groups. */
export function getFolderNamesOrEmpty(
  source: ContentRouteSource,
  folder: string
) {
  return source.getFolderNames(folder).pipe(
    Effect.catchTags({
      DirectoryReadError: () => Effect.succeed([]),
      InvalidPathError: () => Effect.succeed([]),
    })
  );
}
