import { Effect } from "effect";
import type { Locale } from "next-intl";
import {
  getRuntimeContentRoute,
  getRuntimeContentRouteArtifactPage,
} from "@/lib/content/runtime";
import {
  BASE_URL,
  type LlmsSection,
  SECTION_LABELS,
} from "@/lib/llms/constants";
import { formatRouteTitle } from "@/lib/llms/format";
import { getQuranRouteMetadata } from "@/lib/llms/quran";
import {
  baseRoutes,
  buildSitemapContentPageRoutes,
} from "@/lib/sitemap/routes";

const LLMS_ENTRY_BUILD_CONCURRENCY = 16;
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

/** Builds site-page entries without reading the content route catalog. */
export const getSiteLlmsEntries = Effect.fn("www.llms.siteEntries")(function* (
  locale: Locale
) {
  return yield* buildLocalizedLlmsEntriesFromRoutes({
    locale,
    routes: baseRoutes.filter((route) => getRouteSection(route) === "site"),
  });
});

/** Builds entries for one materialized route-catalog page without global reads. */
export const getContentPageLlmsEntries = Effect.fn(
  "www.llms.contentPageEntries"
)(function* ({
  locale,
  page,
  section,
}: {
  locale: Locale;
  page: number;
  section: Exclude<LlmsSection, "site">;
}) {
  const artifactPage = yield* getRuntimeContentRouteArtifactPage({
    locale,
    page,
    section,
  });

  if (!artifactPage) {
    return [];
  }

  const routes = buildSitemapContentPageRoutes(artifactPage.routes).filter(
    (route) => getRouteSection(route) === section
  );

  return yield* buildLocalizedLlmsEntriesFromRoutes({ locale, routes });
});

/** Builds locale-specific llms entries from already scoped route strings. */
function buildLocalizedLlmsEntriesFromRoutes({
  locale,
  routes,
}: {
  locale: Locale;
  routes: readonly string[];
}) {
  return Effect.forEach(
    [...routes].sort((a, b) => a.localeCompare(b)),
    (route) => buildLocalizedLlmsEntry({ locale, route }),
    {
      concurrency: LLMS_ENTRY_BUILD_CONCURRENCY,
    }
  );
}

/** Builds one locale-specific llms entry from a sitemap route. */
const buildLocalizedLlmsEntry = Effect.fn("www.llms.entry")(function* ({
  locale,
  route,
}: {
  locale: Locale;
  route: string;
}) {
  const hrefBase = `${BASE_URL}/${locale}${route === "/" ? "" : route}`;
  const section = getRouteSection(route);
  const routePath = route.slice(1);
  const metadata = yield* getRouteMetadata({
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
});

export type LlmsEntry = Effect.Effect.Success<
  ReturnType<typeof buildLocalizedLlmsEntry>
>;

/** Resolves title, description, and markdown availability for one route. */
const getRouteMetadata = Effect.fn("www.llms.routeMetadata")(function* ({
  locale,
  route,
  section,
}: {
  locale: Locale;
  route: string;
  section: LlmsSection;
}) {
  if (section === "quran") {
    return yield* getQuranRouteMetadata({ locale, route });
  }

  if (
    section === "articles" ||
    section === "exercises" ||
    section === "subject"
  ) {
    const metadata = yield* getContentRouteMetadata({ locale, route });

    if (metadata) {
      return metadata;
    }

    return getListingRouteMetadata(route);
  }

  return {
    description: undefined,
    hasMarkdown: false,
    title: formatRouteTitle(route),
  };
});

/** Builds fallback metadata for sitemap-derived listing routes without markdown. */
function getListingRouteMetadata(route: string) {
  return {
    description: undefined,
    hasMarkdown: false,
    title: formatRouteTitle(route),
  };
}

/** Reads exact runtime content route metadata when the route has markdown. */
const getContentRouteMetadata = Effect.fn("www.llms.contentRouteMetadata")(
  function* ({ locale, route }: { locale: Locale; route: string }) {
    const contentRoute = yield* Effect.match(
      getRuntimeContentRoute({
        locale,
        route: route.slice(1),
      }),
      {
        onFailure: () => null,
        onSuccess: (data) => data,
      }
    );

    if (!contentRoute) {
      return null;
    }

    return {
      description: contentRoute.description,
      hasMarkdown: contentRoute.markdown,
      title: contentRoute.title,
    };
  }
);
