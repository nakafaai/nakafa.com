import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type { AudioContentLookup } from "@repo/backend/convex/contents/validators";

type AudioSourceReaderCtx = Pick<QueryCtx, "db">;

function toAudioContentLookup(
  source: Doc<"audioContentSources">
): AudioContentLookup {
  return {
    alignmentId: source.alignmentId,
    assetId: source.assetId,
    conceptId: source.conceptId,
    contentHash: source.contentHash,
    content_id: source.content_id,
    contentType: source.contentType,
    learningObjectId: source.learningObjectId,
    lensId: source.lensId,
    locale: source.locale,
    route: source.route,
  };
}

/** Reads compact audio metadata by graph content ID. */
export async function getAudioContentSourceByContentId(
  ctx: AudioSourceReaderCtx,
  contentId: AudioContentLookup["content_id"]
) {
  const source = await ctx.db
    .query("audioContentSources")
    .withIndex("by_content_id", (q) => q.eq("content_id", contentId))
    .unique();

  return source ? toAudioContentLookup(source) : null;
}

/** Reads compact audio metadata for a locale version of the same source route. */
export async function getAudioContentSourceByLocale(
  ctx: AudioSourceReaderCtx,
  sourceContent: AudioContentLookup,
  locale: AudioContentLookup["locale"]
) {
  if (sourceContent.locale === locale) {
    return sourceContent;
  }

  const source = await ctx.db
    .query("audioContentSources")
    .withIndex("by_contentType_and_route_and_locale", (q) =>
      q
        .eq("contentType", sourceContent.contentType)
        .eq("route", sourceContent.route)
        .eq("locale", locale)
    )
    .unique();

  return source ? toAudioContentLookup(source) : null;
}

/** Reads compact audio metadata through a graph route projection. */
export async function getAudioContentSourceByRoute(
  ctx: AudioSourceReaderCtx,
  route: Doc<"contentRoutes">
) {
  if (route.kind !== "article" && route.kind !== "subject-section") {
    return null;
  }

  if (route.content_id !== route.assetId) {
    return null;
  }

  const source = await ctx.db
    .query("audioContentSources")
    .withIndex("by_content_id", (q) => q.eq("content_id", route.content_id))
    .unique();

  return source ? toAudioContentLookup(source) : null;
}

/** Upserts compact audio metadata from the content sync source of truth. */
export async function syncAudioContentSource(
  ctx: MutationCtx,
  source: AudioContentLookup & { syncedAt: number }
) {
  const existing = await ctx.db
    .query("audioContentSources")
    .withIndex("by_content_id", (q) => q.eq("content_id", source.content_id))
    .unique();

  const nextValues = {
    alignmentId: source.alignmentId,
    assetId: source.assetId,
    conceptId: source.conceptId,
    contentHash: source.contentHash,
    content_id: source.content_id,
    contentType: source.contentType,
    learningObjectId: source.learningObjectId,
    lensId: source.lensId,
    locale: source.locale,
    route: source.route,
    syncedAt: source.syncedAt,
  };

  if (!existing) {
    await ctx.db.insert("audioContentSources", nextValues);
    return;
  }

  if (
    existing.alignmentId === nextValues.alignmentId &&
    existing.assetId === nextValues.assetId &&
    existing.conceptId === nextValues.conceptId &&
    existing.contentHash === nextValues.contentHash &&
    existing.content_id === nextValues.content_id &&
    existing.contentType === nextValues.contentType &&
    existing.learningObjectId === nextValues.learningObjectId &&
    existing.lensId === nextValues.lensId &&
    existing.locale === nextValues.locale &&
    existing.route === nextValues.route
  ) {
    return;
  }

  await ctx.db.patch("audioContentSources", existing._id, nextValues);
}

/** Removes compact audio metadata for deleted source content. */
export async function deleteAudioContentSource(
  ctx: MutationCtx,
  contentId: AudioContentLookup["content_id"]
) {
  const existing = await ctx.db
    .query("audioContentSources")
    .withIndex("by_content_id", (q) => q.eq("content_id", contentId))
    .unique();

  if (!existing) {
    return;
  }

  await ctx.db.delete(existing._id);
}

/** Removes compact audio metadata by its persisted source-route projection. */
export async function deleteAudioContentSourceByRoute(
  ctx: MutationCtx,
  source: Pick<AudioContentLookup, "contentType" | "locale" | "route">
) {
  const existing = await ctx.db
    .query("audioContentSources")
    .withIndex("by_contentType_and_route_and_locale", (q) =>
      q
        .eq("contentType", source.contentType)
        .eq("route", source.route)
        .eq("locale", source.locale)
    )
    .unique();

  if (!existing) {
    return;
  }

  await ctx.db.delete(existing._id);
}
