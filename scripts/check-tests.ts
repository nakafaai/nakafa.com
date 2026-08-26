import { NodeRuntime, NodeServices } from "@effect/platform-node";
import {
  EFFECT_TEST_ADAPTER,
  inspectEffectTestRunnerPolicy,
} from "@repo/testing/effect-test-policy";
import { Effect, FileSystem, Path, Schema } from "effect";
import { writeError, writeOutput } from "./output.ts";

const TEST_FILE_PATTERN = /\.test\.tsx?$/u;
const TSX_TEST_FILE_PATTERN = /\.test\.tsx$/u;
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

/** Collects repository files without traversing generated output. */
const readFiles = Effect.fn("RepositoryPolicy.readFiles")(function* (
  directory: string
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files: string[] = [];
  const pending = [directory];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }

    const entries = yield* fileSystem.readDirectory(current).pipe(
      Effect.mapError(
        (cause) =>
          new TestPolicyReadError({
            cause,
            message: `Unable to read ${current}.`,
          })
      )
    );
    for (const entry of entries) {
      if (IGNORED_DIRECTORIES.has(entry)) {
        continue;
      }

      const entryPath = path.join(current, entry);
      const info = yield* fileSystem.stat(entryPath).pipe(
        Effect.mapError(
          (cause) =>
            new TestPolicyReadError({
              cause,
              message: `Unable to inspect ${entryPath}.`,
            })
        )
      );
      if (info.type === "Directory") {
        pending.push(entryPath);
      } else {
        files.push(entryPath);
      }
    }
  }

  return files;
});

/** Returns whether a test has a colocated TypeScript Module with the same name. */
const hasColocatedOwner = Effect.fn("RepositoryPolicy.hasColocatedOwner")(
  function* (testPath: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    const ownerPath = testPath.replace(TEST_FILE_PATTERN, "");
    return yield* fileSystem.exists(`${ownerPath}.ts`);
  }
);

/** Reads one test module for Effect runner policy inspection. */
const readTestSource = Effect.fn("RepositoryPolicy.readTestSource")(function* (
  root: string,
  testPath: string
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const source = yield* fileSystem.readFileString(testPath).pipe(
    Effect.mapError(
      (cause) =>
        new TestPolicyReadError({
          cause,
          message: `Unable to read ${testPath}.`,
        })
    )
  );
  return { path: path.relative(root, testPath), source };
});

/** Validates test ownership and final repository test layout. */
export const checkTestPolicy = Effect.fn("RepositoryPolicy.checkTests")(
  function* (root: string) {
    const path = yield* Path.Path;
    const files = yield* Effect.forEach(
      ["apps", "packages", "scripts"],
      (directory) => readFiles(path.join(root, directory))
    ).pipe(Effect.map((groups) => groups.flat()));
    const tests = files.filter((file) => TEST_FILE_PATTERN.test(file));
    const ownership = yield* Effect.forEach(tests, (test) =>
      hasColocatedOwner(test).pipe(
        Effect.map((hasOwner) => ({ hasOwner, test }))
      )
    );
    const testSources = yield* Effect.forEach(
      tests,
      (test) => readTestSource(root, test),
      { concurrency: 16 }
    );
    const effectRunnerProblems = inspectEffectTestRunnerPolicy(testSources);
    const orphanTests = ownership
      .filter(({ hasOwner }) => !hasOwner)
      .map(({ test }) => test);
    const tsxTestFiles = tests.filter((test) =>
      TSX_TEST_FILE_PATTERN.test(test)
    );
    const nestedTestFiles = files.filter((file) =>
      file.split(path.sep).some((segment) => TEST_DIRECTORIES.has(segment))
    );

    if (
      orphanTests.length === 0 &&
      tsxTestFiles.length === 0 &&
      nestedTestFiles.length === 0 &&
      effectRunnerProblems.resolvedBaselineFiles.length === 0 &&
      effectRunnerProblems.unexpectedRunnerFiles.length === 0
    ) {
      yield* writeOutput("Test ownership and Effect runner checks passed.\n");
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
    if (effectRunnerProblems.unexpectedRunnerFiles.length > 0) {
      yield* writeError(
        `Effectful tests must use ${EFFECT_TEST_ADAPTER} methods instead of direct Effect runtime calls:\n${effectRunnerProblems.unexpectedRunnerFiles
          .map((file) => `  - ${file}`)
          .join("\n")}\n`
      );
    }
    if (effectRunnerProblems.resolvedBaselineFiles.length > 0) {
      yield* writeError(
        `Remove resolved Effect runner migration baseline entries in the same checkpoint:\n${effectRunnerProblems.resolvedBaselineFiles
          .map((file) => `  - ${file}`)
          .join("\n")}\n`
      );
    }

    return 1;
  }
);

if (import.meta.main) {
  NodeRuntime.runMain(
    checkTestPolicy(process.cwd()).pipe(
      Effect.tap((status) =>
        status === 0
          ? Effect.void
          : Effect.sync(() => {
              process.exitCode = status;
            })
      ),
      Effect.provide(NodeServices.layer)
    )
  );
}
