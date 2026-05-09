import { runNakafaAgent } from "@repo/ai/agents/nakafa/agent";
import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { read as readNakafa } from "@repo/ai/agents/nakafa/tools/read";
import { runMath } from "@repo/ai/agents/orchestrator/math";
import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import { nakafaPrompt } from "@repo/ai/agents/orchestrator/prompt";
import { runResearch } from "@repo/ai/agents/orchestrator/research";
import type { ModelId } from "@repo/ai/config/models";
import {
  type GoogleProvider,
  model,
  type OpenAIProvider,
  order,
} from "@repo/ai/config/vercel";
import { generateTitle } from "@repo/ai/features/title";
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
import { type createChildLogger, logError } from "@repo/utilities/logging";
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
import { search as nakafaSearch } from "@/app/api/chat/nakafa";
import { repairChatToolCall } from "@/app/api/chat/repair";
import { prepareNakafaStep } from "@/app/api/chat/step";
import { writeSuggestions } from "@/app/api/chat/suggestions";
import { trackUsage } from "@/app/api/chat/usage";
import type { getUserInfo } from "@/app/api/chat/utils";

const MAX_STEPS = 10;

type Logger = ReturnType<typeof createChildLogger>;
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
    logger: Logger;
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
        logError(runtime.logger, error, {
          errorLocation: "createUIMessageStream",
          errorType: error.name,
        });
        if (error.message.includes("Rate limit")) {
          runtime.logger.warn("Rate limit exceeded in chat stream");
          return runtime.translate("rate-limit-message");
        }
        return error.message;
      }
      runtime.logger.error("Unknown error in chat stream");
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
                Effect.sync(() => {
                  runtime.reportError(error, "chat-api-generate-title");

                  logError(
                    runtime.logger,
                    error instanceof Error ? error : new Error(String(error)),
                    { errorLocation: "generateTitle/updateChatTitle" }
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
              Effect.sync(() => {
                runtime.reportError(error, "chat-api-save-assistant-response");

                logError(
                  runtime.logger,
                  error instanceof Error ? error : new Error(String(error)),
                  { errorLocation: "saveAssistantResponse" }
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
          const usage = trackUsage();
          const context = {
            url: page.url,
            slug: cleanSlug(page.slug),
            verified: page.verified,
            needsPageFetch: page.needsFetch,
            userRole: user.info.role ?? undefined,
          };
          let fetchedPage = false;

          const streamTextResult = streamText({
            model: model.languageModel(runtime.modelId),
            system: nakafaPrompt({
              url: page.url,
              currentPage: {
                locale: page.locale,
                slug: page.slug,
                verified: page.verified,
              },
              currentDate: runtime.currentDate,
              userLocation: user.location,
              userRole: user.info.role ?? undefined,
            }),
            messages: chat.finalMessages,
            stopWhen: stepCountIs(MAX_STEPS),
            tools: {
              [TOOL_NAMES.nakafa]: tool({
                description:
                  "Access Nakafa-owned educational content including articles, subjects, Quran references, and exercises.",
                inputSchema: nakafaToolInputSchema,
                execute: ({ query }, { toolCallId }) => {
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
                        task: query,
                        writer,
                      }).pipe(
                        Effect.provideService(NakafaSearch, nakafaSearch)
                      );

                      yield* Effect.sync(() =>
                        usage.addUsage(TOOL_NAMES.nakafa, result.usage)
                      );

                      return result.text;
                    })
                  );
                },
              }),
              [TOOL_NAMES.deepResearch]: tool({
                description:
                  "Conduct deep research on any topic by searching the web and analyzing sources. Use this for up-to-date information, general knowledge questions, and external research.",
                inputSchema: researchToolInputSchema,
                execute: ({ query }) =>
                  Effect.runPromise(
                    runResearch({
                      context,
                      locale: page.locale,
                      modelId: runtime.modelId,
                      query,
                      usageAccumulator: usage,
                      writer,
                    })
                  ),
              }),
              [TOOL_NAMES.mathCalculation]: tool({
                description:
                  "Perform mathematical calculations and solve math problems. Use this for ANY mathematical computation - from simple arithmetic to complex expressions.",
                inputSchema: mathToolInputSchema,
                execute: ({ query }) =>
                  Effect.runPromise(
                    runMath({
                      context,
                      locale: page.locale,
                      modelId: runtime.modelId,
                      query,
                      usageAccumulator: usage,
                      writer,
                    })
                  ),
              }),
            },
            prepareStep: ({ stepNumber }) =>
              Effect.runSync(
                prepareNakafaStep({
                  needsPageFetch: page.needsFetch,
                  stepNumber,
                })
              ),
            experimental_repairToolCall: (options) =>
              Effect.runPromise(
                repairChatToolCall({
                  ...options,
                  needsPageFetch: context.needsPageFetch && !fetchedPage,
                  sessionLogger: runtime.logger,
                  url: page.url,
                })
              ),
            experimental_transform: smoothStream({
              delayInMs: 20,
              chunking: "word",
            }),
            providerOptions: {
              gateway: { order },
              openai: {
                include: ["reasoning.encrypted_content"],
                reasoningSummary: "detailed",
                serviceTier: "priority",
              } satisfies OpenAIProvider,
              google: {
                thinkingConfig: {
                  thinkingBudget: -1,
                  includeThoughts: true,
                },
              } satisfies GoogleProvider,
            },
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
                  return usage.metadata({
                    mainUsage: part.totalUsage,
                    modelId: runtime.modelId,
                  });
                }
              },
              onError: (error) => {
                runtime.reportError(error, "chat-api-message-stream");

                if (error instanceof Error) {
                  logError(runtime.logger, error, {
                    errorLocation: "toUIMessageStream",
                    errorType: error.name,
                  });
                  if (error.message.includes("Rate limit")) {
                    runtime.logger.warn(
                      "Rate limit exceeded in message stream"
                    );
                    return runtime.translate("rate-limit-message");
                  }
                  return error.message;
                }
                runtime.logger.error("Unknown error in message stream");
                return runtime.translate("error-message");
              },
            })
          );

          yield* Effect.tryPromise(() => streamTextResult.consumeStream());

          const response = yield* Effect.tryPromise(
            () => streamTextResult.response
          );
          yield* writeSuggestions({
            messages: [...chat.finalMessages, ...response.messages],
            writer,
          });
        })
      ),
  });
}
