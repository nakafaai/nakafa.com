import { Schema } from "effect";

/**
 * The most characters one prompt can hold. A character here is a Unicode code
 * point, so an emoji counts once, as a learner counts it. The composer checks
 * the limit before it asks and the backend refuses a longer prompt, both
 * through `isPromptWithinLimit`.
 */
export const NINA_PROMPT_LENGTH = 100_000;
/** Says that one prompt is longer than the prompt limit. */
export const NINA_PROMPT_LENGTH_MESSAGE = `Shorten the message to at most ${NINA_PROMPT_LENGTH} characters.`;
/**
 * Whether a prompt is within the prompt limit. It counts no further than the
 * limit, so a very long prompt costs no more to refuse than one just over.
 */
export const isPromptWithinLimit = Schema.is(
  Schema.String.check(Schema.isMaxCodePoints(NINA_PROMPT_LENGTH))
);
/** The refusal of a prompt that is longer than the prompt limit. */
export class NinaPromptError extends Schema.TaggedError<NinaPromptError>()(
  "NinaPromptError",
  {
    code: Schema.Literal("NINA_PROMPT_LENGTH"),
    message: Schema.String,
  }
) {}
