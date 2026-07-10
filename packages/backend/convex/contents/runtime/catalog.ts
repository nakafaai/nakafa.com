import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { NAKAFA_CONTENT_SECTIONS } from "@repo/backend/convex/contents/constants";
import type {
  GetPublicRouteByPathArgs,
  ListPublicRoutesByMaterialArgs,
  ListPublicRoutesByParentArgs,
  ListSitemapPublicRoutesArgs,
} from "@repo/backend/convex/contents/runtime/routes";
import type {
  GetContentRouteArgs,
  GetContentRouteArtifactPageArgs,
  GetContentRouteByContentIdArgs,
  GetContentRouteBySourcePathArgs,
  ListContentRouteCountsArgs,
  ListContentRoutesByKindPrefixArgs,
  ListContentRoutesByParentArgs,
  ListContentRoutesByPrefixArgs,
  ListLatestContentRoutesArgs,
} from "@repo/backend/convex/contents/runtime/spec";
import { ConvexError } from "convex/values";

const MAX_CONTENT_ROUTE_PAGE_SIZE = 100;
const MAX_PUBLIC_ROUTE_PAGE_SIZE = 100;

/** Reads concrete content catalog routes whose route starts with one prefix. */
export async function listContentRoutesByPrefixImpl(
  ctx: QueryCtx,
  args: ListContentRoutesByPrefixArgs
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
  args: ListContentRoutesByKindPrefixArgs
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
  args: ListContentRoutesByParentArgs
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
  args: GetContentRouteArtifactPageArgs
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
  args: ListLatestContentRoutesArgs
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
  args: ListContentRouteCountsArgs
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

/** Reads one source-owned public route by its localized public path. */
export async function getPublicRouteByPathImpl(
  ctx: QueryCtx,
  args: GetPublicRouteByPathArgs
) {
  const publicPath = normalizeRoutePrefix(args.publicPath);
  const route = await ctx.db
    .query("publicRoutes")
    .withIndex("by_locale_and_publicPath", (q) =>
      q.eq("locale", args.locale).eq("publicPath", publicPath)
    )
    .unique();

  return route ? toRuntimePublicRoute(route) : null;
}

/** Reads one bounded page of public route children for curriculum navigation. */
export async function listPublicRoutesByParentImpl(
  ctx: QueryCtx,
  args: ListPublicRoutesByParentArgs
) {
  assertPublicRoutePageLimit(args.limit);

  if (args.programKey) {
    const page = await ctx.db
      .query("publicRoutes")
      .withIndex(
        "by_programKey_and_locale_and_kind_and_parentPath_and_publicPath",
        (q) =>
          q
            .eq("programKey", args.programKey)
            .eq("locale", args.locale)
            .eq("kind", args.kind)
            .eq("parentPath", args.parentPath)
      )
      .paginate({ cursor: args.cursor, numItems: args.limit });

    return toRuntimePublicRoutePage(page);
  }

  const page = await ctx.db
    .query("publicRoutes")
    .withIndex("by_locale_and_kind_and_parentPath_and_publicPath", (q) =>
      q
        .eq("locale", args.locale)
        .eq("kind", args.kind)
        .eq("parentPath", args.parentPath)
    )
    .paginate({ cursor: args.cursor, numItems: args.limit });

  return toRuntimePublicRoutePage(page);
}

/** Reads bounded localized public route contexts for one material key. */
export async function listPublicRoutesByMaterialImpl(
  ctx: QueryCtx,
  args: ListPublicRoutesByMaterialArgs
) {
  assertPublicRoutePageLimit(args.limit);

  const routes = await ctx.db
    .query("publicRoutes")
    .withIndex("by_materialKey_and_locale", (q) =>
      q.eq("materialKey", args.materialKey).eq("locale", args.locale)
    )
    .take(args.limit);

  return routes.map(toRuntimePublicRoute);
}

/** Reads one bounded sitemap-eligible public route page. */
export async function listSitemapPublicRoutesImpl(
  ctx: QueryCtx,
  args: ListSitemapPublicRoutesArgs
) {
  assertPublicRoutePageLimit(args.limit);

  const page = await ctx.db
    .query("publicRoutes")
    .withIndex("by_locale_and_sitemap_and_publicPath", (q) =>
      q.eq("locale", args.locale).eq("sitemap", true)
    )
    .paginate({ cursor: args.cursor, numItems: args.limit });

  return toRuntimePublicRoutePage(page);
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

/** Rejects public route catalog reads that exceed the runtime page bound. */
function assertPublicRoutePageLimit(limit: number) {
  if (limit >= 1 && limit <= MAX_PUBLIC_ROUTE_PAGE_SIZE) {
    return;
  }

  throw new ConvexError({
    code: "PUBLIC_ROUTE_PAGE_LIMIT_INVALID",
    message: `Public route page limit must be between 1 and ${MAX_PUBLIC_ROUTE_PAGE_SIZE}.`,
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

/** Converts one paginated public route response into the runtime route shape. */
function toRuntimePublicRoutePage(page: {
  continueCursor: string;
  isDone: boolean;
  page: Doc<"publicRoutes">[];
}) {
  return {
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    page: page.page.map(toRuntimePublicRoute),
  };
}

/** Loads one exact concrete content route from the durable route catalog. */
export async function getContentRouteImpl(
  ctx: QueryCtx,
  args: GetContentRouteArgs
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

/** Loads one concrete content route by graph-backed content ID. */
export async function getContentRouteByContentIdImpl(
  ctx: QueryCtx,
  args: GetContentRouteByContentIdArgs
) {
  const route = await ctx.db
    .query("contentRoutes")
    .withIndex("by_content_id", (q) => q.eq("content_id", args.contentId))
    .unique();

  if (!route) {
    return null;
  }

  return toRuntimeContentRoute(route);
}

/** Loads one concrete content route by source-owned material or article path. */
export async function getContentRouteBySourcePathImpl(
  ctx: QueryCtx,
  args: GetContentRouteBySourcePathArgs
) {
  const route = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_sourcePath", (q) =>
      q.eq("locale", args.locale).eq("sourcePath", args.sourcePath)
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
    alignmentId: route.alignmentId,
    authors: route.authors,
    assetId: route.assetId,
    conceptId: route.conceptId,
    content_id: route.content_id,
    date: route.date,
    depth: route.depth,
    description: route.description,
    kind: route.kind,
    learningObjectId: route.learningObjectId,
    locale: route.locale,
    lensId: route.lensId,
    markdown: route.markdown,
    materialDomain: route.materialDomain,
    official: route.official,
    parentRoute: route.parentRoute,
    route: route.route,
    section: route.section,
    sourceParentPath: route.sourceParentPath,
    sourcePath: route.sourcePath,
    syncedAt: route.syncedAt,
    title: route.title,
  };
}

/** Removes Convex system fields from source-owned public route rows. */
function toRuntimePublicRoute(route: Doc<"publicRoutes">) {
  return {
    canonicalPath: route.canonicalPath,
    description: route.description,
    displayGroupIconKey: route.displayGroupIconKey,
    displayGroupTitle: route.displayGroupTitle,
    iconKey: route.iconKey,
    kind: route.kind,
    level: route.level,
    locale: route.locale,
    materialCardDescription: route.materialCardDescription,
    materialCardTitle: route.materialCardTitle,
    materialDomain: route.materialDomain,
    materialKey: route.materialKey,
    nodeKey: route.nodeKey,
    order: route.order,
    parentPath: route.parentPath,
    programKey: route.programKey,
    publicPath: route.publicPath,
    sectionKey: route.sectionKey,
    sitemap: route.sitemap,
    sourcePath: route.sourcePath,
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
