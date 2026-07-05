import type { api } from "@repo/backend/convex/_generated/api";
import {
  getPublicContentRouteCheck,
  type PublicContentRouteCheck,
} from "@repo/contents/_lib/manifest/public-route";
import { findPublicContentRouteBySourcePath } from "@repo/contents/_types/route/content";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import type { FunctionReturnType } from "convex/server";
import { Effect, Option } from "effect";
import type { Locale } from "next-intl";
import {
  getRuntimeContentRoute,
  getRuntimeContentRouteArtifactPage,
  getRuntimeContentRouteParentPage,
} from "@/lib/content/runtime/routes";
import {
  BASE_URL,
  type LlmsSection,
  SECTION_LABELS,
} from "@/lib/llms/constants";
import { formatRouteTitle } from "@/lib/llms/format";
import { getLocalizedMappedRoutePathname } from "@/lib/routing/public/pathnames";
import { baseRoutes } from "@/lib/sitemap/routes";

const LLMS_ENTRY_BUILD_CONCURRENCY = 4;
const LLMS_LISTING_ENTRY_LIMIT = 100;
type RuntimeContentRoute = NonNullable<
  FunctionReturnType<
    typeof api.contents.queries.runtime.getContentRouteArtifactPage
  >
>["routes"][number];
type ParentListingRowsArgs = Omit<
  Parameters<typeof getRuntimeContentRouteParentPage>[0],
  "cursor" | "limit"
>;

const materialRouteNamespaces = new Set<string>(
  PUBLIC_ROUTE_SURFACES.filter((surface) => surface.key === "subject").flatMap(
    (surface) => Object.values(surface.routeSlugs)
  )
);
const tryoutRouteNamespaces = new Set<string>(
  PUBLIC_ROUTE_SURFACES.filter((surface) => surface.key === "tryout").flatMap(
    (surface) => Object.values(surface.routeSlugs)
  )
);

/** Classifies a sitemap route into the llms section that owns it. */
export function getRouteSection(route: string): LlmsSection {
  const firstSegment = route.split("/").filter(Boolean)[0];

  if (isLlmsSection(firstSegment) && firstSegment !== "site") {
    return firstSegment;
  }

  if (materialRouteNamespaces.has(firstSegment ?? "")) {
    return "material";
  }

  if (tryoutRouteNamespaces.has(firstSegment ?? "")) {
    return "tryout";
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

  return yield* buildLocalizedLlmsEntriesFromRows({
    locale,
    rows: artifactPage.routes,
    section,
  });
});

/**
 * Builds entries for one public content listing route from route-catalog rows.
 *
 * Unsupported route shapes return null instead of fabricated entries. Supported
 * shapes read one bounded catalog page and reuse the same entry formatter as
 * normal llms indexes, so listing pages advertise only source-backed routes.
 */
export const getContentListingLlmsEntries = Effect.fn(
  "www.llms.contentListingEntries"
)(function* ({ locale, route }: { locale: Locale; route: string }) {
  const cleanRoute = route.replace(/^\/+|\/+$/g, "");
  const routeCheck = getPublicContentRouteCheck(cleanRoute);
  const rows = yield* readContentListingRows({ locale, routeCheck });

  if (rows === null) {
    return null;
  }

  const routes = rows.map((row) => `/${row.route}`);
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

/** Builds locale-specific llms entries directly from materialized route rows. */
function buildLocalizedLlmsEntriesFromRows({
  locale,
  rows,
  section,
}: {
  locale: Locale;
  rows: readonly RuntimeContentRoute[];
  section: Exclude<LlmsSection, "site">;
}) {
  return Effect.forEach(
    [...rows].sort((a, b) => a.route.localeCompare(b.route)),
    (row) => buildLocalizedLlmsEntryFromRow({ locale, row }),
    { concurrency: LLMS_ENTRY_BUILD_CONCURRENCY }
  ).pipe(
    Effect.map((entries) =>
      entries
        .filter(isResolvedLlmsEntry)
        .filter((entry) => entry.section === section)
    )
  );
}

/** Formats one route-catalog row without re-reading metadata by route. */
const buildLocalizedLlmsEntryFromRow = Effect.fn("www.llms.rowEntry")(
  function* ({ locale, row }: { locale: Locale; row: RuntimeContentRoute }) {
    const publicRoute = yield* getRuntimeRowPublicRoute({ locale, row });

    if (publicRoute === null) {
      return null;
    }

    const hrefBase = `${BASE_URL}/${locale}${publicRoute}`;
    const section = getRouteSection(publicRoute);
    const routeSegments = publicRoute.slice(1).split("/").filter(Boolean);

    return {
      description: row.description,
      href: row.markdown ? `${hrefBase}.md` : hrefBase,
      route: publicRoute,
      section,
      segments: routeSegments,
      title: row.title,
    };
  }
);

/** Resolves a route-catalog row to the rendered public app route. */
const getRuntimeRowPublicRoute = Effect.fn("www.llms.rowPublicRoute")(
  function* ({ locale, row }: { locale: Locale; row: RuntimeContentRoute }) {
    if (row.section === "material") {
      const materialRoute = yield* findPublicContentRouteBySourcePath(
        row.sourcePath,
        locale
      );

      if (Option.isNone(materialRoute)) {
        return null;
      }

      return routeToPath(materialRoute.value.publicPath);
    }

    const route = routeToPath(row.route);
    return getLocalizedMappedRoutePathname({ locale, route }) ?? route;
  }
);

/** Converts one route string into an app-level HTTP path string. */
function routeToPath(route: string) {
  return `/${route}`;
}

/** Narrows resolved route entries after unsupported rows are skipped. */
function isResolvedLlmsEntry(entry: LlmsEntry | null): entry is LlmsEntry {
  return entry !== null;
}

/**
 * Reads one bounded route-catalog page for supported listing route shapes.
 *
 * The resolver returns null when the route is not a listing. Every supported
 * branch delegates to an indexed kind or parent page read with a fixed limit.
 */
function readContentListingRows({
  locale,
  routeCheck,
}: {
  locale: Locale;
  routeCheck: PublicContentRouteCheck;
}) {
  if (routeCheck.mode === "article-category") {
    return readParentListingRows({
      kind: "article",
      locale,
      order: "date-desc",
      parentRoute: routeCheck.parentRoute,
      section: "articles",
    });
  }

  return Effect.succeed(null);
}

/**
 * Reads one parent-scoped route page for a listing markdown document.
 *
 * Callers provide the already-classified parent route, and the helper enforces
 * the shared listing limit so listing indexes do not drift into full-table
 * collection.
 */
function readParentListingRows(args: ParentListingRowsArgs) {
  return getRuntimeContentRouteParentPage({
    ...args,
    cursor: null,
    limit: LLMS_LISTING_ENTRY_LIMIT,
  }).pipe(Effect.map((page) => page.page));
}

/** Builds one locale-specific llms entry from a sitemap route. */
const buildLocalizedLlmsEntry = Effect.fn("www.llms.entry")(function* ({
  locale,
  route,
}: {
  locale: Locale;
  route: string;
}) {
  const publicRoute =
    getLocalizedMappedRoutePathname({ locale, route }) ?? route;
  const publicPath = publicRoute === "/" ? "" : publicRoute;
  const hrefBase = `${BASE_URL}/${locale}${publicPath}`;
  const section = getRouteSection(publicRoute);
  const routePath = publicRoute.slice(1);
  const metadata = yield* getRouteMetadata({
    locale,
    route: publicRoute,
    section,
  });
  const routeSegments = routePath.split("/").filter(Boolean);

  if (section === "site") {
    routeSegments.unshift("site");
  }

  return {
    description: metadata.description,
    href: metadata.hasMarkdown ? `${hrefBase}.md` : hrefBase,
    route: publicRoute,
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
  if (
    section === "articles" ||
    section === "material" ||
    section === "tryout"
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

/** Builds listing metadata for sitemap-derived routes that do not have markdown. */
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
