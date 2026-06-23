import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { compressMessages } from "@repo/ai/lib/message";
import {
  type NinaTurn,
  readNinaLearningPage,
} from "@repo/ai/nina/contract/turn";
import { readArtifactWritesForMessage } from "@repo/ai/nina/runtime/artifact";
import { formatNinaStreamError } from "@repo/ai/nina/runtime/error";
import { getNinaResponseFailure } from "@repo/ai/nina/runtime/finish";
import { createNinaLogContext } from "@repo/ai/nina/runtime/log";
import { determinePageFetchNeed } from "@repo/ai/nina/runtime/page";
import { NinaReporter } from "@repo/ai/nina/runtime/report";
import { NinaStore } from "@repo/ai/nina/runtime/store";
import { runNinaWriterTurn } from "@repo/ai/nina/runtime/writer";
import { createNinaWorkspaceRuntime } from "@repo/ai/nina/workspace/runtime";
import type { MyUIMessage } from "@repo/ai/types/message";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  pruneMessages,
} from "ai";
import { Effect, Schema } from "effect";

/** Raised when NinaHarness cannot prepare or stream one turn. */
export class NinaStreamError extends Schema.TaggedError<NinaStreamError>()(
  "NinaStreamError",
  {
    message: Schema.String,
    source: Schema.String,
  }
) {}

/**
 * Creates the framework-native AI SDK stream response for one Nina turn.
 */
export const createNinaStreamResponse = Effect.fn("nina.stream.response")(
  function* (turn: NinaTurn) {
    const store = yield* NinaStore;
    const reporter = yield* NinaReporter;
    const nakafa = yield* Nakafa;
    const search = yield* NakafaSearch;
    const messages = yield* store.loadMessages();
    const logContext = createNinaLogContext(turn);
    const originalMessageCount = messages.length;
    const { messages: compressedMessages, tokens } = compressMessages(messages);
    const learningPage = readNinaLearningPage(turn.page);
    const page = {
      ...turn.page,
      needsFetch: determinePageFetchNeed({
        messages: compressedMessages,
        url: learningPage.url,
        verified: learningPage.verified,
      }),
    };
    const isFirstMessage = messages.length === 1;
    const responseMessageId = generateId();
    const workspace = yield* createNinaWorkspaceRuntime({
      turnId: responseMessageId,
    });
    let failureScheduled = false;

    if (compressedMessages.length < originalMessageCount) {
      yield* Effect.logWarning(
        `Messages compressed from ${originalMessageCount} to ${compressedMessages.length} messages (${tokens} tokens) to stay within token limit`
      ).pipe(Effect.annotateLogs(logContext));
    } else {
      yield* Effect.logInfo(
        `All ${originalMessageCount} messages fit within token limit (${tokens} tokens)`
      ).pipe(Effect.annotateLogs(logContext));
    }

    const modelMessages = yield* Effect.tryPromise({
      try: () => convertToModelMessages(compressedMessages),
      catch: () =>
        new NinaStreamError({
          message: "Unable to convert UI messages for Nina model input.",
          source: "convertToModelMessages",
        }),
    });
    const finalMessages = pruneMessages({
      messages: modelMessages,
      reasoning: "all",
    });

    yield* Effect.logInfo("Nina chat session started").pipe(
      Effect.annotateLogs(logContext)
    );

    /**
     * Schedules durable failure handling once for a failed Nina stream.
     */
    function scheduleAssistantFailure(error: unknown, source: string) {
      if (failureScheduled) {
        return;
      }

      failureScheduled = true;
      Effect.runFork(
        Effect.all(
          [
            reporter.report({ error, source }),
            store.saveFailure({ responseMessageId }).pipe(
              Effect.catchAll((saveError) =>
                reporter.report({
                  error: saveError,
                  source: "saveAssistantFailure",
                })
              )
            ),
          ],
          { discard: true }
        )
      );
    }

    const stream = createUIMessageStream<MyUIMessage>({
      /** Runs Nina's Effect program at the AI SDK stream callback boundary. */
      execute: ({ writer }) =>
        Effect.runPromise(
          runNinaWriterTurn({
            finalMessages,
            logContext,
            onStreamError: scheduleAssistantFailure,
            page,
            responseMessageIdentifier: responseMessageId,
            runtime: turn.runtime,
            copy: turn.copy,
            user: turn.user,
            workspace,
            writer,
          }).pipe(
            Effect.provideService(NinaStore, store),
            Effect.provideService(NinaReporter, reporter),
            Effect.provideService(Nakafa, nakafa),
            Effect.provideService(NakafaSearch, search)
          )
        ),
      generateId: () => responseMessageId,
      onError: (error) => {
        scheduleAssistantFailure(error, "createUIMessageStream");
        return formatNinaStreamError({ error, logContext, turn });
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

        const responseFailure = getNinaResponseFailure({
          finishReason,
          isAborted,
          responseMessage,
        });

        if (responseFailure) {
          scheduleAssistantFailure(responseFailure, "ninaResponseFinalization");
          return;
        }

        if (isFirstMessage) {
          Effect.runFork(
            store
              .saveTitle({ messages: updatedMessages })
              .pipe(
                Effect.catchAll((error) =>
                  reporter.report({ error, source: "saveTitle" })
                )
              )
          );
        }

        Effect.runFork(
          Effect.gen(function* () {
            const artifacts = yield* workspace.readArtifacts();
            const artifactWrites = yield* readArtifactWritesForMessage({
              artifacts,
              message: responseMessage,
            });

            yield* store.saveAssistant({
              context: page.nina,
              responseMessage,
              artifacts: artifactWrites,
            });
          }).pipe(
            Effect.catchAll((error) =>
              reporter.report({ error, source: "saveAssistantResponse" })
            )
          )
        );
      },
      originalMessages: compressedMessages,
    });

    return createUIMessageStreamResponse({ stream });
  }
);
