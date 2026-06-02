import {
  getFolderChildNames,
  getFolderChildNamesCacheVersion,
} from "@repo/contents/_lib/fs/cache";
import { cleanSlug } from "@repo/utilities/helper";
import { Cache, Duration, Effect } from "effect";

const nestedSlugsCacheCapacity = 4096;
const nestedSlugsCacheKeySeparator = "\0";

const nestedSlugsCache = Effect.runSync(
  Cache.make({
    capacity: nestedSlugsCacheCapacity,
    timeToLive: Duration.infinity,
    lookup: readNestedSlugsForCacheKey,
  })
);

/** Gets all nested slug paths below one content-relative base path. */
export const getNestedSlugs = Effect.fn("contents.fs.getNestedSlugs")(
  function* (basePath: string) {
    const version = yield* getFolderChildNamesCacheVersion();
    const cacheKey = getNestedSlugsCacheKey(version, basePath);

    return yield* nestedSlugsCache.get(cacheKey);
  }
);

/** Builds a versioned nested-slug cache key from the folder cache state. */
function getNestedSlugsCacheKey(version: number, basePath: string) {
  return `${version}${nestedSlugsCacheKeySeparator}${basePath}`;
}

/** Reads the base path from a versioned nested-slug cache key. */
function getNestedSlugsCacheBasePath(cacheKey: string) {
  const separatorIndex = cacheKey.indexOf(nestedSlugsCacheKeySeparator);

  return cacheKey.slice(separatorIndex + 1);
}

/** Scans nested slug paths for one cache key. */
function readNestedSlugsForCacheKey(cacheKey: string) {
  return Effect.gen(function* () {
    const basePath = getNestedSlugsCacheBasePath(cacheKey);
    const cleanBasePath = basePath === "" ? "." : cleanSlug(basePath);
    const results: string[][] = [];
    const stack: [string[], string][] = [[[], cleanBasePath]];

    for (;;) {
      const current = stack.pop();

      if (!current) {
        break;
      }

      const [pathSegments, fullPath] = current;
      const children = yield* getFolderChildNames(fullPath).pipe(
        Effect.catchTags({
          DirectoryReadError: () => Effect.succeed([]),
          InvalidPathError: () => Effect.succeed([]),
        })
      );

      if (children.length === 0) {
        if (pathSegments.length > 0) {
          results.push(pathSegments);
        }
        continue;
      }

      if (pathSegments.length > 0) {
        results.push([...pathSegments]);
      }

      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        const newSegments = [...pathSegments, child];
        const newFullPath =
          pathSegments.length === 0
            ? `${cleanBasePath}/${child}`
            : `${fullPath}/${child}`;

        stack.push([newSegments, newFullPath]);
      }
    }

    return results;
  });
}
