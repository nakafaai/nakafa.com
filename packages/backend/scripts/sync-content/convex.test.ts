import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import refs from "@repo/backend/confect/_generated/refs";
import { getUnknownMessage } from "@repo/backend/scripts/lib/errors";
import { logWarning } from "@repo/backend/scripts/sync-content/logging";
import { BatchDeleteResultSchema } from "@repo/backend/scripts/sync-content/schemas";
import { ConfigProvider, Effect, Exit, Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/backend/scripts/sync-content/logging", () => ({
  logWarning: vi.fn(),
}));

class ConvexTestError extends Schema.TaggedError<ConvexTestError>()(
  "ConvexTestError",
  {
    message: Schema.String,
  }
) {}

const config = {
  accessToken: "token",
  url: "https://example.convex.cloud",
};

const deleteArticlesBatch =
  refs.internal.contentSync.mutations.maintenance.deleteArticlesBatch;
const bulkSyncArticles =
  refs.internal.contentSync.mutations.articles.bulkSyncArticles;

/** Creates a temporary Convex CLI auth config under a fake home directory. */
const createTempConvexHome = Effect.fn("convexTest.createTempConvexHome")(
  function* (content?: string) {
    return yield* Effect.try({
      try: () => {
        const directory = fs.mkdtempSync(
          path.join(os.tmpdir(), "nakafa-convex-")
        );
        const convexDir = path.join(directory, ".convex");

        fs.mkdirSync(convexDir, { recursive: true });

        if (content !== undefined) {
          fs.writeFileSync(path.join(convexDir, "config.json"), content);
        }

        return directory;
      },
      catch: (error) =>
        new ConvexTestError({ message: getUnknownMessage(error) }),
    });
  }
);

/** Removes one temporary fake Convex home directory. */
const removeTempConvexHome = Effect.fn("convexTest.removeTempConvexHome")(
  function* (directory: string) {
    yield* Effect.try({
      try: () => fs.rmSync(directory, { force: true, recursive: true }),
      catch: (error) =>
        new ConvexTestError({ message: getUnknownMessage(error) }),
    }).pipe(Effect.orDie);
  }
);

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("node:os");
  vi.unstubAllGlobals();
});

describe("sync-content Convex client", () => {
  it("loads development and production Convex config", async () => {
    const result = await Effect.runPromise(
      Effect.acquireUseRelease(
        createTempConvexHome(JSON.stringify({ accessToken: "token" })),
        (home) =>
          Effect.gen(function* () {
            yield* Effect.sync(() =>
              vi.doMock("node:os", async () => {
                const actual =
                  await vi.importActual<typeof import("node:os")>("node:os");

                return { ...actual, homedir: () => home };
              })
            );

            const { getConvexConfig } = yield* Effect.tryPromise({
              try: () => import("@repo/backend/scripts/sync-content/convex"),
              catch: (error) =>
                new ConvexTestError({ message: getUnknownMessage(error) }),
            });

            const dev = yield* getConvexConfig().pipe(
              Effect.withConfigProvider(
                ConfigProvider.fromMap(new Map([["CONVEX_URL", "dev-url"]]))
              )
            );
            const prod = yield* getConvexConfig({ prod: true }).pipe(
              Effect.withConfigProvider(
                ConfigProvider.fromMap(
                  new Map([["CONVEX_PROD_URL", "prod-url"]])
                )
              )
            );

            return { dev, prod };
          }),
        removeTempConvexHome
      )
    );

    expect(result).toStrictEqual({
      dev: { accessToken: "token", url: "dev-url" },
      prod: { accessToken: "token", url: "prod-url" },
    });
    expect(logWarning).toHaveBeenCalledWith(
      "PRODUCTION MODE: Syncing to prod-url"
    );
  });

  it.each([
    [
      () =>
        Effect.gen(function* () {
          const { getConvexConfig } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          return yield* getConvexConfig().pipe(
            Effect.withConfigProvider(ConfigProvider.fromMap(new Map()))
          );
        }),
      "CONVEX_URL not set",
    ],
    [
      () =>
        Effect.gen(function* () {
          const { getConvexConfig } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          return yield* getConvexConfig({ prod: true }).pipe(
            Effect.withConfigProvider(ConfigProvider.fromMap(new Map()))
          );
        }),
      "CONVEX_PROD_URL not set",
    ],
    [
      () =>
        Effect.acquireUseRelease(
          createTempConvexHome(),
          (home) =>
            Effect.gen(function* () {
              yield* Effect.sync(() =>
                vi.doMock("node:os", async () => {
                  const actual =
                    await vi.importActual<typeof import("node:os")>("node:os");

                  return { ...actual, homedir: () => home };
                })
              );
              const { getConvexConfig } = yield* Effect.tryPromise({
                try: () => import("@repo/backend/scripts/sync-content/convex"),
                catch: (error) =>
                  new ConvexTestError({ message: getUnknownMessage(error) }),
              });

              return yield* getConvexConfig().pipe(
                Effect.withConfigProvider(
                  ConfigProvider.fromMap(new Map([["CONVEX_URL", "dev-url"]]))
                )
              );
            }),
          removeTempConvexHome
        ),
      "Not authenticated",
    ],
    [
      () =>
        Effect.acquireUseRelease(
          createTempConvexHome("{"),
          (home) =>
            Effect.gen(function* () {
              yield* Effect.sync(() =>
                vi.doMock("node:os", async () => {
                  const actual =
                    await vi.importActual<typeof import("node:os")>("node:os");

                  return { ...actual, homedir: () => home };
                })
              );
              const { getConvexConfig } = yield* Effect.tryPromise({
                try: () => import("@repo/backend/scripts/sync-content/convex"),
                catch: (error) =>
                  new ConvexTestError({ message: getUnknownMessage(error) }),
              });

              return yield* getConvexConfig().pipe(
                Effect.withConfigProvider(
                  ConfigProvider.fromMap(new Map([["CONVEX_URL", "dev-url"]]))
                )
              );
            }),
          removeTempConvexHome
        ),
      "Invalid Convex config",
    ],
    [
      () =>
        Effect.acquireUseRelease(
          createTempConvexHome(JSON.stringify({ accessToken: 1 })),
          (home) =>
            Effect.gen(function* () {
              yield* Effect.sync(() =>
                vi.doMock("node:os", async () => {
                  const actual =
                    await vi.importActual<typeof import("node:os")>("node:os");

                  return { ...actual, homedir: () => home };
                })
              );
              const { getConvexConfig } = yield* Effect.tryPromise({
                try: () => import("@repo/backend/scripts/sync-content/convex"),
                catch: (error) =>
                  new ConvexTestError({ message: getUnknownMessage(error) }),
              });

              return yield* getConvexConfig().pipe(
                Effect.withConfigProvider(
                  ConfigProvider.fromMap(new Map([["CONVEX_URL", "dev-url"]]))
                )
              );
            }),
          removeTempConvexHome
        ),
      "Invalid Convex config",
    ],
    [
      () =>
        Effect.acquireUseRelease(
          createTempConvexHome(JSON.stringify({ wrong: true })),
          (home) =>
            Effect.gen(function* () {
              yield* Effect.sync(() =>
                vi.doMock("node:os", async () => {
                  const actual =
                    await vi.importActual<typeof import("node:os")>("node:os");

                  return { ...actual, homedir: () => home };
                })
              );
              const { getConvexConfig } = yield* Effect.tryPromise({
                try: () => import("@repo/backend/scripts/sync-content/convex"),
                catch: (error) =>
                  new ConvexTestError({ message: getUnknownMessage(error) }),
              });

              return yield* getConvexConfig().pipe(
                Effect.withConfigProvider(
                  ConfigProvider.fromMap(new Map([["CONVEX_URL", "dev-url"]]))
                )
              );
            }),
          removeTempConvexHome
        ),
      "No access token",
    ],
  ])("fails invalid Convex config states", async (effectFactory, message) => {
    const exit = await Effect.runPromiseExit(effectFactory());

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain(message);
    }
  });

  it("calls a Convex endpoint with encoded refs and decoded returns", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          status: "success",
          value: { deleted: 2, hasMore: false },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { callConvex } = await import(
      "@repo/backend/scripts/sync-content/convex"
    );

    const result = await Effect.runPromise(
      callConvex(
        config,
        "mutation",
        deleteArticlesBatch,
        {},
        BatchDeleteResultSchema
      )
    );

    expect(result).toStrictEqual({ deleted: 2, hasMore: false });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.convex.cloud/api/mutation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Convex token",
        },
        body: JSON.stringify({
          path: "contentSync/mutations/maintenance:deleteArticlesBatch",
          args: {},
          format: "json",
        }),
      }
    );
  });

  it.each([
    [
      () =>
        Effect.gen(function* () {
          const { callConvex } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          return yield* callConvex(
            config,
            "mutation",
            bulkSyncArticles,
            {},
            BatchDeleteResultSchema
          );
        }),
      "Invalid Convex args",
    ],
    [
      () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue("network failed"));
        return Effect.gen(function* () {
          const { callConvex } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          return yield* callConvex(
            config,
            "mutation",
            deleteArticlesBatch,
            {},
            BatchDeleteResultSchema
          );
        });
      },
      "network failed",
    ],
    [
      () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            json: () => Promise.reject(new Error("json failed")),
          })
        );
        return Effect.gen(function* () {
          const { callConvex } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          return yield* callConvex(
            config,
            "mutation",
            deleteArticlesBatch,
            {},
            BatchDeleteResultSchema
          );
        });
      },
      "json failed",
    ],
    [
      () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            json: () =>
              Promise.resolve({ status: "error", errorMessage: "bad" }),
          })
        );
        return Effect.gen(function* () {
          const { callConvex } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          return yield* callConvex(
            config,
            "mutation",
            deleteArticlesBatch,
            {},
            BatchDeleteResultSchema
          );
        });
      },
      "bad",
    ],
    [
      () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            json: () => Promise.resolve({ status: "error" }),
          })
        );
        return Effect.gen(function* () {
          const { callConvex } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          return yield* callConvex(
            config,
            "mutation",
            deleteArticlesBatch,
            {},
            BatchDeleteResultSchema
          );
        });
      },
      "Unknown Convex error",
    ],
    [
      () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            json: () => Promise.resolve({ status: "unknown" }),
          })
        );
        return Effect.gen(function* () {
          const { callConvex } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          return yield* callConvex(
            config,
            "mutation",
            deleteArticlesBatch,
            {},
            BatchDeleteResultSchema
          );
        });
      },
      "Invalid Convex response",
    ],
    [
      () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            json: () =>
              Promise.resolve({
                status: "success",
                value: { deleted: "two", hasMore: false },
              }),
          })
        );
        return Effect.gen(function* () {
          const { callConvex } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          return yield* callConvex(
            config,
            "mutation",
            deleteArticlesBatch,
            {},
            BatchDeleteResultSchema
          );
        });
      },
      "Invalid Convex value",
    ],
    [
      () => {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            json: () =>
              Promise.resolve({
                status: "success",
                value: { deleted: 2, hasMore: false },
              }),
          })
        );
        return Effect.gen(function* () {
          const { callConvex } = yield* Effect.tryPromise({
            try: () => import("@repo/backend/scripts/sync-content/convex"),
            catch: (error) =>
              new ConvexTestError({ message: getUnknownMessage(error) }),
          });

          return yield* callConvex(
            config,
            "mutation",
            deleteArticlesBatch,
            {},
            Schema.Struct({
              deleted: Schema.Literal(1),
              hasMore: Schema.Boolean,
            })
          );
        });
      },
      "Invalid Convex value",
    ],
  ])("fails invalid Convex calls", async (effectFactory, message) => {
    const exit = await Effect.runPromiseExit(effectFactory());

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain(message);
    }
  });
});
