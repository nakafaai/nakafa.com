import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { NAKAFA_CONTENT_SECTIONS } from "@repo/backend/convex/contents/constants";
import type {
  Locale,
  NakafaSection,
} from "@repo/backend/convex/lib/validators/contents";
import { ConvexError } from "convex/values";

const MAX_CONTENT_ROUTE_PAGE_SIZE = 100;

interface ContentRoutePrefixArgs {
  cursor: string | null;
  limit: number;
  locale: Locale;
  prefix: string;
  section: NakafaSection;
}

interface ContentRouteKindPrefixArgs extends ContentRoutePrefixArgs {
  kind: Doc<"contentRoutes">["kind"];
}

interface ContentRouteParentArgs {
  cursor: string | null;
  kind: Doc<"contentRoutes">["kind"];
  limit: number;
  locale: Locale;
  order: "date-desc" | "route";
  parentRoute: string;
  section: NakafaSection;
}

interface ContentRouteArtifactPageArgs {
  locale: Locale;
  page: number;
  section: NakafaSection;
}

interface LatestContentRoutesArgs {
  limit: number;
  locale: Locale;
  section: NakafaSection;
}

interface ContentRouteCountsArgs {
  locale: Locale;
}

/** Reads concrete content catalog routes whose route starts with one prefix. */
export async function listContentRoutesByPrefixImpl(
  ctx: QueryCtx,
  args: ContentRoutePrefixArgs
) {
  assertContentRoutePageLimit(args.limit);
  const prefix = normalizeRoutePrefix(args.prefix);

  const page = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_section_and_route", (q) =>
      q
        .eq("locale", args.locale)
        .eq("section", args.section)
        .gte("route", prefix)
        .lt("route", `${prefix}\uffff`)
    )
    .paginate({ cursor: args.cursor, numItems: args.limit });

  return {
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    page: page.page
      .filter((route) => matchesRouteSegmentPrefix(route.route, prefix))
      .map(toRuntimeContentRoute),
  };
}

/** Reads content catalog routes by kind without scanning unrelated descendants. */
export async function listContentRoutesByKindPrefixImpl(
  ctx: QueryCtx,
  args: ContentRouteKindPrefixArgs
) {
  assertContentRoutePageLimit(args.limit);
  const prefix = normalizeRoutePrefix(args.prefix);

  const page = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_section_and_kind_and_route", (q) =>
      q
        .eq("locale", args.locale)
        .eq("section", args.section)
        .eq("kind", args.kind)
        .gte("route", prefix)
        .lt("route", `${prefix}\uffff`)
    )
    .paginate({ cursor: args.cursor, numItems: args.limit });

  return {
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    page: page.page
      .filter((route) => matchesRouteSegmentPrefix(route.route, prefix))
      .map(toRuntimeContentRoute),
  };
}

/** Reads immediate navigation children from materialized parent route fields. */
export async function listContentRoutesByParentImpl(
  ctx: QueryCtx,
  args: ContentRouteParentArgs
) {
  assertContentRoutePageLimit(args.limit);
  const parentRoute = normalizeRoutePrefix(args.parentRoute);

  if (args.order === "date-desc") {
    const page = await ctx.db
      .query("contentRoutes")
      .withIndex(
        "by_locale_and_section_and_kind_and_parentRoute_and_date",
        (q) =>
          q
            .eq("locale", args.locale)
            .eq("section", args.section)
            .eq("kind", args.kind)
            .eq("parentRoute", parentRoute)
      )
      .order("desc")
      .paginate({ cursor: args.cursor, numItems: args.limit });

    return toRuntimeContentRoutePage(page);
  }

  const page = await ctx.db
    .query("contentRoutes")
    .withIndex(
      "by_locale_and_section_and_kind_and_parentRoute_and_route",
      (q) =>
        q
          .eq("locale", args.locale)
          .eq("section", args.section)
          .eq("kind", args.kind)
          .eq("parentRoute", parentRoute)
    )
    .paginate({ cursor: args.cursor, numItems: args.limit });

  return toRuntimeContentRoutePage(page);
}

/** Reads one materialized route artifact page for sitemap and LLMS. */
export async function getContentRouteArtifactPageImpl(
  ctx: QueryCtx,
  args: ContentRouteArtifactPageArgs
) {
  const page = await ctx.db
    .query("contentRoutePages")
    .withIndex("by_locale_and_section_and_page", (q) =>
      q
        .eq("locale", args.locale)
        .eq("section", args.section)
        .eq("page", args.page)
    )
    .unique();

  if (!page) {
    return null;
  }

  return toRuntimeContentRouteArtifactPage(page);
}

/** Reads a bounded newest-first content feed page from dated routes. */
export async function listLatestContentRoutesImpl(
  ctx: QueryCtx,
  args: LatestContentRoutesArgs
) {
  assertContentRoutePageLimit(args.limit);

  const routes = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_section_and_date", (q) =>
      q.eq("locale", args.locale).eq("section", args.section).gt("date", 0)
    )
    .order("desc")
    .take(args.limit);

  return routes.map(toRuntimeContentRoute);
}

/** Reads materialized route counts for one locale without route scans. */
export async function listContentRouteCountsImpl(
  ctx: QueryCtx,
  args: ContentRouteCountsArgs
) {
  const counts = await ctx.db
    .query("contentRouteCounts")
    .withIndex("by_locale", (q) => q.eq("locale", args.locale))
    .take(NAKAFA_CONTENT_SECTIONS.length + 1);

  if (counts.length > NAKAFA_CONTENT_SECTIONS.length) {
    throw new ConvexError({
      code: "CONTENT_ROUTE_COUNT_ROWS_EXCEEDED",
      message: "Content route count rows exceed the supported section count.",
    });
  }

  return counts.map((count) => ({
    count: count.count,
    locale: count.locale,
    section: count.section,
    syncedAt: count.syncedAt,
  }));
}

/** Rejects route-catalog scans that exceed the public runtime page bound. */
function assertContentRoutePageLimit(limit: number) {
  if (limit >= 1 && limit <= MAX_CONTENT_ROUTE_PAGE_SIZE) {
    return;
  }

  throw new ConvexError({
    code: "CONTENT_ROUTE_PAGE_LIMIT_INVALID",
    message: `Content route page limit must be between 1 and ${MAX_CONTENT_ROUTE_PAGE_SIZE}.`,
  });
}

/** Normalizes one route prefix before using it in indexed range reads. */
function normalizeRoutePrefix(prefix: string) {
  return prefix.split("/").filter(Boolean).join("/");
}

/** Checks exact-or-descendant route membership without sibling prefix bleed. */
function matchesRouteSegmentPrefix(route: string, prefix: string) {
  if (prefix === "") {
    return true;
  }

  return route === prefix || route.startsWith(`${prefix}/`);
}

/** Converts one Convex paginated route response into the public route shape. */
function toRuntimeContentRoutePage(page: {
  continueCursor: string;
  isDone: boolean;
  page: Doc<"contentRoutes">[];
}) {
  return {
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    page: page.page.map(toRuntimeContentRoute),
  };
}

/** Loads one exact concrete content route from the durable route catalog. */
export async function getContentRouteImpl(
  ctx: QueryCtx,
  args: {
    locale: Locale;
    route: string;
  }
) {
  const route = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_route", (q) =>
      q.eq("locale", args.locale).eq("route", args.route)
    )
    .unique();

  if (!route) {
    return null;
  }

  return toRuntimeContentRoute(route);
}

/** Removes Convex system fields from route catalog rows before returning them. */
function toRuntimeContentRoute(route: Doc<"contentRoutes">) {
  return {
    authors: route.authors,
    content_id: route.content_id,
    date: route.date,
    depth: route.depth,
    description: route.description,
    kind: route.kind,
    locale: route.locale,
    markdown: route.markdown,
    official: route.official,
    parentRoute: route.parentRoute,
    route: route.route,
    section: route.section,
    syncedAt: route.syncedAt,
    title: route.title,
  };
}

/** Removes Convex system fields from one materialized route artifact page. */
function toRuntimeContentRouteArtifactPage(page: Doc<"contentRoutePages">) {
  return {
    locale: page.locale,
    page: page.page,
    routeCount: page.routeCount,
    routes: page.routes,
    section: page.section,
    syncedAt: page.syncedAt,
  };
}
