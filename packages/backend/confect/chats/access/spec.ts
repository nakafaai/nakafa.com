import { failureWire } from "@repo/backend/confect/failure";
import { Schema } from "effect";

/** A chat mutation requires an existing chat owned by the current account. */
export class ChatAccessError extends Schema.TaggedError<ChatAccessError>()(
  "ChatAccessError",
  {
    code: Schema.Literals(["CHAT_NOT_FOUND", "FORBIDDEN"]),
    message: Schema.String,
  }
) {}
export const ChatAccessFailure = failureWire(ChatAccessError);
