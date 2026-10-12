import { Schema } from "effect";

/**
 * The most characters one prompt can hold. A character here is a Unicode code
 * point, the unit that most languages count a string in, and the copy that
 * names the limit says "characters" for it. A letter or an emoji of one code
 * point counts once. A sequence such as a family emoji, or a letter with its
 * accent written as a separate mark, counts once for each code point in it:
 * counting what a reader sees as one character would let a single sequence
 * hold any number of code points, so the limit would no longer bound what the
 * prompt costs to store and to read. The composer checks the limit before it
 * asks and the backend refuses a longer prompt, both through
 * `isPromptWithinLimit`.
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
