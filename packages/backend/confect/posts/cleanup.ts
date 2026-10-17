/**
 * The most post likes one pass removes. A post with more likes than this takes
 * several passes, and a learner's deletion takes the same bounded batches.
 */
export const POST_LIKE_CLEANUP_BATCH_SIZE = 100;
