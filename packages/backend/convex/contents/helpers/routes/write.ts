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
  const contentRows = await ctx.db
    .query("contentRoutes")
    .withIndex("by_content_id", (q) =>
      q.eq("content_id", nextValues.content_id)
    )
    .take(2);
  const routeRows = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_route", (q) =>
      q.eq("locale", nextValues.locale).eq("route", nextValues.route)
    )
    .take(2);
  const sourceRows = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_sourcePath", (q) =>
      q.eq("locale", nextValues.locale).eq("sourcePath", nextValues.sourcePath)
    )
    .take(2);

  assertContentRouteIdentity({
    contentId: nextValues.content_id,
    contentRows,
    locale: nextValues.locale,
    route: nextValues.route,
    routeRows,
    sourcePath: nextValues.sourcePath,
    sourceRows,
  });

  const existing = contentRows[0] ?? null;

  if (isSameContentRoute(existing, nextValues)) {
    return "unchanged";
  }

  if (existing) {
    await ctx.db.patch("contentRoutes", existing._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("contentRoutes", nextValues);
  return "created";
}

/** Deletes the route catalog row attached to one canonical content ID. */
export async function deleteContentRoute(ctx: MutationCtx, contentId: string) {
  const rows = await ctx.db
    .query("contentRoutes")
    .withIndex("by_content_id", (q) => q.eq("content_id", contentId))
    .take(2);

  if (rows.length > 1) {
    throw new ConvexError({
      code: "CONTENT_ROUTE_IDENTITY_COLLISION",
      message: `Multiple content routes use content ID ${contentId}.`,
    });
  }

  const existing = rows[0];

  if (!existing) {
    return;
  }

  await ctx.db.delete(existing._id);
}

/** Deletes the route catalog row attached to one source route projection. */
export async function deleteContentRoutesBySourcePath(
  ctx: MutationCtx,
  args: { locale: Locale; sourcePath: string }
) {
  const rows = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_sourcePath", (q) =>
      q.eq("locale", args.locale).eq("sourcePath", args.sourcePath)
    )
    .take(2);

  if (rows.length > 1) {
    throw new ConvexError({
      code: "CONTENT_ROUTE_SOURCE_COLLISION",
      message: `Multiple content routes use source path ${args.locale}/${args.sourcePath}.`,
    });
  }

  const existing = rows[0];

  if (!existing) {
    return;
  }

  await ctx.db.delete(existing._id);
}

/** Rejects content IDs, public paths, or source paths with conflicting owners. */
function assertContentRouteIdentity(args: {
  contentId: string;
  contentRows: Doc<"contentRoutes">[];
  locale: Locale;
  route: string;
  routeRows: Doc<"contentRoutes">[];
  sourcePath: string;
  sourceRows: Doc<"contentRoutes">[];
}) {
  if (args.contentRows.length > 1) {
    throw new ConvexError({
      code: "CONTENT_ROUTE_IDENTITY_COLLISION",
      message: `Multiple content routes use content ID ${args.contentId}.`,
    });
  }

  if (args.routeRows.length > 1) {
    throw new ConvexError({
      code: "CONTENT_ROUTE_PUBLIC_PATH_COLLISION",
      message: `Multiple content routes use public path ${args.locale}/${args.route}.`,
    });
  }

  if (args.sourceRows.length > 1) {
    throw new ConvexError({
      code: "CONTENT_ROUTE_SOURCE_COLLISION",
      message: `Multiple content routes use source path ${args.locale}/${args.sourcePath}.`,
    });
  }

  const contentRow = args.contentRows[0];
  const routeRow = args.routeRows[0];
  const sourceRow = args.sourceRows[0];

  if (
    routeRow &&
    (routeRow.content_id !== args.contentId || routeRow._id !== contentRow?._id)
  ) {
    throw new ConvexError({
      code: "CONTENT_ROUTE_PUBLIC_PATH_COLLISION",
      message: `Public path ${args.locale}/${args.route} belongs to another content route.`,
    });
  }

  if (sourceRow && sourceRow._id !== contentRow?._id) {
    throw new ConvexError({
      code: "CONTENT_ROUTE_SOURCE_COLLISION",
      message: `Source path ${args.locale}/${args.sourcePath} belongs to another content route.`,
    });
  }
}

/** Checks whether one catalog row already matches the next sync payload. */
function isSameContentRoute(
  existing: Doc<"contentRoutes"> | null,
  next: Omit<Doc<"contentRoutes">, "_creationTime" | "_id">
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
