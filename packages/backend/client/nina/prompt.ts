import { Schema } from "effect";

/**
 * The most characters one prompt can hold, which bounds what a prompt costs to
 * send, store and count before the turn budget is read. Text of ordinary words
 * this long is already over the budget of one turn (the estimator counts
 * 100,000 Latin letters at about 44,000 tokens and 100,000 Arabic characters at
 * about 82,000, against a budget of about 33,000), so the learner is told the
 * same thing for both limits: the message is too long for one turn, with no
 * number that a shorter message could still exceed.
 *
 * A character here is a Unicode code point, the unit that most languages count
 * a string in. A letter or an emoji of one code point counts once. A sequence
 * such as a family emoji, or a letter with its accent written as a separate
 * mark, counts once for each code point in it: counting what a reader sees as
 * one character would let a single sequence hold any number of code points, so
 * the limit would no longer bound what the prompt costs to store and to read.
 * The composer checks the limit before it asks and the backend refuses a
 * longer prompt, both through `isPromptWithinLimit`.
 */
export const NINA_PROMPT_LENGTH = 100_000;
/** Says, in the log, that one prompt is longer than the prompt limit. */
export const NINA_PROMPT_LENGTH_MESSAGE = `The prompt is longer than ${NINA_PROMPT_LENGTH} characters.`;
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
