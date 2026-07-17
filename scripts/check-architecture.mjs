import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const REPOSITORY_ROOT = process.cwd();
const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const TEST_DIRECTORIES = new Set(["__test__", "__tests__"]);
const TEST_FILE_PATTERN = /\.test\.tsx?$/;
const INDEX_SOURCE_FILE_PATTERN = /^index\.tsx?$/;
const IGNORED_DIRECTORIES = new Set([
  ".cache",
  ".devtools",
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);
const RELATIVE_IMPORT_PATTERN = /from\s+["']\.{1,2}\//;
const NAMESPACE_IMPORT_PATTERN = /import\s+(?:type\s+)?\*\s+as\s+/;
const RAW_ANY_PATTERN =
  /(:\s*any\b|<any\b|\bas any\b|\bany\[|Record<[^>]*any|Promise<any|Schema\.Any)/;
const IMPLICIT_CONTENT_DATA_IMPORT_PATTERN =
  /from\s+["']@repo\/contents\/[^"']+\/_data["']/;
const RAW_CONTENT_EFFECT_PATTERNS = [
  /\basync\b/,
  /\btry\s*\{/,
  /\bcatch\s*\(/,
  /new Promise/,
  /Effect\.catchAll/,
  /Data\.TaggedError/,
  /\bas any\b/,
];

function readFiles(directory) {
  const files = [];
  const pendingDirectories = [directory];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();

    if (!currentDirectory) {
      continue;
    }

    for (const entry of readdirSync(currentDirectory, {
      withFileTypes: true,
    })) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const absolutePath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        pendingDirectories.push(absolutePath);
        continue;
      }

      files.push(absolutePath);
    }
  }

  return files;
}

function isTypeScriptSource(filePath) {
  return SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension));
}

function isTestFile(filePath) {
  return TEST_FILE_PATTERN.test(filePath);
}

function toRepositoryPath(filePath) {
  return path.relative(REPOSITORY_ROOT, filePath);
}

function reportViolations(rule, filePaths) {
  if (filePaths.length === 0) {
    return [];
  }

  return [
    rule,
    ...filePaths.map((filePath) => `  - ${toRepositoryPath(filePath)}`),
  ];
}

function findTestOwnershipViolations(workspaceFiles) {
  return workspaceFiles.filter((filePath) => {
    if (!isTestFile(filePath)) {
      return false;
    }

    const ownerBase = filePath.replace(TEST_FILE_PATTERN, "");
    return !SOURCE_EXTENSIONS.some((extension) =>
      existsSync(`${ownerBase}${extension}`)
    );
  });
}

function findNestedTestFiles(workspaceFiles) {
  return workspaceFiles.filter((filePath) =>
    filePath.split(path.sep).some((segment) => TEST_DIRECTORIES.has(segment))
  );
}

function findPatternMatches(filePaths, patterns) {
  return filePaths.filter((filePath) => {
    const source = readFileSync(filePath, "utf8");
    return patterns.some((pattern) => pattern.test(source));
  });
}

function hasMdxDescendant(directory) {
  const pendingDirectories = [directory];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();

    if (!currentDirectory) {
      continue;
    }

    for (const entry of readdirSync(currentDirectory, {
      withFileTypes: true,
    })) {
      if (entry.isFile() && entry.name.endsWith(".mdx")) {
        return true;
      }

      if (entry.isDirectory()) {
        pendingDirectories.push(path.join(currentDirectory, entry.name));
      }
    }
  }

  return false;
}

const workspaceFiles = ["apps", "packages"].flatMap((directory) =>
  readFiles(path.join(REPOSITORY_ROOT, directory))
);
const aiSourceFiles = readFiles(
  path.join(REPOSITORY_ROOT, "packages/ai")
).filter((filePath) => isTypeScriptSource(filePath) && !isTestFile(filePath));
const contentsSourceFiles = readFiles(
  path.join(REPOSITORY_ROOT, "packages/contents")
).filter((filePath) => isTypeScriptSource(filePath) && !isTestFile(filePath));
const contentsLibraryFiles = contentsSourceFiles.filter(
  (filePath) =>
    filePath.includes(`${path.sep}_lib${path.sep}`) ||
    filePath.includes(`${path.sep}_shared${path.sep}`)
);
const materialSourceFiles = contentsSourceFiles.filter(
  (filePath) =>
    path.basename(filePath) === "source.ts" &&
    filePath.startsWith(
      path.join(REPOSITORY_ROOT, "packages/contents/material", path.sep)
    )
);

const violations = [
  ...reportViolations(
    "Every test must have an adjacent source Module with the same basename:",
    findTestOwnershipViolations(workspaceFiles)
  ),
  ...reportViolations(
    "Test files and setup must be colocated instead of nested in __test__ or __tests__:",
    findNestedTestFiles(workspaceFiles)
  ),
  ...reportViolations(
    "The AI package must use workspace aliases instead of relative imports:",
    findPatternMatches(aiSourceFiles, [RELATIVE_IMPORT_PATTERN])
  ),
  ...reportViolations(
    "The AI package must not use namespace imports:",
    findPatternMatches(aiSourceFiles, [NAMESPACE_IMPORT_PATTERN])
  ),
  ...reportViolations(
    "The AI package must not use raw any types:",
    findPatternMatches(aiSourceFiles, [RAW_ANY_PATTERN])
  ),
  ...reportViolations(
    "The contents package must use workspace aliases instead of relative imports:",
    findPatternMatches(contentsSourceFiles, [RELATIVE_IMPORT_PATTERN])
  ),
  ...reportViolations(
    "Content data imports must name an explicit path Module:",
    findPatternMatches(contentsSourceFiles, [
      IMPLICIT_CONTENT_DATA_IMPORT_PATTERN,
    ])
  ),
  ...reportViolations(
    "The contents package must not add index source Modules:",
    contentsSourceFiles.filter((filePath) =>
      INDEX_SOURCE_FILE_PATTERN.test(path.basename(filePath))
    )
  ),
  ...reportViolations(
    "Every material source.ts must remain beside its MDX assets:",
    materialSourceFiles.filter(
      (filePath) => !hasMdxDescendant(path.dirname(filePath))
    )
  ),
  ...reportViolations(
    "Contents library failures must remain inside typed Effect boundaries:",
    findPatternMatches(contentsLibraryFiles, RAW_CONTENT_EFFECT_PATTERNS)
  ),
];

if (violations.length > 0) {
  process.stderr.write(`${violations.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Architecture checks passed.\n");
}
