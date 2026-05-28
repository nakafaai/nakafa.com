import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import { getUnknownMessage } from "@repo/backend/scripts/lib/errors";
import { Config, ConfigProvider, Effect, Exit, Schema } from "effect";

class RuntimeTestError extends Schema.TaggedError<RuntimeTestError>()(
  "RuntimeTestError",
  {
    message: Schema.String,
  }
) {}

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

/** Restores runtime module mocks between sync-content runtime tests. */
function resetRuntimeTestModules() {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("node:fs");
  vi.doUnmock("node:util");
}

afterEach(resetRuntimeTestModules);

describe("sync-content runtime env", () => {
  it.effect(
    "loads the default Effect config provider without env override",
    () =>
      Effect.gen(function* () {
        const provider = yield* Effect.acquireUseRelease(
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
        );

        expect(provider).toBeDefined();
      })
  );

  it.effect(
    "uses provided config provider when backend .env.local is absent",
    () =>
      Effect.gen(function* () {
        const value = yield* Effect.acquireUseRelease(
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
        );

        expect(value).toBe("shell-url");
      })
  );

  it.effect.each([
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
  ])("$name", ({ content, expected, shell }) =>
    Effect.gen(function* () {
      const value = yield* Effect.acquireUseRelease(
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
      );

      expect(value).toBe(expected);
    })
  );

  it.effect("fails env provider loading when dotenv parsing fails", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
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
                      throw new Error("invalid env");
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
    })
  );

  it.effect(
    "skips undefined dotenv entries when building the env provider",
    () =>
      Effect.gen(function* () {
        const value = yield* Effect.acquireUseRelease(
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
        );

        expect(value).toStrictEqual({
          convexUrl: "shell-url",
          fallbackOnly: "fallback",
        });
      })
  );
});
