import { generateTitle } from "@repo/ai/features/title";
import type { NinaAgentPage } from "@repo/ai/nina/agent";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { mapUIMessagePartsToDBParts } from "@repo/backend/convex/chats/messageParts/uiToDb";
import { waitUntil } from "@vercel/functions";
import { createUIMessageStream } from "ai";
import { fetchAction, fetchMutation } from "convex/nextjs";
import { Effect } from "effect";
import {
  type NinaAgentChat,
  type NinaAgentRuntime,
  type NinaAgentUser,
  streamNinaAgent,
} from "@/app/api/chat/agent";
import { persistAssistantFailure } from "@/app/api/chat/failure";
import { getAssistantResponseFailure } from "@/app/api/chat/response";

/** Fully prepared inputs needed to stream and persist one chat response. */
interface Params {
  chat: NinaAgentChat & {
    readonly isFirstMessage: boolean;
    readonly messages: MyUIMessage[];
    readonly responseMessageId: string;
    readonly token: string;
  };
  page: NinaAgentPage;
  runtime: NinaAgentRuntime;
  user: NinaAgentUser;
}

/** Formats stream errors without leaking unknown values to the browser. */
function getStreamErrorMessage({
  error,
  runtime,
}: {
  readonly error: unknown;
  readonly runtime: NinaAgentRuntime;
}) {
  if (error instanceof Error) {
    if (error.message.includes("Rate limit")) {
      Effect.runFork(
        Effect.logWarning("Rate limit exceeded in chat stream").pipe(
          Effect.annotateLogs(runtime.logContext)
        )
      );
      return runtime.translate("rate-limit-message");
    }

    return error.message;
  }

  Effect.runFork(
    Effect.logError("Unknown error in chat stream").pipe(
      Effect.annotateLogs(runtime.logContext)
    )
  );
  return runtime.translate("error-message");
}

/** Schedules first-message title generation after the UI stream completes. */
function scheduleTitleUpdate({
  chatId,
  messages,
  runtime,
  token,
}: {
  readonly chatId: Id<"chats">;
  readonly messages: MyUIMessage[];
  readonly runtime: NinaAgentRuntime;
  readonly token: string;
}) {
  waitUntil(
    Effect.runPromise(
      Effect.gen(function* () {
        const title = yield* generateTitle({ messages });

        yield* Effect.tryPromise(() =>
          fetchMutation(
            convexApi.chats.mutations.updateChatTitle,
            { chatId, title },
            { token }
          )
        );
      }).pipe(
        Effect.catchAll((error) =>
          Effect.sync(() =>
            runtime.reportError(error, "generateTitle/updateChatTitle")
          )
        )
      )
    )
  );
}

/** Schedules assistant response persistence with Nina context metadata. */
function scheduleAssistantResponseSave({
  chat,
  page,
  responseMessage,
  runtime,
}: {
  readonly chat: Params["chat"];
  readonly page: NinaAgentPage;
  readonly responseMessage: MyUIMessage;
  readonly runtime: NinaAgentRuntime;
}) {
  const tokenData = responseMessage.metadata?.tokens;

  waitUntil(
    Effect.runPromise(
      Effect.tryPromise(() =>
        fetchAction(
          convexApi.chats.actions.scheduleSaveAssistantResponse,
          {
            message: {
              chatId: chat.id,
              identifier: responseMessage.id,
              inputTokens: tokenData?.input ?? 0,
              modelId: runtime.modelId,
              ninaContextSnapshot: page.nina.snapshot,
              ninaContextTransition: page.nina.transition,
              outputTokens: tokenData?.output ?? 0,
              role: responseMessage.role,
              totalTokens: tokenData?.total ?? 0,
            },
            parts: mapUIMessagePartsToDBParts({
              messageParts: responseMessage.parts,
            }),
          },
          { token: chat.token }
        )
      ).pipe(
        Effect.catchAll((error) =>
          Effect.sync(() => runtime.reportError(error, "saveAssistantResponse"))
        )
      )
    )
  );
}

/**
 * Streams one chat turn through the AI SDK UI message stream.
 *
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream
 * @see https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
 */
export function streamChat({ chat, page, runtime, user }: Params) {
  let failureScheduled = false;

  /** Records a durable failed assistant turn when streamed generation fails. */
  const scheduleAssistantFailure = (error: unknown, errorLocation: string) => {
    if (failureScheduled) {
      return;
    }

    failureScheduled = true;
    runtime.reportError(error, errorLocation);

    waitUntil(
      Effect.runPromise(
        persistAssistantFailure({
          chatId: chat.id,
          modelId: runtime.modelId,
          responseMessageId: chat.responseMessageId,
          token: chat.token,
        }).pipe(
          Effect.catchAll((saveError) =>
            Effect.sync(() =>
              runtime.reportError(saveError, "saveAssistantFailure")
            )
          )
        )
      )
    );
  };

  return createUIMessageStream<MyUIMessage>({
    /** Runs Nina's Effect program at the AI SDK stream callback boundary. */
    execute: ({ writer }) =>
      Effect.runPromise(
        streamNinaAgent({
          chat,
          onStreamError: scheduleAssistantFailure,
          page,
          runtime,
          user,
          writer,
        })
      ),
    generateId: () => chat.responseMessageId,
    onError: (error) => {
      scheduleAssistantFailure(error, "createUIMessageStream");
      return getStreamErrorMessage({ error, runtime });
    },
    onFinish: ({
      finishReason,
      isAborted,
      messages: updatedMessages,
      responseMessage,
    }) => {
      if (failureScheduled) {
        return;
      }

      const responseFailure = getAssistantResponseFailure({
        finishReason,
        isAborted,
        responseMessage,
      });

      if (responseFailure) {
        scheduleAssistantFailure(responseFailure, "chatResponseFinalization");
        return;
      }

      if (chat.isFirstMessage) {
        scheduleTitleUpdate({
          chatId: chat.id,
          messages: updatedMessages,
          runtime,
          token: chat.token,
        });
      }

      scheduleAssistantResponseSave({
        chat,
        page,
        responseMessage,
        runtime,
      });
    },
    originalMessages: chat.messages,
  });
}
