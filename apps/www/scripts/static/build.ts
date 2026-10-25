import { layer as NodeServices } from "@effect/platform-node/NodeServices";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { LOCALES } from "@repo/internationalization/src/locale";
import { SITE_ORIGIN } from "@repo/seo/origin";
import {
  Array as Arr,
  Clock,
  Effect,
  FileSystem,
  Option,
  Path,
  Schema,
} from "effect";
import { getLlmsMarkdownText } from "@/lib/llms/content/markdown";
import { buildRootLlmsIndexText } from "@/lib/llms/index/public";
import { readOgCopy } from "@/lib/og/copy.server";
import { readRssText } from "@/lib/seo/feed";
import { readManifestText } from "@/lib/seo/manifest";
import { readSitemapFiles } from "@/lib/sitemap/files";
import { readStaticPagePaths } from "@/lib/static/pages";
import { PrerenderedPagesJson } from "@/lib/static/prerender";
import {
  listSocialImageSources,
  type SocialImageSource,
} from "@/lib/static/social";
import { readRuntimeConfig } from "@/runtime";
import { renderSocialImage } from "@/scripts/static/social";

/**
 * Writes the static artifacts of the release into the client output: the sitemap
 * index and its pages, the RSS feed, llms.txt, the manifest, the Markdown twin of
 * every prerendered page that has a source, and every social image. Each file
 * carries the bytes that the runtime answered for the same address, so the static
 * assets serve it without a Worker. `run.mjs` calls it after the client build.
 */

/** The logo that every social image shows, read from the same file the image route bundled. */
const LOGO_FILE = "public/logo.svg";

/** One text artifact of the release, at its path under the client output. */
const TextArtifact = Schema.Struct({
  path: Schema.String,
  text: Schema.String,
});
type TextArtifact = typeof TextArtifact.Type;

/** A prerendered page has no `</head>` to carry its Markdown link, so its HTML is not the one the build expects. */
class MarkdownTwinLinkError extends Schema.TaggedError<MarkdownTwinLinkError>()(
  "MarkdownTwinLinkError",
  { page: Schema.String }
) {}

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

/** The head link that names a page's Markdown twin, so that a crawler or an agent finds it from the page. */
function markdownTwinLink(page: string) {
  return `<link rel="alternate" type="text/markdown" href="${page}.md">`;
}

/**
 * Writes the Markdown twin of one prerendered page, when the page has a source,
 * and links the twin from the page's head. Returns the page when it has a twin.
 */
const writeMarkdownTwin = Effect.fn("www.static.markdownTwin")(function* (
  outDir: string,
  page: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { cleanSlug, locale } = splitPagePath(page);
  const appLocale = yield* Schema.decodeUnknownEffect(
    ActiveAppLocaleCodeSchema
  )(locale);
  const text = Option.fromNullishOr(
    yield* getLlmsMarkdownText({ cleanSlug, locale: appLocale })
  );
  if (Option.isNone(text)) {
    return Option.none<string>();
  }
  yield* writeArtifact(outDir, `${page.slice(1)}.md`, text.value);

  const htmlFile = path.join(outDir, page.slice(1), "index.html");
  const html = yield* fs.readFileString(htmlFile);
  const parts = html.split("</head>");
  if (parts.length !== 2) {
    return yield* new MarkdownTwinLinkError({ page });
  }
  yield* fs.writeFileString(
    htmlFile,
    `${parts[0]}${markdownTwinLink(page)}</head>${parts[1]}`
  );
  return Option.some(page);
});

/** Lists the Markdown twins in llms.txt after the index, so one file names every twin. */
function buildLlmsText(twins: readonly string[]) {
  const lines = Arr.map(twins, (page) => `- ${SITE_ORIGIN}${page}.md`);
  return `${buildRootLlmsIndexText()}\n## Markdown pages\n\n${Arr.join(lines, "\n")}\n`;
}

/** Renders the feeds and indexes of the release as text artifacts. */
const readTextArtifacts = Effect.fn("www.static.textArtifacts")(function* (
  twins: readonly string[]
) {
  const sitemap = yield* readSitemapFiles();
  const rss = yield* readRssText();
  const manifest = yield* readManifestText();
  const rest: readonly TextArtifact[] = [
    { path: "rss.xml", text: rss },
    { path: "llms.txt", text: buildLlmsText(twins) },
    { path: "manifest.webmanifest", text: manifest },
  ];
  return [...sitemap, ...rest];
});

/** Renders one social image when its route names published content, and reports whether it did. */
const writeSocialImage = Effect.fn("www.static.socialImage")(function* (
  outDir: string,
  logoSvg: string,
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

const main = Effect.fn("www.static.build")(function* (
  outDir: string,
  pageListFile: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const pages = yield* readPagePaths(pageListFile);
  const twins = yield* Effect.forEach(
    pages,
    (page) => writeMarkdownTwin(outDir, page),
    { concurrency: 8 }
  );
  const twinPages = Arr.getSomes(twins);
  const textArtifacts = yield* readTextArtifacts(twinPages);
  yield* Effect.forEach(
    textArtifacts,
    ({ path: file, text }) => writeArtifact(outDir, file, text),
    { concurrency: 8, discard: true }
  );

  const logoSvg = yield* fs.readFileString(path.resolve(LOGO_FILE));
  const sources = listSocialImageSources(LOCALES);
  const started = yield* Clock.currentTimeMillis;
  const written = yield* Effect.forEach(
    sources,
    (source) => writeSocialImage(outDir, logoSvg, source),
    { concurrency: 8 }
  );
  const images = Arr.filter(written, Boolean).length;
  const elapsed = (yield* Clock.currentTimeMillis) - started;
  const perThousand = images === 0 ? 0 : (elapsed * 1000) / images;
  process.stdout.write(
    Arr.join(
      [
        `static text artifacts: ${textArtifacts.length}`,
        `markdown twins: ${twinPages.length} of ${pages.length} prerendered pages`,
        `social image sources: ${sources.length}`,
        `social images written: ${images}`,
        `social images skipped (no published copy): ${sources.length - images}`,
        `social image render time: ${elapsed} ms (${perThousand.toFixed(0)} ms per 1,000 images)`,
        "",
      ],
      "\n"
    )
  );
});

/** Writes the static artifacts for the prerendered pages in the list into the client output directory. */
export async function buildStaticArtifacts(
  outDir: string,
  pageListFile: string
) {
  readRuntimeConfig();
  await Effect.runPromise(
    main(outDir, pageListFile).pipe(Effect.provide(NodeServices))
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
