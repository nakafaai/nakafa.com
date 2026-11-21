import { layer as NodeServices } from "@effect/platform-node/NodeServices";
import {
  ActiveAppLocaleCodeSchema,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import type { Locale } from "@repo/internationalization/src/locale";
import { LOCALES } from "@repo/internationalization/src/locale";
import { SITE_ORIGIN } from "@repo/seo/origin";
import {
  Array as Arr,
  Clock,
  DateTime,
  Effect,
  FileSystem,
  Option,
  Path,
  Record as Rec,
  Schema,
} from "effect";
import { readTryoutHubPage } from "@/components/tryout/catalog/source.server";
import { readPublishedContent } from "@/lib/content/published/exchange";
import {
  readRuntimeCurriculumCatalog,
  readRuntimeCurriculumOptions,
} from "@/lib/curriculum/model";
import {
  getLlmsMarkdownText,
  getPublishedMarkdownSource,
} from "@/lib/llms/content/markdown";
import { readTwinTitle } from "@/lib/llms/format";
import { buildRootLlmsIndexText } from "@/lib/llms/index/public";
import { readOgCopy } from "@/lib/og/copy.server";
import {
  readSubjectMap,
  SubjectLocaleSchema,
} from "@/lib/routing/public/subject";
import { readTryoutMap } from "@/lib/routing/public/tryout/map";
import { SearchIndexJson, searchIndexPath } from "@/lib/search/entry";
import { readExamEntries, readPageEntry } from "@/lib/search/page";
import { renderSecurityTxt, SECURITY_TXT_PATH } from "@/lib/security/txt";
import { readRssText } from "@/lib/seo/feed";
import { readManifestText } from "@/lib/seo/manifest";
import { readSitemapFiles } from "@/lib/sitemap/files";
import { checkDiagrams, readCharts } from "@/lib/static/diagram";
import { readStaticPagePaths } from "@/lib/static/pages";
import { PrerenderedPagesJson } from "@/lib/static/prerender";
import type { SocialImageSource } from "@/lib/static/social";
import { listSocialImageSources } from "@/lib/static/social";
import { readRuntimeConfig } from "@/runtime";
import { renderSocialImage } from "@/scripts/static/social";

/**
 * Writes the static artifacts of the release into the client output: the sitemap
 * index and its pages, the RSS feed, llms.txt, the manifest, the Markdown twin of
 * every prerendered page that has a source, the search index of every locale, and
 * every social image. Each file
 * carries the bytes that the runtime answered for the same address, so the static
 * assets serve it without a Worker. `run.ts` derives what needs no prerendered
 * page beside the client build, and writes the rest once the prerender is done.
 */

/** The logo that every social image shows, read from the same file the image route bundled. */
const LOGO_FILE = "public/logo.svg";
/** Allo's Latin face, which every social image draws its words in. */
const ALLO_LATIN_FILE = "../../packages/design-system/fonts/allo/latin.woff2";

/** One text artifact of the release, at its path under the client output. */
const TextArtifact = Schema.Struct({
  path: Schema.String,
  text: Schema.String,
});
type TextArtifact = typeof TextArtifact.Type;

/**
 * A prerendered page has no `</head>` to carry its Markdown link, or it already
 * carries one, so its HTML is not the one the build expects. The build is the only
 * writer of that link.
 */
class MarkdownTwinLinkError extends Schema.TaggedError<
  MarkdownTwinLinkError,
  { readonly brand: unique symbol }
>()("MarkdownTwinLinkError", { page: Schema.String }) {}

const writeArtifact = Effect.fn("www.static.write")(function* (
  outDir: string,
  file: string,
  body: string | Uint8Array
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(outDir, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  if (typeof body === "string") {
    yield* fs.writeFileString(target, body);
    return;
  }
  yield* fs.writeFile(target, body);
});

/** Splits a prerendered page path into its locale and its slug without the locale, which the Markdown reader names a route by. */
function splitPagePath(page: string) {
  const [, locale = "", ...segments] = page.split("/");
  return { cleanSlug: Arr.join(segments, "/"), locale };
}

/** The media type that a page's Markdown twin is linked with, which only the build writes. */
const MARKDOWN_TYPE = 'type="text/markdown"';

/** The head link that names a page's Markdown twin, so that a crawler or an agent finds it from the page. */
function markdownTwinLink(page: string) {
  return `<link rel="alternate" type="text/markdown" href="${page}.md">`;
}

/** A page's Markdown twin as the build derives it, before the prerender has written the page it links from. */
const PreparedTwinSchema = Schema.Struct({
  page: Schema.String,
  text: Schema.String,
  title: Schema.String,
});
type PreparedTwin = typeof PreparedTwinSchema.Type;

/** Derives the Markdown twin of one prerendered page, when the page has a source. */
const readMarkdownTwin = Effect.fn("www.static.markdownTwin")(function* (
  page: string
) {
  const { cleanSlug, locale } = splitPagePath(page);
  const appLocale = yield* Schema.decodeUnknownEffect(
    ActiveAppLocaleCodeSchema
  )(locale);
  return Option.map(
    Option.fromNullishOr(
      yield* getLlmsMarkdownText({ cleanSlug, locale: appLocale })
    ),
    (text): PreparedTwin => ({ page, text, title: readTwinTitle(text) })
  );
});

/** Writes one page's Markdown twin and links it from the page's head, which the prerender has written. */
const linkMarkdownTwin = Effect.fn("www.static.markdownLink")(function* (
  outDir: string,
  { page, text }: PreparedTwin
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* writeArtifact(outDir, `${page.slice(1)}.md`, text);
  const htmlFile = path.join(outDir, page.slice(1), "index.html");
  const html = yield* fs.readFileString(htmlFile);
  const parts = html.split("</head>");
  if (parts.length !== 2 || html.includes(MARKDOWN_TYPE)) {
    return yield* new MarkdownTwinLinkError({ page });
  }
  yield* fs.writeFileString(
    htmlFile,
    `${parts[0]}${markdownTwinLink(page)}</head>${parts[1]}`
  );
});

/**
 * Lists the Mermaid diagrams of one prerendered page with a signed body, read
 * from the content tree the page rendered. The content store answers a body
 * from the reads the prerender and the Markdown twin already made; a page with
 * no signed body costs one ownership read for each release.
 */
const readPageDiagrams = Effect.fn("www.static.pageDiagrams")(function* (
  page: string
) {
  const { cleanSlug, locale } = splitPagePath(page);
  const appLocale = yield* Schema.decodeUnknownEffect(
    ActiveAppLocaleCodeSchema
  )(locale);
  const source = Option.fromNullishOr(
    yield* getPublishedMarkdownSource({ cleanSlug, locale: appLocale })
  );
  if (Option.isNone(source)) {
    return [];
  }
  const data = yield* readPublishedContent({
    ...source.value,
    appLocale: AppLocaleSchema.make(appLocale),
  });
  return Arr.map(
    readCharts(data.artifact.payload.contentTree.children),
    (chart) => ({ chart, page })
  );
});

/** Lists the Markdown twins in llms.txt after the index, each by its title, so one file names every twin. */
function buildLlmsText(twins: readonly PreparedTwin[]) {
  const lines = Arr.map(
    twins,
    ({ page, title }) => `- [${title}](${SITE_ORIGIN}${page}.md)`
  );
  return `${buildRootLlmsIndexText()}\n## Markdown pages\n\n${Arr.join(lines, "\n")}\n`;
}

/**
 * Renders the feeds and indexes of the release as text artifacts, the maps that
 * redirect each locale's retired subject lessons to their successors, and the
 * try-out route map that the retired try-out redirects read.
 */
const readTextArtifacts = Effect.fn("www.static.textArtifacts")(function* (
  twins: readonly PreparedTwin[]
) {
  const sitemap = yield* readSitemapFiles();
  const subjects = yield* Effect.forEach(
    SubjectLocaleSchema.literals,
    readSubjectMap
  );
  const tryouts = yield* readTryoutMap(yield* readStaticPagePaths());
  const rss = yield* readRssText();
  const manifest = yield* readManifestText();
  const now = yield* DateTime.now;
  const rest: readonly TextArtifact[] = [
    { path: "rss.xml", text: rss },
    { path: "llms.txt", text: buildLlmsText(twins) },
    { path: "manifest.webmanifest", text: manifest },
    { path: SECURITY_TXT_PATH, text: renderSecurityTxt(now) },
  ];
  return [...sitemap, ...subjects, tryouts, ...rest];
});

/**
 * The country of each curriculum and try-out country of a locale, by the slug
 * that ends its path. Both reads are keyed by their family's snapshot, so a
 * deploy that keeps the snapshot reads neither again.
 */
const readSearchFlags = Effect.fn("www.static.searchFlags")(function* (
  locale: Locale
) {
  const curricula = readRuntimeCurriculumOptions(
    yield* readRuntimeCurriculumCatalog(locale)
  );
  const { countries } = yield* readTryoutHubPage(locale);
  const rows = Arr.getSomes([
    ...Arr.map(curricula, ({ countryCode, publicSlug }) =>
      Option.map(
        Option.fromNullishOr(countryCode),
        (code) => [publicSlug, code] as const
      )
    ),
    ...Arr.map(countries, ({ countryCode, publicPath }) =>
      Option.map(
        Arr.last(publicPath.split("/")),
        (slug) => [slug, countryCode] as const
      )
    ),
  ]);
  return Rec.fromEntries(rows);
});

/**
 * Writes the search index of each locale that has pages: one entry per
 * prerendered page, read from the page's own breadcrumb, so the palette searches
 * exactly the pages the build wrote, in the browser, with no read per keystroke.
 */
const writeSearchIndexes = Effect.fn("www.static.searchIndexes")(function* (
  outDir: string,
  pages: readonly string[]
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const locales = Arr.filter(LOCALES, (locale) =>
    Arr.some(pages, (page) => splitPagePath(page).locale === locale)
  );
  return yield* Effect.forEach(locales, (locale) =>
    Effect.gen(function* () {
      const flags = yield* readSearchFlags(locale);
      const entries = yield* Effect.forEach(
        Arr.filter(pages, (page) => splitPagePath(page).locale === locale),
        (page) =>
          Effect.map(
            fs.readFileString(path.join(outDir, page.slice(1), "index.html")),
            (html) => readPageEntry({ flags, html, locale, path: page })
          ),
        { concurrency: 8 }
      );
      const pageEntries = Arr.getSomes(entries);
      const index = {
        entries: Arr.appendAll(pageEntries, readExamEntries(pageEntries)),
      };
      const json = yield* Schema.encodeEffect(SearchIndexJson)(index);
      yield* writeArtifact(outDir, searchIndexPath(locale).slice(1), json);
      return `${locale} ${index.entries.length}`;
    })
  );
});

/** Renders one social image when its route names published content, and reports whether it did. */
const writeSocialImage = Effect.fn("www.static.socialImage")(function* (
  outDir: string,
  logoSvg: string,
  face: Uint8Array,
  source: SocialImageSource
) {
  const segments = Arr.filter(source.slug.split("/"), (part) => part !== "");
  const copy = yield* readOgCopy(source.locale, segments);
  if (Option.isNone(copy)) {
    return false;
  }
  const png = yield* Effect.promise(() =>
    renderSocialImage({
      description: copy.value.description,
      face,
      logoSvg,
      title: copy.value.title,
    })
  );
  yield* writeArtifact(
    outDir,
    Arr.join([source.locale, "og", ...segments, "image.png"], "/"),
    png
  );
  return true;
});

/** Reads the prerendered paths that `buildStaticPagePaths` wrote, which the build verifies against its output. */
const readPagePaths = Effect.fn("www.static.pagePathList")(function* (
  pageListFile: string
) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(pageListFile);
  return yield* Schema.decodeEffect(PrerenderedPagesJson)(text);
});

/**
 * Derives what the static artifacts hold that needs no prerendered page: the
 * Markdown twin of every page with a source, and every diagram the twins' bodies
 * draw, each parsed, so a diagram that cannot be drawn stops the build before it
 * deploys. The build runs it beside the client build and the prerender.
 */
const prepare = Effect.fn("www.static.prepare")(function* (
  pageListFile: string
) {
  const started = yield* Clock.currentTimeMillis;
  const pages = yield* readPagePaths(pageListFile);
  const twins = Arr.getSomes(
    yield* Effect.forEach(pages, readMarkdownTwin, { concurrency: 8 })
  );
  const diagrams = Arr.flatten(
    yield* Effect.forEach(twins, ({ page }) => readPageDiagrams(page), {
      concurrency: 8,
    })
  );
  yield* checkDiagrams(diagrams);
  const elapsed = (yield* Clock.currentTimeMillis) - started;
  return { diagrams: diagrams.length, elapsed, pages, twins };
});
type Prepared = Effect.Success<ReturnType<typeof prepare>>;

/** Writes the static artifacts into the client output once the prerender has written its pages. */
const write = Effect.fn("www.static.build")(function* (
  outDir: string,
  { diagrams, elapsed: preparing, pages, twins }: Prepared
) {
  const writing = yield* Clock.currentTimeMillis;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* Effect.forEach(twins, (twin) => linkMarkdownTwin(outDir, twin), {
    concurrency: 8,
    discard: true,
  });
  const searchIndexes = yield* writeSearchIndexes(outDir, pages);
  const textArtifacts = yield* readTextArtifacts(twins);
  yield* Effect.forEach(
    textArtifacts,
    ({ path: file, text }) => writeArtifact(outDir, file, text),
    { concurrency: 8, discard: true }
  );

  const logoSvg = yield* fs.readFileString(path.resolve(LOGO_FILE));
  const face = yield* fs.readFile(path.resolve(ALLO_LATIN_FILE));
  const sources = listSocialImageSources(LOCALES);
  const started = yield* Clock.currentTimeMillis;
  const written = yield* Effect.forEach(
    sources,
    (source) => writeSocialImage(outDir, logoSvg, face, source),
    { concurrency: 8 }
  );
  const images = Arr.filter(written, Boolean).length;
  const elapsed = (yield* Clock.currentTimeMillis) - started;
  const perThousand = images === 0 ? 0 : (elapsed * 1000) / images;
  const afterPrerender = (yield* Clock.currentTimeMillis) - writing;
  process.stdout.write(
    Arr.join(
      [
        `static text artifacts: ${textArtifacts.length}`,
        `markdown twins: ${twins.length} of ${pages.length} prerendered pages`,
        `search entries: ${Arr.join(searchIndexes, ", ")}`,
        `diagrams parsed: ${diagrams}`,
        `social image sources: ${sources.length}`,
        `social images written: ${images}`,
        `social images skipped (no published copy): ${sources.length - images}`,
        `social image render time: ${elapsed} ms (${perThousand.toFixed(0)} ms per 1,000 images)`,
        `static artifacts prepared beside the client build: ${preparing} ms`,
        `static artifacts written after the prerender: ${afterPrerender} ms`,
        "",
      ],
      "\n"
    )
  );
});

/** Derives the Markdown twins and parses the diagrams of the prerendered pages in the list. */
export async function prepareStaticArtifacts(pageListFile: string) {
  readRuntimeConfig();
  return await Effect.runPromise(
    prepare(pageListFile).pipe(Effect.provide(NodeServices))
  );
}

/** Writes the static artifacts that `prepareStaticArtifacts` derived into the client output directory. */
export async function writeStaticArtifacts(outDir: string, prepared: Prepared) {
  readRuntimeConfig();
  await Effect.runPromise(
    write(outDir, prepared).pipe(Effect.provide(NodeServices))
  );
}

/** Writes the JSON list of public paths that the build prerenders, which `vite.config.ts` reads. */
export async function buildStaticPagePaths(file: string) {
  readRuntimeConfig();
  await Effect.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const paths = yield* readStaticPagePaths();
      yield* fs.makeDirectory(path.dirname(file), { recursive: true });
      const json = yield* Schema.encodeEffect(PrerenderedPagesJson)(paths);
      yield* fs.writeFileString(file, json);
    }).pipe(Effect.provide(NodeServices))
  );
}
