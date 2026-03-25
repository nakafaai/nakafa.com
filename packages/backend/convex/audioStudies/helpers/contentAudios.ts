import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  AudioContentRef,
  AudioStatus,
} from "@repo/backend/convex/lib/validators/audio";
import { ConvexError } from "convex/values";

const CONTENT_AUDIO_DUPLICATE_LIMIT = 3;

/** Load one content audio row or fail with a precise not-found error. */
export async function requireContentAudio(
  ctx: MutationCtx,
  contentAudioId: Doc<"contentAudios">["_id"]
) {
  const audio = await ctx.db.get("contentAudios", contentAudioId);

  if (audio) {
    return audio;
  }

  throw new ConvexError({
    code: "NOT_FOUND",
    message: "Audio record not found",
  });
}

/** Load the canonical content-audio rows for one content ref and locale. */
export async function loadContentAudioRecords(
  ctx: MutationCtx,
  {
    contentRef,
    locale,
  }: {
    contentRef: AudioContentRef;
    locale: Doc<"contentAudios">["locale"];
  }
) {
  const records = await ctx.db
    .query("contentAudios")
    .withIndex("by_contentRefType_and_contentRefId_and_locale", (q) =>
      q
        .eq("contentRef.type", contentRef.type)
        .eq("contentRef.id", contentRef.id)
        .eq("locale", locale)
    )
    .take(CONTENT_AUDIO_DUPLICATE_LIMIT);

  if (records.length < CONTENT_AUDIO_DUPLICATE_LIMIT) {
    return records;
  }

  throw new ConvexError({
    code: "CONTENT_AUDIO_DUPLICATE_LIMIT_EXCEEDED",
    message: "Content audio duplicate limit exceeded.",
  });
}

/** Keep the earliest content-audio row as the canonical record for one key. */
export async function collapseDuplicateContentAudioRecords(
  ctx: MutationCtx,
  records: Doc<"contentAudios">[]
) {
  const [keeper, ...duplicates] = records;

  if (!keeper) {
    throw new ConvexError({
      code: "CONTENT_AUDIO_NOT_FOUND",
      message: "Content audio record not found.",
    });
  }

  for (const duplicate of duplicates) {
    await ctx.db.delete("contentAudios", duplicate._id);
  }

  return keeper;
}

/**
 * Claim one content-audio state transition only when the current status allows
 * a retry-safe workflow step to continue.
 */
export async function claimContentAudioGeneration(
  ctx: MutationCtx,
  {
    allowedStatuses,
    contentAudioId,
    nextStatus,
  }: {
    allowedStatuses: AudioStatus[];
    contentAudioId: Doc<"contentAudios">["_id"];
    nextStatus: AudioStatus;
  }
) {
  const audio = await requireContentAudio(ctx, contentAudioId);

  if (!allowedStatuses.includes(audio.status)) {
    return false;
  }

  await ctx.db.patch("contentAudios", contentAudioId, {
    status: nextStatus,
    updatedAt: Date.now(),
  });

  return true;
}
