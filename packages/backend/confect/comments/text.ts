import {
  LEARNER_TEXT_MAX_LENGTH,
  readLearnerText,
} from "@repo/backend/confect/writing/text";
import { Result, String as Str } from "effect";

/**
 * Reads the Markdown a learner wrote for a comment: learner text, as a post reads it, or nothing at all
 * when the comment carries a photo, which then speaks for itself. The composer and the server both read
 * a comment with this function, so they agree.
 */
export function readCommentText(input: string, photos: number) {
  return photos > 0 && Str.isEmpty(Str.trim(input))
    ? Result.succeed("")
    : readLearnerText(input);
}

/** The message of a refused text, which names the limit. */
export const TEXT_REFUSAL_MESSAGE = `The comment must hold 1 to ${LEARNER_TEXT_MAX_LENGTH} characters, or a photo.`;
