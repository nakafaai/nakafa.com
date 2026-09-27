import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { MyUIMessage } from "@repo/backend/confect/chats/message";
import { mapDBPartToUIMessagePart } from "@repo/backend/confect/chats/messageParts/dbToUi";
import {
  defaultModel,
  ModelIdSchema,
} from "@repo/backend/confect/nina/config/model";
import {
  NinaContextSnapshotSchema,
  NinaContextTransitionSchema,
} from "@repo/backend/confect/nina/memory/pack";
import { Option, Predicate, Schema } from "effect";

/** Decodes stored Nina snapshots from Convex JSON into branded AI metadata. */
function readStoredNinaSnapshot(
  snapshot: Docs["messages"]["ninaContextSnapshot"]
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
  transition: Docs["messages"]["ninaContextTransition"]
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
  messages: ReadonlyArray<
    Docs["messages"] & {
      parts: readonly Docs["messageParts"][];
    }
  >
): MyUIMessage[] {
  return messages.map((message) => ({
    id: message.identifier,
    role: message.role,
    parts: message.parts.map((part) =>
      mapDBPartToUIMessagePart({
        part,
      })
    ),
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
        Predicate.isNotNullish(message.inputTokens) ||
        Predicate.isNotNullish(message.outputTokens) ||
        Predicate.isNotNullish(message.totalTokens)
          ? {
              input: message.inputTokens,
              output: message.outputTokens,
              total: message.totalTokens,
            }
          : undefined,
    },
  }));
}
