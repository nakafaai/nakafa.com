import { routing } from "@repo/internationalization/src/routing";
import { cacheLife } from "next/cache";
import { hasLocale, type Locale } from "next-intl";
import {
  BASE_URL,
  LLMS_INDEX_TARGET_MAX_CHARS,
  type LlmsSection,
  SECTION_LABELS,
} from "@/lib/llms/constants";
import {
  getLlmsSections,
  getLocalizedLlmsEntries,
  isLlmsSection,
  type LlmsEntry,
} from "@/lib/llms/entries";
import {
  formatSegmentTitle,
  getLocaleLabel,
  stripLlmsRouteExtension,
} from "@/lib/llms/format";

/** Builds the small root llms index that points agents to section indexes. */
export function buildRootLlmsIndexText() {
  return [
    "# Nakafa",
    "",
    "> Nakafa is a multilingual educational platform. Use this root index to choose a locale and section, then open the linked section llms.txt files for page-level markdown URLs.",
    "",
    "## Indexes",
    "",
    ...routing.locales.map(formatLocaleIndexLine),
    `- [MCP server](${BASE_URL}/mcp): Tool endpoint for searching and retrieving Nakafa content.`,
    `- [Sitemap](${BASE_URL}/sitemap.xml): Canonical sitemap used to generate these indexes.`,
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

  cacheLife("max");

  return await getLlmsSectionIndexText(cleanSlug);
}

/** Builds a locale or section llms index from a cleaned llms route. */
export async function getLlmsSectionIndexText(cleanSlug: string) {
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

  const entries = await getLocalizedLlmsEntries(locale);
  const scopedEntries = entries.filter((entry) =>
    entryBelongsToPrefix(entry, prefixParts)
  );

  if (scopedEntries.length === 0) {
    return null;
  }

  return buildScopedLlmsIndexText({
    entries: scopedEntries,
    locale,
    prefixParts,
    section,
  });
}

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

  return {
    locale: rawLocale,
    prefixParts: parts.slice(2),
  };
}

/** Builds the locale-level index that links to each content section. */
function buildLocaleLlmsIndexText(locale: Locale) {
  const localeLabel = getLocaleLabel(locale);

  return [
    `# Nakafa ${localeLabel} Docs`,
    "",
    `> ${localeLabel} Nakafa content index generated from the sitemap. Follow a section llms.txt link, then use \`.md\` page links when available for clean markdown content.`,
    "",
    "## Sections",
    "",
    ...getLlmsSections().map((section) =>
      formatSectionIndexLine({ locale, localeLabel, section })
    ),
    "",
  ].join("\n");
}

/** Builds a scoped section index, splitting large scopes into child indexes. */
function buildScopedLlmsIndexText({
  entries,
  locale,
  prefixParts,
  section,
}: {
  entries: LlmsEntry[];
  locale: Locale;
  prefixParts: string[];
  section: LlmsSection;
}) {
  const localeLabel = getLocaleLabel(locale);
  const sectionLabel = SECTION_LABELS[section];
  const titleSuffix = prefixParts.slice(1).map(formatSegmentTitle).join(" / ");
  let title = `Nakafa ${localeLabel} ${sectionLabel} Index`;

  if (titleSuffix) {
    title = `Nakafa ${localeLabel} ${sectionLabel}: ${titleSuffix} Index`;
  }

  const summary = `Sitemap-derived links for ${localeLabel} ${sectionLabel.toLowerCase()} pages. Use \`.md\` links when available for agent-friendly markdown.`;
  const allPageLines = entries.map(formatLlmsEntryLine);
  const fullPageIndex = renderIndexText({
    lines: allPageLines,
    summary,
    title,
  });

  if (fullPageIndex.length <= LLMS_INDEX_TARGET_MAX_CHARS) {
    return fullPageIndex;
  }

  const directEntries = entries.filter((entry) =>
    entryMatchesExactPrefix(entry, prefixParts)
  );
  const childGroups = getChildGroups(entries, prefixParts);
  const lines = [
    ...childGroups.map(([segment, childEntries]) =>
      formatChildIndexLine({ childEntries, locale, prefixParts, segment })
    ),
  ];

  if (directEntries.length > 0) {
    lines.push(...directEntries.map(formatLlmsEntryLine));
  }

  return renderIndexText({
    lines,
    summary,
    title,
  });
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

/** Checks whether an entry is inside the current section prefix. */
function entryBelongsToPrefix(entry: LlmsEntry, prefixParts: string[]) {
  if (prefixParts[0] !== entry.section) {
    return false;
  }

  return prefixParts.every((part, index) => entry.segments[index] === part);
}

/** Checks whether an entry is exactly the current prefix page. */
function entryMatchesExactPrefix(entry: LlmsEntry, prefixParts: string[]) {
  return (
    entryBelongsToPrefix(entry, prefixParts) &&
    entry.segments.length === prefixParts.length
  );
}

/** Groups entries by the next route segment below the current prefix. */
function getChildGroups(entries: LlmsEntry[], prefixParts: string[]) {
  const groups = new Map<string, LlmsEntry[]>();

  for (const entry of entries) {
    const childSegment = entry.segments[prefixParts.length];

    if (!childSegment) {
      continue;
    }

    const group = groups.get(childSegment) ?? [];
    group.push(entry);
    groups.set(childSegment, group);
  }

  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

/** Formats one child index link for a split section index. */
function formatChildIndexLine({
  childEntries,
  locale,
  prefixParts,
  segment,
}: {
  childEntries: LlmsEntry[];
  locale: Locale;
  prefixParts: string[];
  segment: string;
}) {
  const href = `${BASE_URL}/llms/${locale}/${[...prefixParts, segment].join("/")}/llms.txt`;
  return `- [${formatSegmentTitle(segment)}](${href}): Sitemap group with ${childEntries.length} pages.`;
}

/** Formats one page-level llms entry line. */
function formatLlmsEntryLine(entry: LlmsEntry) {
  const suffix = entry.description ? `: ${entry.description}` : "";
  return `- [${entry.title}](${entry.href})${suffix}`;
}

/** Formats one root index link to a locale index. */
function formatLocaleIndexLine(locale: Locale) {
  const localeLabel = getLocaleLabel(locale);
  return `- [${localeLabel} docs index](${BASE_URL}/llms/${locale}/llms.txt): ${localeLabel} pages grouped by content area.`;
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
