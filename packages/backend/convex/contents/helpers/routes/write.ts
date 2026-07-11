import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_ROUTE_KINDS } from "@repo/backend/convex/contents/constants";
import { learningGraphIdentityValidator } from "@repo/backend/convex/contents/graph";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import {
  localeValidator,
  materialValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { getSourceRouteProjection } from "@repo/contents/_types/graph/projection";
import { ConvexError, type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

const duplicateRouteRepairLimit = 6;

/** Convex validator for source rows used to upsert route projections. */
const contentRouteSourceValidator = v.object({
  ...learningGraphIdentityValidator.fields,
  authors: v.optional(v.array(v.object({ name: v.string() }))),
  contentHash: v.string(),
  date: v.optional(v.number()),
  description: v.optional(v.string()),
  kind: literals(...CONTENT_ROUTE_KINDS),
  locale: localeValidator,
  markdown: v.boolean(),
  materialDomain: v.optional(materialValidator),
  official: v.optional(v.boolean()),
  publicPath: v.string(),
  section: nakafaSectionValidator,
  sourcePath: v.string(),
  syncedAt: v.number(),
  title: v.string(),
});

/** Route source row derived from the Convex validator. */
type ContentRouteSource = Infer<typeof contentRouteSourceValidator>;

/** Upserts one concrete public content route into the durable route catalog. */
export async function syncContentRoute(
  ctx: MutationCtx,
  source: ContentRouteSource
) {
  const routeProjection = getSourceRouteProjection({
    kind: source.kind,
    locale: source.locale,
    route: source.sourcePath,
  });

  if (!routeProjection) {
    throw new ConvexError({
      code: "CONTENT_ROUTE_GRAPH_PROJECTION_INVALID",
      message: "Content route cannot be projected into graph identity.",
    });
  }

  const nextValues = {
    alignmentId: source.alignmentId,
    authors: source.authors ?? [],
    assetId: source.assetId,
    conceptId: source.conceptId,
    contentHash: source.contentHash,
    content_id: source.assetId,
    date: source.date,
    depth: routeProjection.depth,
    description: source.description,
    kind: source.kind,
    learningObjectId: source.learningObjectId,
    locale: source.locale,
    lensId: source.lensId,
    markdown: source.markdown,
    materialDomain: source.materialDomain,
    official: source.official,
    parentRoute: getParentPath(source.publicPath),
    route: source.publicPath,
    section: source.section,
    sourceParentPath: routeProjection.parentRoute,
    sourcePath: source.sourcePath,
    syncedAt: source.syncedAt,
    title: source.title,
  };
  const existing = await ctx.db
    .query("contentRoutes")
    .withIndex("by_content_id", (q) =>
      q.eq("content_id", nextValues.content_id)
    )
    .unique();
  const routeRows = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_route", (q) =>
      q.eq("locale", nextValues.locale).eq("route", nextValues.route)
    )
    .take(duplicateRouteRepairLimit);
  const routeExisting = existing ?? routeRows[0] ?? null;
  const deletedDuplicates = await deleteDuplicateContentRoutes(ctx, {
    primary: routeExisting,
    rows: routeRows,
  });

  if (isSameContentRoute(routeExisting, nextValues)) {
    if (routeExisting && routeExisting.countedAt === undefined) {
      await incrementContentRouteCount(ctx, routeExisting, source.syncedAt);
      await ctx.db.patch("contentRoutes", routeExisting._id, {
        countedAt: source.syncedAt,
      });
    }

    return deletedDuplicates > 0 ? "updated" : "unchanged";
  }

  if (routeExisting) {
    const countedAt = routeExisting.countedAt ?? source.syncedAt;

    if (routeExisting.countedAt === undefined) {
      await incrementContentRouteCount(ctx, routeExisting, source.syncedAt);
    }

    await ctx.db.patch("contentRoutes", routeExisting._id, {
      ...nextValues,
      countedAt,
    });
    return "updated";
  }

  await ctx.db.insert("contentRoutes", {
    ...nextValues,
    countedAt: source.syncedAt,
  });
  await incrementContentRouteCount(ctx, nextValues, source.syncedAt);
  return "created";
}

/** Deletes the route catalog row attached to one canonical content ID. */
export async function deleteContentRoute(ctx: MutationCtx, contentId: string) {
  const existing = await ctx.db
    .query("contentRoutes")
    .withIndex("by_content_id", (q) => q.eq("content_id", contentId))
    .unique();

  if (!existing) {
    return;
  }

  if (existing.countedAt !== undefined) {
    await decrementContentRouteCount(ctx, existing);
  }

  await ctx.db.delete(existing._id);
}

/** Deletes every route catalog row attached to one source route projection. */
export async function deleteContentRoutesBySourcePath(
  ctx: MutationCtx,
  args: { locale: Locale; sourcePath: string }
) {
  const rows = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_sourcePath", (q) =>
      q.eq("locale", args.locale).eq("sourcePath", args.sourcePath)
    )
    .take(duplicateRouteRepairLimit);

  if (rows.length >= duplicateRouteRepairLimit) {
    throw new ConvexError({
      code: "CONTENT_ROUTE_DELETE_LIMIT_EXCEEDED",
      message: "Content route has too many route projections to delete safely.",
    });
  }

  for (const row of rows) {
    if (row.countedAt !== undefined) {
      await decrementContentRouteCount(ctx, row);
    }

    await ctx.db.delete(row._id);
  }
}

/** Increments the materialized route count for one synced catalog row. */
async function incrementContentRouteCount(
  ctx: MutationCtx,
  route: Pick<Doc<"contentRoutes">, "locale" | "section">,
  syncedAt: number
) {
  await adjustContentRouteCount(ctx, {
    delta: 1,
    locale: route.locale,
    section: route.section,
    syncedAt,
  });
}

/** Decrements the materialized route count for one deleted catalog row. */
async function decrementContentRouteCount(
  ctx: MutationCtx,
  route: Pick<Doc<"contentRoutes">, "locale" | "section" | "syncedAt">
) {
  await adjustContentRouteCount(ctx, {
    delta: -1,
    locale: route.locale,
    section: route.section,
    syncedAt: route.syncedAt,
  });
}

/** Removes duplicate route projections before one route is inserted or patched. */
async function deleteDuplicateContentRoutes(
  ctx: MutationCtx,
  source: {
    primary: Doc<"contentRoutes"> | null;
    rows: Doc<"contentRoutes">[];
  }
) {
  if (source.rows.length >= duplicateRouteRepairLimit) {
    throw new ConvexError({
      code: "CONTENT_ROUTE_DUPLICATE_LIMIT_EXCEEDED",
      message: "Content route has too many duplicate route projections.",
    });
  }

  let deleted = 0;

  for (const row of source.rows) {
    if (row._id === source.primary?._id) {
      continue;
    }

    if (row.countedAt !== undefined) {
      await decrementContentRouteCount(ctx, row);
    }

    await ctx.db.delete(row._id);
    deleted += 1;
  }

  return deleted;
}

/** Applies one idempotent count delta to the route-count read model. */
async function adjustContentRouteCount(
  ctx: MutationCtx,
  source: {
    delta: 1 | -1;
    locale: Locale;
    section: ContentRouteSource["section"];
    syncedAt: number;
  }
) {
  const existing = await ctx.db
    .query("contentRouteCounts")
    .withIndex("by_locale_and_section", (q) =>
      q.eq("locale", source.locale).eq("section", source.section)
    )
    .unique();

  if (existing) {
    await ctx.db.patch("contentRouteCounts", existing._id, {
      count: Math.max(0, existing.count + source.delta),
      syncedAt: source.syncedAt,
    });
    return;
  }

  if (source.delta < 0) {
    return;
  }

  await ctx.db.insert("contentRouteCounts", {
    count: source.delta,
    locale: source.locale,
    section: source.section,
    syncedAt: source.syncedAt,
  });
}

/** Checks whether one catalog row already matches the next sync payload. */
function isSameContentRoute(
  existing: Doc<"contentRoutes"> | null,
  next: Omit<Doc<"contentRoutes">, "_creationTime" | "_id" | "countedAt">
) {
  if (!existing) {
    return false;
  }

  return (
    existing.authors.length === next.authors.length &&
    existing.authors.every(
      (author, index) => author.name === next.authors[index]?.name
    ) &&
    existing.content_id === next.content_id &&
    existing.contentHash === next.contentHash &&
    existing.date === next.date &&
    existing.depth === next.depth &&
    existing.description === next.description &&
    existing.kind === next.kind &&
    existing.alignmentId === next.alignmentId &&
    existing.assetId === next.assetId &&
    existing.conceptId === next.conceptId &&
    existing.learningObjectId === next.learningObjectId &&
    existing.lensId === next.lensId &&
    existing.locale === next.locale &&
    existing.markdown === next.markdown &&
    existing.materialDomain === next.materialDomain &&
    existing.official === next.official &&
    existing.parentRoute === next.parentRoute &&
    existing.route === next.route &&
    existing.section === next.section &&
    existing.sourceParentPath === next.sourceParentPath &&
    existing.sourcePath === next.sourcePath &&
    existing.title === next.title
  );
}

/**
 * Derives the parent public path stored with route rows so runtime lookups can
 * query sibling and child routes without rebuilding URL hierarchy in callers.
 */
function getParentPath(path: string) {
  const parentPath = path.split("/").slice(0, -1).join("/");

  return parentPath.length > 0 ? parentPath : undefined;
}
