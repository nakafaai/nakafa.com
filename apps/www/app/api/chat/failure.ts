import { chatResponseFailureCode } from "@repo/ai/config/generation";
import type { ModelId } from "@repo/ai/config/model";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { fetchAction } from "convex/nextjs";
import { Effect, Schema } from "effect";

/** Expected Convex boundary failure while persisting an assistant marker. */
export class PersistAssistantFailureError extends Schema.TaggedError<PersistAssistantFailureError>()(
  "PersistAssistantFailureError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

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
}: {
  readonly chatId: Id<"chats">;
  readonly modelId: ModelId;
  readonly responseMessageId: string;
  readonly token: string;
}) {
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
      new PersistAssistantFailureError({
        cause: error,
        message: "Unable to persist the failed assistant marker.",
      }),
  });
});
