import { CONTENT_ROUTE_ARTIFACT_PAGE_SIZE } from "@repo/backend/convex/contents/constants";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { hasLocale, type Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { getRuntimeContentRouteCounts } from "@/lib/content/runtime/routes";
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
  formatLlmsEntryLine,
  renderLlmsIndexText,
} from "@/lib/llms/index-text";
import { getPublicLlmsSectionIndexLines } from "@/lib/llms/public-index";

const LOCALE_INDEX_ENTRY_LIMIT = 60;

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

    const section = prefixParts[0];
    if (!isLlmsSection(section)) {
      return null;
    }

    if (section === "site") {
      const entries = getSiteLlmsEntries(locale);
      return buildLlmsSiteIndexText({ entries, locale });
    }

    const page = parsePageIndex(prefixParts);
    if (page !== null) {
      const entries = yield* getContentPageLlmsEntries({
        locale,
        page,
        section,
      });

      if (entries === null) {
        return null;
      }

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
      const { pageCount, routeCount } = yield* getLlmsSectionPages({
        locale,
        section,
      });
      return buildLlmsSectionPageMapText({
        locale,
        pageCount,
        routeCount,
        section,
      });
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

/** Builds the bounded site index from static site routes only. */
function buildLlmsSiteIndexText({
  entries,
  locale,
}: {
  entries: LlmsEntry[];
  locale: Locale;
}) {
  const localeLabel = getLocaleLabel(locale);

  return renderLlmsIndexText({
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
    `> For AI agents: use [llms.txt](${BASE_URL}/llms.txt). Start with the direct ${localeLabel} page links below or open a public section index for bounded route-catalog pages.`,
    "",
    "## Sections",
    "",
    ...getPublicLlmsSectionIndexLines(locale),
    "",
    ...starterLines,
  ].join("\n");
}

/** Reads a bounded starter set of page-level markdown entries for one locale. */
function getLocaleIndexEntries(locale: Locale) {
  const sections = getLlmsSections().filter(isContentLlmsSection);
  const siteEntries = getSiteLlmsEntries(locale);

  return Effect.all(
    sections.map((section) =>
      getContentPageLlmsEntries({
        locale,
        page: 0,
        section,
      })
    )
  ).pipe(
    Effect.map((sectionEntries) => {
      const entries = [...siteEntries];

      for (const pageEntries of sectionEntries) {
        if (pageEntries === null) {
          continue;
        }

        entries.push(...pageEntries);
      }

      return entries.slice(0, LOCALE_INDEX_ENTRY_LIMIT);
    })
  );
}

/** Excludes the static site section when building content-backed locale starter links. */
function isContentLlmsSection(
  section: LlmsSection
): section is Exclude<LlmsSection, "site"> {
  return section !== "site";
}

/** Builds a bounded section index that links to materialized route pages. */
function buildLlmsSectionPageMapText({
  locale,
  pageCount,
  routeCount,
  section,
}: {
  locale: Locale;
  pageCount: number;
  routeCount: number;
  section: Exclude<LlmsSection, "site">;
}) {
  const localeLabel = getLocaleLabel(locale);
  const sectionLabel = SECTION_LABELS[section];
  const lines = buildSectionPageMapLines({
    locale,
    pageCount,
    section,
    sectionLabel,
  });

  return renderLlmsIndexText({
    lines,
    summary: `For AI agents: ${routeCount} ${localeLabel} ${sectionLabel.toLowerCase()} routes are split across ${pageCount} bounded catalog pages of at most ${CONTENT_ROUTE_ARTIFACT_PAGE_SIZE} routes. Follow the page pattern, then its page-level \`.md\` links.`,
    title: `Nakafa ${localeLabel} ${sectionLabel} Pages`,
  });
}

/** Builds constant-size navigation for a bounded catalog page range. */
function buildSectionPageMapLines({
  locale,
  pageCount,
  section,
  sectionLabel,
}: {
  locale: Locale;
  pageCount: number;
  section: Exclude<LlmsSection, "site">;
  sectionLabel: string;
}) {
  if (pageCount === 0) {
    return [];
  }

  const pagePath = `${BASE_URL}/llms/${locale}/${section}/page`;
  const lastPage = pageCount - 1;
  const lines = [
    `- [${sectionLabel} page 0](${pagePath}/0/llms.txt): first bounded route-catalog page.`,
  ];

  if (lastPage > 0) {
    lines.push(
      `- [${sectionLabel} page ${lastPage}](${pagePath}/${lastPage}/llms.txt): last bounded route-catalog page.`
    );
  }

  lines.push(
    `- Page URL pattern: \`${pagePath}/{page}/llms.txt\`, where \`page\` is an integer from 0 through ${lastPage}.`
  );

  return lines;
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
    return renderLlmsIndexText({
      lines: [],
      summary: `This ${localeLabel} ${sectionLabel.toLowerCase()} listing currently has no markdown entries.`,
      title,
    });
  }

  return renderLlmsIndexText({
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
    return renderLlmsIndexText({
      lines: [],
      summary: `This bounded ${sectionLabel.toLowerCase()} route-catalog page is currently empty.`,
      title: `Nakafa ${localeLabel} ${sectionLabel} Page ${page}`,
    });
  }

  return renderLlmsIndexText({
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
  const page = Number(pageSegment);
  if (!Number.isSafeInteger(page) || page < 0 || String(page) !== pageSegment) {
    return null;
  }

  return page;
}

/** Reads one constant-size count row for a locale and content section. */
function getLlmsSectionPages({
  locale,
  section,
}: {
  locale: Locale;
  section: Exclude<LlmsSection, "site">;
}) {
  return getRuntimeContentRouteCounts({ locale }).pipe(
    Effect.map((counts) => {
      const routeCount =
        counts.find((count) => count.section === section)?.count ?? 0;

      return {
        pageCount: Math.ceil(routeCount / CONTENT_ROUTE_ARTIFACT_PAGE_SIZE),
        routeCount,
      };
    })
  );
}
