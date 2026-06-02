import path from "node:path";
import { filterDirectoryNames } from "@repo/contents/_lib/fs/filter";
import {
  getFolderChildNamesCacheParts,
  resolveContentFolderPath,
  validateContentFolderPath,
} from "@repo/contents/_lib/fs/path";
import { ContentIO } from "@repo/contents/_lib/io/content-io";
import { DirectoryReadError } from "@repo/contents/_shared/error";
import { Effect } from "effect";

/** Directory entry shape used by content scans without exposing Node Dirent. */
export interface ContentDirectoryEntry {
  isDirectory: () => boolean;
  isFile: () => boolean;
  name: string;
}

function toContentDirectoryEntry(
  name: string,
  type: "File" | "Directory" | string
) {
  return {
    name,
    isDirectory: () => type === "Directory",
    isFile: () => type === "File",
  };
}

/** Reads directory entries through the native Effect Platform filesystem. */
export function readContentDirectoryEntries(dirPath: string) {
  return Effect.gen(function* () {
    const childNames = yield* ContentIO.readDirectory(dirPath);

    return yield* Effect.forEach(
      childNames,
      (name) =>
        ContentIO.stat(path.join(dirPath, name)).pipe(
          Effect.map((info) => toContentDirectoryEntry(name, info.type))
        ),
      { concurrency: "unbounded" }
    );
  }).pipe(
    Effect.provide(ContentIO.Default),
    Effect.mapError(
      (cause) =>
        new DirectoryReadError({
          cause,
          message: "Unable to read content directory.",
          path: dirPath,
        })
    )
  );
}

/** Reads recursive content-relative directory paths through Effect Platform. */
export function readContentDirectoryPaths(dirPath: string) {
  return ContentIO.readDirectory(dirPath, { recursive: true }).pipe(
    Effect.provide(ContentIO.Default),
    Effect.mapError(
      (cause) =>
        new DirectoryReadError({
          cause,
          message: "Unable to read content directory.",
          path: dirPath,
        })
    )
  );
}

/** Reads and filters child directory names for a cache lookup key. */
export function readFolderChildNamesForCacheKey(cacheKey: string) {
  return Effect.gen(function* () {
    const { folder, exclude } = getFolderChildNamesCacheParts(cacheKey);

    yield* validateContentFolderPath(folder);

    const contentDir = resolveContentFolderPath(folder);
    const entries = yield* readContentDirectoryEntries(contentDir);

    return filterDirectoryNames(entries, exclude);
  });
}
