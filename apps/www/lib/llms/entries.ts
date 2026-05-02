import { getContentMetadata } from "@repo/contents/_lib/metadata";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import {
  BASE_URL,
  type LlmsSection,
  SECTION_LABELS,
} from "@/lib/llms/constants";
import { formatRouteTitle } from "@/lib/llms/format";
import { getQuranRouteMetadata } from "@/lib/llms/quran";
import { getSitemapRoutes } from "@/lib/sitemap";

export type LlmsEntry = Awaited<ReturnType<typeof buildLocalizedLlmsEntry>>;

/** Builds sitemap-aligned llms entries for one locale. */
export async function getLocalizedLlmsEntries(locale: Locale) {
  const routes = getSitemapRoutes().sort((a, b) => a.localeCompare(b));
  const entries = await Promise.all(
    routes.map((route) => buildLocalizedLlmsEntry(locale, route))
  );

  return entries;
}

/** Classifies a sitemap route into the llms section that owns it. */
export function getRouteSection(route: string): LlmsSection {
  const firstSegment = route.split("/").filter(Boolean)[0];

  if (isLlmsSection(firstSegment) && firstSegment !== "site") {
    return firstSegment;
  }

  return "site";
}

/** Checks whether a route segment is a supported llms section. */
export function isLlmsSection(
  section: string | undefined
): section is LlmsSection {
  return typeof section === "string" && Object.hasOwn(SECTION_LABELS, section);
}

/** Returns the configured llms sections in display order. */
export function getLlmsSections() {
  return Object.keys(SECTION_LABELS).filter(isLlmsSection);
}

/** Builds one locale-specific llms entry from a sitemap route. */
async function buildLocalizedLlmsEntry(locale: Locale, route: string) {
  const hrefBase = `${BASE_URL}/${locale}${route === "/" ? "" : route}`;
  const section = getRouteSection(route);
  const routePath = route.slice(1);
  const metadata = await getRouteMetadata({
    locale,
    route,
    section,
  });
  const routeSegments = routePath.split("/").filter(Boolean);

  if (section === "site") {
    routeSegments.unshift("site");
  }

  return {
    description: metadata.description,
    href: metadata.hasMarkdown ? `${hrefBase}.md` : hrefBase,
    route,
    section,
    segments: routeSegments,
    title: metadata.title,
  };
}

/** Resolves title, description, and markdown availability for one route. */
async function getRouteMetadata({
  locale,
  route,
  section,
}: {
  locale: Locale;
  route: string;
  section: LlmsSection;
}) {
  if (section === "quran") {
    return getQuranRouteMetadata({ locale, route });
  }

  if (section === "exercises") {
    return getIndexRouteMetadata(route);
  }

  if (section === "articles" || section === "subject") {
    const metadata = await getMdxRouteMetadata({ locale, route });

    if (metadata) {
      return metadata;
    }

    return getIndexRouteMetadata(route);
  }

  return {
    description: undefined,
    hasMarkdown: false,
    title: formatRouteTitle(route),
  };
}

/** Builds fallback metadata for routes served as sitemap-derived indexes. */
function getIndexRouteMetadata(route: string) {
  return {
    description: undefined,
    hasMarkdown: true,
    title: formatRouteTitle(route),
  };
}

/** Reads existing MDX metadata for article and subject routes. */
async function getMdxRouteMetadata({
  locale,
  route,
}: {
  locale: Locale;
  route: string;
}) {
  const metadata = await Effect.runPromise(
    Effect.match(getContentMetadata(route.slice(1), locale), {
      onFailure: () => null,
      onSuccess: (data) => data,
    })
  );

  if (!metadata) {
    return null;
  }

  return {
    description: metadata.description ?? metadata.subject,
    hasMarkdown: true,
    title: metadata.title,
  };
}
