import { defaultModel } from "@repo/ai/config/models";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import { mapDBPartToUIMessagePart } from "@repo/backend/confect/modules/chat/messageParts/dbToUi";

export type MessageWithPartsDoc = Doc<"messages"> & {
  readonly parts: readonly Doc<"parts">[];
};

/** Converts persisted chat messages into AI SDK UI messages. */
function mapDBMessagesToUIMessages(
  messages: readonly MessageWithPartsDoc[]
): MyUIMessage[] {
  return messages.map((message) => ({
    id: message.identifier,
    role: message.role,
    parts: message.parts.map((part) => mapDBPartToUIMessagePart({ part })),
    metadata: {
      model: message.modelId ?? defaultModel,
      credits: message.credits,
      tokens:
        message.inputTokens != null ||
        message.outputTokens != null ||
        message.totalTokens != null
          ? {
              input: message.inputTokens,
              output: message.outputTokens,
              total: message.totalTokens,
            }
          : undefined,
    },
  }));
}

export { mapDBMessagesToUIMessages };
