import path from "node:path";
import { resolveContentsDir } from "@repo/contents/_lib/root";
import { InvalidPathError } from "@repo/contents/_shared/error";
import { Effect } from "effect";

const contentsDir = resolveContentsDir(import.meta.url);

/** Builds a stable cache key for one child-folder scan. */
export function getFolderChildNamesCacheKey(
  folder: string,
  exclude?: string[]
) {
  return exclude && exclude.length > 0
    ? `${folder}\0${exclude.join("\0")}`
    : folder;
}

/** Reads a child-folder cache key back into scan parameters. */
export function getFolderChildNamesCacheParts(cacheKey: string) {
  const [folder, ...exclude] = cacheKey.split("\0");

  return {
    folder,
    exclude: exclude.length > 0 ? exclude : undefined,
  };
}

/** Resolves a content-relative folder path into an absolute directory path. */
export function resolveContentFolderPath(folder: string) {
  return path.join(contentsDir, folder);
}

/** Rejects unsafe folder paths before filesystem access. */
export function validateContentFolderPath(folder: string) {
  if (folder.includes("..")) {
    return Effect.fail(
      new InvalidPathError({
        message: "Path contains parent directory traversal.",
        path: folder,
        reason: "Path contains '..'",
      })
    );
  }

  if (path.isAbsolute(folder)) {
    return Effect.fail(
      new InvalidPathError({
        message: "Absolute paths are not allowed in content lookups.",
        path: folder,
        reason: "Path is absolute",
      })
    );
  }

  return Effect.void;
}
