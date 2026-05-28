import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
import { getUnknownMessage } from "@repo/backend/scripts/lib/errors";
import { ConfigProvider, Effect, Exit, Schema } from "effect";

const logWarningMock = vi.fn();

class ConvexTestError extends Schema.TaggedError<ConvexTestError>()(
  "ConvexTestError",
  {
    message: Schema.String,
  }
) {}

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

/** Restores Convex config mocks between sync-content tests. */
function resetConvexTestModules() {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("node:os");
  vi.unstubAllGlobals();
}

afterEach(resetConvexTestModules);

describe("sync-content Convex config", () => {
  beforeEach(() => {
    logWarningMock.mockReset();
    vi.doMock("@repo/backend/scripts/sync-content/logging", () => ({
      logWarning: logWarningMock,
    }));
  });

  it.effect("loads development and production Convex config", () =>
    Effect.gen(function* () {
      const result = yield* Effect.acquireUseRelease(
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
      );

      expect(result).toStrictEqual({
        dev: { accessToken: "token", url: "dev-url" },
        prod: { accessToken: "token", url: "prod-url" },
      });
      expect(logWarningMock).toHaveBeenCalledWith(
        "PRODUCTION MODE: Syncing to prod-url"
      );
    })
  );

  it.effect.each([
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
  ] as const)(
    "fails invalid Convex config states",
    ([effectFactory, message]) =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(effectFactory());

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          expect(exit.cause.toString()).toContain(message);
        }
      })
  );
});
