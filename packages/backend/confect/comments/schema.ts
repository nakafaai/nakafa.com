import { Schema } from "effect";
/**
 * Vote value validator: -1 = downvote, 1 = upvote
 */
export const commentVoteValidator = Schema.Literals([-1, 1]);
