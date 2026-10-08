import { parseEnv } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  callCustomerIntegrityQuery,
  getCustomerConvexConfig,
  loadCustomerEnvProvider,
} from "@repo/backend/scripts/customers/convex";
import { getFunctionName, makeFunctionReference } from "convex/server";
import {
  Config,
  ConfigProvider,
  Effect,
  FileSystem,
  Layer,
  Path,
  PlatformError,
  Schema,
} from "effect";
import { FetchHttpClient } from "effect/http";

vi.mock("node:util", async (original) => {
  const actual = await original<typeof import("node:util")>();
  return { ...actual, parseEnv: vi.fn(actual.parseEnv) };
});
vi.mock("convex/server", async (original) => {
  const actual = await original<typeof import("convex/server")>();
  return { ...actual, getFunctionName: vi.fn(actual.getFunctionName) };
});

const config = { accessToken: "test-token", url: "https://test.convex.cloud" };
const query = makeFunctionReference<"query", { cursor: string }, number>(
  "customers/integrity:count"
);
const args = { cursor: "reviewed-cursor" };
const configured = ConfigProvider.fromEnvRecord({
  CONVEX_DEPLOY_KEY: "test-key",
  CONVEX_PROD_URL: "https://prod.example",
  CONVEX_URL: "https://dev.example",
});

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

/** The real path service beside a file system scripted for one test. */
const scriptedFiles = (fileSystem: Partial<FileSystem.FileSystem>) =>
  Layer.merge(Path.layer, FileSystem.layerNoop(fileSystem));

/** A file read that fails the test when the code under test reads a file it should not. */
const unexpectedRead = () =>
  vi.fn<FileSystem.FileSystem["readFileString"]>(() =>
    Effect.die("unexpected file read")
  );

/** Calls the reviewed query through the controlled fetch. */
function callQuery() {
  return callCustomerIntegrityQuery(config, query, args, Schema.Finite).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

beforeEach(() => {
  fetcher.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("customer audit configuration", () => {
  it.effect("uses the shell before backend-local values", () =>
    Effect.gen(function* () {
      vi.stubEnv("CONVEX_URL", "https://shell.example");
      const provider = yield* loadCustomerEnvProvider();
      const values = yield* Effect.all([
        Config.String("CONVEX_URL"),
        Config.String("CONVEX_PROD_URL"),
      ]).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider));
      expect(values).toEqual(["https://shell.example", "https://prod.example"]);
    }).pipe(
      Effect.provide(
        scriptedFiles({
          exists: () => Effect.succeed(true),
          readFileString: () =>
            Effect.succeed(
              "CONVEX_URL=https://file.example\nCONVEX_PROD_URL=https://prod.example"
            ),
        })
      )
    )
  );

  it.effect("works without a backend env file", () => {
    const readFileString = unexpectedRead();
    return Effect.gen(function* () {
      vi.stubEnv("CONVEX_URL", "https://shell.example");
      const provider = yield* loadCustomerEnvProvider();
      expect(
        yield* Config.String("CONVEX_URL").pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, provider)
        )
      ).toBe("https://shell.example");
      expect(readFileString).not.toHaveBeenCalled();
    }).pipe(Effect.provide(scriptedFiles({ readFileString })));
  });

  it.effect.each([
    {
      failure: PlatformError.systemError({
        _tag: "PermissionDenied",
        module: "FileSystem",
        method: "readFileString",
        description: "unreadable env",
      }),
      label: "a system failure",
    },
    {
      failure: PlatformError.badArgument({
        module: "FileSystem",
        method: "readFileString",
        description: "unreadable env",
      }),
      label: "a bad argument",
    },
  ])(
    "reports backend env read failures as configuration errors: $label",
    ({ failure }) =>
      Effect.gen(function* () {
        expect(
          yield* loadCustomerEnvProvider().pipe(Effect.flip)
        ).toMatchObject({
          _tag: "CustomerConvexConfigError",
          message: failure.message,
        });
      }).pipe(
        Effect.provide(
          scriptedFiles({
            exists: () => Effect.succeed(true),
            readFileString: () => Effect.fail(failure),
          })
        )
      )
  );

  it.effect.each([new Error("invalid env"), "invalid env"])(
    "reports an env parser failure as a configuration error: %s",
    (failure) =>
      Effect.gen(function* () {
        vi.mocked(parseEnv).mockImplementationOnce(() => {
          throw failure;
        });
        expect(
          yield* loadCustomerEnvProvider().pipe(Effect.flip)
        ).toMatchObject({
          _tag: "CustomerConvexConfigError",
          message: "invalid env",
        });
      }).pipe(
        Effect.provide(
          scriptedFiles({
            exists: () => Effect.succeed(true),
            readFileString: () =>
              Effect.succeed("CONVEX_URL=https://example.com"),
          })
        )
      )
  );

  it.effect.each([false, true])(
    "selects the exact deployment for prod=%s",
    (prod) => {
      const readFileString = unexpectedRead();
      return Effect.gen(function* () {
        expect(yield* getCustomerConvexConfig(prod)).toEqual({
          accessToken: "test-key",
          url: prod ? "https://prod.example" : "https://dev.example",
        });
        expect(readFileString).not.toHaveBeenCalled();
      }).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, configured),
        Effect.provide(scriptedFiles({ readFileString }))
      );
    }
  );

  it.effect.each([{}, { CONVEX_URL: "" }])(
    "rejects a missing deployment: %j",
    (values) =>
      Effect.gen(function* () {
        expect(
          yield* getCustomerConvexConfig(false).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "CustomerConvexConfigError",
          message: "CONVEX_URL is not configured for customer verification",
        });
      }).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnvRecord(values)
        ),
        Effect.provide(scriptedFiles({}))
      )
  );

  it.effect("uses local Convex login only when no deployment key exists", () =>
    Effect.gen(function* () {
      expect(yield* getCustomerConvexConfig(false)).toEqual({
        accessToken: "local-token",
        url: "https://dev.example",
      });
    }).pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnvRecord({ CONVEX_URL: "https://dev.example" })
      ),
      Effect.provide(
        scriptedFiles({
          readFileString: () => Effect.succeed('{"accessToken":"local-token"}'),
        })
      )
    )
  );

  it.effect.each([
    {
      source: undefined,
      message: "No CONVEX_DEPLOY_KEY and no local Convex login are available",
    },
    { source: "{", message: "The local Convex configuration is invalid" },
    {
      source: '{"accessToken":42}',
      message: "The local Convex configuration is invalid",
    },
    {
      source: "{}",
      message: "The local Convex configuration has no access token",
    },
  ])("rejects unusable local login: $message", ({ source, message }) =>
    Effect.gen(function* () {
      expect(
        yield* getCustomerConvexConfig(false).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "CustomerConvexAuthError",
        message,
      });
    }).pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnvRecord({ CONVEX_URL: "https://dev.example" })
      ),
      Effect.provide(
        scriptedFiles({
          readFileString: () =>
            source === undefined
              ? Effect.fail(
                  PlatformError.systemError({
                    _tag: "NotFound",
                    module: "FileSystem",
                    method: "readFileString",
                  })
                )
              : Effect.succeed(source),
        })
      )
    )
  );
});

describe("customer integrity query boundary", () => {
  it.effect("sends one authenticated query and validates its value", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(Response.json({ status: "success", value: 3 }));
      expect(yield* callQuery()).toBe(3);
      expect(fetcher).toHaveBeenCalledExactlyOnceWith(
        new URL("https://test.convex.cloud/api/query"),
        expect.objectContaining({
          headers: {
            authorization: "Convex test-token",
            "content-type": "application/json",
          },
          method: "POST",
        })
      );
      expect(
        yield* Effect.promise(
          (): Promise<unknown> =>
            new Response(fetcher.mock.calls[0]?.[1]?.body).json()
        )
      ).toEqual({ args, format: "json", path: "customers/integrity:count" });
    })
  );

  it.effect("fails before IO if the function reference cannot resolve", () =>
    Effect.gen(function* () {
      vi.mocked(getFunctionName).mockImplementationOnce(() => {
        throw new Error("invalid reference");
      });
      expect(yield* callQuery().pipe(Effect.flip)).toMatchObject({
        _tag: "CustomerConvexConfigError",
        message: "invalid reference",
      });
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect.each([
    { body: { status: "unknown" }, message: "Invalid Convex response:" },
    {
      body: { status: "success", value: "three" },
      message: "Invalid Convex value:",
    },
    {
      body: { status: "error", errorMessage: "Access denied" },
      message: "customers/integrity:count: Access denied",
    },
    {
      body: { status: "error" },
      message: "customers/integrity:count: Unknown Convex error",
    },
  ])("rejects an invalid query response: $message", ({ body, message }) =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(Response.json(body));
      expect(yield* callQuery().pipe(Effect.flip)).toMatchObject({
        _tag: "CustomerConvexResponseError",
        message: expect.stringContaining(message),
      });
    })
  );

  it.effect.each([
    {
      response: undefined,
      tag: "CustomerConvexRequestError",
      message: "offline",
    },
    {
      response: new Response("unauthorized", { status: 401 }),
      tag: "CustomerConvexRequestError",
      message: "HTTP 401 unauthorized",
    },
    {
      response: new Response("{"),
      tag: "CustomerConvexResponseError",
      message: "",
    },
  ])(
    "preserves typed transport failure: $tag $message",
    ({ response, tag, message }) =>
      Effect.gen(function* () {
        if (response === undefined) {
          fetcher.mockRejectedValue(new Error("offline"));
        } else {
          fetcher.mockResolvedValue(response);
        }
        expect(yield* callQuery().pipe(Effect.flip)).toMatchObject({
          _tag: tag,
          message: expect.stringContaining(message),
        });
      })
  );

  it.effect("reports an unreadable HTTP error body", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(
        new Response(
          new ReadableStream({
            /** Fails before the error body yields any bytes. */
            pull(controller) {
              controller.error(new Error("body interrupted"));
            },
          }),
          { status: 403 }
        )
      );
      expect(yield* callQuery().pipe(Effect.flip)).toMatchObject({
        _tag: "CustomerConvexResponseError",
        message: "body interrupted",
      });
    })
  );
});
