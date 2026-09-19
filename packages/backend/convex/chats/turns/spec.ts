import { modelIdValueValidator } from "@repo/backend/convex/chats/schema";
import { v } from "convex/values";
import { Schema } from "effect";

/** In-flight credit holds are owned by one authenticated user and model. */
export const chatTurnValidator = v.object({
  userId: v.id("users"),
  modelId: modelIdValueValidator,
  credits: v.number(),
  creditsResetAt: v.number(),
  planCreditGrantId: v.optional(v.id("creditTransactions")),
  transactionId: v.id("creditTransactions"),
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
