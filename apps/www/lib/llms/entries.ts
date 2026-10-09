import type { PublicPageProjection } from "@nakafa/aksara-contracts/projection/page";
import { Array as Arr, Option, Order, Record as Rec, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  BASE_URL,
  type LlmsSection,
  SECTION_LABELS,
} from "@/lib/llms/constants";
import { formatRouteTitle, getLlmsMarkdownPath } from "@/lib/llms/format";
import { getLocalizedMappedRoutePathname } from "@/lib/routing/public/pathnames";

const derivedSiteRoutes = ["/curricula"] as const;
type DerivedSiteRoute = (typeof derivedSiteRoutes)[number];

const LlmsSectionSchema = Schema.Literals(Rec.keys(SECTION_LABELS));

/** One localized link advertised by a Nakafa llms index. */
const LlmsEntrySchema = Schema.Struct({
  description: Schema.optionalKey(Schema.String),
  href: Schema.String,
  route: Schema.String,
  section: LlmsSectionSchema,
  segments: Schema.Array(Schema.String),
  title: Schema.String,
});
export type LlmsEntry = typeof LlmsEntrySchema.Type;

const PublishedContentSummarySchema = Schema.Struct({
  description: Schema.optionalKey(Schema.String),
  publicPath: Schema.String,
  title: Schema.String,
});
type PublishedContentSummary = typeof PublishedContentSummarySchema.Type;

const ApplicationSiteSummarySchema = Schema.Struct({
  description: Schema.String,
  route: Schema.String,
  title: Schema.String,
});
export type ApplicationSiteSummary = typeof ApplicationSiteSummarySchema.Type;

/** Checks whether a route segment is a supported llms section. */
export function isLlmsSection(
  section: string | undefined
): section is LlmsSection {
  return typeof section === "string" && Object.hasOwn(SECTION_LABELS, section);
}

/** Returns the configured llms sections in display order. */
export function getLlmsSections() {
  return Arr.filter(Rec.keys(SECTION_LABELS), isLlmsSection);
}

/** Builds site entries from derived indexes and signed Page projections. */
export function buildSiteLlmsEntries(
  locale: Locale,
  pages: readonly PublicPageProjection[],
  applicationPages: readonly ApplicationSiteSummary[]
) {
  const entries: LlmsEntry[] = [
    ...Arr.flatMap(derivedSiteRoutes, (route) =>
      Option.toArray(buildLocalizedSiteLlmsEntry({ locale, route }))
    ),
    ...Arr.map(applicationPages, (page) =>
      buildSiteLlmsEntry({
        description: page.description,
        locale,
        publicRoute: page.route,
        title: page.title,
      })
    ),
    ...Arr.map(
      Arr.filter(pages, (page) => page.appLocale === locale),
      (page): LlmsEntry => {
        const route = `/${page.publicPath}`;
        return {
          description: page.metadata.description,
          href: `${BASE_URL}/${locale}${route}`,
          route,
          section: "site",
          segments: ["site", ...page.publicPath.split("/")],
          title: page.metadata.title,
        };
      }
    ),
  ];

  return entries;
}

/** Orders entries by route with the locale-aware comparison used for agent indexes. */
const compareEntryRoutes = Order.make<{ readonly route: string }>(
  (left, right) => {
    const order = left.route.localeCompare(right.route);
    if (order === 0) {
      return 0;
    }
    return order < 0 ? -1 : 1;
  }
);

/** Builds sorted agent entries from compact published content summaries. */
export function buildPublishedContentLlmsEntries({
  locale,
  rows,
  section,
}: {
  locale: Locale;
  rows: readonly PublishedContentSummary[];
  section: Exclude<LlmsSection, "site">;
}) {
  return Arr.sort(
    Arr.map(rows, (row) => {
      const route = `/${row.publicPath}`;
      return {
        ...(row.description === undefined
          ? {}
          : { description: row.description }),
        href: `${BASE_URL}${getLlmsMarkdownPath({
          locale,
          publicPath: row.publicPath,
        })}`,
        route,
        section,
        segments: row.publicPath.split("/"),
        title: row.title,
      };
    }),
    compareEntryRoutes
  );
}

/** Builds one locale-specific llms entry from a sitemap route. */
function buildLocalizedSiteLlmsEntry({
  locale,
  route,
}: {
  locale: Locale;
  route: DerivedSiteRoute;
}) {
  return Option.map(
    getLocalizedMappedRoutePathname({ locale, route }),
    (publicRoute) =>
      buildSiteLlmsEntry({
        locale,
        publicRoute,
        title: formatRouteTitle(publicRoute),
      })
  );
}

/** Builds one localized site entry from its owned route and metadata. */
function buildSiteLlmsEntry({
  description,
  locale,
  publicRoute,
  title,
}: {
  description?: string;
  locale: Locale;
  publicRoute: string;
  title: string;
}) {
  const hrefBase = `${BASE_URL}/${locale}${publicRoute}`;
  const routePath = publicRoute.slice(1);
  const routeSegments = ["site", ...Arr.filter(routePath.split("/"), Boolean)];
  const section: LlmsSection = "site";

  return {
    ...(description === undefined ? {} : { description }),
    href: hrefBase,
    route: publicRoute,
    section,
    segments: routeSegments,
    title,
  };
}
