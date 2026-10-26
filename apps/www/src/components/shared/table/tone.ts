import { Schema } from "effect";

/** The tones a record's status takes in a table, each drawn from its colour token of the theme. */
export const StatusTone = Schema.Literals([
  "danger",
  "info",
  "neutral",
  "primary",
  "success",
  "warning",
]);
