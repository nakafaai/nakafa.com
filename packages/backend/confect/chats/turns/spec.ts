import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { modelIdValueValidator } from "@repo/backend/confect/chats/schema";
import { Schema } from "effect";

/** In-flight credit holds are owned by one authenticated user and model. */
export const chatTurnValidator = Schema.Struct({
  userId: IdSchema("users"),
  modelId: modelIdValueValidator,
  credits: Schema.Finite,
  creditsResetAt: Schema.Finite,
  planCreditGrantId: Schema.optionalKey(IdSchema("creditTransactions")),
  transactionId: IdSchema("creditTransactions"),
});

/** Twice the HTTP execution limit allows final persistence before recovery. */
export const CHAT_TURN_EXPIRY_MS = 600_000;
export class ChatTurnError extends Schema.TaggedError<ChatTurnError>()(
  "ChatTurnError",
  {
    code: Schema.Literals([
      "INSUFFICIENT_CREDITS",
      "RATE_LIMITED",
      "CHAT_TURN_FORBIDDEN",
      "CHAT_TURN_IO_FAILED",
    ]),
    message: Schema.String,
  }
) {}
