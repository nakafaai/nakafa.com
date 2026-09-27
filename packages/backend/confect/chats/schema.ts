import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

export const chatVisibilityValidator = Schema.Literals(["private", "public"]);
export type ChatVisibility = typeof chatVisibilityValidator.Type;
export const chatTypeValidator = Schema.Literal("study");

export const chatValidator = Schema.Struct({
  threadId: Schema.String,
  activeTurnId: Schema.optionalKey(Id("ninaTurns")),
  updatedAt: Schema.Finite,
  title: Schema.optionalKey(Schema.String),
  userId: Id("users"),
  visibility: chatVisibilityValidator,
  type: chatTypeValidator,
});
