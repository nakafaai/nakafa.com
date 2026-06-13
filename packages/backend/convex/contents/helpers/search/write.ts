import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  buildContentSearchDocument,
  type ContentSearchSource,
} from "@repo/backend/convex/contents/helpers/search/documents";
import { ConvexError } from "convex/values";

const duplicateSearchRepairLimit = 6;

/** Upserts one search row derived from canonical synced content. */
export async function syncContentSearch(
  ctx: MutationCtx,
  source: ContentSearchSource
) {
  const nextValues = buildContentSearchDocument(source);
  const existing = await ctx.db
    .query("contentSearch")
    .withIndex("by_content_id", (q) =>
      q.eq("content_id", nextValues.content_id)
    )
    .unique();
  const routeRows = await ctx.db
    .query("contentSearch")
    .withIndex("by_locale_and_route", (q) =>
      q.eq("locale", nextValues.locale).eq("route", nextValues.route)
    )
    .take(duplicateSearchRepairLimit);
  const routeExisting = existing ?? routeRows[0] ?? null;
  const deletedDuplicates = await deleteDuplicateContentSearchRows(ctx, {
    primary: routeExisting,
    rows: routeRows,
  });

  if (isSameContentSearch(routeExisting, nextValues)) {
    return deletedDuplicates > 0 ? "updated" : "unchanged";
  }

  if (routeExisting) {
    await ctx.db.patch("contentSearch", routeExisting._id, nextValues);
    return "updated";
  }

  await ctx.db.insert("contentSearch", nextValues);
  return "created";
}

/** Deletes the search row attached to one canonical content ID. */
export async function deleteContentSearch(ctx: MutationCtx, contentId: string) {
  const existing = await ctx.db
    .query("contentSearch")
    .withIndex("by_content_id", (q) => q.eq("content_id", contentId))
    .unique();

  if (!existing) {
    return;
  }

  await ctx.db.delete(existing._id);
}

/** Removes duplicate search rows before one route projection is inserted. */
async function deleteDuplicateContentSearchRows(
  ctx: MutationCtx,
  source: {
    primary: Doc<"contentSearch"> | null;
    rows: Doc<"contentSearch">[];
  }
) {
  if (source.rows.length >= duplicateSearchRepairLimit) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_DUPLICATE_LIMIT_EXCEEDED",
      message: "Content search route has too many duplicate projections.",
    });
  }

  let deleted = 0;

  for (const row of source.rows) {
    if (row._id === source.primary?._id) {
      continue;
    }

    await ctx.db.delete(row._id);
    deleted += 1;
  }

  return deleted;
}

/** Checks whether an existing read-model row already matches the next payload. */
function isSameContentSearch(
  existing: Doc<"contentSearch"> | null,
  next: Omit<Doc<"contentSearch">, "_creationTime" | "_id">
) {
  if (!existing) {
    return false;
  }

  return (
    existing.alignmentId === next.alignmentId &&
    existing.assetId === next.assetId &&
    existing.conceptId === next.conceptId &&
    existing.contentHash === next.contentHash &&
    existing.content_id === next.content_id &&
    existing.description === next.description &&
    existing.learningObjectId === next.learningObjectId &&
    existing.lensId === next.lensId &&
    existing.markdown_url === next.markdown_url &&
    existing.route === next.route &&
    existing.section === next.section &&
    existing.text === next.text &&
    existing.title === next.title &&
    existing.url === next.url
  );
}
