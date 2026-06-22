import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { compressMessages } from "@repo/ai/lib/message";
import { createNinaCapabilityCatalog } from "@repo/ai/nina/capability/catalog";
import {
  createNinaAgentContext,
  type NinaTurn,
} from "@repo/ai/nina/contract/turn";
import {
  type NinaAgentMessages,
  runNinaAgentTurn,
} from "@repo/ai/nina/runtime/agent";
import { formatNinaStreamError } from "@repo/ai/nina/runtime/error";
import { getNinaResponseFailure } from "@repo/ai/nina/runtime/finish";
import { createNinaLogContext } from "@repo/ai/nina/runtime/log";
import {
  createPageFetchState,
  determinePageFetchNeed,
} from "@repo/ai/nina/runtime/page";
import { repairNinaToolCall } from "@repo/ai/nina/runtime/repair";
import { NinaReporter } from "@repo/ai/nina/runtime/report";
import { NinaStore } from "@repo/ai/nina/runtime/store";
import { writeNinaSuggestions } from "@repo/ai/nina/runtime/suggest";
import { trackUsage } from "@repo/ai/nina/runtime/usage";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { LogContext } from "@repo/utilities/logging/types";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  pruneMessages,
  type UIMessageStreamWriter,
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

/** Creates the framework-native AI SDK stream response for one Nina turn. */
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
    const page = {
      ...turn.page,
      needsFetch: determinePageFetchNeed({
        messages: compressedMessages,
        url: turn.page.url,
        verified: turn.page.verified,
      }),
    };
    const isFirstMessage = messages.length === 1;
    const responseMessageId = generateId();
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

    /** Schedules durable failure handling once for a failed Nina stream. */
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
            runtime: turn.runtime,
            copy: turn.copy,
            user: turn.user,
            writer,
          }).pipe(
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
          store
            .saveAssistant({
              context: page.nina,
              responseMessage,
            })
            .pipe(
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

/** Streams one Nina ToolLoopAgent turn into the AI SDK UI writer. */
const runNinaWriterTurn = Effect.fn("nina.stream.writer")(function* ({
  finalMessages,
  logContext,
  onStreamError,
  copy,
  page,
  runtime,
  user,
  writer,
}: {
  readonly copy: NinaTurn["copy"];
  readonly finalMessages: NinaAgentMessages;
  readonly logContext: LogContext;
  readonly onStreamError: (error: unknown, source: string) => void;
  readonly page: NinaTurn["page"];
  readonly runtime: NinaTurn["runtime"];
  readonly user: NinaTurn["user"];
  readonly writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  const usage = yield* trackUsage();
  const context = createNinaAgentContext({ page, runtime, user });
  const pageFetch = createPageFetchState(context.needsPageFetch);
  const reporter = yield* NinaReporter;
  const tools = yield* createNinaCapabilityCatalog({
    context,
    locale: page.locale,
    logContext,
    modelId: runtime.modelId,
    consumePageFetch: pageFetch.consumeForTool,
    usage,
    writer,
  });

  const responseMessages = yield* runNinaAgentTurn({
    messages: finalMessages,
    page,
    runtime,
    settings: {
      experimental_repairToolCall: (options) =>
        Effect.runPromise(
          repairNinaToolCall({
            ...options,
            reporter,
            reservePageFetch: pageFetch.reserveForRepair,
            sessionLogger: logContext,
            url: page.url,
          })
        ),
      tools,
    },
    stream: {
      formatError: (error) =>
        formatNinaStreamError({
          error,
          logContext,
          turn: { page, runtime, user, copy },
        }),
      onError: onStreamError,
      readFinishMetadata: (mainUsage) =>
        Effect.runSync(
          usage.metadata({
            mainUsage,
            modelId: runtime.modelId,
          })
        ),
      writer,
    },
    user,
  });

  yield* writeNinaSuggestions({
    locale: page.locale,
    messages: [...finalMessages, ...responseMessages],
    writer,
  }).pipe(
    Effect.catchAll((error) =>
      reporter.report({ error, source: "writeNinaSuggestions" })
    )
  );
});
