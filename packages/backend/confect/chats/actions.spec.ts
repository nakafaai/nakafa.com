import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import messageParts from "@repo/backend/confect/_generated/tables/messageParts";
import messages from "@repo/backend/confect/_generated/tables/messages";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import {
  messageGenerationErrorCodeValidator,
  modelIdValueValidator,
} from "@repo/backend/confect/chats/schema";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicAction({
      name: "scheduleSaveAssistantResponse",
      args: () => ({
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
      returns: () => Schema.Null,
      error: () => AuthFailure,
    })
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "scheduleSaveAssistantFailure",
      args: () => ({
        turnId: IdSchema("chatTurns"),
        message: Schema.Struct({
          chatId: IdSchema("chats"),
          identifier: Schema.String,
          modelId: modelIdValueValidator,
          generationErrorCode: messageGenerationErrorCodeValidator,
        }),
      }),
      returns: () => Schema.Null,
      error: () => AuthFailure,
    })
  );
