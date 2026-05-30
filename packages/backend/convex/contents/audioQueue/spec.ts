import { popularAudioContentItemValidator } from "@repo/backend/convex/contents/validators";
import { type Infer, v } from "convex/values";
import { Schema } from "effect";

export const audioQueuePopulationFailedCode = "AUDIO_QUEUE_POPULATION_FAILED";

export const enqueuePopularContentForAudioArgs = {
  items: v.array(popularAudioContentItemValidator),
};

export const enqueuePopularContentForAudioArgsValidator = v.object(
  enqueuePopularContentForAudioArgs
);

export const enqueuePopularContentForAudioResultValidator = v.object({
  processed: v.number(),
  queued: v.number(),
});

export const populateAudioQueueResultValidator = v.null();

export type EnqueuePopularContentForAudioArgs = Infer<
  typeof enqueuePopularContentForAudioArgsValidator
>;

export type EnqueuePopularContentForAudioResult = Infer<
  typeof enqueuePopularContentForAudioResultValidator
>;

export type PopulateAudioQueueResult = Infer<
  typeof populateAudioQueueResultValidator
>;

/** Raised when an internal popularity read or queue write fails. */
export class AudioQueuePopulationError extends Schema.TaggedError<AudioQueuePopulationError>()(
  "AudioQueuePopulationError",
  {
    code: Schema.Literal(audioQueuePopulationFailedCode),
    message: Schema.String,
  }
) {}
