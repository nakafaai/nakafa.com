import { NAKAFA_MCP_RECOMMENDED_ENDPOINT } from "@repo/contents/_lib/agent/constants";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { hasLocale, type Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import {
  BASE_URL,
  type LlmsSection,
  SECTION_LABELS,
} from "@/lib/llms/constants";
import {
  getContentListingLlmsEntries,
  getContentPageLlmsEntries,
  getLlmsSections,
  getSiteLlmsEntries,
  isLlmsSection,
  type LlmsEntry,
} from "@/lib/llms/entries";
import {
  formatRouteTitle,
  getLocaleLabel,
  stripLlmsRouteExtension,
} from "@/lib/llms/format";
import {
  type ContentSitemapPage,
  readSitemapPageDescriptors,
} from "@/lib/sitemap/routes";

const LOCALE_INDEX_ENTRY_LIMIT = 60;
const PAGE_CATALOG_SEGMENT = "pages";

/** Builds the small root llms index that points agents to section indexes. */
export function buildRootLlmsIndexText() {
  return [
    "# Nakafa",
    "",
    "> Nakafa publishes multilingual learning materials. Use this root index to choose a locale, section, or page catalog for page-level markdown URLs.",
    "",
    "## Indexes",
    "",
    ...routing.locales.flatMap(formatLocaleIndexLines),
    "",
    "## References",
    "",
    `- [Nakafa MCP skill](${BASE_URL}/skill.md): public agent instructions for tools \`nakafa_search_content\`, \`nakafa_get_content\`, \`nakafa_get_taxonomy\`, \`nakafa_get_exercise\`, and \`nakafa_get_quran_reference\`. Recommended MCP endpoint: \`${NAKAFA_MCP_RECOMMENDED_ENDPOINT}\`.`,
    `- Full corpus map: \`${BASE_URL}/llms-full.txt\`; shard manifest: \`${BASE_URL}/llms-full/index.json\` for locale, section, topic, set, and Quran full-content files.`,
    `- Sitemap: \`${BASE_URL}/sitemap.xml\`, used to generate these indexes.`,
    "",
  ].join("\n");
}

/** Caches section index generation for Next.js Cache Components. */
export async function getCachedLlmsSectionIndexText({
  cleanSlug,
}: {
  cleanSlug: string;
}) {
  "use cache";

  applyContentRuntimeCache();

  return await Effect.runPromise(getLlmsSectionIndexText(cleanSlug));
}

/** Builds a locale or section llms index from a cleaned llms route. */
export const getLlmsSectionIndexText = Effect.fn("www.llms.index.text")(
  function* (cleanSlug: string) {
    const parsed = parseLlmsIndexSlug(cleanSlug);

    if (!parsed) {
      return null;
    }

    const { locale, prefixParts } = parsed;

    if (prefixParts.length === 0) {
      const entries = yield* getLocaleIndexEntries(locale);
      return buildLocaleLlmsIndexText({ entries, locale });
    }

    if (isLocalePageCatalogRoute(prefixParts)) {
      const entries = yield* getLocalePageCatalogEntries(locale);
      return buildLocalePageCatalogIndexText({ entries, locale });
    }

    const section = prefixParts[0];
    if (!isLlmsSection(section)) {
      return null;
    }

    if (section === "site") {
      const entries = yield* getSiteLlmsEntries(locale);
      return buildLlmsSiteIndexText({ entries, locale });
    }

    const page = parsePageIndex(prefixParts);
    if (page !== null) {
      const entries = yield* getContentPageLlmsEntries({
        locale,
        page,
        section,
      });

      return buildLlmsPageIndexText({
        entries,
        locale,
        page,
        section,
      });
    }

    if (prefixParts.length > 1) {
      const route = prefixParts.join("/");
      const entries = yield* getContentListingLlmsEntries({ locale, route });

      if (entries !== null) {
        return buildLlmsListingIndexText({
          entries,
          locale,
          route: `/${route}`,
          section,
        });
      }
    }

    if (prefixParts.length === 1) {
      const pages = yield* getLlmsSectionPages({ locale, section });
      return buildLlmsSectionPageMapText({ locale, pages, section });
    }

    return null;
  }
);

/** Parses `/llms/:locale/...` index routes into locale and prefix parts. */
function parseLlmsIndexSlug(cleanSlug: string) {
  const parts = stripLlmsRouteExtension(cleanSlug).split("/").filter(Boolean);

  if (parts[0] !== "llms") {
    return null;
  }

  const rawLocale = parts[1];
  if (!hasLocale(routing.locales, rawLocale)) {
    return null;
  }

  const prefixParts = parts.slice(2);
  if (prefixParts.at(-1) === "llms") {
    prefixParts.pop();
  }

  return {
    locale: rawLocale,
    prefixParts,
  };
}

/** Detects the locale page-catalog index route used for AFDocs sitemap coverage. */
function isLocalePageCatalogRoute(prefixParts: readonly string[]) {
  return prefixParts.length === 1 && prefixParts[0] === PAGE_CATALOG_SEGMENT;
}

/** Builds the bounded site index from static site routes only. */
function buildLlmsSiteIndexText({
  entries,
  locale,
}: {
  entries: LlmsEntry[];
  locale: Locale;
}) {
  const localeLabel = getLocaleLabel(locale);

  return renderIndexText({
    lines: entries.map(formatLlmsEntryLine),
    summary: `For AI agents: static ${localeLabel} site pages that do not require content route catalog reads.`,
    title: `Nakafa ${localeLabel} Site Pages`,
  });
}

/** Builds the locale-level index that links to sections and starter page URLs. */
function buildLocaleLlmsIndexText({
  entries,
  locale,
}: {
  entries: LlmsEntry[];
  locale: Locale;
}) {
  const localeLabel = getLocaleLabel(locale);
  const starterLines: string[] = [];
  if (entries.length > 0) {
    starterLines.push(
      "## Starter Pages",
      "",
      ...entries.map(formatLlmsEntryLine),
      ""
    );
  }

  return [
    `# Nakafa ${localeLabel} Content`,
    "",
    `> For AI agents: use [llms.txt](${BASE_URL}/llms.txt). ${localeLabel} Nakafa content index generated from the sitemap. Start with the direct \`.md\` page links below, open the page catalog for broad coverage, or open a section llms.txt for the bounded route catalog.`,
    "",
    "## Catalog",
    "",
    formatLocalePageCatalogLine({ locale, localeLabel }),
    "",
    "## Sections",
    "",
    ...getLlmsSections().map((section) =>
      formatSectionIndexLine({ locale, localeLabel, section })
    ),
    "",
    ...starterLines,
  ].join("\n");
}

/** Builds the locale-level page catalog that lists sitemap-backed page URLs. */
function buildLocalePageCatalogIndexText({
  entries,
  locale,
}: {
  entries: LlmsEntry[];
  locale: Locale;
}) {
  const localeLabel = getLocaleLabel(locale);

  if (entries.length === 0) {
    return renderIndexText({
      lines: [],
      summary: `This ${localeLabel} page catalog currently has no markdown entries.`,
      title: `Nakafa ${localeLabel} Page Catalog`,
    });
  }

  return renderIndexText({
    lines: entries.map(formatLlmsEntryLine),
    summary: `For AI agents: page-level ${localeLabel} URLs from the sitemap-backed content route catalog. Prefer \`.md\` links for clean markdown retrieval when they are available.`,
    title: `Nakafa ${localeLabel} Page Catalog`,
  });
}

/** Reads a bounded starter set of page-level markdown entries for one locale. */
function getLocaleIndexEntries(locale: Locale) {
  const sections = getLlmsSections().filter(isContentLlmsSection);

  return Effect.all(
    sections.map((section) =>
      getContentPageLlmsEntries({
        locale,
        page: 0,
        section,
      })
    )
  ).pipe(
    Effect.map((sectionEntries) =>
      sectionEntries.flat().slice(0, LOCALE_INDEX_ENTRY_LIMIT)
    )
  );
}

/** Excludes the static site section when building content-backed locale starter links. */
function isContentLlmsSection(
  section: LlmsSection
): section is Exclude<LlmsSection, "site"> {
  return section !== "site";
}

/** Reads every sitemap-backed page entry for one locale for AFDocs coverage. */
function getLocalePageCatalogEntries(locale: Locale) {
  return readSitemapPageDescriptors().pipe(
    Effect.flatMap((pages) =>
      Effect.forEach(
        pages.filter(
          (page): page is ContentSitemapPage =>
            "kind" in page && page.kind === "content" && page.locale === locale
        ),
        (page) =>
          getContentPageLlmsEntries({
            locale,
            page: page.page,
            section: page.section,
          }),
        { concurrency: 4 }
      )
    ),
    Effect.map((pageEntries) => sortUniqueEntries(pageEntries.flat()))
  );
}

/** Builds a bounded section index that links to materialized route pages. */
function buildLlmsSectionPageMapText({
  locale,
  pages,
  section,
}: {
  locale: Locale;
  pages: ContentSitemapPage[];
  section: Exclude<LlmsSection, "site">;
}) {
  const localeLabel = getLocaleLabel(locale);
  const sectionLabel = SECTION_LABELS[section];
  const lines = pages.map((page) => {
    const href = `${BASE_URL}/llms/${locale}/${section}/page/${page.page}/llms.txt`;
    return `- [${sectionLabel} page ${page.page}](${href}): bounded route-catalog artifact page for ${localeLabel} ${sectionLabel.toLowerCase()}.`;
  });

  return renderIndexText({
    lines,
    summary: `For AI agents: choose a bounded ${sectionLabel.toLowerCase()} route artifact page, then follow page-level \`.md\` links. This index reads materialized page descriptors, not section routes.`,
    title: `Nakafa ${localeLabel} ${sectionLabel} Pages`,
  });
}

/**
 * Builds a markdown index for one content listing page.
 *
 * Empty listings render an explicit empty index, while null listing lookups are
 * handled before this function and mean the route is unsupported.
 */
function buildLlmsListingIndexText({
  entries,
  locale,
  route,
  section,
}: {
  entries: LlmsEntry[];
  locale: Locale;
  route: string;
  section: Exclude<LlmsSection, "site">;
}) {
  const localeLabel = getLocaleLabel(locale);
  const sectionLabel = SECTION_LABELS[section];
  const title = `${formatRouteTitle(route)} ${sectionLabel}`;

  if (entries.length === 0) {
    return renderIndexText({
      lines: [],
      summary: `This ${localeLabel} ${sectionLabel.toLowerCase()} listing currently has no markdown entries.`,
      title,
    });
  }

  return renderIndexText({
    lines: entries.map(formatLlmsEntryLine),
    summary: `For AI agents: source-backed ${localeLabel} ${sectionLabel.toLowerCase()} links for ${route}. Follow page-level \`.md\` links for clean markdown content.`,
    title,
  });
}

/** Builds one bounded page index from materialized route entries. */
function buildLlmsPageIndexText({
  entries,
  locale,
  page,
  section,
}: {
  entries: LlmsEntry[];
  locale: Locale;
  page: number;
  section: Exclude<LlmsSection, "site">;
}) {
  const localeLabel = getLocaleLabel(locale);
  const sectionLabel = SECTION_LABELS[section];

  if (entries.length === 0) {
    return renderIndexText({
      lines: [],
      summary: `This bounded ${sectionLabel.toLowerCase()} route-catalog page is currently empty.`,
      title: `Nakafa ${localeLabel} ${sectionLabel} Page ${page}`,
    });
  }

  return renderIndexText({
    lines: entries.map(formatLlmsEntryLine),
    summary: `For AI agents: bounded sitemap-derived links for ${localeLabel} ${sectionLabel.toLowerCase()} page ${page}. Use \`.md\` links when available for agent-friendly markdown.`,
    title: `Nakafa ${localeLabel} ${sectionLabel} Page ${page}`,
  });
}

/** Parses `/:section/page/:id` index routes into a materialized page id. */
function parsePageIndex(prefixParts: readonly string[]) {
  if (prefixParts.length !== 3 || prefixParts[1] !== "page") {
    return null;
  }

  const pageSegment = prefixParts.slice(2).join("");
  const page = Number.parseInt(pageSegment, 10);
  if (!Number.isInteger(page) || page < 0) {
    return null;
  }

  return page;
}

/** Reads page descriptors for one locale and content section. */
function getLlmsSectionPages({
  locale,
  section,
}: {
  locale: Locale;
  section: Exclude<LlmsSection, "site">;
}) {
  return readSitemapPageDescriptors().pipe(
    Effect.map((pages) =>
      pages.filter(
        (page): page is ContentSitemapPage =>
          "section" in page &&
          page.locale === locale &&
          page.section === section
      )
    )
  );
}

/** Renders one llms index document with the standard title and summary shape. */
function renderIndexText({
  lines,
  summary,
  title,
}: {
  lines: string[];
  summary: string;
  title: string;
}) {
  return [
    `# ${title}`,
    "",
    `> ${summary}`,
    "",
    "## Pages",
    "",
    ...lines,
    "",
  ].join("\n");
}

/** Formats one page-level llms entry line. */
function formatLlmsEntryLine(entry: LlmsEntry) {
  const suffix = entry.description ? `: ${entry.description}` : "";
  return `- [${entry.title}](${entry.href})${suffix}`;
}

/** Sorts page entries and removes routes repeated across sitemap parent rows. */
function sortUniqueEntries(entries: Iterable<LlmsEntry>) {
  const entriesByHref = new Map<string, LlmsEntry>();

  for (const entry of entries) {
    if (!entriesByHref.has(entry.href)) {
      entriesByHref.set(entry.href, entry);
    }
  }

  return Array.from(entriesByHref.values()).sort((a, b) =>
    a.href.localeCompare(b.href)
  );
}

/** Formats root index links to locale, page-catalog, and section indexes. */
function formatLocaleIndexLines(locale: Locale) {
  const localeLabel = getLocaleLabel(locale);
  return [
    `- [${localeLabel} content index](${BASE_URL}/llms/${locale}/llms.txt): ${localeLabel} pages, section indexes, and page catalog.`,
    formatLocalePageCatalogLine({ locale, localeLabel }),
    ...getLlmsSections().map((section) =>
      formatSectionIndexLine({ locale, localeLabel, section })
    ),
  ];
}

/** Formats one locale index link to its broad sitemap-backed page catalog. */
function formatLocalePageCatalogLine({
  locale,
  localeLabel,
}: {
  locale: Locale;
  localeLabel: string;
}) {
  return `- [${localeLabel} page catalog](${BASE_URL}/llms/${locale}/${PAGE_CATALOG_SEGMENT}/llms.txt): sitemap-backed ${localeLabel} page URLs for AFDocs and agent coverage.`;
}

/** Formats one locale index link to a section index. */
function formatSectionIndexLine({
  locale,
  localeLabel,
  section,
}: {
  locale: Locale;
  localeLabel: string;
  section: LlmsSection;
}) {
  const sectionLabel = SECTION_LABELS[section];
  return `- [${sectionLabel}](${BASE_URL}/llms/${locale}/${section}/llms.txt): ${localeLabel} ${sectionLabel.toLowerCase()}.`;
}
