import { Schema } from "effect";

/**
 * A report hash as the verification address carries it: 64 lowercase hex digits. It stands
 * alone because the check page's route reads it, and a route's checks sit in the first
 * JavaScript of every public page.
 */
export const ReportHash = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{64}$/u)
);
