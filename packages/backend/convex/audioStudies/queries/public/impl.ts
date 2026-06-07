import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  type AudioPlaybackArgs,
  AudioPlaybackIoError,
  audioPlaybackIoFailedCode,
} from "@repo/backend/convex/audioStudies/queries/public/spec";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { logger } from "@repo/backend/convex/utils/logger";
import { Effect } from "effect";

/** Maps thrown Convex IO failures into the audio playback error channel. */
function toAudioPlaybackIoError(error: unknown) {
  return new AudioPlaybackIoError({
    code: audioPlaybackIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/**
 * Resolves public audio playback from the compact audio source read model.
 *
 * This avoids rereading large article or subject documents on every playback
 * probe while still using native Convex indexed reads and storage URLs.
 * @see https://docs.convex.dev/understanding/best-practices/
 */
export const getAudioPlaybackBySlug = Effect.fn(
  "audioStudies.queries.public.getAudioPlaybackBySlug"
)(function* (ctx: QueryCtx, args: AudioPlaybackArgs) {
  const source = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("audioContentSources")
        .withIndex("by_contentRefType_and_slug_and_locale", (q) =>
          q
            .eq("contentRef.type", args.contentType)
            .eq("slug", args.slug)
            .eq("locale", args.locale)
        )
        .unique(),
    catch: toAudioPlaybackIoError,
  });

  if (!source) {
    return null;
  }

  const audio = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("contentAudios")
        .withIndex("by_contentRefType_and_contentRefId_and_locale", (q) =>
          q
            .eq("contentRef.type", source.contentRef.type)
            .eq("contentRef.id", source.contentRef.id)
            .eq("locale", args.locale)
        )
        .first(),
    catch: toAudioPlaybackIoError,
  });

  if (audio?.status !== "completed" || !audio.audioStorageId) {
    return null;
  }

  const audioStorageId = audio.audioStorageId;
  const audioUrl = yield* Effect.tryPromise({
    try: () => ctx.storage.getUrl(audioStorageId),
    catch: toAudioPlaybackIoError,
  });

  if (!audioUrl) {
    yield* Effect.sync(() =>
      logger.warn("Audio storage URL missing", {
        slug: args.slug,
        storageId: audioStorageId,
      })
    );
    return null;
  }

  return {
    audioUrl,
    contentType: args.contentType,
    duration: audio.audioDuration ? audio.audioDuration / 1000 : 0,
    script: audio.script,
    status: audio.status,
  };
});
