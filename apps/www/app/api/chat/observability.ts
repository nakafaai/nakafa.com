import { getGatewayErrorContext } from "@repo/ai/config/gateway-error";
import { getModelGatewayId, type ModelId } from "@repo/ai/config/model";
import { captureServerException } from "@repo/analytics/posthog/server";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { logError } from "@repo/utilities/logging/effect";
import type { LogContext } from "@repo/utilities/logging/types";
import { waitUntil } from "@vercel/functions";
import { Effect } from "effect";

const source = "chat-api";

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
}: {
  readonly chatId: Id<"chats">;
  readonly logContext: LogContext;
  readonly modelId: ModelId;
  readonly userId: string;
}) {
  const gatewayModelId = getModelGatewayId(modelId);

  return (error: unknown, errorLocation: string) => {
    const normalizedError = toError(error);
    const gatewayErrorContext = getGatewayErrorContext(normalizedError);
    const errorContext = {
      ...logContext,
      chatId,
      errorLocation,
      ...gatewayErrorContext,
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
