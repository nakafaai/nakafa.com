import { Schema } from "effect";
/** Current content families accepted by durable engagement history. */
export const contentViewSectionValidator = Schema.Union([
  Schema.Literal("articles"),
  Schema.Literal("material"),
]);
