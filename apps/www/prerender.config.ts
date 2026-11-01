import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { DEFAULT_LOCALE, LOCALES } from "@repo/internationalization/src/locale";
import { FetchClient } from "@repo/utilities/http/client";
import { Effect, Option, Result, Schema } from "effect";
import { HttpClient } from "effect/http";
import { toJSONAsync } from "seroval";
import type { Plugin } from "vite";
import {
  readStaticCalls,
  type StaticCall,
  staticDataPath,
  toStaticFile,
} from "#www/src/lib/static/calls";
import {
  notFoundOutputPath,
  notFoundPagePath,
  schoolNotFoundPath,
  staticNotFoundDocument,
} from "#www/src/lib/static/notfound";
import { deferStaticScripts } from "#www/src/lib/static/scripts";
import { THEME_PREPAINT_SCRIPT } from "#www/src/lib/theme/prepaint";

/*
 * The build steps that run after TanStack has prerendered the public pages: the
 * static answers that the browser reads on a navigation, the deferred scripts of
 * each page, the static not-found page of each locale, then the check that the
 * output holds exactly the listed pages.
 * `vite.config.ts` adds them in that order.
 */

/**
 * The marker that React writes where a Suspense boundary failed on the server, so
 * the browser renders that part. A page that carries it is a server failure.
 */
const SERVER_FAILURE_PATTERN = /<!--\$!-->/u;

/**
 * The marker that React writes where a Suspense boundary had not finished when
 * the page was written: its content follows at the page's end, for the browser's
 * script to move into place. A page that carries it was not rendered whole.
 */
const PENDING_BOUNDARY_PATTERN = /<!--\$\?--><template id="B:/u;

/**
 * The robots meta of the standalone not-found page. A prerendered page never
 * renders that page, because TanStack would write the body of a missing route.
 */
const NOT_FOUND_PATTERN = /<meta name="robots" content="noindex,nofollow"/u;

/**
 * TanStack runs each prerender task in a queue whose failures nobody awaits: a
 * page that fails only logs an unhandled rejection, and the build still exits 0.
 * This check throws unless the client output directory, the directory that
 * TanStack prerenders into, holds exactly the listed pages, each rendered whole,
 * and none of them carries a server failure marker.
 */
function assertPrerenderedPages(
  clientOutputDirectory: string,
  pages: readonly string[]
) {
  const expected = pages.map((path) =>
    join(clientOutputDirectory, path, "index.html")
  );
  const written = readdirSync(clientOutputDirectory, {
    encoding: "utf8",
    recursive: true,
  })
    .filter((entry) => basename(entry) === "index.html")
    .map((entry) => join(clientOutputDirectory, entry));
  const listed = new Set(expected);
  const problems = [
    ...expected.flatMap((file) => {
      if (!existsSync(file)) {
        return [`no page at ${file}`];
      }
      const html = readFileSync(file, "utf8");
      return [
        ...(SERVER_FAILURE_PATTERN.test(html)
          ? [`server failure in ${file}`]
          : []),
        ...(PENDING_BOUNDARY_PATTERN.test(html)
          ? [`unfinished boundary in ${file}`]
          : []),
        ...(NOT_FOUND_PATTERN.test(html) ? [`not-found page in ${file}`] : []),
      ];
    }),
    ...written
      .filter((file) => !listed.has(file))
      .map((file) => `unlisted page at ${file}`),
  ];
  if (problems.length > 0) {
    throw new Error(
      `The prerendered pages are not the listed set:\n${problems.join("\n")}`
    );
  }
}

/** How many static answers the build reads from its prerender server at once. */
const STATIC_ANSWER_CONCURRENCY = 8;

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
    });
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

/**
 * Writes the answer of every server function call that the prerendered pages'
 * loaders made as a static file, after TanStack has prerendered them. The browser
 * reads these files on a navigation, so moving between prerendered pages costs no
 * Worker request. The answers come from a preview server of the same build, as
 * TanStack's own prerender reads its pages.
 */
export const writeStaticAnswers = (pages: readonly string[]): Plugin => ({
  apply: "build",
  // After TanStack's prerender, which is a post plugin too, and before the verifier.
  enforce: "post",
  buildApp: {
    order: "post",
    handler: async (builder) => {
      const outDir = builder.environments.client.config.build.outDir;
      const calls = takeStaticCalls(outDir, pages);
      if (calls.length === 0) {
        return;
      }
      const { configFile } = builder.config;
      if (configFile === undefined) {
        throw new Error("The build has no config file to preview.");
      }
      const { preview } = await import("vite");
      const server = await preview({
        configFile,
        preview: { open: false, port: 0 },
      });
      try {
        const origin = server.resolvedUrls?.local[0];
        if (origin === undefined) {
          throw new Error("The prerender server has no local address.");
        }
        await Effect.runPromise(
          Effect.forEach(
            calls,
            (call) => writeStaticAnswer(outDir, origin, call),
            { concurrency: STATIC_ANSWER_CONCURRENCY, discard: true }
          ).pipe(Effect.provide(FetchClient))
        );
      } finally {
        await server.close();
      }
    },
  },
  name: "www:write-static-answers",
});

/**
 * Defers the scripts of every prerendered page until the page has painted (see
 * `deferStaticScripts`). It runs after the static answers, which close each page.
 */
export const deferStaticPageScripts = (pages: readonly string[]): Plugin => ({
  apply: "build",
  enforce: "post",
  buildApp: {
    order: "post",
    handler: (builder) => {
      const outDir = builder.environments.client.config.build.outDir;
      for (const path of pages) {
        const file = join(outDir, path, "index.html");
        const deferred = Result.getOrThrowWith(
          deferStaticScripts(readFileSync(file, "utf8")),
          (error) =>
            new Error(
              `The prerendered page ${path} cannot defer its scripts: ${error.reason}`
            )
        );
        writeFileSync(file, deferred);
      }
      return Promise.resolve();
    },
  },
  name: "www:defer-static-scripts",
});

/** Verifies the prerendered pages against the list that the build was given. */
export const verifyPrerenderedPages = (pages: readonly string[]): Plugin => ({
  apply: "build",
  // TanStack's prerender is a post plugin too; this check must run after it.
  enforce: "post",
  // After every environment is built and TanStack has prerendered the pages.
  buildApp: {
    order: "post",
    handler: (builder) =>
      Promise.resolve(
        assertPrerenderedPages(
          builder.environments.client.config.build.outDir,
          pages
        )
      ),
  },
  name: "www:verify-prerendered-pages",
});

/**
 * The not-found pages of each locale, as TanStack prerenders them. The
 * `/_notfound/$locale` route writes that locale's `404.html`: the assets answer a
 * missing address with the nearest `404.html` and a 404 status, so a missing
 * address shows the app's own page in the language of its path. The
 * `/_notfound/school/$locale` route writes the page that the Worker answers a
 * refused school page with, at its own address.
 */
export const notFoundPages = LOCALES.flatMap((locale) => [
  {
    path: notFoundPagePath(locale),
    prerender: {
      autoSubfolderIndex: false,
      outputPath: notFoundOutputPath(locale),
    },
  },
  {
    path: schoolNotFoundPath(locale),
    prerender: {
      autoSubfolderIndex: false,
      outputPath: schoolNotFoundPath(locale),
    },
  },
]);

/**
 * Turns each prerendered not-found page into a static document: it keeps the markup,
 * the stylesheets and the theme script, and loses the app's scripts and the list of
 * server calls, so the page never starts the router on an address it does not own.
 * The default locale's page also answers at the root, for a missing address that
 * names no locale.
 */
export const writeNotFoundPages = (pages: readonly string[]): Plugin => ({
  apply: "build",
  enforce: "post",
  buildApp: {
    order: "post",
    handler: (builder) => {
      if (pages.length === 0) {
        return Promise.resolve();
      }
      const outDir = builder.environments.client.config.build.outDir;
      /** Rewrites one prerendered not-found page as its static document, and returns the document. */
      const writeStatic = (output: string) => {
        const file = join(outDir, `${output}.html`);
        const prerendered = readFileSync(file, "utf8");
        const page = Option.match(readStaticCalls(prerendered), {
          onNone: () => prerendered,
          onSome: ({ html }) => html,
        });
        const document = staticNotFoundDocument(page, THEME_PREPAINT_SCRIPT);
        writeFileSync(file, document);
        return document;
      };
      for (const locale of LOCALES) {
        const document = writeStatic(notFoundOutputPath(locale));
        writeStatic(schoolNotFoundPath(locale));
        if (locale === DEFAULT_LOCALE) {
          writeFileSync(join(outDir, "404.html"), document);
        }
      }
      return Promise.resolve();
    },
  },
  name: "www:write-not-found-pages",
});
