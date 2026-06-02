import { readFolderChildNamesForCacheKey } from "@repo/contents/_lib/fs/folder-scan";
import { getFolderChildNamesCacheKey } from "@repo/contents/_lib/fs/path";
import { Cache, Duration, Effect, Ref } from "effect";

const folderChildNamesCacheCapacity = 8192;

const folderChildNamesCache = Effect.runSync(
  Cache.make({
    capacity: folderChildNamesCacheCapacity,
    timeToLive: Duration.infinity,
    lookup: readFolderChildNamesForCacheKey,
  })
);

const folderChildNamesCacheVersion = Effect.runSync(Ref.make(0));

/** Clears memoized folder scans for tests and long-lived tools. */
export const clearFolderChildNamesCache = Effect.fn(
  "contents.fs.clearFolderChildNamesCache"
)(function* () {
  yield* folderChildNamesCache.invalidateAll;
  yield* Ref.update(folderChildNamesCacheVersion, (version) => version + 1);
});

/** Returns the current folder scan cache version for derived memoized data. */
export const getFolderChildNamesCacheVersion = Effect.fn(
  "contents.fs.getFolderChildNamesCacheVersion"
)(function* () {
  return yield* Ref.get(folderChildNamesCacheVersion);
});

/** Gets child directory names for a content-relative folder. */
export const getFolderChildNames = Effect.fn("contents.fs.getFolderChildNames")(
  function* (folder: string, exclude?: string[]) {
    const cacheKey = getFolderChildNamesCacheKey(folder, exclude);
    return yield* folderChildNamesCache.get(cacheKey);
  }
);
