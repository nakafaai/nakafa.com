import { getDocumentSize } from "convex/values";

/**
 * Convex's size of one stored document: 1 MiB, in the Documents section of its
 * limits page (https://docs.convex.dev/production/state/limits, read on 13
 * October 2026). The types page says "Convex values must be less than 1MB in
 * total size" (https://docs.convex.dev/database/types, read on 14 October 2026),
 * so the row must stay below this limit, and a row of exactly this size is refused.
 */
export const CONVEX_DOCUMENT_LIMIT = 1024 * 1024;

/**
 * Largest JSON text of one document, in UTF-8 bytes (ADR 0028 Bounds). The text
 * is the one string field of its row. The installed `convex` package (1.46.0,
 * `getConvexSize` in `values/size.js`) costs a string at its UTF-8 bytes plus
 * two, and `getDocumentSize` counts the system fields of a stored row (`_id` and
 * `_creationTime`) when they are absent, as the types page says. So every byte of
 * text adds exactly one byte to the row, and the largest text is the limit, less
 * one byte because the row must stay below it, less the row of an empty text. This
 * bound covers the text alone. A snapshot row also holds its version, its time, and
 * its document ID, so `ensureRowSize` in `confect/editor/document.ts` checks the
 * complete row before the write (ADR 0028 and ADR 0031).
 */
export const MAX_DOCUMENT_BYTES =
  CONVEX_DOCUMENT_LIMIT - 1 - getDocumentSize({ text: "" });

/** Most steps one call may send (ADR 0028 Bounds: 200 steps in one call). */
export const MAX_BATCH_STEPS = 200;

/** Largest JSON text of one call's batch in UTF-8 bytes (ADR 0028 Bounds: 128 KiB in one call). */
export const MAX_BATCH_BYTES = 128 * 1024;
