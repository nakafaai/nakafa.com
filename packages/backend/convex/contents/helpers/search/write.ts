import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  buildContentSearchDocument,
  type ContentSearchSource,
} from "@repo/backend/convex/contents/helpers/search/documents";

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

  if (isSameContentSearch(existing, nextValues)) {
    return "unchanged";
  }

  if (existing) {
    await ctx.db.patch("contentSearch", existing._id, nextValues);
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
