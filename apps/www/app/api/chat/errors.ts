import { Schema } from "effect";
/** Convex mutation failure raised while preparing or persisting a chat. */
export class ChatMutationError extends Schema.TaggedError<ChatMutationError>()(
  "ChatMutationError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
    operation: Schema.Literals(["create-chat", "save-message", "sync-user"]),
  }
) {}
/** Convex query failure raised while loading authenticated chat context. */
export class ChatQueryError extends Schema.TaggedError<ChatQueryError>()(
  "ChatQueryError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
    operation: Schema.Literals([
      "load-context",
      "load-messages",
      "load-selection",
    ]),
  }
) {}
