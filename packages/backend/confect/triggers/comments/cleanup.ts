/**
 * The most votes one pass removes from a deleted comment, until the contract stage
 * removes the vote table.
 */
export const COMMENT_VOTE_CLEANUP_BATCH_SIZE = 100;

/** The most likes one pass removes from a deleted comment. */
export const COMMENT_LIKE_CLEANUP_BATCH_SIZE = 100;

/**
 * The most comments one pass removes from a deleted thread or from the replies of a
 * deleted comment.
 */
export const COMMENT_REPLY_CLEANUP_BATCH_SIZE = 100;
