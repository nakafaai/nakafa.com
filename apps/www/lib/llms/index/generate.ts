import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { hasLocale, type Locale } from "next-intl";
import { BASE_URL, type LlmsSection } from "@/lib/llms/constants";
import { getContentPageLlmsEntries } from "@/lib/llms/content/entries";
import { getContentListingLlmsEntries } from "@/lib/llms/content/listing";
import {
  getLlmsSections,
  isLlmsSection,
  type LlmsEntry,
} from "@/lib/llms/entries";
import { getLocaleLabel, stripLlmsRouteExtension } from "@/lib/llms/format";
import { getPublicLlmsSectionIndexLines } from "@/lib/llms/index/public";
import {
  formatLlmsEntryLine,
  renderLlmsIndexText,
} from "@/lib/llms/index/render";
import {
  buildLlmsListingIndexText,
  buildLlmsPageIndexText,
  buildLlmsSectionPageMapText,
  getLlmsSectionPages,
} from "@/lib/llms/section";
import { readSiteLlmsEntries } from "@/lib/llms/site";

const LOCALE_INDEX_ENTRY_LIMIT = 60;

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
      const entries = yield* readSiteLlmsEntries(locale);
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
      const pages = yield* getLlmsSectionPages({
        locale,
        section,
      });
      return buildLlmsSectionPageMapText({
        locale,
        ...pages,
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

/** Builds the bounded site index from derived and signed Page routes. */
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
    summary: `For AI agents: reviewed ${localeLabel} site pages from Nakafa indexes and the active signed Page catalog.`,
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
const getLocaleIndexEntries = Effect.fn("www.llms.locale.entries")(function* (
  locale: Locale
) {
  const sections = getLlmsSections().filter(isContentLlmsSection);
  const siteEntries = yield* readSiteLlmsEntries(locale);

  const sectionEntries = yield* Effect.all(
    sections.map((section) =>
      getContentPageLlmsEntries({
        locale,
        page: 0,
        section,
      })
    )
  );
  const entries = [...siteEntries];

  for (const pageEntries of sectionEntries) {
    if (pageEntries === null) {
      continue;
    }

    entries.push(...pageEntries);
  }

  return entries.slice(0, LOCALE_INDEX_ENTRY_LIMIT);
});

/** Excludes the static site section when building content-backed locale starter links. */
function isContentLlmsSection(
  section: LlmsSection
): section is Exclude<LlmsSection, "site"> {
  return section !== "site";
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
