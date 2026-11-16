import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { DEFAULT_LOCALE, LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr, Option, Record, Result } from "effect";
import type { Plugin } from "vite";
import { SHELL_PATH, schoolEntryPath } from "#www/src/lib/routing/shell";
import { readPageFacts } from "#www/src/lib/seo/audit/html";
import { auditSite } from "#www/src/lib/seo/audit/site";
import { readStaticCalls } from "#www/src/lib/static/calls";
import { type BuiltChunk, readParts } from "#www/src/lib/static/chunks";
import { composeSchoolEntry, readSchoolEntry } from "#www/src/lib/static/entry";
import {
  notFoundOutputPath,
  notFoundPagePath,
  schoolNotFoundPath,
  staticNotFoundDocument,
} from "#www/src/lib/static/notfound";
import { deferStaticScripts } from "#www/src/lib/static/scripts";
import { THEME_PREPAINT_SCRIPT } from "#www/src/lib/theme/prepaint";

/*
 * The build steps after the public pages render (`render.config.ts`): the
 * deferred scripts of each page, the static not-found page of each locale, and
 * the check that the output holds exactly the listed pages. `vite.config.ts` adds
 * them in that order.
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

/** One address that a sitemap file lists. */
const SITEMAP_LOCATION = /<loc>(?<location>[^<]*)<\/loc>/gu;

/**
 * Throws unless every listed page keeps the search contract (`auditSite`): its
 * head, its structured data and its links to the other pages. It reads only what
 * each page's facts need, page by page, so the build never holds every page at once.
 */
function assertSearchContract(
  clientOutputDirectory: string,
  pages: readonly string[]
) {
  const sitemapDirectory = join(clientOutputDirectory, "sitemap");
  const sitemapPaths = readdirSync(sitemapDirectory).flatMap((file) =>
    [
      ...readFileSync(join(sitemapDirectory, file), "utf8").matchAll(
        SITEMAP_LOCATION
      ),
    ].map((found) => new URL(found.groups?.location ?? "").pathname)
  );
  const built = pages.map((path) => ({
    facts: readPageFacts(
      readFileSync(join(clientOutputDirectory, path, "index.html"), "utf8")
    ),
    path,
  }));
  const problems = auditSite(built, sitemapPaths);
  if (problems.length > 0) {
    throw new Error(
      `The prerendered pages break the search contract:\n${problems.join("\n")}`
    );
  }
}

/**
 * Defers the scripts of every prerendered page until the page has painted (see
 * `deferStaticScripts`), and starts only what the page's first paint runs. The
 * first plugin records every chunk of the client build (its address, its static
 * imports and the route parts it holds) as the client build writes it; the second
 * runs after the static answers, which close each page, in the same process. A
 * build that recorded no chunk fails, since every page would then preload the
 * chunks it never runs.
 */
export const deferStaticPageScripts = (pages: readonly string[]): Plugin[] => {
  let chunks: readonly BuiltChunk[] = [];
  return [
    {
      apply: "build",
      applyToEnvironment: (environment) => environment.name === "client",
      generateBundle: (_, bundle) => {
        chunks = Arr.flatMap(Record.values(bundle), (output) =>
          output.type === "chunk"
            ? [
                {
                  href: `/${output.fileName}`,
                  imports: Arr.map(output.imports, (file) => `/${file}`),
                  parts: readParts(output.moduleIds),
                },
              ]
            : []
        );
      },
      name: "www:record-client-chunks",
    },
    {
      apply: "build",
      enforce: "post",
      buildApp: {
        order: "post",
        handler: (builder) => {
          const outDir = builder.environments.client.config.build.outDir;
          if (pages.length > 0 && chunks.length === 0) {
            throw new Error("The client build recorded no chunk to defer.");
          }
          for (const path of pages) {
            const file = join(outDir, path, "index.html");
            const deferred = Result.getOrThrowWith(
              deferStaticScripts(readFileSync(file, "utf8"), chunks),
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
    },
  ];
};

/** Verifies the prerendered pages against the list that the build was given. */
export const verifyPrerenderedPages = (pages: readonly string[]): Plugin => ({
  apply: "build",
  // TanStack's prerender is a post plugin too; this check must run after it.
  enforce: "post",
  // After every environment is built and TanStack has prerendered the pages.
  buildApp: {
    order: "post",
    handler: (builder) =>
      Promise.resolve().then(() => {
        assertPrerenderedPages(
          builder.environments.client.config.build.outDir,
          pages
        );
        assertSearchContract(
          builder.environments.client.config.build.outDir,
          pages
        );
      }),
  },
  name: "www:verify-prerendered-pages",
});

/**
 * The pages of each locale that stand without the router, as TanStack prerenders
 * them. The `/_notfound/$locale` route writes that locale's `404.html`: the assets
 * answer a missing address with the nearest `404.html` and a 404 status, so a missing
 * address shows the app's own page in the language of its path. The
 * `/_notfound/school/$locale` route writes the page that the Worker answers a
 * refused school page with, at its own address, and `/_entry/school/$locale` the
 * sign-in that a school's first HTML paints.
 */
export const standalonePages = LOCALES.flatMap((locale) => [
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
  {
    path: schoolEntryPath(locale),
    prerender: {
      autoSubfolderIndex: false,
      outputPath: schoolEntryPath(locale),
    },
  },
]);

/**
 * Turns each prerendered standalone page into a static document: it keeps the markup,
 * the stylesheets and the theme script, and loses the app's scripts and the list of
 * server calls, so the page never starts the router on an address it does not own.
 * The default locale's page also answers at the root, for a missing address that
 * names no locale. A school's sign-in leaves its page for a copy of the browser
 * shell, which the Worker answers a visitor with (ADR 0038 D2).
 */
export const writeStandalonePages = (pages: readonly string[]): Plugin => ({
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
      const shell = readFileSync(join(outDir, `${SHELL_PATH}.html`), "utf8");
      for (const locale of LOCALES) {
        const document = writeStatic(notFoundOutputPath(locale));
        writeStatic(schoolNotFoundPath(locale));
        if (locale === DEFAULT_LOCALE) {
          writeFileSync(join(outDir, "404.html"), document);
        }
        const entry = Option.getOrThrowWith(
          readSchoolEntry(writeStatic(schoolEntryPath(locale))),
          () => new Error(`The ${locale} school entry drew no sign-in.`)
        );
        writeFileSync(
          join(outDir, `${schoolEntryPath(locale)}.html`),
          composeSchoolEntry(shell, entry, locale)
        );
      }
      return Promise.resolve();
    },
  },
  name: "www:write-standalone-pages",
});
