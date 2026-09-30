import { Effect, FileSystem, Path, Schema } from "effect";
import {
  effectTestViolations,
  inspectEffectSource,
} from "#scripts/check/effect";
import { readRepositoryFiles } from "#scripts/check/files";
import { inspectContextSource, inspectReactSource } from "#scripts/check/react";
import { sourceViolations as inspectSources } from "#scripts/check/source";
import { inspectTailwindSource } from "#scripts/check/tailwind";
import { runEntry } from "#scripts/entry";
import { writeError, writeOutput } from "#scripts/output";

const TEST_FILE_PATTERN = /\.test\.tsx?$/u;
const TSX_TEST_FILE_PATTERN = /\.test\.tsx$/u;
const SOURCE_FILE_PATTERN = /\.tsx?$/u;
const GENERATED_DIRECTORY = "_generated";
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

/** Expected failure while inspecting repository test ownership. */
class TestPolicyReadError extends Schema.TaggedError<TestPolicyReadError>()(
  "TestPolicyReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Returns whether a test has a colocated TypeScript Module with the same name. */
const hasColocatedOwner = Effect.fn("RepositoryPolicy.hasColocatedOwner")(
  function* (testPath: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    const ownerPath = testPath.replace(TEST_FILE_PATTERN, "");
    return yield* fileSystem.exists(`${ownerPath}.ts`);
  }
);

/** Validates test ownership, source policy, and repository layout. */
export const checkTestPolicy = Effect.fn("RepositoryPolicy.checkTests")(
  function* (root: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const files = yield* Effect.forEach(["apps", "packages"], (directory) =>
      readRepositoryFiles(path.join(root, directory), IGNORED_DIRECTORIES)
    ).pipe(Effect.map((groups) => groups.flat()));
    const scriptFiles = yield* readRepositoryFiles(
      path.join(root, "scripts"),
      IGNORED_DIRECTORIES
    );
    const tests = files.filter((file) => TEST_FILE_PATTERN.test(file));
    const effectTests = [...tests, ...scriptFiles].filter((file) =>
      TEST_FILE_PATTERN.test(file)
    );
    const ownership = yield* Effect.forEach(tests, (test) =>
      hasColocatedOwner(test).pipe(
        Effect.map((hasOwner) => ({ hasOwner, test }))
      )
    );
    const orphanTests = ownership
      .filter(({ hasOwner }) => !hasOwner)
      .map(({ test }) => test);
    const tsxTestFiles = tests.filter((test) =>
      TSX_TEST_FILE_PATTERN.test(test)
    );
    const nestedTestFiles = files.filter((file) =>
      file.split(path.sep).some((segment) => TEST_DIRECTORIES.has(segment))
    );
    const sources = yield* Effect.forEach(effectTests, (test) =>
      fileSystem.readFileString(test).pipe(
        Effect.map((sourceText) => ({ file: test, sourceText })),
        Effect.mapError(
          (cause) =>
            new TestPolicyReadError({
              cause,
              message: `Unable to read ${test}.`,
            })
        )
      )
    );
    const effectViolations = yield* effectTestViolations(sources);
    const authoredFiles = [...files, ...scriptFiles].filter(
      (file) =>
        SOURCE_FILE_PATTERN.test(file) &&
        !file.endsWith(".d.ts") &&
        !file.split(path.sep).includes(GENERATED_DIRECTORY)
    );
    const authoredSources = yield* Effect.forEach(authoredFiles, (file) =>
      fileSystem.readFileString(file).pipe(
        Effect.map((sourceText) => ({
          file: path.relative(root, file).split(path.sep).join("/"),
          sourceText,
        })),
        Effect.mapError(
          (cause) =>
            new TestPolicyReadError({
              cause,
              message: `Unable to read ${file}.`,
            })
        )
      )
    );
    const sourceViolations = yield* inspectSources(authoredSources, [
      inspectContextSource,
      inspectEffectSource,
      inspectReactSource,
    ]);
    const tailwindViolations = authoredSources.flatMap(({ file, sourceText }) =>
      inspectTailwindSource(file, sourceText)
    );

    if (
      orphanTests.length === 0 &&
      tsxTestFiles.length === 0 &&
      nestedTestFiles.length === 0 &&
      effectViolations.length === 0 &&
      sourceViolations.length === 0 &&
      tailwindViolations.length === 0
    ) {
      yield* writeOutput("Test ownership checks passed.\n");
      return 0;
    }

    if (orphanTests.length > 0) {
      yield* writeError(
        `Every final test must have a colocated .ts Module with the same name; React and TSX behavior belongs in Browser or E2E acceptance:\n${orphanTests
          .map((file) => `  - ${path.relative(root, file)}`)
          .join("\n")}\n`
      );
    }
    if (tsxTestFiles.length > 0) {
      yield* writeError(
        `Final code must not contain .test.tsx files:\n${tsxTestFiles
          .map((file) => `  - ${path.relative(root, file)}`)
          .join("\n")}\n`
      );
    }
    if (nestedTestFiles.length > 0) {
      yield* writeError(
        `Tests must not use __test__ or __tests__ folders:\n${nestedTestFiles
          .map((file) => `  - ${path.relative(root, file)}`)
          .join("\n")}\n`
      );
    }
    if (effectViolations.length > 0) {
      yield* writeError(`${effectViolations.join("\n")}\n`);
    }
    if (sourceViolations.length > 0) {
      yield* writeError(`${sourceViolations.join("\n")}\n`);
    }
    if (tailwindViolations.length > 0) {
      yield* writeError(`${tailwindViolations.join("\n")}\n`);
    }

    return 1;
  }
);

runEntry(import.meta.main, checkTestPolicy(process.cwd()));
