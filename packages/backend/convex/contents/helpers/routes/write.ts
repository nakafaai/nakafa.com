import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { buildContentSearchRef } from "@repo/backend/convex/contents/helpers/search/documents";
import type {
  Locale,
  NakafaSection,
} from "@repo/backend/convex/lib/validators/contents";
import type { LearningGraphIdentity } from "@repo/contents/_types/learning-graph";
import { ConvexError } from "convex/values";

const duplicateRouteProjectionRepairLimit = 6;

interface ContentRouteSource extends LearningGraphIdentity {
  authors?: { name: string }[];
  contentHash: string;
  date?: number;
  description?: string;
  kind: Doc<"contentRoutes">["kind"];
  locale: Locale;
  markdown: boolean;
  official?: boolean;
  route: string;
  section: NakafaSection;
  syncedAt: number;
  title: string;
}

/** Upserts one concrete public content route into the durable route catalog. */
export async function syncContentRoute(
  ctx: MutationCtx,
  source: ContentRouteSource
) {
  const searchRef = buildContentSearchRef(source);
  const routeParts = source.route.split("/").filter(Boolean);
  const nextValues = {
    alignmentId: source.alignmentId,
    authors: source.authors ?? [],
    assetId: source.assetId,
    conceptId: source.conceptId,
    contentHash: source.contentHash,
    content_id: searchRef.content_id,
    date: source.date,
    depth: routeParts.length,
    description: source.description,
    kind: source.kind,
    learningObjectId: source.learningObjectId,
    locale: source.locale,
    lensId: source.lensId,
    markdown: source.markdown,
    official: source.official,
    parentRoute: getContentRouteParentRoute(source.kind, routeParts),
    route: source.route,
    section: source.section,
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
    .take(duplicateRouteProjectionRepairLimit);
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

/** Deletes the route catalog row attached to one graph content ID. */
export async function deleteContentRouteByGraphContentId(
  ctx: MutationCtx,
  graphContentId: string
) {
  const existing = await ctx.db
    .query("contentRoutes")
    .withIndex("by_content_id", (q) => q.eq("content_id", graphContentId))
    .unique();

  if (!existing) {
    return;
  }

  if (existing.countedAt !== undefined) {
    await decrementContentRouteCount(ctx, existing);
  }

  await ctx.db.delete(existing._id);
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
  if (source.rows.length >= duplicateRouteProjectionRepairLimit) {
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
    section: NakafaSection;
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
    existing.official === next.official &&
    existing.parentRoute === next.parentRoute &&
    existing.route === next.route &&
    existing.section === next.section &&
    existing.title === next.title
  );
}

/** Derives the navigation parent route for one synced public route. */
function getContentRouteParentRoute(
  kind: Doc<"contentRoutes">["kind"],
  parts: readonly string[]
) {
  if (kind === "article") {
    return parts.slice(0, 2).join("/");
  }

  if (kind === "exercise-group") {
    return parts.slice(0, 4).join("/");
  }

  if (kind === "subject-topic") {
    return parts.slice(0, 4).join("/");
  }

  if (kind === "quran-surah") {
    return "quran";
  }

  return parts.slice(0, -1).join("/");
}
