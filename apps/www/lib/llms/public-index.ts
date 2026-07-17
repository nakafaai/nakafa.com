import { NAKAFA_MCP_RECOMMENDED_ENDPOINT } from "@repo/contents/_lib/agent/constants";
import {
  PUBLIC_ROUTE_SURFACES,
  type PublicRouteSurface,
} from "@repo/contents/_types/route/surface";
import { routing } from "@repo/internationalization/src/routing";
import type { Locale } from "next-intl";
import {
  BASE_URL,
  type LlmsSection,
  SECTION_LABELS,
} from "@/lib/llms/constants";
import { getLocaleLabel, stripLlmsRouteExtension } from "@/lib/llms/format";
import { renderLlmsIndexText } from "@/lib/llms/index-text";

type LlmsContentSection = Exclude<LlmsSection, "site">;

/** One public-prefix index in the locale discovery hierarchy. */
interface PublicLlmsSectionIndex {
  label: string;
  prefix: string;
  section?: LlmsContentSection;
}

/** Renders the constant-size root discovery index. */
export function buildRootLlmsIndexText() {
  return [
    "# Nakafa",
    "",
    "> Nakafa publishes multilingual learning materials. Choose a locale, then follow its public-prefix indexes and bounded catalog pages to page-level markdown URLs.",
    "",
    "## Indexes",
    "",
    ...routing.locales.map(formatLocaleIndexLine),
    "",
    "## References",
    "",
    `- [Nakafa MCP skill](${BASE_URL}/skill.md): public agent instructions for tools \`nakafa_search_content\`, \`nakafa_get_content\`, \`nakafa_get_taxonomy\`, and \`nakafa_get_quran_reference\`. Recommended MCP endpoint: \`${NAKAFA_MCP_RECOMMENDED_ENDPOINT}\`.`,
    `- Sitemap: \`${BASE_URL}/sitemap.xml\`.`,
    "",
  ].join("\n");
}

/** Returns localized nested-index lines for one locale aggregate. */
export function getPublicLlmsSectionIndexLines(locale: Locale) {
  const localeLabel = getLocaleLabel(locale);

  return getPublicLlmsSectionIndexes(locale).map(
    (index) =>
      `- [${index.label}](${BASE_URL}/${locale}/${index.prefix}/llms.txt): ${localeLabel} ${index.label.toLowerCase()}.`
  );
}

/** Resolves one localized public-prefix llms index request. */
export function resolvePublicLlmsSectionIndex({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  const parts = stripLlmsRouteExtension(cleanSlug).split("/").filter(Boolean);

  if (parts.at(-1) === "llms") {
    parts.pop();
  }

  if (parts.length !== 1) {
    return null;
  }

  return (
    getPublicLlmsSectionIndexes(locale).find(
      (index) => index.prefix === parts[0]
    ) ?? null
  );
}

/** Builds a small index for app-only public route namespaces. */
export function buildPublicLlmsAppSectionIndexText({
  index,
  locale,
}: {
  index: PublicLlmsSectionIndex;
  locale: Locale;
}) {
  const localeLabel = getLocaleLabel(locale);
  const appRoot = `${BASE_URL}/${locale}/${index.prefix}`;

  return renderLlmsIndexText({
    lines: [
      `- [${index.label}](${appRoot}): ${localeLabel} learner-facing application index.`,
      `- [Nakafa MCP skill](${BASE_URL}/skill.md): bounded search and retrieval tools for exact content access.`,
    ],
    summary: `For AI agents: ${localeLabel} ${index.label.toLowerCase()} is application navigation rather than a page-level Markdown corpus. Use the app index or Nakafa MCP tools.`,
    title: `Nakafa ${localeLabel} ${index.label}`,
  });
}

/** Returns public section prefixes from the canonical route-surface registry. */
function getPublicLlmsSectionIndexes(locale: Locale): PublicLlmsSectionIndex[] {
  return [
    { label: SECTION_LABELS.articles, prefix: "articles", section: "articles" },
    ...PUBLIC_ROUTE_SURFACES.map((surface) =>
      getProjectedPublicLlmsSectionIndex({ locale, surface })
    ),
    { label: SECTION_LABELS.quran, prefix: "quran", section: "quran" },
  ];
}

/** Maps one canonical projected route surface to its llms section. */
function getProjectedPublicLlmsSectionIndex({
  locale,
  surface,
}: {
  locale: Locale;
  surface: PublicRouteSurface;
}): PublicLlmsSectionIndex {
  const prefix = surface.routeSlugs[locale];

  if (surface.key === "subject") {
    return { label: SECTION_LABELS.material, prefix, section: "material" };
  }

  if (surface.key === "curriculum") {
    return { label: "Curriculum", prefix };
  }

  return { label: "Try Out", prefix };
}

/** Formats one locale aggregate link for the root index. */
function formatLocaleIndexLine(locale: Locale) {
  const localeLabel = getLocaleLabel(locale);
  return `- [${localeLabel} content index](${BASE_URL}/${locale}/llms.txt): ${localeLabel} starter pages and nested public-prefix indexes.`;
}
