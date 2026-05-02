import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONTENTS_LIB_SEGMENT = `${path.sep}_lib${path.sep}`;
const CONTENTS_SENTINELS = ["articles", "exercises", "subject"];

/**
 * Checks whether a directory looks like the `packages/contents` root.
 *
 * @param directory - Absolute directory candidate to validate
 * @returns True when the directory contains the expected contents structure
 */
function isContentsDirectory(directory: string) {
  return CONTENTS_SENTINELS.every((entry) =>
    fs.existsSync(path.join(directory, entry))
  );
}

/**
 * Finds the `packages/contents` root boundary from a source file path.
 *
 * @param filePath - Absolute source file path from `import.meta.url`
 * @returns Absolute contents root path when the file lives under `_lib`
 */
function getContentsRootFromLibPath(filePath: string) {
  const boundaryIndex = filePath.lastIndexOf(CONTENTS_LIB_SEGMENT);

  if (boundaryIndex === -1) {
    return null;
  }

  return filePath.slice(0, boundaryIndex);
}

/**
 * Builds runtime root candidates for bundled server environments.
 *
 * @param filePath - Absolute file path from `import.meta.url`
 * @returns Ordered contents root candidates
 */
function getContentsRootCandidates(filePath: string) {
  const currentWorkingDirectory = process.cwd();
  const fallbackDirectory = path.resolve(path.dirname(filePath), "..");

  return [
    currentWorkingDirectory,
    path.resolve(currentWorkingDirectory, "packages/contents"),
    path.resolve(currentWorkingDirectory, "../packages/contents"),
    path.resolve(currentWorkingDirectory, "../../packages/contents"),
    fallbackDirectory,
  ];
}

/**
 * Resolves the runtime root of the `packages/contents` workspace.
 *
 * Next.js and Turbopack preserve package source locations for `import.meta.url`
 * in bundled server code. The contents runtime callers live under
 * `packages/contents/_lib`, so the package root can be derived directly from
 * the source path without probing parent folders at build time.
 *
 * When a runtime only exposes generated chunk paths, probe the current working
 * directory and nearby monorepo locations before falling back to the chunk
 * parent directory.
 *
 * @param metaUrl - The current module `import.meta.url`
 * @returns Absolute path to the contents package root directory
 */
export function resolveContentsDir(metaUrl: string) {
  const filePath = fileURLToPath(metaUrl);
  const contentsRoot = getContentsRootFromLibPath(filePath);

  if (contentsRoot) {
    return contentsRoot;
  }

  const candidates = getContentsRootCandidates(filePath);

  for (const candidate of new Set(candidates)) {
    if (isContentsDirectory(candidate)) {
      return candidate;
    }
  }

  return path.resolve(path.dirname(filePath), "..");
}
