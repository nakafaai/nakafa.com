import fs from "node:fs";
import path from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const SOURCE_EXTENSIONS = [".ts", ".tsx"] as const;
const REMOVED_WRAPPER_MODULES = [
  "_lib/articles/content.ts",
  "_lib/exercises/content.ts",
  "_lib/subject/content.ts",
] as const;
const REMOVED_ROOT_FACADE_MODULES = [
  "_lib/cache.ts",
  "_lib/params.ts",
] as const;
const RELATIVE_IMPORT_PATTERN = /from\s+["']\.{1,2}\//g;
const IMPLICIT_DATA_IMPORT_PATTERN =
  /from\s+["']@repo\/contents\/[^"']+\/_data["']/g;
const LEGACY_ROOT_FACADE_IMPORT_PATTERN =
  /from\s+["']@repo\/contents\/_lib\/(?:cache|params)["']/g;
const INDEX_SOURCE_FILE_PATTERN = /^index\.tsx?$/;
const TEST_FOLDER_PATTERNS = [
  `${path.sep}__test__${path.sep}`,
  `${path.sep}__tests__${path.sep}`,
] as const;
const RAW_EFFECT_BOUNDARY_PATTERNS = [
  /\basync\b/,
  /\btry\s*\{/,
  /\bcatch\s*\(/,
  /new Promise/,
  /Effect\.catchAll/,
  /Data\.TaggedError/,
  /\bas any\b/,
] as const;

/**
 * Reads all TypeScript source files under a directory.
 */
function readSourceFiles(directory: string) {
  return Effect.runSync(
    Effect.sync(() => {
      const files: string[] = [];
      const pendingDirectories = [directory];

      while (pendingDirectories.length > 0) {
        const currentDirectory = pendingDirectories.pop();
        if (!currentDirectory) {
          continue;
        }

        const entries = fs.readdirSync(currentDirectory, {
          withFileTypes: true,
        });

        for (const entry of entries) {
          const absolutePath = path.join(currentDirectory, entry.name);

          if (entry.isDirectory()) {
            pendingDirectories.push(absolutePath);
            continue;
          }

          if (
            SOURCE_EXTENSIONS.some((extension) =>
              entry.name.endsWith(extension)
            )
          ) {
            files.push(absolutePath);
          }
        }
      }

      return files;
    })
  );
}

/**
 * Reads a source file as UTF-8 text.
 */
function readSourceFile(filePath: string) {
  return Effect.runSync(Effect.sync(() => fs.readFileSync(filePath, "utf8")));
}

/**
 * Converts an absolute path to a repository-relative contents path.
 */
function toContentsPath(filePath: string) {
  return path.relative(process.cwd(), filePath);
}

describe("contents architecture", () => {
  const contentsDirectory = process.cwd();
  const sourceFiles = readSourceFiles(contentsDirectory);
  const productionSourceFiles = sourceFiles.filter(
    (filePath) =>
      !(
        filePath.endsWith(".test.ts") ||
        filePath.endsWith(".test.tsx") ||
        filePath.includes(`${path.sep}__test__${path.sep}`) ||
        filePath.includes(`${path.sep}__tests__${path.sep}`)
      )
  );
  const librarySourceFiles = productionSourceFiles.filter(
    (filePath) =>
      filePath.includes(`${path.sep}_lib${path.sep}`) ||
      filePath.includes(`${path.sep}_shared${path.sep}`)
  );

  it("uses alias imports instead of relative imports", () => {
    const relativeImportMatches = productionSourceFiles.flatMap((filePath) => {
      const source = readSourceFile(filePath);
      const matches = source.matchAll(RELATIVE_IMPORT_PATTERN);

      return Array.from(matches, () => toContentsPath(filePath));
    });

    expect(relativeImportMatches).toStrictEqual([]);
  });

  it("keeps material data imports on explicit path modules", () => {
    const implicitDataImports = productionSourceFiles.flatMap((filePath) => {
      const source = readSourceFile(filePath);
      const matches = source.matchAll(IMPLICIT_DATA_IMPORT_PATTERN);

      return Array.from(matches, () => toContentsPath(filePath));
    });

    expect(implicitDataImports).toStrictEqual([]);
  });

  it("does not keep scoped-content wrapper modules", () => {
    const existingWrapperModules = REMOVED_WRAPPER_MODULES.filter((filePath) =>
      fs.existsSync(path.join(contentsDirectory, filePath))
    );

    expect(existingWrapperModules).toStrictEqual([]);
  });

  it("does not keep root cache or params facade modules", () => {
    const existingRootFacades = REMOVED_ROOT_FACADE_MODULES.filter((filePath) =>
      fs.existsSync(path.join(contentsDirectory, filePath))
    );

    expect(existingRootFacades).toStrictEqual([]);
  });

  it("uses direct modules instead of restored root facade imports", () => {
    const legacyFacadeImports = productionSourceFiles.flatMap((filePath) => {
      const source = readSourceFile(filePath);
      const matches = source.matchAll(LEGACY_ROOT_FACADE_IMPORT_PATTERN);

      return Array.from(matches, () => toContentsPath(filePath));
    });

    expect(legacyFacadeImports).toStrictEqual([]);
  });

  it("does not use index source modules", () => {
    const indexSourceFiles = sourceFiles.filter((filePath) =>
      INDEX_SOURCE_FILE_PATTERN.test(path.basename(filePath))
    );

    expect(indexSourceFiles.map(toContentsPath)).toStrictEqual([]);
  });

  it("keeps tests colocated beside the module under test", () => {
    const nestedTestFiles = sourceFiles.filter((filePath) =>
      TEST_FOLDER_PATTERNS.some((pattern) => filePath.includes(pattern))
    );

    expect(nestedTestFiles.map(toContentsPath)).toStrictEqual([]);
  });

  it("keeps production library failures inside Effect boundaries", () => {
    const rawEffectBoundaryMatches = librarySourceFiles.flatMap((filePath) => {
      const source = readSourceFile(filePath);
      const hasRawBoundary = RAW_EFFECT_BOUNDARY_PATTERNS.some((pattern) =>
        pattern.test(source)
      );

      if (!hasRawBoundary) {
        return [];
      }

      return [toContentsPath(filePath)];
    });

    expect(rawEffectBoundaryMatches).toStrictEqual([]);
  });
});
