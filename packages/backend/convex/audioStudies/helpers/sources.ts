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
  const contentRows = await ctx.db
    .query("audioContentSources")
    .withIndex("by_content_id", (q) => q.eq("content_id", source.content_id))
    .take(2);
  const routeRows = await readAudioContentSourcesByRoute(ctx, source);

  assertAudioContentSourceIdentity({
    contentId: source.content_id,
    contentRows,
    route: source,
    routeRows,
  });

  const existing = contentRows[0] ?? null;

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

/** Removes compact audio metadata by its persisted source-route projection. */
export async function deleteAudioContentSourceByRoute(
  ctx: MutationCtx,
  source: AudioSourceRoute
) {
  const rows = await readAudioContentSourcesByRoute(ctx, source);

  if (rows.length > 1) {
    throw new ConvexError({
      code: "AUDIO_CONTENT_SOURCE_ROUTE_COLLISION",
      message: `Multiple audio content sources use route ${source.locale}/${source.contentType}/${source.route}.`,
    });
  }

  const existing = rows[0];

  if (!existing) {
    return;
  }

  await ctx.db.delete(existing._id);
}

/** Reads enough audio source projections to detect a route collision. */
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
    .take(2);
}

/** Rejects content IDs or source routes with conflicting audio owners. */
function assertAudioContentSourceIdentity(args: {
  contentId: AudioContentLookup["content_id"];
  contentRows: Doc<"audioContentSources">[];
  route: AudioSourceRoute;
  routeRows: Doc<"audioContentSources">[];
}) {
  if (args.contentRows.length > 1) {
    throw new ConvexError({
      code: "AUDIO_CONTENT_SOURCE_IDENTITY_COLLISION",
      message: `Multiple audio content sources use content ID ${args.contentId}.`,
    });
  }

  if (args.routeRows.length > 1) {
    throw new ConvexError({
      code: "AUDIO_CONTENT_SOURCE_ROUTE_COLLISION",
      message: `Multiple audio content sources use route ${args.route.locale}/${args.route.contentType}/${args.route.route}.`,
    });
  }

  const contentRow = args.contentRows[0];
  const routeRow = args.routeRows[0];

  if (routeRow && routeRow._id !== contentRow?._id) {
    throw new ConvexError({
      code: "AUDIO_CONTENT_SOURCE_ROUTE_COLLISION",
      message: `Audio content source route ${args.route.locale}/${args.route.contentType}/${args.route.route} belongs to another content ID.`,
    });
  }
}
