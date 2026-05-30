import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const sourceExtensions = [".ts", ".tsx"] as const;
const ignoredSegments = [".devtools", ".turbo", "coverage", "node_modules"];
const relativeImportPattern = /from\s+["']\.{1,2}\//;
const namespaceImportPattern = /import\s+(?:type\s+)?\*\s+as\s+/;
const rawAnyPattern =
  /(:\s*any\b|<any\b|\bas any\b|\bany\[|Record<[^>]*any|Promise<any|Schema\.Any)/;

/** Reads every TypeScript source file in the AI package. */
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

        const entries = readdirSync(currentDirectory, { withFileTypes: true });

        for (const entry of entries) {
          if (ignoredSegments.includes(entry.name)) {
            continue;
          }

          const absolutePath = path.join(currentDirectory, entry.name);

          if (entry.isDirectory()) {
            pendingDirectories.push(absolutePath);
            continue;
          }

          if (
            sourceExtensions.some((extension) => entry.name.endsWith(extension))
          ) {
            files.push(absolutePath);
          }
        }
      }

      return files;
    })
  );
}

/** Reads one source file as UTF-8 text. */
function readSourceFile(filePath: string) {
  return Effect.runSync(Effect.sync(() => readFileSync(filePath, "utf8")));
}

/** Converts an absolute file path to an AI package path. */
function toPackagePath(filePath: string) {
  return path.relative(process.cwd(), filePath);
}

describe("AI architecture", () => {
  const sourceFiles = readSourceFiles(process.cwd()).filter(
    (filePath) => !filePath.endsWith(".test.ts")
  );

  it("uses alias imports instead of relative imports", () => {
    const matches = sourceFiles.flatMap((filePath) => {
      const source = readSourceFile(filePath);

      if (!relativeImportPattern.test(source)) {
        return [];
      }

      return [toPackagePath(filePath)];
    });

    expect(matches).toStrictEqual([]);
  });

  it("does not use namespace imports", () => {
    const matches = sourceFiles.flatMap((filePath) => {
      const source = readSourceFile(filePath);

      if (!namespaceImportPattern.test(source)) {
        return [];
      }

      return [toPackagePath(filePath)];
    });

    expect(matches).toStrictEqual([]);
  });

  it("does not use raw any", () => {
    const matches = sourceFiles.flatMap((filePath) => {
      const source = readSourceFile(filePath);

      if (!rawAnyPattern.test(source)) {
        return [];
      }

      return [toPackagePath(filePath)];
    });

    expect(matches).toStrictEqual([]);
  });
});
