import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONTENTS_SENTINELS = ["articles", "exercises", "subject"];

/**
 * Checks whether a directory looks like the `packages/contents` root.
 *
 * The contents package is treated as valid only when all required runtime
 * folders exist. This keeps filesystem lookups stable in local development,
 * tests, and production bundles where `import.meta.url` may resolve inside
 * generated server chunks.
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
 * Resolves the runtime root of the `packages/contents` workspace.
 *
 * On Vercel and in Next.js production bundles, modules can be executed from
 * generated chunk locations instead of the original source file path. This
 * helper prefers `process.cwd()`-relative monorepo locations first, then falls
 * back to the source-relative path derived from `import.meta.url`.
 *
 * @param metaUrl - The current module `import.meta.url`
 * @returns Absolute path to the contents package root directory
 */
export function resolveContentsDir(metaUrl: string) {
  const currentWorkingDirectory = process.cwd();
  const fallbackDirectory = path.resolve(
    path.dirname(fileURLToPath(metaUrl)),
    ".."
  );

  const candidates = [
    currentWorkingDirectory,
    path.resolve(currentWorkingDirectory, "packages/contents"),
    path.resolve(currentWorkingDirectory, "../packages/contents"),
    path.resolve(currentWorkingDirectory, "../../packages/contents"),
    fallbackDirectory,
  ];

  for (const candidate of new Set(candidates)) {
    if (isContentsDirectory(candidate)) {
      return candidate;
    }
  }

  return fallbackDirectory;
}
