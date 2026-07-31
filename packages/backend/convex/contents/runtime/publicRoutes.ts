import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { READ_MODEL_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import { normalizeRoutePrefix } from "@repo/backend/convex/contents/runtime/path";
import type {
  GetPublicRouteByPathArgs,
  ListPublicRoutesByMaterialArgs,
  ListPublicRoutesByParentArgs,
} from "@repo/backend/convex/contents/runtime/routes";
import { ConvexError } from "convex/values";

const MAX_PUBLIC_ROUTE_PAGE_SIZE = 100;

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
      .paginate({
        cursor: args.cursor,
        maximumBytesRead: args.limit * READ_MODEL_DOCUMENT_LIMIT,
        maximumRowsRead: args.limit,
        numItems: args.limit,
      });

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
    .paginate({
      cursor: args.cursor,
      maximumBytesRead: args.limit * READ_MODEL_DOCUMENT_LIMIT,
      maximumRowsRead: args.limit,
      numItems: args.limit,
    });

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
