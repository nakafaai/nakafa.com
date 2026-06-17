import { runMathAgent } from "@repo/ai/agents/math/agent";
import { runNakafaAgent } from "@repo/ai/agents/nakafa/agent";
import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { read as readNakafa } from "@repo/ai/agents/nakafa/tools/read";
import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import { nakafaPrompt } from "@repo/ai/agents/orchestrator/prompt";
import { runResearchAgent } from "@repo/ai/agents/research/agent";
import { provider } from "@repo/ai/config/app";
import { getModelProviderOptions, type ModelId } from "@repo/ai/config/model";
import { gatewayProviderOptions } from "@repo/ai/config/routing";
import { chatStreamTimeout } from "@repo/ai/config/timeouts";
import { generateTitle } from "@repo/ai/features/title";
import { getSourceReferencesFromMessages } from "@repo/ai/lib/source";
import {
  formatSpecialistToolTask,
  mathToolInputSchema,
  nakafaToolInputSchema,
  researchToolInputSchema,
} from "@repo/ai/schema/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { mapUIMessagePartsToDBParts } from "@repo/backend/convex/chats/messageParts/uiToDb";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import { cleanSlug } from "@repo/utilities/helper";
import type { LogContext } from "@repo/utilities/logging/types";
import { waitUntil } from "@vercel/functions";
import {
  createUIMessageStream,
  type ModelMessage,
  smoothStream,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { fetchAction, fetchMutation } from "convex/nextjs";
import { Effect } from "effect";
import type { getTranslations } from "next-intl/server";
import { getCanonicalNakafaContentUrl } from "@/app/api/chat/content";
import { persistAssistantFailure } from "@/app/api/chat/failure";
import { search as nakafaSearch } from "@/app/api/chat/nakafa";
import { nakafaContent } from "@/app/api/chat/nakafa-content";
import { recoverChatToolCall } from "@/app/api/chat/recovery";
import { getAssistantResponseFailure } from "@/app/api/chat/response";
import {
  recordSpecialistUsage,
  recoverSpecialistFailure,
  specialistSuccess,
} from "@/app/api/chat/specialist";
import { prepareChatStep } from "@/app/api/chat/step";
import { writeSuggestions } from "@/app/api/chat/suggestions";
import { trackUsage } from "@/app/api/chat/usage";
import type { getLearningProfile, getUserInfo } from "@/app/api/chat/utils";

const MAX_ORCHESTRATOR_STEPS = 20;

type Location = Parameters<typeof nakafaPrompt>[0]["userLocation"];
type Translator = Awaited<ReturnType<typeof getTranslations>>;
type LearningProfile = Effect.Effect.Success<
  ReturnType<typeof getLearningProfile>
>;
type UserInfo = Effect.Effect.Success<ReturnType<typeof getUserInfo>>;

/** Fully prepared inputs needed to stream and persist one chat response. */
interface Params {
  chat: {
    finalMessages: ModelMessage[];
    id: Id<"chats">;
    isFirstMessage: boolean;
    messages: MyUIMessage[];
    responseMessageId: string;
    token: string;
  };
  page: {
    locale: Locale;
    needsFetch: boolean;
    slug: string;
    url: string;
    verified: boolean;
  };
  runtime: {
    currentDate: string;
    logContext: LogContext;
    modelId: ModelId;
    reportError: (error: unknown, source: string) => void;
    translate: Translator;
  };
  user: {
    info: UserInfo;
    learningProfile: LearningProfile;
    location: Location;
  };
}

/**
 * Streams one chat turn through the AI SDK UI message stream.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#streaming-tool-calls
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text#to-ui-message-stream
 * @see https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
 */
export function streamChat({ chat, page, runtime, user }: Params) {
  let failureScheduled = false;

  /** Records a durable failed assistant turn when the streamed generation fails. */
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
    generateId: () => chat.responseMessageId,
    onError: (error) => {
      scheduleAssistantFailure(error, "createUIMessageStream");

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
    },
    originalMessages: chat.messages,
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
        waitUntil(
          Effect.runPromise(
            Effect.gen(function* () {
              const title = yield* generateTitle({ messages: updatedMessages });

              yield* Effect.tryPromise(() =>
                fetchMutation(
                  convexApi.chats.mutations.updateChatTitle,
                  { chatId: chat.id, title },
                  { token: chat.token }
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

      const tokenData = responseMessage.metadata?.tokens;

      waitUntil(
        Effect.runPromise(
          Effect.tryPromise(() =>
            fetchAction(
              convexApi.chats.actions.scheduleSaveAssistantResponse,
              {
                message: {
                  chatId: chat.id,
                  role: responseMessage.role,
                  identifier: responseMessage.id,
                  modelId: runtime.modelId,
                  inputTokens: tokenData?.input ?? 0,
                  outputTokens: tokenData?.output ?? 0,
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
              Effect.sync(() =>
                runtime.reportError(error, "saveAssistantResponse")
              )
            )
          )
        )
      );
    },
    /** Runs the main AI stream and merges UI message chunks into the writer. */
    execute: ({ writer }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const usage = yield* trackUsage();
          const context = {
            currentDate: runtime.currentDate,
            learningProfile: user.learningProfile ?? undefined,
            url: page.url,
            slug: cleanSlug(page.slug),
            verified: page.verified,
            needsPageFetch: page.needsFetch,
            userRole: user.info.role ?? undefined,
          };
          let fetchedPage = false;

          const system = nakafaPrompt({
            url: page.url,
            currentPage: {
              locale: page.locale,
              slug: page.slug,
              verified: page.verified,
            },
            currentDate: runtime.currentDate,
            learningProfile: user.learningProfile ?? undefined,
            userLocation: user.location,
            userRole: user.info.role ?? undefined,
          });

          const streamTextResult = streamText({
            model: provider.languageModel(runtime.modelId),
            system,
            messages: chat.finalMessages,
            stopWhen: stepCountIs(MAX_ORCHESTRATOR_STEPS),
            tools: {
              [TOOL_NAMES.nakafa]: tool({
                description:
                  "Retrieve Nakafa educational evidence for lessons, study topics, current pages, articles, Quran references, examples, warmups, review tasks, tryout preparation, and structured exercises. Use this before math when content must be selected. Preserve requested deliverables in the structured input.",
                inputSchema: nakafaToolInputSchema,
                /** Runs the Nakafa specialist with one-time current-page fetch support. */
                execute: (input, { toolCallId }) => {
                  const needsPageFetch = context.needsPageFetch && !fetchedPage;

                  if (needsPageFetch) {
                    fetchedPage = true;
                  }

                  return Effect.runPromise(
                    Effect.gen(function* () {
                      if (needsPageFetch) {
                        const contentRef = getCanonicalNakafaContentUrl(
                          context.url
                        );

                        return yield* readNakafa({
                          input: {
                            content_ref:
                              NakafaAgentContentRefInputSchema.make(contentRef),
                          },
                          toolCallId,
                          writer,
                        }).pipe(Effect.provideService(Nakafa, nakafaContent));
                      }

                      const result = yield* runNakafaAgent({
                        context: { ...context, needsPageFetch },
                        locale: page.locale,
                        modelId: runtime.modelId,
                        nakafa: nakafaContent,
                        task: formatSpecialistToolTask(input),
                        writer,
                      }).pipe(
                        Effect.provideService(NakafaSearch, nakafaSearch),
                        Effect.map(specialistSuccess),
                        Effect.catchAll((error) =>
                          recoverSpecialistFailure({
                            component: TOOL_NAMES.nakafa,
                            error,
                            errorLocation: "runNakafaAgent",
                            reportError: runtime.reportError,
                          })
                        )
                      );

                      yield* recordSpecialistUsage({
                        addUsage: usage.addUsage,
                        component: TOOL_NAMES.nakafa,
                        logContext: runtime.logContext,
                        result,
                      });

                      return result.text;
                    })
                  );
                },
              }),
              [TOOL_NAMES.deepResearch]: tool({
                description:
                  "Research external, official, current, latest, cited, or source-backed information with web search and source analysis.",
                inputSchema: researchToolInputSchema,
                /** Runs the external research specialist and records its token usage. */
                execute: (input, { messages, toolCallId }) =>
                  Effect.runPromise(
                    Effect.gen(function* () {
                      const result = yield* runResearchAgent({
                        context,
                        locale: page.locale,
                        modelId: runtime.modelId,
                        task: formatSpecialistToolTask(input),
                        sourceReferences:
                          getSourceReferencesFromMessages(messages),
                        toolCallId,
                        writer,
                      }).pipe(
                        Effect.map(specialistSuccess),
                        Effect.catchAll((error) =>
                          recoverSpecialistFailure({
                            component: TOOL_NAMES.deepResearch,
                            error,
                            errorLocation: "runResearchAgent",
                            reportError: runtime.reportError,
                          })
                        )
                      );

                      yield* recordSpecialistUsage({
                        addUsage: usage.addUsage,
                        component: TOOL_NAMES.deepResearch,
                        logContext: runtime.logContext,
                        result,
                      });

                      return result.text;
                    })
                  ),
              }),
              [TOOL_NAMES.math]: tool({
                description:
                  "Verify user-provided or retrieved math with deterministic evidence for arithmetic, algebra, equations, calculus, series, matrices, statistics, probability, geometry, and discrete math. Do not use this as the first or only source for educational practice content; use Nakafa first, then math verifies the selected content.",
                inputSchema: mathToolInputSchema,
                /** Runs the deterministic math specialist and records its token usage. */
                execute: (input) =>
                  Effect.runPromise(
                    Effect.gen(function* () {
                      const result = yield* runMathAgent({
                        context,
                        locale: page.locale,
                        modelId: runtime.modelId,
                        task: formatSpecialistToolTask(input),
                        writer,
                      }).pipe(
                        Effect.map(specialistSuccess),
                        Effect.catchAll((error) =>
                          recoverSpecialistFailure({
                            component: TOOL_NAMES.math,
                            error,
                            errorLocation: "runMathAgent",
                            reportError: runtime.reportError,
                          })
                        )
                      );

                      yield* recordSpecialistUsage({
                        addUsage: usage.addUsage,
                        component: TOOL_NAMES.math,
                        logContext: runtime.logContext,
                        result,
                      });

                      return result.text;
                    })
                  ),
              }),
            },
            prepareStep: ({ messages, stepNumber }) =>
              Effect.runSync(
                prepareChatStep({
                  messages,
                  needsPageFetch: page.needsFetch,
                  system,
                  stepNumber,
                })
              ),
            experimental_repairToolCall: (options) =>
              Effect.runPromise(
                recoverChatToolCall({
                  ...options,
                  needsPageFetch: context.needsPageFetch && !fetchedPage,
                  sessionLogger: runtime.logContext,
                  url: page.url,
                })
              ),
            experimental_transform: smoothStream({
              delayInMs: 20,
              chunking: "word",
            }),
            providerOptions: {
              gateway: gatewayProviderOptions,
              google: getModelProviderOptions(runtime.modelId),
            },
            timeout: chatStreamTimeout,
          });

          writer.merge(
            streamTextResult.toUIMessageStream({
              sendReasoning: true,
              sendStart: false,
              messageMetadata: ({ part }) => {
                if (part.type === "start") {
                  return { model: runtime.modelId };
                }

                if (part.type === "finish") {
                  return Effect.runSync(
                    usage.metadata({
                      mainUsage: part.totalUsage,
                      modelId: runtime.modelId,
                    })
                  );
                }
              },
              onError: (error) => {
                scheduleAssistantFailure(error, "toUIMessageStream");

                if (error instanceof Error) {
                  if (error.message.includes("Rate limit")) {
                    Effect.runFork(
                      Effect.logWarning(
                        "Rate limit exceeded in message stream"
                      ).pipe(Effect.annotateLogs(runtime.logContext))
                    );
                    return runtime.translate("rate-limit-message");
                  }
                  return error.message;
                }
                Effect.runFork(
                  Effect.logError("Unknown error in message stream").pipe(
                    Effect.annotateLogs(runtime.logContext)
                  )
                );
                return runtime.translate("error-message");
              },
            })
          );

          // AI SDK result promises consume the stream as needed; the merged UI
          // stream is already the client-facing consumer.
          // https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
          const response = yield* Effect.tryPromise({
            try: () => streamTextResult.response,
            catch: (error) => error,
          });
          yield* writeSuggestions({
            locale: page.locale,
            messages: [...chat.finalMessages, ...response.messages],
            writer,
          }).pipe(
            Effect.catchAll((error) =>
              Effect.sync(() => runtime.reportError(error, "writeSuggestions"))
            )
          );
        })
      ),
  });
}
