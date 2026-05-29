import { Effect, Schema } from "effect";

export class AudioGenerationActionError extends Schema.TaggedError<AudioGenerationActionError>()(
  "AudioGenerationActionError",
  { message: Schema.String }
) {}

/** Converts an unknown failure into a readable queue error message. */
export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/** Fails when content changed while paid generation work was running. */
export function failContentChanged(message: string) {
  return Effect.fail(new AudioGenerationActionError({ message }));
}
