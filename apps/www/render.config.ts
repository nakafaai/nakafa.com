import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { FetchClient } from "@repo/utilities/http/client";
import { Array as Arr, Duration, Effect, Option, Ref, Schema } from "effect";
import { HttpClient } from "effect/http";
import { toJSONAsync } from "seroval";
import type { Plugin, PreviewServer } from "vite";
import type { StaticCall } from "#www/src/lib/static/calls";
import {
  PRERENDER_HEADER,
  readStaticCalls,
  staticDataPath,
  toStaticFile,
} from "#www/src/lib/static/calls";

/*
 * The build renders its public pages from preview servers of its own output. Each
 * server runs the Worker in one workerd, which runs JavaScript on one thread, so a
 * page render waits for its server's thread, never for a core: one server kept a
 * single core busy while the rest of the machine waited. The listed pages render
 * across several servers, and the static answers of those pages are read from the
 * same servers before they close. TanStack's own prerender keeps the browser shell
 * and the standalone pages, which `spa` and `pages` give it in `vite.config.ts`.
 */

/**
 * The address of every preview server that the build fetches its own pages from.
 * A server that listens at `localhost` binds only its first address, ::1, and the
 * fetching Node races ::1 and 127.0.0.1 on a 250 ms timer. A prerender that holds
 * the event loop past the timer then fails with ETIMEDOUT on ::1 and ECONNREFUSED
 * on 127.0.0.1. A literal address leaves Node one address and no race.
 */
const PRERENDER_HOST = "127.0.0.1";

/**
 * Binds TanStack's prerender preview server to `PRERENDER_HOST`. TanStack starts
 * that server from this config with TSS_PRERENDERING set, then crawls the address
 * the server resolves, which no prerender option names.
 */
export const bindPrerenderHost: Plugin = {
  config: () =>
    process.env.TSS_PRERENDERING === "true"
      ? { preview: { host: PRERENDER_HOST } }
      : undefined,
  name: "www:bind-prerender-host",
};

/**
 * How many preview servers render the listed pages. Three keep one core of the
 * proof's four-core runner for the local Convex backend and the build's own
 * process. Set, so the build machine never changes how the build runs.
 */
const PREVIEW_SERVERS = 3;

/** How many pages each server renders at once: one renders while the next waits on its reads. */
const PAGES_PER_SERVER = 2;

/** How many static answers each server answers at once. */
const ANSWERS_PER_SERVER = 3;

/** A serialized server function input as the JSON text of its `payload` query field. */
const PayloadJson = Schema.fromJsonString(Schema.Unknown);

/** The headers of a server function request as the browser sends it. */
const SERVER_FUNCTION_REQUEST_HEADERS = {
  accept: "application/x-tss-framed, application/x-ndjson, application/json",
  // Start's CSRF check accepts a server function request from the page's own site.
  "sec-fetch-site": "same-origin",
  "x-tsr-serverFn": "true",
};

/**
 * Removes the closing comment from every prerendered page, and returns the server
 * function calls that the comments list, each once. A page without the comment was
 * rendered without recording its calls, which fails the build.
 */
function takeStaticCalls(
  clientOutputDirectory: string,
  pages: readonly string[]
): readonly StaticCall[] {
  const calls = new Map<string, StaticCall>();
  for (const path of pages) {
    const file = join(clientOutputDirectory, path, "index.html");
    const read = readStaticCalls(readFileSync(file, "utf8"));
    if (Option.isNone(read)) {
      throw new Error(`The prerendered page ${path} lists no server calls.`);
    }
    writeFileSync(file, read.value.html);
    for (const call of read.value.calls) {
      calls.set(call.key, call);
    }
  }
  return [...calls.values()];
}

/**
 * Reads the answer of one call from the prerender server, as the browser would
 * request it, and writes it as the static file that the browser reads instead. The
 * input is serialized as Start serializes it, and only a serialized answer is kept.
 */
const writeStaticAnswer = (
  clientOutputDirectory: string,
  origin: string,
  call: StaticCall
) =>
  Effect.gen(function* () {
    const payload = yield* Effect.promise(() =>
      toJSONAsync({ data: call.data })
    );
    const address = new URL(call.url, origin);
    address.searchParams.set(
      "payload",
      yield* Schema.encodeEffect(PayloadJson)(payload)
    );
    const response = yield* HttpClient.get(address, {
      headers: SERVER_FUNCTION_REQUEST_HEADERS,
    }).pipe(
      // A busy machine can hold the build past the preview server's keep-alive, and the pooled
      // connection the server closed then answers with a reset. The request only reads, so it is sent again.
      Effect.retry({
        times: 2,
        while: (error) => error.reason._tag === "TransportError",
      })
    );
    const contentType = response.headers["content-type"];
    if (
      response.status !== 200 ||
      contentType === undefined ||
      response.headers["x-tss-serialized"] === undefined ||
      response.headers["x-tss-raw"] !== undefined
    ) {
      const text = yield* response.text;
      return yield* Effect.die(
        new Error(
          `The answer of ${call.url} for ${address.search.slice(0, 200)} is not a serialized answer: ${response.status} ${contentType ?? "no type"}: ${text.slice(0, 300)}`
        )
      );
    }
    const body = new Uint8Array(yield* response.arrayBuffer);
    const file = join(clientOutputDirectory, staticDataPath(call.key));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, toStaticFile(contentType, body));
  });

/** The local address of one preview server. */
function originOf(server: PreviewServer) {
  const origin = server.resolvedUrls?.local[0];
  if (origin === undefined) {
    throw new Error("A prerender server has no local address.");
  }
  return origin;
}

/**
 * Starts the preview servers that render the pages, from the build's own config.
 * TanStack's prerender, which runs first, has set TSS_PRERENDERING for the rest of
 * the build, so each server binds no static assets and every request reaches the
 * Worker.
 */
async function startPreviewServers(configFile: string | undefined) {
  if (configFile === undefined) {
    throw new Error("The build has no config file to preview.");
  }
  const { preview } = await import("vite");
  return Promise.all(
    Arr.makeBy(PREVIEW_SERVERS, () =>
      preview({
        configFile,
        preview: { host: PRERENDER_HOST, open: false, port: 0 },
      })
    )
  );
}

/**
 * Renders one listed page and writes it where TanStack writes a page: the
 * `index.html` of its path. The request carries the prerender header, so the
 * Worker records the page's server function calls, and fetch follows a redirect
 * as TanStack's prerender did. Any answer but 200 fails the build.
 */
const renderPage = (outDir: string, origin: string, path: string) =>
  Effect.gen(function* () {
    const response = yield* HttpClient.get(new URL(path, origin), {
      headers: { [PRERENDER_HEADER]: "1" },
    }).pipe(
      // As for a static answer: a pooled connection that the server closed answers
      // with a reset, and the request only reads, so it is sent again.
      Effect.retry({
        times: 2,
        while: (error) => error.reason._tag === "TransportError",
      })
    );
    const html = yield* response.text;
    if (response.status !== 200) {
      return yield* Effect.die(
        new Error(`The page ${path} answered ${response.status}.`)
      );
    }
    const file = join(outDir, path, "index.html");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
  });

/**
 * Runs `work` for every item across the servers: each server takes the next item
 * as soon as one of its `perServer` slots frees, so a slow page holds only its own
 * slot and the servers stay evenly busy.
 */
const acrossServers = <A, E, R>(
  servers: readonly PreviewServer[],
  perServer: number,
  items: readonly A[],
  work: (origin: string, item: A) => Effect.Effect<void, E, R>
) =>
  Effect.gen(function* () {
    const next = yield* Ref.make(0);
    const lane = (origin: string) =>
      Ref.getAndUpdate(next, (index) => index + 1).pipe(
        Effect.flatMap((index) =>
          Option.match(Arr.get(items, index), {
            onNone: () => Effect.succeed(false),
            onSome: (item) => work(origin, item).pipe(Effect.as(true)),
          })
        ),
        Effect.repeat({ while: (more) => more })
      );
    yield* Effect.forEach(
      Arr.flatMap(servers, (server) =>
        Arr.replicate(originOf(server), perServer)
      ),
      lane,
      { concurrency: "unbounded", discard: true }
    );
  });

/**
 * Renders the listed pages across the preview servers, then reads the static
 * answers of their server function calls from the same servers and closes them.
 * The first plugin runs after TanStack's prerender and before the static
 * artifacts, which read the pages; the second runs after the artifacts and before
 * the deferred scripts, which close each page. A build that lists no page starts
 * no server.
 */
export const renderPublicPages = (pages: readonly string[]) => {
  let servers: readonly PreviewServer[] = [];
  const close = () =>
    Promise.all(servers.map((server) => server.close())).then(() => {
      servers = [];
    });
  const render: Plugin = {
    apply: "build",
    enforce: "post",
    buildApp: {
      order: "post",
      handler: async (builder) => {
        if (pages.length === 0) {
          return;
        }
        const outDir = builder.environments.client.config.build.outDir;
        servers = await startPreviewServers(builder.config.configFile);
        await Effect.runPromise(
          acrossServers(servers, PAGES_PER_SERVER, pages, (origin, path) =>
            renderPage(outDir, origin, path)
          ).pipe(
            Effect.timed,
            Effect.flatMap(([took]) =>
              Effect.log(
                `Rendered ${pages.length} pages across ${PREVIEW_SERVERS} preview servers in ${Duration.format(took)}.`
              )
            ),
            Effect.provide(FetchClient)
          )
        ).catch(async (error: unknown) => {
          await close();
          throw error;
        });
      },
    },
    name: "www:render-public-pages",
  };
  const answers: Plugin = {
    apply: "build",
    enforce: "post",
    buildApp: {
      order: "post",
      handler: async (builder) => {
        if (pages.length === 0) {
          return;
        }
        const outDir = builder.environments.client.config.build.outDir;
        const calls = takeStaticCalls(outDir, pages);
        try {
          await Effect.runPromise(
            acrossServers(servers, ANSWERS_PER_SERVER, calls, (origin, call) =>
              writeStaticAnswer(outDir, origin, call)
            ).pipe(Effect.provide(FetchClient))
          );
        } finally {
          await close();
        }
      },
    },
    name: "www:write-static-answers",
  };
  return { answers, render };
};
