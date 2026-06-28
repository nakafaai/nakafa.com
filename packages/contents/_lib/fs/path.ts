import path from "node:path";
import { resolveContentsDir } from "@repo/contents/_lib/root";
import { InvalidPathError } from "@repo/contents/_shared/error";
import { cleanSlug } from "@repo/utilities/helper";
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

  if (exclude.length === 0) {
    return {
      folder,
    };
  }

  return {
    folder,
    exclude,
  };
}

/** Resolves a content-relative folder path into an absolute directory path. */
export function resolveContentFolderPath(folder: string) {
  return path.join(contentsDir, folder);
}

/** Returns whether an absolute path stays inside the expected root directory. */
export function isPathInsideDirectory(
  rootDirectory: string,
  targetPath: string
) {
  const relativePath = path.relative(rootDirectory, targetPath);

  if (relativePath === "") {
    return true;
  }

  if (relativePath.startsWith("..")) {
    return false;
  }

  return !path.isAbsolute(relativePath);
}

/** Resolves a slash-trimmed content path and rejects directory escape attempts. */
export function resolveSafeContentPath(
  filePath: string,
  basePath: string,
  message: string
) {
  const cleanPath = cleanSlug(filePath);
  const fullPath = path.join(basePath, cleanPath);

  if (isPathInsideDirectory(basePath, fullPath)) {
    return Effect.succeed(fullPath);
  }

  return Effect.fail(
    new InvalidPathError({
      message,
      path: filePath,
      reason: "Path traversal detected",
    })
  );
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
