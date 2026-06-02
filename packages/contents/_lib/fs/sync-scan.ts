import fs from "node:fs";
import { filterDirectoryNames } from "@repo/contents/_lib/fs/filter";
import {
  getFolderChildNamesCacheParts,
  resolveContentFolderPath,
  validateContentFolderPath,
} from "@repo/contents/_lib/fs/path";
import { DirectoryReadError } from "@repo/contents/_shared/error";
import { Effect } from "effect";

/** Reads a directory synchronously and reports failures through Effect. */
export function readDirectorySync(dirPath: string) {
  return Effect.try({
    try: () => fs.readdirSync(dirPath, { withFileTypes: true }),
    catch: (cause) =>
      new DirectoryReadError({
        cause,
        message: "Unable to read content directory.",
        path: dirPath,
      }),
  });
}

/** Reads and filters child directory names for a cache lookup key. */
export function readFolderChildNamesForCacheKey(cacheKey: string) {
  return Effect.gen(function* () {
    const { folder, exclude } = getFolderChildNamesCacheParts(cacheKey);

    yield* validateContentFolderPath(folder);

    const contentDir = resolveContentFolderPath(folder);
    const files = yield* readDirectorySync(contentDir);

    return filterDirectoryNames(files, exclude);
  });
}
