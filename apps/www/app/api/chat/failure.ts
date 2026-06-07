import { chatResponseFailureCode } from "@repo/ai/config/generation";
import type { ModelId } from "@repo/ai/config/model";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { fetchAction } from "convex/nextjs";
import { Effect } from "effect";

interface PersistAssistantFailure {
  chatId: Id<"chats">;
  modelId: ModelId;
  responseMessageId: string;
  token: string;
}

/**
 * Schedules a durable failed assistant marker through Convex.
 *
 * @see https://docs.convex.dev/scheduling/scheduled-functions
 */
export const persistAssistantFailure = Effect.fn(
  "chat.persistAssistantFailure"
)(function* ({
  chatId,
  modelId,
  responseMessageId,
  token,
}: PersistAssistantFailure) {
  yield* Effect.tryPromise({
    try: () =>
      fetchAction(
        convexApi.chats.actions.scheduleSaveAssistantFailure,
        {
          message: {
            chatId,
            identifier: responseMessageId,
            modelId,
            generationErrorCode: chatResponseFailureCode,
          },
        },
        { token }
      ),
    catch: (error) =>
      error instanceof Error ? error : new Error(String(error)),
  });
});
