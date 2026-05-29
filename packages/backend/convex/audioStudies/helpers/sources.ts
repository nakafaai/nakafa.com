import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type { AudioContentLookup } from "@repo/backend/convex/contents/validators";
import type { AudioContentRef } from "@repo/backend/convex/lib/validators/audio";

type AudioSourceReaderCtx = Pick<QueryCtx, "db">;

function toAudioContentLookup(
  source: Doc<"audioContentSources">
): AudioContentLookup {
  return {
    contentHash: source.contentHash,
    locale: source.locale,
    ref: source.contentRef,
    slug: source.slug,
  };
}

/** Reads compact audio metadata by content reference. */
export async function getAudioContentSourceByRef(
  ctx: AudioSourceReaderCtx,
  contentRef: AudioContentRef
) {
  const source = await ctx.db
    .query("audioContentSources")
    .withIndex("by_contentRefType_and_contentRefId", (q) =>
      q
        .eq("contentRef.type", contentRef.type)
        .eq("contentRef.id", contentRef.id)
    )
    .unique();

  return source ? toAudioContentLookup(source) : null;
}

/** Reads compact audio metadata for a locale version of the same source slug. */
export async function getAudioContentSourceByLocale(
  ctx: AudioSourceReaderCtx,
  sourceContent: AudioContentLookup,
  locale: AudioContentLookup["locale"]
) {
  const source = await ctx.db
    .query("audioContentSources")
    .withIndex("by_contentRefType_and_slug_and_locale", (q) =>
      q
        .eq("contentRef.type", sourceContent.ref.type)
        .eq("slug", sourceContent.slug)
        .eq("locale", locale)
    )
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
    .withIndex("by_contentRefType_and_contentRefId", (q) =>
      q
        .eq("contentRef.type", source.ref.type)
        .eq("contentRef.id", source.ref.id)
    )
    .unique();

  const nextValues = {
    contentHash: source.contentHash,
    contentRef: source.ref,
    locale: source.locale,
    slug: source.slug,
    syncedAt: source.syncedAt,
  };

  if (!existing) {
    await ctx.db.insert("audioContentSources", nextValues);
    return;
  }

  if (
    existing.contentHash === nextValues.contentHash &&
    existing.locale === nextValues.locale &&
    existing.slug === nextValues.slug
  ) {
    return;
  }

  await ctx.db.patch("audioContentSources", existing._id, nextValues);
}

/** Removes compact audio metadata for deleted source content. */
export async function deleteAudioContentSource(
  ctx: MutationCtx,
  contentRef: AudioContentRef
) {
  const existing = await ctx.db
    .query("audioContentSources")
    .withIndex("by_contentRefType_and_contentRefId", (q) =>
      q
        .eq("contentRef.type", contentRef.type)
        .eq("contentRef.id", contentRef.id)
    )
    .unique();

  if (!existing) {
    return;
  }

  await ctx.db.delete(existing._id);
}
