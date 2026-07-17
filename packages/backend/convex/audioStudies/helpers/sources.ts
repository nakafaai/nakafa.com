import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type { AudioContentLookup } from "@repo/backend/convex/contents/validators";
import { ConvexError } from "convex/values";

type AudioSourceReaderCtx = Pick<QueryCtx, "db">;
type AudioSourceRoute = Pick<
  AudioContentLookup,
  "contentType" | "locale" | "route"
>;

const duplicateAudioSourceRepairLimit = 6;

/** Projects an audio source document into the compact graph lookup contract. */
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
  if (route.kind !== "article" && route.kind !== "curriculum-lesson") {
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
  const routeRows = await readAudioContentSourcesByRoute(ctx, source);
  const primary = existing ?? routeRows[0] ?? null;

  await deleteDuplicateAudioContentSources(ctx, {
    primary,
    rows: routeRows,
  });

  if (!primary) {
    await ctx.db.insert("audioContentSources", nextValues);
    return;
  }

  if (
    primary.alignmentId === nextValues.alignmentId &&
    primary.assetId === nextValues.assetId &&
    primary.conceptId === nextValues.conceptId &&
    primary.contentHash === nextValues.contentHash &&
    primary.content_id === nextValues.content_id &&
    primary.contentType === nextValues.contentType &&
    primary.learningObjectId === nextValues.learningObjectId &&
    primary.lensId === nextValues.lensId &&
    primary.locale === nextValues.locale &&
    primary.route === nextValues.route
  ) {
    return;
  }

  await ctx.db.patch("audioContentSources", primary._id, nextValues);
}

/** Removes compact audio metadata by its persisted source-route projection. */
export async function deleteAudioContentSourceByRoute(
  ctx: MutationCtx,
  source: AudioSourceRoute
) {
  const rows = await readAudioContentSourcesByRoute(ctx, source);

  if (rows.length >= duplicateAudioSourceRepairLimit) {
    throw new ConvexError({
      code: "AUDIO_CONTENT_SOURCE_DELETE_LIMIT_EXCEEDED",
      message:
        "Audio content source route has too many projections to delete safely.",
    });
  }

  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
}

/** Reads every bounded audio source projection for one source route. */
async function readAudioContentSourcesByRoute(
  ctx: Pick<MutationCtx, "db">,
  source: AudioSourceRoute
) {
  return await ctx.db
    .query("audioContentSources")
    .withIndex("by_contentType_and_route_and_locale", (q) =>
      q
        .eq("contentType", source.contentType)
        .eq("route", source.route)
        .eq("locale", source.locale)
    )
    .take(duplicateAudioSourceRepairLimit);
}

/** Removes duplicate route projections while preserving one canonical source row. */
async function deleteDuplicateAudioContentSources(
  ctx: MutationCtx,
  source: {
    primary: Doc<"audioContentSources"> | null;
    rows: Doc<"audioContentSources">[];
  }
) {
  if (source.rows.length >= duplicateAudioSourceRepairLimit) {
    throw new ConvexError({
      code: "AUDIO_CONTENT_SOURCE_DUPLICATE_LIMIT_EXCEEDED",
      message: "Audio content source route has too many duplicate projections.",
    });
  }

  for (const row of source.rows) {
    if (row._id === source.primary?._id) {
      continue;
    }

    await ctx.db.delete(row._id);
  }
}
