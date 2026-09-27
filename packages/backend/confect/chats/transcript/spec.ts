import { failureWire } from "@repo/backend/confect/failure";
import { Schema } from "effect";

/** A bounded transcript operation cannot be completed in one transaction. */
export class TranscriptLimitExceeded extends Schema.TaggedError<TranscriptLimitExceeded>()(
  "TranscriptLimitExceeded",
  {
    code: Schema.Literals([
      "CHAT_PART_LIMIT_EXCEEDED",
      "CHAT_MESSAGE_PART_LIMIT_EXCEEDED",
      "CHAT_USER_MESSAGE_REWRITE_EXCEEDED",
      "CHAT_ASSISTANT_RESPONSE_REWRITE_EXCEEDED",
    ]),
    message: Schema.String,
  }
) {}
export const TranscriptFailure = failureWire(TranscriptLimitExceeded);
