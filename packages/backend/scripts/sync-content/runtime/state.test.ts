import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import { getUnknownMessage } from "@repo/backend/scripts/lib/errors";
import { ConfigProvider, Effect, Exit, Schema } from "effect";

class RuntimeTestError extends Schema.TaggedError<RuntimeTestError>()(
  "RuntimeTestError",
  {
    message: Schema.String,
  }
) {}

/** Creates a temporary backend env file for one runtime state test. */
const createTempEnvFile = Effect.fn("runtimeTest.createTempEnvFile")(function* (
  content: string
) {
  return yield* Effect.try({
    try: () => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nakafa-sync-"));
      const envFile = path.join(directory, ".env.local");

      fs.writeFileSync(envFile, content);

      return { directory, envFile };
    },
    catch: (error) =>
      new RuntimeTestError({ message: getUnknownMessage(error) }),
  });
});

/** Removes a temporary directory created by a runtime state test. */
const removeTempDirectory = Effect.fn("runtimeTest.removeTempDirectory")(
  function* (directory: string) {
    yield* Effect.try({
      try: () => fs.rmSync(directory, { force: true, recursive: true }),
      catch: (error) =>
        new RuntimeTestError({ message: getUnknownMessage(error) }),
    }).pipe(Effect.orDie);
  }
);

/** Restores runtime module mocks between sync-content runtime tests. */
function resetRuntimeTestModules() {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("glob");
  vi.doUnmock("node:child_process");
  vi.doUnmock("node:fs");
  vi.doUnmock("node:util");
}

afterEach(resetRuntimeTestModules);

describe("sync-content runtime state", () => {
  it.effect("loads, saves, clears, and ignores invalid sync state files", () =>
    Effect.gen(function* () {
      const state = yield* Effect.acquireUseRelease(
        createTempEnvFile("CONVEX_URL=file-url\n"),
        ({ directory, envFile }) =>
          Effect.gen(function* () {
            const devStateFile = path.join(directory, ".sync-state.json");
            const prodStateFile = path.join(directory, ".sync-state.prod.json");

            yield* Effect.sync(() =>
              vi.doMock("@repo/backend/scripts/sync-content/paths", () => ({
                CONTENTS_DIR: directory,
                getBackendEnvFilePath: () => envFile,
                getSyncStateFile: (isProd: boolean) =>
                  isProd ? prodStateFile : devStateFile,
              }))
            );

            const { clearSyncState, loadSyncState, saveSyncState } =
              yield* Effect.tryPromise({
                try: () => import("@repo/backend/scripts/sync-content/runtime"),
                catch: (error) =>
                  new RuntimeTestError({ message: getUnknownMessage(error) }),
              });

            const missing = yield* loadSyncState(false);
            yield* saveSyncState(
              { lastSyncCommit: "commit-a", lastSyncTimestamp: 1 },
              false
            );
            const loaded = yield* loadSyncState(false);

            yield* Effect.sync(() => fs.writeFileSync(devStateFile, "{"));
            const invalidJson = yield* loadSyncState(false);

            yield* Effect.sync(() =>
              fs.writeFileSync(devStateFile, JSON.stringify({ wrong: true }))
            );
            const invalidShape = yield* loadSyncState(false);

            yield* saveSyncState(
              { lastSyncCommit: "commit-prod", lastSyncTimestamp: 2 },
              true
            );
            const prod = yield* loadSyncState(true);

            yield* clearSyncState(false);
            const devExistsAfterClear = fs.existsSync(devStateFile);
            yield* clearSyncState(false);

            return {
              devExistsAfterClear,
              invalidJson,
              invalidShape,
              loaded,
              missing,
              prod,
            };
          }),
        ({ directory }) => removeTempDirectory(directory)
      );

      expect(state).toStrictEqual({
        devExistsAfterClear: false,
        invalidJson: null,
        invalidShape: null,
        loaded: { lastSyncCommit: "commit-a", lastSyncTimestamp: 1 },
        missing: null,
        prod: { lastSyncCommit: "commit-prod", lastSyncTimestamp: 2 },
      });
    })
  );

  it.effect("fails save and clear state operations on filesystem errors", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Effect.acquireUseRelease(
          createTempEnvFile("CONVEX_URL=file-url\n"),
          ({ directory, envFile }) =>
            Effect.gen(function* () {
              const stateFile = path.join(directory, ".sync-state.json");
              const writeFileSyncMock = vi.fn(() => {
                throw new Error("write denied");
              });
              const unlinkSyncMock = vi.fn(() => {
                throw new Error("unlink denied");
              });

              yield* Effect.sync(() =>
                vi.doMock("node:fs", async () => {
                  const actual =
                    await vi.importActual<typeof import("node:fs")>("node:fs");

                  return {
                    ...actual,
                    unlinkSync: unlinkSyncMock,
                    writeFileSync: writeFileSyncMock,
                  };
                })
              );
              yield* Effect.sync(() =>
                vi.doMock("@repo/backend/scripts/sync-content/paths", () => ({
                  CONTENTS_DIR: directory,
                  getBackendEnvFilePath: () => envFile,
                  getSyncStateFile: () => stateFile,
                }))
              );

              const { clearSyncState, saveSyncState } =
                yield* Effect.tryPromise({
                  try: () =>
                    import("@repo/backend/scripts/sync-content/runtime"),
                  catch: (error) =>
                    new RuntimeTestError({
                      message: getUnknownMessage(error),
                    }),
                });

              const saveExit = yield* Effect.exit(
                saveSyncState(
                  { lastSyncCommit: "commit-a", lastSyncTimestamp: 1 },
                  false
                )
              );

              yield* Effect.sync(() => fs.writeFileSync(stateFile, "{}"));
              const clearExit = yield* Effect.exit(clearSyncState(false));

              return { clearExit, saveExit };
            }),
          ({ directory }) => removeTempDirectory(directory)
        )
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        expect(Exit.isFailure(exit.value.saveExit)).toBe(true);
        expect(Exit.isFailure(exit.value.clearExit)).toBe(true);
      }
    })
  );

  it.effect("handles env and state read failures from the filesystem", () =>
    Effect.gen(function* () {
      const result = yield* Effect.acquireUseRelease(
        createTempEnvFile("CONVEX_URL=file-url\n"),
        ({ directory, envFile }) =>
          Effect.gen(function* () {
            const readFileSyncMock = vi.fn(() => {
              throw new Error("read denied");
            });

            yield* Effect.sync(() =>
              vi.doMock("node:fs", async () => {
                const actual =
                  await vi.importActual<typeof import("node:fs")>("node:fs");

                return {
                  ...actual,
                  existsSync: () => true,
                  readFileSync: readFileSyncMock,
                };
              })
            );
            yield* Effect.sync(() =>
              vi.doMock("@repo/backend/scripts/sync-content/paths", () => ({
                CONTENTS_DIR: directory,
                getBackendEnvFilePath: () => envFile,
                getSyncStateFile: (isProd: boolean) =>
                  path.join(
                    directory,
                    isProd ? ".sync-state.prod.json" : ".sync-state.json"
                  ),
              }))
            );

            const { loadEnvProvider, loadSyncState } = yield* Effect.tryPromise(
              {
                try: () => import("@repo/backend/scripts/sync-content/runtime"),
                catch: (error) =>
                  new RuntimeTestError({ message: getUnknownMessage(error) }),
              }
            );

            const envExit = yield* Effect.exit(
              loadEnvProvider(ConfigProvider.fromMap(new Map()))
            );
            const state = yield* loadSyncState(false);

            return { envExit, state };
          }),
        ({ directory }) => removeTempDirectory(directory)
      );

      expect(Exit.isFailure(result.envExit)).toBe(true);
      if (Exit.isFailure(result.envExit)) {
        expect(result.envExit.cause.toString()).toContain("read denied");
      }
      expect(result.state).toBeNull();
    })
  );

  it.effect("reads git state, changed files, and globbed content files", () =>
    Effect.gen(function* () {
      const result = yield* Effect.acquireUseRelease(
        createTempEnvFile("CONVEX_URL=file-url\n"),
        ({ directory, envFile }) =>
          Effect.gen(function* () {
            const execSyncMock = vi
              .fn()
              .mockReturnValueOnce("commit-a\n")
              .mockImplementationOnce(() => {
                throw new Error("not git");
              })
              .mockReturnValueOnce(
                "packages/contents/subject/high-school/10/mathematics/a.mdx\n"
              )
              .mockReturnValueOnce("articles/politics/demo/id.mdx\n\n")
              .mockImplementationOnce(() => {
                throw new Error("cached failed");
              })
              .mockReturnValueOnce(
                "exercises/high-school/snbt/mathematics/x.mdx\n"
              );
            const globMock = vi
              .fn()
              .mockResolvedValueOnce([path.join(directory, "a.mdx")])
              .mockRejectedValueOnce(new Error("glob failed"));

            yield* Effect.sync(() =>
              vi.doMock("node:child_process", () => ({
                execSync: execSyncMock,
              }))
            );
            yield* Effect.sync(() =>
              vi.doMock("glob", () => ({ glob: globMock }))
            );
            yield* Effect.sync(() =>
              vi.doMock("@repo/backend/scripts/sync-content/paths", () => ({
                CONTENTS_DIR: directory,
                getBackendEnvFilePath: () => envFile,
                getSyncStateFile: (isProd: boolean) =>
                  path.join(
                    directory,
                    isProd ? ".sync-state.prod.json" : ".sync-state.json"
                  ),
              }))
            );

            const { getChangedFilesSince, getCurrentGitCommit, globFiles } =
              yield* Effect.tryPromise({
                try: () => import("@repo/backend/scripts/sync-content/runtime"),
                catch: (error) =>
                  new RuntimeTestError({ message: getUnknownMessage(error) }),
              });

            const currentCommit = yield* getCurrentGitCommit();
            const missingCommit = yield* getCurrentGitCommit();
            const changedFiles = yield* getChangedFilesSince("commit-a");
            const globbed = yield* globFiles("**/*.mdx");
            const globExit = yield* Effect.exit(globFiles("**/*.mdx"));

            return {
              changedFiles: [...changedFiles].sort(),
              currentCommit,
              globbed,
              globFailed: Exit.isFailure(globExit),
              missingCommit,
            };
          }),
        ({ directory }) => removeTempDirectory(directory)
      );

      expect(result).toStrictEqual({
        changedFiles: [
          path.join(
            result.globbed[0] ? path.dirname(result.globbed[0]) : "",
            "articles/politics/demo/id.mdx"
          ),
          path.join(
            result.globbed[0] ? path.dirname(result.globbed[0]) : "",
            "exercises/high-school/snbt/mathematics/x.mdx"
          ),
          path.join(
            result.globbed[0] ? path.dirname(result.globbed[0]) : "",
            "subject/high-school/10/mathematics/a.mdx"
          ),
        ],
        currentCommit: "commit-a",
        globbed: [path.join(path.dirname(result.globbed[0] ?? ""), "a.mdx")],
        globFailed: true,
        missingCommit: "",
      });
    })
  );
});
