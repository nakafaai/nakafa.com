/**
 * Cost and time bounds of the section index. Each one keeps a single step far
 * below the Convex limits of 16 MiB read and 1 second of code per transaction.
 */

/**
 * Lessons one build step reads. A lesson carries up to 128 KiB of source, so
 * six of them stay well below the transaction read limit.
 */
export const LESSONS_PER_STEP = 6;

/** Bytes of search rows one build step may scan while it lists its lessons. */
export const LESSON_PAGE_BYTES = 1024 * 1024;

/** Texts sent to the embedder in one request. */
export const EMBED_BATCH_SIZE = 64;

/** Sections one store mutation writes, with their vectors. */
export const SECTIONS_PER_MUTATION = 24;

/** Rows one prune mutation deletes. */
export const PRUNE_BATCH_SIZE = 64;

/** Stored sections one page of the model test reads back. */
export const COMPARE_PAGE_ROWS = 64;

/**
 * Bytes one page of the model test may read. A stored section is a vector of
 * 6 KB and up to 12,000 characters of text, so a full page stays below 3 MiB.
 */
export const COMPARE_PAGE_BYTES = 4 * 1024 * 1024;

/** Embedding requests the model test keeps open at once. */
export const COMPARE_CONCURRENCY = 6;

/** Characters of a section kept for word search. */
export const SECTION_TEXT_CHARS = 12_000;

/**
 * Characters of a section sent to the embedder: the lesson title, the heading
 * path, and the start of the body. Four thousand characters stay below the
 * token limit of every candidate model, the smallest being 2,048 tokens.
 */
export const EMBED_TEXT_CHARS = 4000;

/** Candidates each search leg, by meaning and by words, hands to the fusion. */
export const CANDIDATES_PER_LEG = 32;

/** The constant of reciprocal rank fusion: the larger it is, the flatter the gap between ranks. */
export const FUSION_RANK_CONSTANT = 60;

/** Sections a search returns when its caller names no limit. */
export const SEARCH_DEFAULT_LIMIT = 8;

/**
 * Candidates beyond the limit that a search verifies, so a stale row near the
 * top does not leave the answer short.
 */
export const SEARCH_VERIFY_SLACK = 4;

/** How long a whole search may run before the caller falls back to words. */
export const SEARCH_DEADLINE_MS = 10_000;

/** Search terms Convex accepts in one text query. */
export const TEXT_QUERY_TERMS = 16;

/** Bytes at which Convex discards one search term. */
export const TEXT_TERM_BYTES = 32;
