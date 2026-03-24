import type { MyUIMessage } from "@repo/ai/types/message";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { mapDBPartToUIMessagePart } from "@repo/backend/convex/chats/messageParts/dbToUi";

/**
 * Maps raw DB messages (with parts) to UI messages.
 * Use this after receiving one or more pages from `loadMessagesPage`.
 */
export function mapDBMessagesToUIMessages(
  messages: Array<Doc<"messages"> & { parts: Doc<"parts">[] }>
): MyUIMessage[] {
  return messages.map((message) => ({
    id: message.identifier,
    role: message.role,
    parts: message.parts.map((part) => mapDBPartToUIMessagePart({ part })),
    metadata: {
      model: message.modelId ?? "unknown",
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
