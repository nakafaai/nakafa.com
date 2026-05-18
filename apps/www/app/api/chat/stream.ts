import { runMathAgent } from "@repo/ai/agents/math/agent";
import { runNakafaAgent } from "@repo/ai/agents/nakafa/agent";
import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { read as readNakafa } from "@repo/ai/agents/nakafa/tools/read";
import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import { nakafaPrompt } from "@repo/ai/agents/orchestrator/prompt";
import { runResearchAgent } from "@repo/ai/agents/research/agent";
import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import { getModelProviderOptions, type ModelId } from "@repo/ai/config/models";
import { chatStreamTimeout } from "@repo/ai/config/timeouts";
import { model } from "@repo/ai/config/vercel";
import { generateTitle } from "@repo/ai/features/title";
import { getSourceReferencesFromMessages } from "@repo/ai/lib/source";
import {
  mathToolInputSchema,
  nakafaToolInputSchema,
  researchToolInputSchema,
} from "@repo/ai/schema/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { mapUIMessagePartsToDBParts } from "@repo/backend/convex/chats/messageParts/uiToDb";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import { cleanSlug } from "@repo/utilities/helper";
import { logError } from "@repo/utilities/logging/effect";
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
import { gateUnsourcedResearchStream } from "@/app/api/chat/evidence";
import { search as nakafaSearch } from "@/app/api/chat/nakafa";
import { repairChatToolCall } from "@/app/api/chat/repair";
import { prepareChatStep } from "@/app/api/chat/step";
import { writeSuggestions } from "@/app/api/chat/suggestions";
import { trackUsage } from "@/app/api/chat/usage";
import type { getUserInfo } from "@/app/api/chat/utils";

const MAX_ORCHESTRATOR_STEPS = 20;

type Location = Parameters<typeof nakafaPrompt>[0]["userLocation"];
type Translator = Awaited<ReturnType<typeof getTranslations>>;
type UserInfo = Effect.Effect.Success<ReturnType<typeof getUserInfo>>;

interface Params {
  chat: {
    finalMessages: ModelMessage[];
    id: Id<"chats">;
    isFirstMessage: boolean;
    messages: MyUIMessage[];
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
    location: Location;
  };
}

/**
 * Streams one chat turn through the AI SDK UI message stream.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#streaming-tool-calls
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text#to-ui-message-stream
 */
export function streamChat({ chat, page, runtime, user }: Params) {
  return createUIMessageStream<MyUIMessage>({
    onError: (error) => {
      runtime.reportError(error, "chat-api-stream");

      if (error instanceof Error) {
        Effect.runFork(
          logError(error, {
            ...runtime.logContext,
            errorLocation: "createUIMessageStream",
            errorType: error.name,
          })
        );
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
    onFinish: ({ messages: updatedMessages, responseMessage }) => {
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
                Effect.gen(function* () {
                  runtime.reportError(error, "chat-api-generate-title");

                  yield* logError(
                    error instanceof Error ? error : new Error(String(error)),
                    {
                      ...runtime.logContext,
                      errorLocation: "generateTitle/updateChatTitle",
                    }
                  );
                })
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
              Effect.gen(function* () {
                runtime.reportError(error, "chat-api-save-assistant-response");

                yield* logError(
                  error instanceof Error ? error : new Error(String(error)),
                  {
                    ...runtime.logContext,
                    errorLocation: "saveAssistantResponse",
                  }
                );
              })
            )
          )
        )
      );
    },
    execute: ({ writer }) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const usage = yield* trackUsage();
          const context = {
            currentDate: runtime.currentDate,
            url: page.url,
            slug: cleanSlug(page.slug),
            verified: page.verified,
            needsPageFetch: page.needsFetch,
            userRole: user.info.role ?? undefined,
          };
          let fetchedPage = false;
          let sawResearch = false;
          let hasSourceBackedResearch = false;
          let generatedNoEvidenceAnswer = "";

          const system = nakafaPrompt({
            url: page.url,
            currentPage: {
              locale: page.locale,
              slug: page.slug,
              verified: page.verified,
            },
            currentDate: runtime.currentDate,
            userLocation: user.location,
            userRole: user.info.role ?? undefined,
          });

          const streamTextResult = streamText({
            model: model.languageModel(runtime.modelId),
            system,
            messages: chat.finalMessages,
            stopWhen: stepCountIs(MAX_ORCHESTRATOR_STEPS),
            tools: {
              [TOOL_NAMES.nakafa]: tool({
                description:
                  "Retrieve Nakafa educational evidence for lessons, study topics, current pages, articles, Quran references, examples, warmups, review tasks, tryout preparation, and structured exercises. Use this before math when content must be selected. Preserve every requested deliverable in the task.",
                inputSchema: nakafaToolInputSchema,
                execute: ({ task }, { toolCallId }) => {
                  const needsPageFetch = context.needsPageFetch && !fetchedPage;

                  if (needsPageFetch) {
                    fetchedPage = true;
                  }

                  return Effect.runPromise(
                    Effect.gen(function* () {
                      if (needsPageFetch) {
                        return yield* readNakafa({
                          input: { content_ref: context.url },
                          toolCallId,
                          writer,
                        }).pipe(Effect.provide(Nakafa.Default));
                      }

                      const result = yield* runNakafaAgent({
                        context: { ...context, needsPageFetch },
                        locale: page.locale,
                        modelId: runtime.modelId,
                        task,
                        writer,
                      }).pipe(
                        Effect.provideService(NakafaSearch, nakafaSearch)
                      );

                      yield* usage.addUsage(TOOL_NAMES.nakafa, result.usage);

                      return result.text;
                    })
                  );
                },
              }),
              [TOOL_NAMES.deepResearch]: tool({
                description:
                  "Research external, official, current, latest, cited, or source-backed information with web search and source analysis.",
                inputSchema: researchToolInputSchema,
                execute: ({ task }, { messages, toolCallId }) =>
                  Effect.runPromise(
                    Effect.gen(function* () {
                      const result = yield* runResearchAgent({
                        context,
                        locale: page.locale,
                        modelId: runtime.modelId,
                        task,
                        sourceReferences:
                          getSourceReferencesFromMessages(messages),
                        toolCallId,
                        writer,
                      });

                      sawResearch = true;
                      hasSourceBackedResearch =
                        hasSourceBackedResearch || result.sourceBacked;
                      if (!result.sourceBacked) {
                        generatedNoEvidenceAnswer = result.text;
                      }

                      yield* usage.addUsage(
                        TOOL_NAMES.deepResearch,
                        result.usage
                      );

                      return result.text;
                    })
                  ),
              }),
              [TOOL_NAMES.math]: tool({
                description:
                  "Verify user-provided or retrieved math with deterministic evidence for arithmetic, algebra, equations, calculus, series, matrices, statistics, probability, geometry, and discrete math. Do not use this as the first or only source for educational practice content; use Nakafa first, then math verifies the selected content.",
                inputSchema: mathToolInputSchema,
                execute: ({ task }) =>
                  Effect.runPromise(
                    Effect.gen(function* () {
                      const result = yield* runMathAgent({
                        context,
                        locale: page.locale,
                        modelId: runtime.modelId,
                        task,
                        writer,
                      });

                      yield* usage.addUsage(TOOL_NAMES.math, result.usage);

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
                repairChatToolCall({
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

          const evidenceGate = { blocked: false };
          const gatedStream = gateUnsourcedResearchStream({
            getNoEvidenceAnswer: () => generatedNoEvidenceAnswer,
            shouldBlock: () =>
              sawResearch &&
              !hasSourceBackedResearch &&
              generatedNoEvidenceAnswer.length > 0,
            state: evidenceGate,
            stream: streamTextResult.toUIMessageStream({
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
                runtime.reportError(error, "chat-api-message-stream");

                if (error instanceof Error) {
                  Effect.runFork(
                    logError(error, {
                      ...runtime.logContext,
                      errorLocation: "toUIMessageStream",
                      errorType: error.name,
                    })
                  );
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
            }),
          });

          writer.merge(gatedStream);

          // AI SDK result promises consume the stream as needed; the merged UI
          // stream is already the client-facing consumer.
          // https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
          const response = yield* Effect.tryPromise(
            () => streamTextResult.response
          );
          const suggestionMessages = evidenceGate.blocked
            ? [
                ...chat.finalMessages,
                {
                  content: generatedNoEvidenceAnswer,
                  role: "assistant" as const,
                },
              ]
            : [...chat.finalMessages, ...response.messages];

          yield* writeSuggestions({
            locale: page.locale,
            messages: suggestionMessages,
            writer,
          }).pipe(
            Effect.catchAll((error) =>
              logError(error, {
                ...runtime.logContext,
                errorLocation: "writeSuggestions",
              })
            )
          );
        })
      ),
  });
}
