import { getArticleSummaries } from "@repo/contents/_lib/articles/slug";
import { getAllSurah, getSurahName } from "@repo/contents/_lib/quran";
import { isMaterialLessonRoute } from "@repo/contents/_types/route/content";
import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import { readStaticPublicTryoutRoutes } from "@repo/contents/_types/route/tryout/static";
import { ARTICLE_CATEGORIES } from "@repo/contents/_types/taxonomy";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { BASE_URL, type LlmsSection } from "@/lib/llms/constants";
import type { LlmsEntry } from "@/lib/llms/entries";
import { getLocaleLabel } from "@/lib/llms/format";
import {
  formatLlmsEntryLine,
  renderLlmsIndexText,
} from "@/lib/llms/index-text";

export const LLMS_PAGE_CATALOG_SEGMENT = "pages";

/** Builds one locale page-catalog index from source-backed public route entries. */
export const getLlmsPageCatalogIndexText = Effect.fn(
  "www.llms.index.pageCatalog"
)(function* (locale: Locale) {
  const entries = yield* getLocalePageCatalogEntries(locale);

  return buildLocalePageCatalogIndexText({ entries, locale });
});

/** Detects the locale page-catalog index route used for AFDocs sitemap coverage. */
export function isLlmsPageCatalogRoute(prefixParts: readonly string[]) {
  return (
    prefixParts.length === 1 && prefixParts[0] === LLMS_PAGE_CATALOG_SEGMENT
  );
}

/** Formats one locale index link to its broad source-backed page catalog. */
export function formatLlmsPageCatalogLine({
  locale,
  localeLabel,
}: {
  locale: Locale;
  localeLabel: string;
}) {
  return `- [${localeLabel} page catalog](${BASE_URL}/llms/${locale}/${LLMS_PAGE_CATALOG_SEGMENT}/llms.txt): source-backed ${localeLabel} page URLs for AFDocs and agent coverage.`;
}

/** Builds the locale-level page catalog that lists source-backed page URLs. */
function buildLocalePageCatalogIndexText({
  entries,
  locale,
}: {
  entries: LlmsEntry[];
  locale: Locale;
}) {
  const localeLabel = getLocaleLabel(locale);

  return renderLlmsIndexText({
    lines: entries.map(formatLlmsEntryLine),
    summary: `For AI agents: page-level ${localeLabel} URLs from the source-backed public route catalog. Prefer \`.md\` links for clean markdown retrieval when they are available.`,
    title: `Nakafa ${localeLabel} Page Catalog`,
  });
}

/** Reads every source-backed public page entry for one locale for AFDocs coverage. */
function getLocalePageCatalogEntries(locale: Locale) {
  return Effect.all([
    readArticlePageCatalogEntries(locale),
    Effect.sync(() => readMaterialPageCatalogEntries(locale)),
    Effect.sync(() => readQuranPageCatalogEntries(locale)),
    Effect.sync(() => readTryoutPageCatalogEntries(locale)),
  ]).pipe(Effect.map((entrySets) => sortUniqueEntries(entrySets.flat())));
}

/** Reads source-backed article detail pages without calling the runtime catalog. */
function readArticlePageCatalogEntries(locale: Locale) {
  return Effect.forEach(
    ARTICLE_CATEGORIES,
    (category) =>
      getArticleSummaries(category, locale).pipe(
        Effect.map((articles) =>
          articles.map((article) =>
            buildPageCatalogEntry({
              description: article.description,
              hasMarkdown: true,
              locale,
              publicPath: `articles/${category}/${article.slug}`,
              section: "articles",
              title: article.title,
            })
          )
        )
      ),
    { concurrency: 2 }
  ).pipe(Effect.map((entries) => entries.flat()));
}

/** Reads source-backed material lesson pages without calling Convex. */
function readMaterialPageCatalogEntries(locale: Locale) {
  return readStaticPublicContentRoutes()
    .filter((route) => route.locale === locale && route.sitemap)
    .filter(isMaterialLessonRoute)
    .map((route) =>
      buildPageCatalogEntry({
        description: route.description,
        hasMarkdown: true,
        locale,
        publicPath: route.publicPath,
        section: "material",
        title: route.title,
      })
    );
}

/** Reads source-backed Quran surah pages without calling Convex. */
function readQuranPageCatalogEntries(locale: Locale) {
  return getAllSurah().map((surah) =>
    buildPageCatalogEntry({
      description: surah.name.translation[locale],
      hasMarkdown: true,
      locale,
      publicPath: `quran/${surah.number}`,
      section: "quran",
      title: `${surah.number}. ${getSurahName({ locale, name: surah.name })}`,
    })
  );
}

/** Reads source-backed try-out catalog pages without calling Convex. */
function readTryoutPageCatalogEntries(locale: Locale) {
  return readStaticPublicTryoutRoutes()
    .filter((route) => route.locale === locale && route.sitemap)
    .map((route) =>
      buildPageCatalogEntry({
        description: route.description,
        hasMarkdown: route.kind === "tryout-section",
        locale,
        publicPath: route.publicPath,
        section: "tryout",
        title: route.title,
      })
    );
}

/** Builds one page-catalog entry from source-projected public route metadata. */
function buildPageCatalogEntry({
  description,
  hasMarkdown,
  locale,
  publicPath,
  section,
  title,
}: {
  description: string | undefined;
  hasMarkdown: boolean;
  locale: Locale;
  publicPath: string;
  section: LlmsSection;
  title: string;
}): LlmsEntry {
  const hrefBase = `${BASE_URL}/${locale}/${publicPath}`;

  return {
    description,
    href: hasMarkdown ? `${hrefBase}.md` : hrefBase,
    route: `/${publicPath}`,
    section,
    segments: publicPath.split("/").filter(Boolean),
    title,
  };
}

/** Sorts page entries and removes duplicate source-projected hrefs. */
function sortUniqueEntries(entries: Iterable<LlmsEntry>) {
  const entriesByHref = new Map<string, LlmsEntry>();

  for (const entry of entries) {
    entriesByHref.set(entry.href, entry);
  }

  return Array.from(entriesByHref.values()).sort((a, b) =>
    a.href.localeCompare(b.href)
  );
}
