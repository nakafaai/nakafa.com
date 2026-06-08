import { NAKAFA_MCP_RECOMMENDED_ENDPOINT } from "@repo/contents/_lib/agent/constants";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { cacheLife } from "next/cache";
import { hasLocale, type Locale } from "next-intl";
import {
  BASE_URL,
  type LlmsSection,
  SECTION_LABELS,
} from "@/lib/llms/constants";
import {
  getContentPageLlmsEntries,
  getLlmsSections,
  getSiteLlmsEntries,
  isLlmsSection,
  type LlmsEntry,
} from "@/lib/llms/entries";
import { getLocaleLabel, stripLlmsRouteExtension } from "@/lib/llms/format";
import {
  type ContentSitemapPage,
  getSitemapPageDescriptorsEffect,
} from "@/lib/sitemap/routes";

/** Builds the small root llms index that points agents to section indexes. */
export function buildRootLlmsIndexText() {
  return [
    "# Nakafa",
    "",
    "> Nakafa publishes multilingual learning materials. Use this root index to choose a locale and section, then open the linked section llms.txt files for page-level markdown URLs.",
    "",
    "## Indexes",
    "",
    ...routing.locales.map(formatLocaleIndexLine),
    "",
    "## References",
    "",
    `- MCP endpoint: \`${NAKAFA_MCP_RECOMMENDED_ENDPOINT}\` with tools \`nakafa_search_content\`, \`nakafa_get_content\`, \`nakafa_get_taxonomy\`, \`nakafa_get_exercise\`, and \`nakafa_get_quran_reference\`.`,
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

  cacheLife("seconds");

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
      return buildLocaleLlmsIndexText(locale);
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

/** Builds the locale-level index that links to each content section. */
function buildLocaleLlmsIndexText(locale: Locale) {
  const localeLabel = getLocaleLabel(locale);

  return [
    `# Nakafa ${localeLabel} Content`,
    "",
    `> For AI agents: use [llms.txt](${BASE_URL}/llms.txt). ${localeLabel} Nakafa content index generated from the sitemap. Follow a section llms.txt link, then use \`.md\` page links when available for clean markdown content.`,
    "",
    "## Sections",
    "",
    ...getLlmsSections().map((section) =>
      formatSectionIndexLine({ locale, localeLabel, section })
    ),
    "",
  ].join("\n");
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
  return getSitemapPageDescriptorsEffect().pipe(
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

/** Formats one root index link to a locale index. */
function formatLocaleIndexLine(locale: Locale) {
  const localeLabel = getLocaleLabel(locale);
  return `- [${localeLabel} content index](${BASE_URL}/llms/${locale}/llms.txt): ${localeLabel} pages grouped by content area.`;
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
