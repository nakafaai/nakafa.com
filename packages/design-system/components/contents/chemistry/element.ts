import { Schema } from "effect";

/** The elements that the matter and multiple proportions lessons draw as particles. */
export const ElementNameSchema = Schema.Literals([
  "carbon",
  "hydrogen",
  "nitrogen",
  "oxygen",
]);
export type ElementName = typeof ElementNameSchema.Type;
