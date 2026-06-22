import { defaultModel, ModelIdSchema } from "@repo/ai/config/model";
import {
  NinaContextSnapshotSchema,
  NinaContextTransitionSchema,
} from "@repo/ai/nina/memory/pack";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { mapDBPartToUIMessagePart } from "@repo/backend/convex/chats/messageParts/dbToUi";
import { Option, Schema } from "effect";

/** Decodes stored Nina snapshots from Convex JSON into branded AI metadata. */
function readStoredNinaSnapshot(
  snapshot: Doc<"messages">["ninaContextSnapshot"]
) {
  const decoded = Schema.decodeUnknownOption(NinaContextSnapshotSchema)(
    snapshot
  );

  if (Option.isNone(decoded)) {
    return;
  }

  return decoded.value;
}

/** Decodes stored Nina transition markers into schema-owned AI metadata. */
function readStoredNinaTransition(
  transition: Doc<"messages">["ninaContextTransition"]
) {
  const decoded = Schema.decodeUnknownOption(NinaContextTransitionSchema)(
    transition
  );

  if (Option.isNone(decoded)) {
    return;
  }

  return decoded.value;
}

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
      model: message.modelId
        ? ModelIdSchema.make(message.modelId)
        : defaultModel,
      credits: message.credits,
      generationErrorCode: message.generationErrorCode,
      generationStatus: message.generationStatus,
      ninaContextSnapshot: readStoredNinaSnapshot(message.ninaContextSnapshot),
      ninaContextTransition: readStoredNinaTransition(
        message.ninaContextTransition
      ),
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
