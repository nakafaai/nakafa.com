import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanSlug } from "@repo/contents/_lib/helpers";
import {
  DirectoryReadError,
  InvalidPathError,
} from "@repo/contents/_shared/error";
import { Effect } from "effect";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contentsDir = path.dirname(__dirname);

const DEFAULT_EXCLUDE = ["_", "node_modules", ".", "coverage"] as const;

/**
 * Validates that a folder path is safe for use within the contents directory.
 *
 * Ensures the path does not contain parent directory references (..) and
 * is not an absolute path, preventing directory traversal attacks.
 *
 * @param folder - The folder path to validate
 * @returns Effect that succeeds if path is valid, fails with InvalidPathError otherwise
 *
 * @example
 * ```ts
 * const result = Effect.runSync(validatePath("subject/math"));
 * // Returns: undefined (success)
 * ```
 */
function validatePath(folder: string): Effect.Effect<void, InvalidPathError> {
  if (folder.includes("..")) {
    return Effect.fail(
      new InvalidPathError({ reason: "Path contains '..'", path: folder })
    );
  }

  if (path.isAbsolute(folder)) {
    return Effect.fail(
      new InvalidPathError({ reason: "Path is absolute", path: folder })
    );
  }

  return Effect.void;
}

/**
 * Reads a directory synchronously and returns its entries as Dirent objects.
 *
 * @param dirPath - The absolute path to the directory to read
 * @returns Effect that resolves to array of Dirent objects or fails with DirectoryReadError
 *
 * @example
 * ```ts
 * const files = Effect.runSync(readDirectorySync("/some/path"));
 * // Returns: [Dirent { name: "file.txt", ... }, Dirent { name: "folder", ... }]
 * ```
 */
function readDirectorySync(
  dirPath: string
): Effect.Effect<fs.Dirent[], DirectoryReadError> {
  return Effect.try({
    try: () => fs.readdirSync(dirPath, { withFileTypes: true }),
    catch: (cause) => new DirectoryReadError({ path: dirPath, cause }),
  });
}

/**
 * Checks if a directory name should be excluded based on exclusion patterns.
 *
 * @param name - The directory name to check
 * @param excludeItems - Array of exclusion patterns (exact match or prefix match)
 * @returns True if the directory should be excluded, false otherwise
 *
 * @example
 * ```ts
 * shouldExclude("_private", ["_", "."]); // Returns: true
 * shouldExclude("node_modules", ["_", "node_modules"]); // Returns: true
 * shouldExclude("content", ["_"]); // Returns: false
 * ```
 */
function shouldExclude(name: string, excludeItems: readonly string[]): boolean {
  for (const excludeItem of excludeItems) {
    if (name === excludeItem || name.startsWith(excludeItem)) {
      return true;
    }
  }
  return false;
}

/**
 * Filters directory entries to return only directory names that match exclusion criteria.
 *
 * @param files - Array of Dirent objects from a directory read operation
 * @param defaultExclude - Array of default exclusion patterns
 * @param customExclude - Optional array of additional exclusion patterns
 * @returns Array of directory names that passed all filters
 *
 * @example
 * ```ts
 * const files = [
 *   { name: "folder1", isDirectory: () => true },
 *   { name: "_private", isDirectory: () => true },
 *   { name: "file.txt", isDirectory: () => false },
 * ];
 * const result = filterDirectoryNames(files, ["_", "."], ["temp"]);
 * // Returns: ["folder1"]
 * ```
 */
function filterDirectoryNames(
  files: fs.Dirent[],
  defaultExclude: readonly string[],
  customExclude?: string[]
): string[] {
  const dirNames: string[] = [];
  const hasCustomExclude = customExclude && customExclude.length > 0;

  for (const dirent of files) {
    if (!dirent.isDirectory()) {
      continue;
    }

    const name = dirent.name;

    if (shouldExclude(name, defaultExclude)) {
      continue;
    }

    if (hasCustomExclude && shouldExclude(name, customExclude)) {
      continue;
    }

    dirNames.push(name);
  }

  return dirNames;
}

/**
 * Gets child directory names for a given folder within the contents directory.
 *
 * @param folder - The relative path to the folder from the contents directory
 * @param exclude - Optional array of additional directory names to exclude
 * @returns Effect that resolves to array of child directory names
 *
 * @example
 * ```ts
 * const names = Effect.runSync(getFolderChildNames("subject/math"));
 * // Returns: ["algebra", "calculus", "geometry"]
 * ```
 */
export function getFolderChildNames(
  folder: string,
  exclude?: string[]
): Effect.Effect<string[], InvalidPathError | DirectoryReadError> {
  return Effect.gen(function* () {
    yield* validatePath(folder);

    const contentDir = path.join(contentsDir, folder);
    const files = yield* readDirectorySync(contentDir);

    return filterDirectoryNames(files, DEFAULT_EXCLUDE, exclude);
  });
}

/**
 * Gets all nested slugs for a given base path using iterative DFS traversal.
 *
 * @param basePath - The base path to start traversal from (empty string for root)
 * @returns Array of slug paths, where each path is an array of segment names
 *
 * @example
 * ```ts
 * const slugs = getNestedSlugs("");
 * // Returns: [["math"], ["math", "algebra"], ["physics"], ["physics", "mechanics"]]
 * ```
 */
export function getNestedSlugs(basePath: string): string[][] {
  const cleanBasePath = basePath === "" ? "." : cleanSlug(basePath);
  const results: string[][] = [];

  const stack: [string[], string][] = [[[], cleanBasePath]];
  let stackIndex = stack.length - 1;

  while (stackIndex >= 0) {
    const [pathSegments, fullPath] = stack[stackIndex];
    stack.splice(stackIndex, 1);
    stackIndex--;

    const children = Effect.runSync(
      Effect.match(getFolderChildNames(fullPath), {
        onFailure: (error) => {
          Effect.logError("Failed to get folder child names", error);
          return [];
        },
        onSuccess: (dirNames) => dirNames,
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

    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      const newSegments = [...pathSegments, child];
      const newFullPath =
        pathSegments.length === 0
          ? `${cleanBasePath}/${child}`
          : `${fullPath}/${child}`;
      stack.push([newSegments, newFullPath]);
    }

    stackIndex = stack.length - 1;
  }

  return results;
}
