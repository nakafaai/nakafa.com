import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { getUnknownMessage } from "@repo/backend/scripts/lib/errors";
import { Config, ConfigProvider, Effect, Exit, Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

class RuntimeTestError extends Schema.TaggedError<RuntimeTestError>()(
  "RuntimeTestError",
  {
    message: Schema.String,
  }
) {}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("glob");
  vi.doUnmock("node:child_process");
  vi.doUnmock("node:fs");
  vi.doUnmock("node:util");
});

/** Creates a temporary backend env file for one runtime config test. */
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

/** Removes a temporary directory created by a runtime config test. */
const removeTempDirectory = Effect.fn("runtimeTest.removeTempDirectory")(
  function* (directory: string) {
    yield* Effect.try({
      try: () => fs.rmSync(directory, { force: true, recursive: true }),
      catch: (error) =>
        new RuntimeTestError({ message: getUnknownMessage(error) }),
    }).pipe(Effect.orDie);
  }
);

describe("sync-content runtime", () => {
  it("loads the default Effect config provider when no env override is passed", async () => {
    const provider = await Effect.runPromise(
      Effect.acquireUseRelease(
        createTempEnvFile("CONVEX_URL=file-url\n"),
        ({ directory, envFile }) =>
          Effect.gen(function* () {
            yield* Effect.sync(() => fs.unlinkSync(envFile));
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

            const { loadEnvProvider } = yield* Effect.tryPromise({
              try: () => import("@repo/backend/scripts/sync-content/runtime"),
              catch: (error) =>
                new RuntimeTestError({ message: getUnknownMessage(error) }),
            });

            return yield* loadEnvProvider();
          }),
        ({ directory }) => removeTempDirectory(directory)
      )
    );

    expect(provider).toBeDefined();
  });

  it("uses only the provided config provider when backend .env.local is absent", async () => {
    const value = await Effect.runPromise(
      Effect.acquireUseRelease(
        createTempEnvFile("CONVEX_URL=file-url\n"),
        ({ directory, envFile }) =>
          Effect.gen(function* () {
            yield* Effect.sync(() => fs.unlinkSync(envFile));
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

            const { loadEnvProvider } = yield* Effect.tryPromise({
              try: () => import("@repo/backend/scripts/sync-content/runtime"),
              catch: (error) =>
                new RuntimeTestError({ message: getUnknownMessage(error) }),
            });
            const provider = yield* loadEnvProvider(
              ConfigProvider.fromMap(new Map([["CONVEX_URL", "shell-url"]]))
            );

            return yield* Config.string("CONVEX_URL").pipe(
              Effect.withConfigProvider(provider)
            );
          }),
        ({ directory }) => removeTempDirectory(directory)
      )
    );

    expect(value).toBe("shell-url");
  });

  it.each([
    {
      content: "CONVEX_URL=file-url\n",
      expected: "shell-url",
      name: "keeps explicit shell environment above backend .env.local",
      shell: "shell-url",
    },
    {
      content: 'CONVEX_URL="file-url"\n',
      expected: "file-url",
      name: "falls back to dotenv-quoted backend .env.local",
      shell: null,
    },
  ])("$name", async ({ content, expected, shell }) => {
    const value = await Effect.runPromise(
      Effect.acquireUseRelease(
        createTempEnvFile(content),
        ({ envFile }) =>
          Effect.gen(function* () {
            yield* Effect.sync(() =>
              vi.doMock(
                "@repo/backend/scripts/sync-content/paths",
                async () => {
                  const actual = await vi.importActual<
                    typeof import("@repo/backend/scripts/sync-content/paths")
                  >("@repo/backend/scripts/sync-content/paths");

                  return {
                    ...actual,
                    getBackendEnvFilePath: () => envFile,
                  };
                }
              )
            );

            const { loadEnvProvider } = yield* Effect.tryPromise({
              try: () => import("@repo/backend/scripts/sync-content/runtime"),
              catch: (error) =>
                new RuntimeTestError({ message: getUnknownMessage(error) }),
            });
            const shellValues =
              shell === null
                ? new Map<string, string>()
                : new Map([["CONVEX_URL", shell]]);
            const provider = yield* loadEnvProvider(
              ConfigProvider.fromMap(shellValues)
            );

            return yield* Config.string("CONVEX_URL").pipe(
              Effect.withConfigProvider(provider)
            );
          }),
        ({ directory }) => removeTempDirectory(directory)
      )
    );

    expect(value).toBe(expected);
  });

  it("fails env provider loading when dotenv parsing fails", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.acquireUseRelease(
        createTempEnvFile("CONVEX_URL=file-url\n"),
        ({ directory, envFile }) =>
          Effect.gen(function* () {
            yield* Effect.sync(() =>
              vi.doMock("node:util", async () => {
                const actual =
                  await vi.importActual<typeof import("node:util")>(
                    "node:util"
                  );

                return {
                  ...actual,
                  parseEnv: () => {
                    Effect.runSync(Effect.die(new Error("invalid env")));
                  },
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

            const { loadEnvProvider } = yield* Effect.tryPromise({
              try: () => import("@repo/backend/scripts/sync-content/runtime"),
              catch: (error) =>
                new RuntimeTestError({ message: getUnknownMessage(error) }),
            });

            return yield* loadEnvProvider(ConfigProvider.fromMap(new Map()));
          }),
        ({ directory }) => removeTempDirectory(directory)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain("invalid env");
    }
  });

  it("skips undefined dotenv entries when building the env provider", async () => {
    const value = await Effect.runPromise(
      Effect.acquireUseRelease(
        createTempEnvFile("CONVEX_URL=file-url\n"),
        ({ directory, envFile }) =>
          Effect.gen(function* () {
            yield* Effect.sync(() =>
              vi.doMock("node:util", async () => {
                const actual =
                  await vi.importActual<typeof import("node:util")>(
                    "node:util"
                  );

                return {
                  ...actual,
                  parseEnv: () => ({
                    CONVEX_URL: undefined,
                    FALLBACK_ONLY: "fallback",
                  }),
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

            const { loadEnvProvider } = yield* Effect.tryPromise({
              try: () => import("@repo/backend/scripts/sync-content/runtime"),
              catch: (error) =>
                new RuntimeTestError({ message: getUnknownMessage(error) }),
            });
            const provider = yield* loadEnvProvider(
              ConfigProvider.fromMap(new Map([["CONVEX_URL", "shell-url"]]))
            );

            return yield* Config.all({
              convexUrl: Config.string("CONVEX_URL"),
              fallbackOnly: Config.string("FALLBACK_ONLY"),
            }).pipe(Effect.withConfigProvider(provider));
          }),
        ({ directory }) => removeTempDirectory(directory)
      )
    );

    expect(value).toStrictEqual({
      convexUrl: "shell-url",
      fallbackOnly: "fallback",
    });
  });

  it("loads, saves, clears, and ignores invalid sync state files", async () => {
    const state = await Effect.runPromise(
      Effect.acquireUseRelease(
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
              missing,
              loaded,
              invalidJson,
              invalidShape,
              prod,
              devExistsAfterClear,
            };
          }),
        ({ directory }) => removeTempDirectory(directory)
      )
    );

    expect(state).toStrictEqual({
      missing: null,
      loaded: { lastSyncCommit: "commit-a", lastSyncTimestamp: 1 },
      invalidJson: null,
      invalidShape: null,
      prod: { lastSyncCommit: "commit-prod", lastSyncTimestamp: 2 },
      devExistsAfterClear: false,
    });
  });

  it("fails save and clear state operations on filesystem errors", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.acquireUseRelease(
        createTempEnvFile("CONVEX_URL=file-url\n"),
        ({ directory, envFile }) =>
          Effect.gen(function* () {
            const stateFile = path.join(directory, ".sync-state.json");
            const writeFileSyncMock = vi.fn(() =>
              Effect.runSync(Effect.die(new Error("write denied")))
            );
            const unlinkSyncMock = vi.fn(() =>
              Effect.runSync(Effect.die(new Error("unlink denied")))
            );

            yield* Effect.sync(() =>
              vi.doMock("node:fs", async () => {
                const actual =
                  await vi.importActual<typeof import("node:fs")>("node:fs");

                return {
                  ...actual,
                  writeFileSync: writeFileSyncMock,
                  unlinkSync: unlinkSyncMock,
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

            const { clearSyncState, saveSyncState } = yield* Effect.tryPromise({
              try: () => import("@repo/backend/scripts/sync-content/runtime"),
              catch: (error) =>
                new RuntimeTestError({ message: getUnknownMessage(error) }),
            });

            const saveExit = yield* Effect.exit(
              saveSyncState(
                { lastSyncCommit: "commit-a", lastSyncTimestamp: 1 },
                false
              )
            );

            yield* Effect.sync(() => fs.writeFileSync(stateFile, "{}"));
            const clearExit = yield* Effect.exit(clearSyncState(false));

            return { saveExit, clearExit };
          }),
        ({ directory }) => removeTempDirectory(directory)
      )
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(Exit.isFailure(exit.value.saveExit)).toBe(true);
      expect(Exit.isFailure(exit.value.clearExit)).toBe(true);
    }
  });

  it("handles env and state read failures from the filesystem", async () => {
    const result = await Effect.runPromise(
      Effect.acquireUseRelease(
        createTempEnvFile("CONVEX_URL=file-url\n"),
        ({ directory, envFile }) =>
          Effect.gen(function* () {
            const readFileSyncMock = vi.fn(() =>
              Effect.runSync(Effect.die("read denied"))
            );

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
      )
    );

    expect(Exit.isFailure(result.envExit)).toBe(true);
    if (Exit.isFailure(result.envExit)) {
      expect(result.envExit.cause.toString()).toContain("read denied");
    }
    expect(result.state).toBeNull();
  });

  it("reads git state, changed files, and globbed content files", async () => {
    const result = await Effect.runPromise(
      Effect.acquireUseRelease(
        createTempEnvFile("CONVEX_URL=file-url\n"),
        ({ directory, envFile }) =>
          Effect.gen(function* () {
            const execSyncMock = vi
              .fn()
              .mockReturnValueOnce("commit-a\n")
              .mockImplementationOnce(() => {
                Effect.runSync(Effect.die(new Error("not git")));
              })
              .mockReturnValueOnce(
                "packages/contents/subject/high-school/10/mathematics/a.mdx\n"
              )
              .mockReturnValueOnce("articles/politics/demo/id.mdx\n\n")
              .mockImplementationOnce(() => {
                Effect.runSync(Effect.die(new Error("cached failed")));
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
              currentCommit,
              missingCommit,
              changedFiles: [...changedFiles].sort(),
              globbed,
              globFailed: Exit.isFailure(globExit),
            };
          }),
        ({ directory }) => removeTempDirectory(directory)
      )
    );

    expect(result).toStrictEqual({
      currentCommit: "commit-a",
      missingCommit: "",
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
      globbed: [path.join(path.dirname(result.globbed[0] ?? ""), "a.mdx")],
      globFailed: true,
    });
  });
});
