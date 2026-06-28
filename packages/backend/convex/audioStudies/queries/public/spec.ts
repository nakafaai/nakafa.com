import {
  audioContentTypeValidator,
  audioStatusValidator,
} from "@repo/backend/convex/lib/validators/audio";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { type Infer, v } from "convex/values";
import { nullable } from "convex-helpers/validators";
import { Schema } from "effect";

export const audioPlaybackIoFailedCode = "AUDIO_PLAYBACK_IO_FAILED";

export const audioPlaybackArgs = {
  contentType: audioContentTypeValidator,
  locale: localeValidator,
  slug: v.string(),
};

export const audioPlaybackArgsValidator = v.object(audioPlaybackArgs);

export const audioPlaybackResultValidator = nullable(
  v.object({
    audioUrl: v.string(),
    contentType: audioContentTypeValidator,
    duration: v.number(),
    script: v.optional(v.string()),
    status: audioStatusValidator,
  })
);

export type AudioPlaybackArgs = Infer<typeof audioPlaybackArgsValidator>;

export type AudioPlaybackResult = Infer<typeof audioPlaybackResultValidator>;

/** Raised when Convex IO fails while resolving public audio playback. */
export class AudioPlaybackIoError extends Schema.TaggedError<AudioPlaybackIoError>()(
  "AudioPlaybackIoError",
  {
    code: Schema.Literal(audioPlaybackIoFailedCode),
    message: Schema.String,
  }
) {}
