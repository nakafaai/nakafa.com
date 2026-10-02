import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** Whose data a row or a model call belongs to: one account's own space. */
export const Space = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("personal"), userId: Id("users") }),
]);
export type Space = typeof Space.Type;
