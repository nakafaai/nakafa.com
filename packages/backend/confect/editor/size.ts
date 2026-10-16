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
 * The length of a Convex document ID. The installed `convex` package estimates the
 * `_id` of a stored row at 38 bytes (`SYSTEM_FIELD_ID_ESTIMATE` in `values/size.js`):
 * the key `_id`, its separator, and a string of 32 characters.
 */
export const DOCUMENT_ID_LENGTH = 32;

/**
 * Largest JSON text of one document, in UTF-8 bytes (ADR 0028 Bounds). The text is the
 * one string field of a snapshot row, and the row must stay below `CONVEX_DOCUMENT_LIMIT`.
 * The installed `convex` package (1.46.0, `getConvexSize` in `values/size.js`) costs a
 * string at its UTF-8 bytes plus two, so every byte of text adds one byte to the row. The
 * row also holds its time, its version, and its document ID, and `getDocumentSize` counts
 * the system fields of a row that has no `_id` or `_creationTime`, as a snapshot row has
 * when `ensureRowSize` checks it (`confect/editor/document.ts`). So the bound is the limit,
 * less one byte because the row must stay below it, less the snapshot row of an empty
 * text. The largest text that the editor admits is then one that the snapshot stores.
 */
export const MAX_DOCUMENT_BYTES =
  CONVEX_DOCUMENT_LIMIT -
  1 -
  getDocumentSize({
    at: 0,
    content: "",
    documentId: "x".repeat(DOCUMENT_ID_LENGTH),
    version: 0,
  });

/** Most steps one call may send (ADR 0028 Bounds: 200 steps in one call). */
export const MAX_BATCH_STEPS = 200;

/** Largest JSON text of one call's batch in UTF-8 bytes (ADR 0028 Bounds: 128 KiB in one call). */
export const MAX_BATCH_BYTES = 128 * 1024;
