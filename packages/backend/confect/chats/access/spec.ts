import { Schema } from "effect";

/** A chat mutation requires an existing chat owned by the current account. */
export class ChatAccessError extends Schema.TaggedError<ChatAccessError>()(
  "ChatAccessError",
  {
    code: Schema.Literals(["CHAT_NOT_FOUND", "FORBIDDEN"]),
    message: Schema.String,
  }
) {}

/** The share of a chat could not be read or opened, so its link cannot be shown. */
export class ChatShareReadError extends Schema.TaggedError<ChatShareReadError>()(
  "ChatShareReadError",
  {}
) {}
