import { Schema } from "effect";

/**
 * The most characters one prompt can hold, counted the way a string counts its
 * length. The composer checks it before it asks and the backend refuses a
 * longer prompt, so both read the limit from here.
 */
export const NINA_PROMPT_LENGTH = 100_000;
/** Says that one prompt is longer than the prompt limit. */
export const NINA_PROMPT_LENGTH_MESSAGE = `Shorten the message to at most ${NINA_PROMPT_LENGTH} characters.`;
/** The refusal of a prompt that is longer than the prompt limit. */
export class NinaPromptError extends Schema.TaggedError<NinaPromptError>()(
  "NinaPromptError",
  {
    code: Schema.Literal("NINA_PROMPT_LENGTH"),
    message: Schema.String,
  }
) {}
