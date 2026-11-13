import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  LocalConvex,
  localConvexLayer,
  makeLocalConvex,
  readRows,
} from "@repo/backend/scripts/content/acceptance/convex";
import { nodePlatform } from "@repo/backend/test/platform";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Layer,
  MutableList,
  Schema,
} from "effect";
import { Base64 } from "effect/encoding";
import { FetchHttpClient, HttpClient } from "effect/http";

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock(
  "@repo/backend/scripts/content/acceptance/local",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/scripts/content/acceptance/local")
    >()),
    readLocalRuntime: mocks.read,
  })
);

const fetcher = vi.fn<typeof fetch>();
const decodeJson = Schema.decodeUnknownSync(JsonTextSchema);

const URL_ROOT = "http://127.0.0.1:3210";
const OPENING_FAILED = /^school opening failed: /u;
const ADMIN_KEY = "local-admin-key";

/** One request the backend double received: its path with query, its authorization, and its body. */
const Received = Schema.Struct({
  authorization: Schema.NullOr(Schema.String),
  body: Schema.String,
  path: Schema.String,
});

/**
 * A backend that answers each request through `answer` by its path, and keeps
 * every request in the order it came.
 */
const serve = (
  answer: (path: string, body: string) => Response | Promise<Response>
) => {
  const received = MutableList.make<typeof Received.Type>();
  fetcher.mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const path = `${url.pathname}${url.search}`;
    const body =
      init?.body instanceof Uint8Array
        ? new TextDecoder().decode(init.body)
        : String(init?.body ?? "");
    MutableList.append(received, {
      authorization: new Headers(init?.headers).get("authorization"),
      body,
      path,
    });
    return await answer(path, body);
  });
  return () => MutableList.toArray(received);
};

const json = (value: unknown, status = 200) =>
  new Response(encodeJsonText(value), {
    headers: { "content-type": "application/json" },
    status,
  });

/** The local backend over the stubbed fetch. */
const backend = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient;
  return makeLocalConvex(client, { adminKey: ADMIN_KEY, url: URL_ROOT });
});

const withFetch = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );

describe("the local backend over HTTP", () => {
  afterEach(() => {
    fetcher.mockReset();
    vi.resetAllMocks();
  });

  it.effect(
    "runs a function as the admin, with its component, and answers its value",
    () =>
      withFetch(
        Effect.gen(function* () {
          const received = serve(() =>
            json({ status: "success", value: "user-1" })
          );
          const convex = yield* backend;

          const value = yield* convex.run("Learner username", {
            args: { userId: "user-1" },
            component: "authUsername",
            path: "public:getUsername",
          });

          expect(value).toBe("user-1");
          const [request] = received();
          expect(request?.path).toBe("/api/function");
          expect(request?.authorization).toBe(`Convex ${ADMIN_KEY}`);
          expect(decodeJson(request?.body ?? "")).toEqual({
            args: { userId: "user-1" },
            componentPath: "authUsername",
            format: "json",
            path: "public:getUsername",
          });
        })
      )
  );

  it.effect("acts as the identity a call names, after the admin key", () =>
    withFetch(
      Effect.gen(function* () {
        const received = serve(() => json({ status: "success", value: null }));
        const convex = yield* backend;
        const identity = { sessionId: "session-1", subject: "user-1" };

        yield* convex.run("Nina turn", {
          args: {},
          identity,
          path: "nina/turns:start",
        });

        expect(received()[0]?.authorization).toBe(
          `Convex ${ADMIN_KEY}:${Base64.encode(encodeJsonText(identity))}`
        );
      })
    )
  );

  it.effect(
    "fails with the function's own error, without the admin key or a sensitive value",
    () =>
      withFetch(
        Effect.gen(function* () {
          serve(() =>
            json(
              {
                errorMessage: `Uncaught Error: no session token-1 for ${ADMIN_KEY}`,
                status: "error",
              },
              560
            )
          );
          const convex = yield* backend;

          const error = yield* convex
            .run(
              "Learner session",
              { args: {}, path: "auth/core:signInWithUsernamePassword" },
              ["token-1"]
            )
            .pipe(Effect.asVoid, Effect.flip);

          expect(error.message).toBe(
            "Learner session failed: Uncaught Error: no session [redacted] for [redacted]"
          );
        })
      )
  );

  it.effect("fails with the status and text of any other answer", () =>
    withFetch(
      Effect.gen(function* () {
        serve(() => new Response("Bad Gateway", { status: 502 }));
        const convex = yield* backend;

        const error = yield* convex
          .run("school opening", { args: {}, path: "tenancy/provision:open" })
          .pipe(Effect.asVoid, Effect.flip);

        expect(error.message).toBe("school opening failed: 502 Bad Gateway");
      })
    )
  );

  it.effect(
    "fails with the status alone when an error's text cannot be read",
    () =>
      withFetch(
        Effect.gen(function* () {
          serve(
            () =>
              new Response(
                new ReadableStream({
                  start: (controller) => controller.error(new Error("cut")),
                }),
                { status: 502 }
              )
          );
          const convex = yield* backend;

          const error = yield* convex
            .run("school opening", { args: {}, path: "tenancy/provision:open" })
            .pipe(Effect.asVoid, Effect.flip);

          expect(error.message).toBe("school opening failed: 502");
        })
      )
  );

  it.effect(
    "fails when the backend cannot be reached, or answers no JSON",
    () =>
      withFetch(
        Effect.gen(function* () {
          fetcher.mockRejectedValueOnce(new TypeError("fetch failed"));
          const convex = yield* backend;
          const unreachable = yield* convex
            .run("school opening", { args: {}, path: "tenancy/provision:open" })
            .pipe(Effect.asVoid, Effect.flip);
          serve(() => new Response("<html>", { status: 200 }));
          const garbled = yield* convex
            .run("school opening", { args: {}, path: "tenancy/provision:open" })
            .pipe(Effect.asVoid, Effect.flip);
          serve(() => json({ status: "pending" }));
          const unknown = yield* convex
            .run("school opening", { args: {}, path: "tenancy/provision:open" })
            .pipe(Effect.asVoid, Effect.flip);

          expect(unreachable.message).toMatch(OPENING_FAILED);
          expect(garbled.message).toMatch(OPENING_FAILED);
          expect(unknown.message).toMatch(OPENING_FAILED);
        })
      )
  );

  it.live(
    "appends rows through an upload, waits for the confirmation, confirms, and waits for the import to complete",
    () =>
      withFetch(
        Effect.gen(function* () {
          // The import works a moment, waits for its confirmation, then completes.
          const states = [
            "in_progress",
            "waiting_for_confirmation",
            "completed",
          ] as const;
          const read = MutableList.make<string>();
          const received = serve((path) => {
            if (path === "/api/import/start_upload") {
              return json({ uploadToken: "upload-1" });
            }
            if (path.startsWith("/api/import/upload_part")) {
              return json("part-1");
            }
            if (path === "/api/import/finish_upload") {
              return json({ importId: "import-1" });
            }
            if (path === "/api/perform_import") {
              return json({});
            }
            MutableList.append(read, path);
            return json({
              status: "success",
              value: {
                state: {
                  state: states[Math.min(read.length, states.length) - 1],
                },
              },
            });
          });
          const convex = yield* backend;

          yield* convex.importRows("chats", [
            { type: "study" },
            { type: "study" },
          ]);

          const requests = received();
          expect(Arr.map(requests, (request) => request.path)).toEqual([
            "/api/import/start_upload",
            "/api/import/upload_part?partNumber=1&uploadToken=upload-1",
            "/api/import/finish_upload",
            "/api/function",
            "/api/function",
            "/api/perform_import",
            "/api/function",
          ]);
          expect(requests[1]?.body).toBe('{"type":"study"}\n{"type":"study"}');
          expect(decodeJson(requests[2]?.body ?? "")).toEqual({
            import: { format: "jsonLines", mode: "append", tableName: "chats" },
            partTokens: ["part-1"],
            uploadToken: "upload-1",
          });
          expect(decodeJson(requests[5]?.body ?? "")).toEqual({
            importId: "import-1",
          });
          expect(
            Arr.every(
              requests,
              (request) =>
                request.authorization?.startsWith(`Convex ${ADMIN_KEY}`) ===
                true
            )
          ).toBe(true);
        })
      )
  );

  it.effect("confirms nothing for an import that completes on its own", () =>
    withFetch(
      Effect.gen(function* () {
        const received = serve((path) => {
          if (path === "/api/import/start_upload") {
            return json({ uploadToken: "upload-1" });
          }
          if (path === "/api/import/finish_upload") {
            return json({ importId: "import-1" });
          }
          if (path === "/api/function") {
            return json({
              status: "success",
              value: { state: { state: "completed" } },
            });
          }
          return json("part-1");
        });
        const convex = yield* backend;

        yield* convex.importRows("chats", [{ type: "study" }]);

        expect(
          Arr.some(
            received(),
            (request) => request.path === "/api/perform_import"
          )
        ).toBe(false);
      })
    )
  );

  it.effect(
    "fails an import that failed, with the reason the backend gave",
    () =>
      withFetch(
        Effect.gen(function* () {
          serve((path) => {
            if (path === "/api/import/start_upload") {
              return json({ uploadToken: "upload-1" });
            }
            if (path === "/api/import/finish_upload") {
              return json({ importId: "import-1" });
            }
            if (path === "/api/function") {
              return json({
                status: "success",
                value: {
                  state: {
                    error_message: "Table chats is invalid",
                    state: "failed",
                  },
                },
              });
            }
            return json("part-1");
          });
          const convex = yield* backend;

          const error = yield* convex
            .importRows("chats", [{ type: "study" }])
            .pipe(Effect.flip);

          expect(error.message).toBe(
            "chats import failed: Table chats is invalid"
          );
        })
      )
  );

  it.effect("reads a table page by page, newest first, up to its limit", () =>
    Effect.gen(function* () {
      const asked = MutableList.make<unknown>();
      const run = (_operation: string, call: { readonly args: unknown }) =>
        Effect.sync(() => {
          MutableList.append(asked, call.args);
          return asked.length === 1
            ? {
                continueCursor: "page-2",
                isDone: false,
                page: [{ n: 1 }, { n: 2 }],
              }
            : { continueCursor: "", isDone: false, page: [{ n: 3 }, { n: 4 }] };
        });

      const rows = yield* readRows(
        run,
        "tenants",
        Schema.Struct({ n: Schema.Finite }),
        3
      );

      expect(rows).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
      expect(MutableList.toArray(asked)).toEqual([
        {
          order: "desc",
          paginationOpts: { cursor: null, numItems: 1000 },
          table: "tenants",
        },
        {
          order: "desc",
          paginationOpts: { cursor: "page-2", numItems: 1000 },
          table: "tenants",
        },
      ]);
    })
  );

  it.effect(
    "reaches the backend that the runtime's manifest and saved deployment name",
    () =>
      withFetch(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const root = yield* fs.makeTempDirectoryScoped({
            prefix: "acceptance-convex-test-",
          });
          const backendDirectory = `${root}/backend`;
          yield* fs.makeDirectory(`${backendDirectory}/.convex/local/default`, {
            recursive: true,
          });
          yield* fs.writeFileString(
            `${backendDirectory}/.convex/local/default/config.json`,
            encodeJsonText({
              adminKey: ADMIN_KEY,
              backendVersion: "1",
              deploymentName: "local",
              instanceSecret: "secret",
              ports: { cloud: 3210, site: 3211 },
            })
          );
          mocks.read.mockReturnValue(
            Effect.succeed({ backend: backendDirectory, query: URL_ROOT })
          );
          const received = serve(() => json({ status: "success", value: 1 }));

          const value = yield* Effect.gen(function* () {
            const convex = yield* LocalConvex;
            return yield* convex.run("probe", { args: {}, path: "probe:run" });
          }).pipe(Effect.provide(localConvexLayer(root)));

          expect(value).toBe(1);
          expect(received()[0]?.authorization).toBe(`Convex ${ADMIN_KEY}`);
          expect(mocks.read).toHaveBeenCalledWith(root);
        }).pipe(Effect.scoped, Effect.provide(nodePlatform))
      )
  );

  it.effect("refuses to reach a runtime that is not prepared", () =>
    Effect.gen(function* () {
      mocks.read.mockReturnValue(Effect.void);

      const error = yield* Effect.service(LocalConvex).pipe(
        Effect.provide(localConvexLayer("/root")),
        Effect.flip
      );

      expect(error).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: expect.stringContaining("acceptance:prepare"),
      });
    }).pipe(Effect.provide(Layer.merge(nodePlatform, FetchHttpClient.layer)))
  );
});
