import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  buildContentSearchDocument,
  type ContentSearchSource,
} from "@repo/backend/convex/contents/helpers/search/documents";
import { ConvexError } from "convex/values";

/** Upserts one search row derived from canonical synced content. */
export async function syncContentSearch(
  ctx: MutationCtx,
  source: ContentSearchSource
) {
  const nextValues = buildContentSearchDocument(source);
  const contentRows = await ctx.db
    .query("contentSearch")
    .withIndex("by_content_id", (q) =>
      q.eq("content_id", nextValues.content_id)
    )
    .take(2);
  const routeRows = await ctx.db
    .query("contentSearch")
    .withIndex("by_locale_and_route", (q) =>
      q.eq("locale", nextValues.locale).eq("route", nextValues.route)
    )
    .take(2);
  const sourceRows = await ctx.db
    .query("contentSearch")
    .withIndex("by_locale_and_sourcePath", (q) =>
      q.eq("locale", nextValues.locale).eq("sourcePath", nextValues.sourcePath)
    )
    .take(2);

  assertContentSearchIdentity({
    contentId: nextValues.content_id,
    contentRows,
    locale: nextValues.locale,
    route: nextValues.route,
    routeRows,
    sourcePath: nextValues.sourcePath,
    sourceRows,
  });

  const existing = contentRows[0] ?? null;

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
  const rows = await ctx.db
    .query("contentSearch")
    .withIndex("by_content_id", (q) => q.eq("content_id", contentId))
    .take(2);

  if (rows.length > 1) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_IDENTITY_COLLISION",
      message: `Multiple search documents use content ID ${contentId}.`,
    });
  }

  const existing = rows[0];

  if (!existing) {
    return;
  }

  await ctx.db.delete(existing._id);
}

/** Deletes the search row attached to one source route projection. */
export async function deleteContentSearchBySourcePath(
  ctx: MutationCtx,
  args: { locale: Doc<"contentSearch">["locale"]; sourcePath: string }
) {
  const rows = await ctx.db
    .query("contentSearch")
    .withIndex("by_locale_and_sourcePath", (q) =>
      q.eq("locale", args.locale).eq("sourcePath", args.sourcePath)
    )
    .take(2);

  if (rows.length > 1) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_SOURCE_COLLISION",
      message: `Multiple search documents use source path ${args.locale}/${args.sourcePath}.`,
    });
  }

  const existing = rows[0];

  if (!existing) {
    return;
  }

  await ctx.db.delete(existing._id);
}

/** Rejects content IDs, public paths, or source paths with conflicting owners. */
function assertContentSearchIdentity(args: {
  contentId: string;
  contentRows: Doc<"contentSearch">[];
  locale: Doc<"contentSearch">["locale"];
  route: string;
  routeRows: Doc<"contentSearch">[];
  sourcePath: string;
  sourceRows: Doc<"contentSearch">[];
}) {
  if (args.contentRows.length > 1) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_IDENTITY_COLLISION",
      message: `Multiple search documents use content ID ${args.contentId}.`,
    });
  }

  if (args.routeRows.length > 1) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_PUBLIC_PATH_COLLISION",
      message: `Multiple search documents use public path ${args.locale}/${args.route}.`,
    });
  }

  if (args.sourceRows.length > 1) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_SOURCE_COLLISION",
      message: `Multiple search documents use source path ${args.locale}/${args.sourcePath}.`,
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
      code: "CONTENT_SEARCH_PUBLIC_PATH_COLLISION",
      message: `Public path ${args.locale}/${args.route} belongs to another search document.`,
    });
  }

  if (sourceRow && sourceRow._id !== contentRow?._id) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_SOURCE_COLLISION",
      message: `Source path ${args.locale}/${args.sourcePath} belongs to another search document.`,
    });
  }
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
    existing.locale === next.locale &&
    existing.markdown_url === next.markdown_url &&
    existing.route === next.route &&
    existing.section === next.section &&
    existing.sourcePath === next.sourcePath &&
    existing.text === next.text &&
    existing.title === next.title &&
    existing.url === next.url
  );
}
