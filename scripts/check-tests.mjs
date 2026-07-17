import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const REPOSITORY_ROOT = process.cwd();
const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const TEST_FILE_PATTERN = /\.test\.tsx?$/;
const TEST_DIRECTORIES = new Set(["__test__", "__tests__"]);
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".react-email",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);

/** Collects repository files without traversing generated output. */
function readFiles(directory) {
  const files = [];
  const pending = [directory];

  while (pending.length > 0) {
    const current = pending.pop();

    if (!current) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const entryPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        pending.push(entryPath);
        continue;
      }

      files.push(entryPath);
    }
  }

  return files;
}

/** Returns whether a test has a colocated source Module with the same name. */
function hasColocatedOwner(testPath) {
  const ownerPath = testPath.replace(TEST_FILE_PATTERN, "");
  return SOURCE_EXTENSIONS.some((extension) =>
    existsSync(`${ownerPath}${extension}`)
  );
}

const files = ["apps", "packages"].flatMap((directory) =>
  readFiles(path.join(REPOSITORY_ROOT, directory))
);
const tests = files.filter((file) => TEST_FILE_PATTERN.test(file));
const orphanTests = tests.filter((test) => !hasColocatedOwner(test));
const nestedTestFiles = files.filter((file) =>
  file.split(path.sep).some((segment) => TEST_DIRECTORIES.has(segment))
);

if (orphanTests.length === 0 && nestedTestFiles.length === 0) {
  process.stdout.write("Test ownership checks passed.\n");
  process.exit(0);
}

if (orphanTests.length > 0) {
  process.stderr.write(
    `Every test must have a colocated source Module with the same name:\n${orphanTests
      .map((file) => `  - ${path.relative(REPOSITORY_ROOT, file)}`)
      .join("\n")}\n`
  );
}

if (nestedTestFiles.length > 0) {
  process.stderr.write(
    `Tests must not use __test__ or __tests__ folders:\n${nestedTestFiles
      .map((file) => `  - ${path.relative(REPOSITORY_ROOT, file)}`)
      .join("\n")}\n`
  );
}

process.exitCode = 1;
