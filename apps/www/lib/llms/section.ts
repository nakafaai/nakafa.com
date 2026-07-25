import { CONTENT_ROUTE_ARTIFACT_PAGE_SIZE } from "@repo/backend/convex/contents/constants";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { readPublishedArticleBuckets } from "@/lib/content/article/sitemap";
import { getRuntimeContentRouteCounts } from "@/lib/content/runtime/routes";
import {
  BASE_URL,
  type LlmsSection,
  SECTION_LABELS,
} from "@/lib/llms/constants";
import type { LlmsEntry } from "@/lib/llms/entries";
import { formatRouteTitle, getLocaleLabel } from "@/lib/llms/format";
import {
  formatLlmsEntryLine,
  renderLlmsIndexText,
} from "@/lib/llms/index-text";

type ContentSection = Exclude<LlmsSection, "site">;

/** One bounded section inventory and the runtime that owns its rows. */
export interface LlmsSectionPages {
  readonly owner: "published" | "source";
  readonly pageCount: number;
  readonly routeCount: number;
}

/** Reads bounded page counts from the active owner of one content section. */
export const getLlmsSectionPages = Effect.fn("www.llms.section.pages")(
  function* ({ locale, section }: { locale: Locale; section: ContentSection }) {
    if (section === "articles") {
      const published = yield* readPublishedArticleBuckets(locale);
      if (published.managed) {
        return {
          owner: "published",
          pageCount: published.buckets.length,
          routeCount: published.articleCount,
        } satisfies LlmsSectionPages;
      }
    }

    const counts = yield* getRuntimeContentRouteCounts({ locale });
    const routeCount =
      counts.find((count) => count.section === section)?.count ?? 0;
    return {
      owner: "source",
      pageCount: Math.ceil(routeCount / CONTENT_ROUTE_ARTIFACT_PAGE_SIZE),
      routeCount,
    } satisfies LlmsSectionPages;
  }
);

/** Builds a bounded section index from its active inventory owner. */
export function buildLlmsSectionPageMapText({
  locale,
  owner,
  pageCount,
  routeCount,
  section,
}: LlmsSectionPages & {
  readonly locale: Locale;
  readonly section: ContentSection;
}) {
  const localeLabel = getLocaleLabel(locale);
  const sectionLabel = SECTION_LABELS[section];
  const lines = buildSectionPageMapLines({
    locale,
    pageCount,
    section,
    sectionLabel,
  });
  const partitionLabel =
    owner === "published"
      ? "bounded published partitions"
      : `bounded catalog pages of at most ${CONTENT_ROUTE_ARTIFACT_PAGE_SIZE} routes`;

  return renderLlmsIndexText({
    lines,
    summary: `For AI agents: ${routeCount} ${localeLabel} ${sectionLabel.toLowerCase()} routes are split across ${pageCount} ${partitionLabel}. Follow the page pattern, then its page-level \`.md\` links.`,
    title: `Nakafa ${localeLabel} ${sectionLabel} Pages`,
  });
}

/** Builds one markdown index for a verified content listing page. */
export function buildLlmsListingIndexText({
  entries,
  locale,
  route,
  section,
}: {
  entries: LlmsEntry[];
  locale: Locale;
  route: string;
  section: ContentSection;
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
    summary: `For AI agents: verified ${localeLabel} ${sectionLabel.toLowerCase()} links for ${route}. Follow page-level \`.md\` links for clean markdown content.`,
    title,
  });
}

/** Builds one bounded page index from verified content entries. */
export function buildLlmsPageIndexText({
  entries,
  locale,
  page,
  section,
}: {
  entries: LlmsEntry[];
  locale: Locale;
  page: number;
  section: ContentSection;
}) {
  const localeLabel = getLocaleLabel(locale);
  const sectionLabel = SECTION_LABELS[section];

  if (entries.length === 0) {
    return renderLlmsIndexText({
      lines: [],
      summary: `This bounded ${sectionLabel.toLowerCase()} content page is currently empty.`,
      title: `Nakafa ${localeLabel} ${sectionLabel} Page ${page}`,
    });
  }

  return renderLlmsIndexText({
    lines: entries.map(formatLlmsEntryLine),
    summary: `For AI agents: bounded verified links for ${localeLabel} ${sectionLabel.toLowerCase()} page ${page}. Use \`.md\` links when available for agent-friendly markdown.`,
    title: `Nakafa ${localeLabel} ${sectionLabel} Page ${page}`,
  });
}

/** Builds constant-size navigation for a bounded content page range. */
function buildSectionPageMapLines({
  locale,
  pageCount,
  section,
  sectionLabel,
}: {
  locale: Locale;
  pageCount: number;
  section: ContentSection;
  sectionLabel: string;
}) {
  if (pageCount === 0) {
    return [];
  }

  const pagePath = `${BASE_URL}/llms/${locale}/${section}/page`;
  const lastPage = pageCount - 1;
  const lines = [
    `- [${sectionLabel} page 0](${pagePath}/0/llms.txt): first bounded content page.`,
  ];

  if (lastPage > 0) {
    lines.push(
      `- [${sectionLabel} page ${lastPage}](${pagePath}/${lastPage}/llms.txt): last bounded content page.`
    );
  }

  lines.push(
    `- Page URL pattern: \`${pagePath}/{page}/llms.txt\`, where \`page\` is an integer from 0 through ${lastPage}.`
  );

  return lines;
}
