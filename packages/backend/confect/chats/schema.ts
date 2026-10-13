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
  // Sealed for the learner who owns the chat (`chats/title`).
  title: Schema.optionalKey(Sealed),
  userId: Id("users"),
  // A public chat is shared by link: it has a `chatShares` row, and only a
  // reader who presents that row's token can open it besides its owner.
  visibility: chatVisibilityValidator,
  type: chatTypeValidator,
});

/**
 * A share token as a link carries it: 32 random bytes in URL-safe Base64, 43
 * characters. Readers send it as an argument, so the pattern bounds the work
 * of hashing it.
 */
export const shareTokenValidator = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9_-]{43}$/u)
);

/**
 * The share of one chat while it is shared. `hash` is the SHA-256 of the token
 * in lower-case hex, which a reader checks without any key. `token` is the
 * token sealed for the chat owner, so the owner can copy the link again. A
 * table export holds neither the token nor a key that opens it. `userId` is
 * the chat owner, who never changes, so the owner reads the token without
 * reading the chat.
 */
export const chatShareValidator = Schema.Struct({
  chatId: Id("chats"),
  hash: Schema.String,
  token: Sealed,
  userId: Id("users"),
});
