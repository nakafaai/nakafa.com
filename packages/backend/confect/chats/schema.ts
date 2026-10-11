import { Id } from "@repo/backend/confect/_generated/id";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { Schema } from "effect";

export const chatVisibilityValidator = Schema.Literals(["private", "public"]);
export type ChatVisibility = typeof chatVisibilityValidator.Type;
export const chatTypeValidator = Schema.Literal("study");

export const chatValidator = Schema.Struct({
  threadId: Schema.String,
  activeTurnId: Schema.optionalKey(Id("ninaTurns")),
  updatedAt: Schema.Finite,
  // A new title is stored sealed. The string form is what rows written before
  // October 2026 hold, and it leaves with the contract change that follows the
  // sealing migration.
  title: Schema.optionalKey(Schema.Union([Schema.String, Sealed])),
  userId: Id("users"),
  visibility: chatVisibilityValidator,
  type: chatTypeValidator,
});
