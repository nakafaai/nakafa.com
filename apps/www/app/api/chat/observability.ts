import { getModelGatewayId, type ModelId } from "@repo/ai/config/model";
import { captureServerException } from "@repo/analytics/posthog/server";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { logError } from "@repo/utilities/logging/effect";
import type { LogContext } from "@repo/utilities/logging/types";
import { waitUntil } from "@vercel/functions";
import { Effect } from "effect";

const source = "chat-api";

interface ChatErrorReporterParams {
  chatId: Id<"chats">;
  logContext: LogContext;
  modelId: ModelId;
  userId: string;
}

/** Preserves real Error details while giving non-Error failures a stable shape. */
function toError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

/**
 * Creates one chat error reporter for AI SDK stream boundaries.
 *
 * AI SDK streams surface generation failures through stream `onError`
 * callbacks instead of throwing synchronously. The reporter keeps route code
 * thin while sending the same original error and stable chat context to Effect
 * logs and PostHog.
 *
 * Docs:
 * https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
 * https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream
 * https://effect.website/docs/observability/logging/
 * https://posthog.com/docs/error-tracking/capture
 */
export function createChatErrorReporter({
  chatId,
  logContext,
  modelId,
  userId,
}: ChatErrorReporterParams) {
  const gatewayModelId = getModelGatewayId(modelId);

  return (error: unknown, errorLocation: string) => {
    const normalizedError = toError(error);
    const errorContext = {
      ...logContext,
      chatId,
      errorLocation,
      gatewayModelId,
      modelId,
      source,
    };

    waitUntil(
      Effect.runPromise(
        Effect.all(
          [
            logError(normalizedError, errorContext),
            Effect.tryPromise({
              try: () =>
                captureServerException(normalizedError, userId, errorContext),
              catch: toError,
            }).pipe(
              Effect.catchAll((captureError) =>
                logError(captureError, {
                  ...errorContext,
                  errorLocation: "posthog-capture",
                })
              )
            ),
          ],
          { discard: true }
        )
      )
    );
  };
}
