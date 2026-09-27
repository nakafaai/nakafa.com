import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import messageParts from "@repo/backend/confect/_generated/tables/messageParts";
import messages from "@repo/backend/confect/_generated/tables/messages";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import {
  messageGenerationErrorCodeValidator,
  modelIdValueValidator,
} from "@repo/backend/confect/chats/schema";
import { TranscriptLimitExceeded } from "@repo/backend/confect/chats/transcript/spec";
import { ChatTurnError } from "@repo/backend/confect/chats/turns/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/**
 * Persists an assistant message and settles its credits atomically.
 *
 * A held turn completes its existing debit exactly once. Closed turns and
 * account deletion make delayed retries a no-op.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "saveAssistantResponse",
      args: () => ({
        userId: IdSchema("users"),
        turnId: IdSchema("chatTurns"),
        message: messages.Fields,
        parts: Schema.mutable(
          Schema.Array(
            Schema.Struct({
              ...messageParts.Fields.fields,
              messageId: Schema.optionalKey(IdSchema("messages")),
            })
          )
        ),
      }),
      returns: () =>
        Schema.Union([
          Schema.Null,
          Schema.Struct({
            messageId: IdSchema("messages"),
            partIds: Schema.mutable(Schema.Array(IdSchema("messageParts"))),
            credits: Schema.Finite,
            newBalance: Schema.Finite,
          }),
        ]),
      error: () =>
        Schema.Union([ChatAccessError, TranscriptLimitExceeded, ChatTurnError]),
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "saveAssistantFailure",
      args: () => ({
        userId: IdSchema("users"),
        turnId: IdSchema("chatTurns"),
        message: Schema.Struct({
          chatId: IdSchema("chats"),
          identifier: Schema.String,
          modelId: modelIdValueValidator,
          generationErrorCode: messageGenerationErrorCodeValidator,
        }),
      }),
      returns: () =>
        Schema.Union([
          Schema.Null,
          Schema.Struct({
            messageId: IdSchema("messages"),
          }),
        ]),
      error: () =>
        Schema.Union([ChatAccessError, TranscriptLimitExceeded, ChatTurnError]),
    }).middleware(Atomic)
  );
