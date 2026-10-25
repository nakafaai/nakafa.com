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

/** Sections that the model test embeds in one batch, which it runs a few batches at a time. */
export const EMBED_BATCH_SIZE = 64;

/**
 * Embedding requests that a batch keeps open at once. The gateway refuses a
 * request of several texts for `gemini-embedding-2` with status 404: on 25
 * October 2026 every request of 2 to 16 texts was refused, and every request of
 * one text was answered. So each text goes in a request of its own, and a few of
 * those requests run at once.
 */
export const EMBED_CONCURRENCY = 4;

/**
 * Times a build step asks for vectors again after a failure that may pass. A
 * model that refuses a text is not asked again.
 */
export const EMBED_RETRIES = 4;

/**
 * The wait before the first new try. Each wait is twice the one before, so the
 * four new tries wait 75 seconds in all, which outlasts a gateway that is down
 * for a minute without ending the build.
 */
export const EMBED_RETRY_DELAY_MS = 5000;

/**
 * Sections one document may have. One store mutation replaces all the sections
 * of a document, so that the stored sections and the version recorded for them
 * are never apart. It reads this many rows of about 31 KB at the most, a
 * vector and a longest text (Convex counts a vector of 768 numbers as 6,914
 * bytes, and a section keeps up to 12,000 characters of text beside it, 24,000
 * bytes when they are Arabic), and may read each of them twice more when it
 * replaces or deletes them, about 12 MB in all, below the 16 MiB limits. The
 * check that asks which texts a document holds reads the rows once, about 4
 * MB. The longest lesson of the corpus has 19 sections and the longest surah
 * 48 passages, so a document over the limit is a source to fix, and the build
 * fails and names it.
 */
export const SECTIONS_PER_DOCUMENT = 128;

/**
 * Rows one clean-up mutation deletes. It is the most rows a document may hold,
 * so that a document always fits an empty batch and goes whole: its rows and
 * its record are deleted in one transaction, and the record never names a
 * version that its sections lack.
 */
export const PRUNE_BATCH_SIZE = SECTIONS_PER_DOCUMENT;

/** Documents one clean-up mutation checks for being published still. */
export const PRUNE_SOURCES_PER_PAGE = 64;

/** Stored sections one page of the model test reads back. */
export const COMPARE_PAGE_ROWS = 64;

/**
 * Bytes one page of the model test may read. A stored section takes at most
 * about 31 KB, a vector of 6,914 bytes and 12,000 characters of Arabic, so a
 * full page stays below 2 MB.
 */
export const COMPARE_PAGE_BYTES = 4 * 1024 * 1024;

/** Embedding requests the model test keeps open at once. */
export const COMPARE_CONCURRENCY = 6;

/** Characters of a section kept for word search. */
export const SECTION_TEXT_CHARS = 12_000;

/**
 * Characters of a section sent to the embedder: the lesson title, the heading
 * path, and the start of the body. The limit of a model is in tokens, which
 * this cut does not count, so a section that a model still refuses is left out
 * of the index with a warning and counted as missing.
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
