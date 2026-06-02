import path from "node:path";
import { fileURLToPath } from "node:url";
import { Option } from "effect";

const CONTENTS_LIB_SEGMENT = `${path.sep}_lib${path.sep}`;
const APPS_WORKSPACE_SEGMENT = "apps";
const PACKAGES_WORKSPACE_SEGMENT = "packages";
const CONTENTS_PACKAGE_SEGMENT = "contents";

/**
 * Finds the `packages/contents` root boundary from a source file path.
 *
 * @param filePath - Absolute source file path from `import.meta.url`
 * @returns Absolute contents root path when the file lives under `_lib`
 */
function getContentsRootFromLibPath(filePath: string) {
  const boundaryIndex = filePath.lastIndexOf(CONTENTS_LIB_SEGMENT);

  if (boundaryIndex === -1) {
    return Option.none();
  }

  return Option.some(filePath.slice(0, boundaryIndex));
}

/**
 * Joins absolute path segments after workspace boundary detection.
 *
 * @param segments - Absolute path segments split on the current platform separator
 * @returns Absolute path rebuilt from the provided segments
 */
function joinAbsoluteSegments(segments: string[]) {
  return path.resolve(path.sep, ...segments.filter(Boolean));
}

/**
 * Derives the monorepo contents package path from a known workspace path.
 *
 * @param workspacePath - Absolute path inside the monorepo
 * @returns Contents package path when the workspace boundary is recognizable
 */
function getContentsRootFromWorkspacePath(workspacePath: string) {
  const segments = workspacePath.split(path.sep);
  const packagesIndex = segments.lastIndexOf(PACKAGES_WORKSPACE_SEGMENT);

  if (packagesIndex !== -1) {
    return Option.some(
      joinAbsoluteSegments([
        ...segments.slice(0, packagesIndex + 1),
        CONTENTS_PACKAGE_SEGMENT,
      ])
    );
  }

  const appsIndex = segments.lastIndexOf(APPS_WORKSPACE_SEGMENT);

  if (appsIndex !== -1) {
    return Option.some(
      joinAbsoluteSegments([
        ...segments.slice(0, appsIndex),
        PACKAGES_WORKSPACE_SEGMENT,
        CONTENTS_PACKAGE_SEGMENT,
      ])
    );
  }

  return Option.none();
}

/**
 * Resolves the runtime root of the `packages/contents` workspace.
 *
 * Next.js and Turbopack preserve package source locations for `import.meta.url`
 * in bundled server code. The contents runtime callers live under
 * `packages/contents/_lib`, so the package root can be derived directly from
 * the source path without probing parent folders at build time.
 *
 * When a runtime only exposes generated chunk paths, derive the contents root
 * from the workspace path shape instead of probing the filesystem.
 *
 * @param metaUrl - The current module `import.meta.url`
 * @returns Absolute path to the contents package root directory
 */
export function resolveContentsDir(metaUrl: string) {
  const filePath = fileURLToPath(metaUrl);
  const contentsRoot = getContentsRootFromLibPath(filePath);

  if (Option.isSome(contentsRoot)) {
    return contentsRoot.value;
  }

  const cwdContentsRoot = getContentsRootFromWorkspacePath(process.cwd());

  if (Option.isSome(cwdContentsRoot)) {
    return cwdContentsRoot.value;
  }

  const fileContentsRoot = getContentsRootFromWorkspacePath(filePath);

  if (Option.isSome(fileContentsRoot)) {
    return fileContentsRoot.value;
  }

  return path.resolve(process.cwd(), "packages/contents");
}
