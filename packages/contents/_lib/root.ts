import path from "node:path";
import { fileURLToPath } from "node:url";

const CONTENTS_LIB_SEGMENT = `${path.sep}_lib${path.sep}`;

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
 * Resolves the runtime root of the `packages/contents` workspace.
 *
 * Next.js and Turbopack preserve package source locations for `import.meta.url`
 * in bundled server code. The contents runtime callers live under
 * `packages/contents/_lib`, so the package root can be derived directly from
 * the source path without probing parent folders at build time.
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

  return path.dirname(filePath);
}
