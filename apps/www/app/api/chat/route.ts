import { orchestratorTools } from "@repo/ai/agents/orchestrator";
import { nakafaPrompt } from "@repo/ai/agents/orchestrator/prompt";
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
} from "@repo/ai/clients/weather/client";
import {
  defaultModel,
  getModelCreditCost,
  hasEnoughCredits,
  MODEL_IDS,
} from "@repo/ai/config/models";
import {
  type GatewayProvider,
  type GoogleProvider,
  model,
  type OpenAIProvider,
  order,
} from "@repo/ai/config/vercel";
import { generateTitle } from "@repo/ai/features/title-generation";
import { compressMessages } from "@repo/ai/lib/utils";
import { nakafaSuggestions } from "@repo/ai/prompt/suggestions";
import type { ComponentUsage } from "@repo/ai/schema/metadata";
import type { ToolName } from "@repo/ai/schema/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { mapUIMessagePartsToDBParts } from "@repo/backend/convex/chats/utils";
import { LocaleSchema } from "@repo/contents/_types/content";
import { CorsValidator } from "@repo/security/lib/cors-validator";
import { cleanSlug } from "@repo/utilities/helper";
import { createChildLogger, logError } from "@repo/utilities/logging";
import { geolocation, waitUntil } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  NoSuchToolError,
  Output,
  smoothStream,
  stepCountIs,
  streamText,
  type Tool,
} from "ai";
import { fetchMutation } from "convex/nextjs";
import { getTranslations } from "next-intl/server";
import * as z from "zod";
import { getToken } from "@/lib/auth/server";
import { CHAT_ERRORS } from "./constants";
import { loadMessages, saveOrCreateChat } from "./persistence";
import { getUserInfo, getVerified } from "./utils";

const ModelIdSchema = z.enum(MODEL_IDS);

const MAX_STEPS = 10;

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

const corsValidator = new CorsValidator();

const possibleVerifiedUrls = [
  "/articles",
  "/quran",
  "/subject",
  "/exercises",
] as const;

/**
 * POST /api/chat
 *
 * Handles an incoming chat message from the client. Validates the request,
 * gates on user credits, persists the user message, then streams the
 * assistant response back using the AI SDK UI message stream protocol.
 *
 * After the stream finishes, two fire-and-forget tasks run via `waitUntil`:
 * - Title generation (first message only)
 * - Assistant response persistence and credit deduction
 */
export async function POST(req: Request) {
  if (!corsValidator.isRequestFromAllowedDomain(req)) {
    return corsValidator.createForbiddenResponse();
  }

  const {
    message,
    id,
    locale: rawLocale,
    slug,
    model: rawModel,
  }: {
    message: MyUIMessage | undefined;
    id: Id<"chats"> | undefined;
    locale: unknown;
    slug: string;
    model: unknown;
  } = await req.json();

  const localeResult = LocaleSchema.safeParse(rawLocale);
  if (!localeResult.success) {
    return new Response(CHAT_ERRORS.BAD_REQUEST.code, {
      status: CHAT_ERRORS.BAD_REQUEST.status,
    });
  }
  const locale = localeResult.data;

  const modelResult = ModelIdSchema.safeParse(rawModel);
  if (!modelResult.success) {
    return new Response(CHAT_ERRORS.BAD_REQUEST.code, {
      status: CHAT_ERRORS.BAD_REQUEST.status,
    });
  }
  const selectedModel = modelResult.data;

  const token = await getToken();
  if (!token) {
    return new Response(CHAT_ERRORS.UNAUTHORIZED.code, {
      status: CHAT_ERRORS.UNAUTHORIZED.status,
    });
  }

  if (!message) {
    return new Response(CHAT_ERRORS.BAD_REQUEST.code, {
      status: CHAT_ERRORS.BAD_REQUEST.status,
    });
  }

  const url = `/${locale}/${cleanSlug(slug)}`;
  const shouldVerify = possibleVerifiedUrls.some((segment) =>
    url.includes(segment)
  );

  const currentDate = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

  const geo = geolocation(req);
  const userLocation = {
    latitude: geo.latitude ?? DEFAULT_LATITUDE,
    longitude: geo.longitude ?? DEFAULT_LONGITUDE,
    city: geo.city ?? "Unknown",
    countryRegion: geo.countryRegion ?? "Unknown",
    country: geo.country ?? "Unknown",
  };

  const [verified, userInfo] = await Promise.all([
    shouldVerify ? getVerified(url) : Promise.resolve(false),
    getUserInfo(token),
  ]);

  if (!hasEnoughCredits(userInfo.credits, selectedModel)) {
    return Response.json(
      { error: CHAT_ERRORS.INSUFFICIENT_CREDITS.code },
      { status: CHAT_ERRORS.INSUFFICIENT_CREDITS.status }
    );
  }

  const sessionLogger = createChildLogger({
    service: "chat-api",
    currentPage: {
      locale,
      slug: cleanSlug(slug),
      url,
      verified,
    },
    currentDate,
    userLocation,
    userRole: userInfo.role,
    url,
  });

  const chatId = await saveOrCreateChat({ chatId: id, message, token });
  const messages = await loadMessages({ chatId, token });
  const isFirstMessage = messages.length === 1;

  const originalMessageCount = messages.length;
  const { messages: compressedMessages, tokens } = compressMessages(messages);

  if (compressedMessages.length < originalMessageCount) {
    sessionLogger.warn(
      `Messages compressed from ${originalMessageCount} to ${compressedMessages.length} messages (${tokens} tokens) to stay within token limit`
    );
  } else {
    sessionLogger.info(
      `All ${originalMessageCount} messages fit within token limit (${tokens} tokens)`
    );
  }

  const finalMessages = await convertToModelMessages(compressedMessages);

  sessionLogger.info("Chat session started");

  const t = await getTranslations("Ai");

  const stream = createUIMessageStream<MyUIMessage>({
    onError: (error) => {
      if (error instanceof Error) {
        logError(sessionLogger, error, {
          errorLocation: "createUIMessageStream",
          errorType: error.name,
        });
        if (error.message.includes("Rate limit")) {
          sessionLogger.warn("Rate limit exceeded in chat stream");
          return t("rate-limit-message");
        }
        return error.message;
      }
      sessionLogger.error("Unknown error in chat stream");
      return t("error-message");
    },
    originalMessages: compressedMessages,
    onFinish: ({ messages: updatedMessages, responseMessage }) => {
      if (isFirstMessage) {
        waitUntil(
          generateTitle({ messages: updatedMessages })
            .then((title) =>
              fetchMutation(
                convexApi.chats.mutations.updateChatTitle,
                { chatId, title },
                { token }
              )
            )
            .catch((error) => {
              logError(
                sessionLogger,
                error instanceof Error ? error : new Error(String(error)),
                { errorLocation: "generateTitle/updateChatTitle" }
              );
            })
        );
      }

      const tokenData = responseMessage.metadata?.tokens;

      waitUntil(
        fetchMutation(
          convexApi.chats.mutations.saveAssistantResponse,
          {
            message: {
              chatId,
              role: responseMessage.role,
              identifier: responseMessage.id,
              modelId: selectedModel,
              inputTokens: tokenData?.input ?? 0,
              outputTokens: tokenData?.output ?? 0,
              totalTokens: tokenData?.total ?? 0,
            },
            parts: mapUIMessagePartsToDBParts({
              messageParts: responseMessage.parts,
            }),
          },
          { token }
        ).catch((error) => {
          logError(
            sessionLogger,
            error instanceof Error ? error : new Error(String(error)),
            { errorLocation: "saveAssistantResponse" }
          );
        })
      );
    },
    execute: async ({ writer }) => {
      const subAgentUsage = new Map<ToolName, ComponentUsage>();

      const streamTextResult = streamText({
        model: model.languageModel(selectedModel),
        system: nakafaPrompt({
          url,
          currentPage: { locale, slug, verified },
          currentDate,
          userLocation,
          userRole: userInfo.role ?? undefined,
        }),
        messages: finalMessages,
        stopWhen: stepCountIs(MAX_STEPS),
        tools: orchestratorTools({
          writer,
          modelId: selectedModel,
          locale,
          context: {
            url,
            slug: cleanSlug(slug),
            verified,
            userRole: userInfo.role,
          },
          usageAccumulator: {
            addUsage: (component, usage) => {
              const input = usage.inputTokens ?? 0;
              const output = usage.outputTokens ?? 0;
              const existing = subAgentUsage.get(component);
              subAgentUsage.set(component, {
                input: (existing?.input ?? 0) + input,
                output: (existing?.output ?? 0) + output,
              });
            },
            getTotal: () => {
              const subAgentsInput = Array.from(subAgentUsage.values()).reduce(
                (sum, usage) => sum + usage.input,
                0
              );
              const subAgentsOutput = Array.from(subAgentUsage.values()).reduce(
                (sum, usage) => sum + usage.output,
                0
              );
              return {
                input: subAgentsInput,
                output: subAgentsOutput,
                total: subAgentsInput + subAgentsOutput,
                breakdown: {
                  main: { input: 0, output: 0 },
                  subAgents: Object.fromEntries(subAgentUsage),
                },
              };
            },
          },
        }),
        experimental_repairToolCall: async ({
          toolCall,
          tools: availableTools,
          inputSchema,
          error,
        }) => {
          logError(sessionLogger, error, {
            errorLocation: "experimental_repairToolCall",
            toolName: toolCall.toolName,
            toolInput: toolCall.input,
            errorType: error.name,
          });

          if (NoSuchToolError.isInstance(error)) {
            sessionLogger.warn("Invalid tool name, not attempting repair");
            return null;
          }

          const tool: Tool =
            availableTools[toolCall.toolName as keyof typeof availableTools];

          const { output: repairedArgs } = await generateText({
            model: model.languageModel(defaultModel),
            output: Output.object({ schema: tool.inputSchema }),
            prompt: [
              `The model tried to call the tool "${toolCall.toolName}"` +
                " with the following arguments:",
              JSON.stringify(toolCall.input, null, 2),
              "The tool accepts the following schema:",
              JSON.stringify(inputSchema(toolCall), null, 2),
              "Please fix the arguments.",
            ].join("\n"),
            providerOptions: {
              gateway: { order },
              google: {
                thinkingConfig: {
                  thinkingBudget: 0,
                  includeThoughts: false,
                },
              } satisfies GoogleProvider,
            },
          });

          sessionLogger.info("Tool call successfully repaired");
          return { ...toolCall, input: JSON.stringify(repairedArgs, null, 2) };
        },
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
              return { model: selectedModel };
            }

            if (part.type === "finish") {
              const mainInput = part.totalUsage.inputTokens ?? 0;
              const mainOutput = part.totalUsage.outputTokens ?? 0;

              const subAgentsRecord = Object.fromEntries(subAgentUsage);
              const subAgentsInput = Array.from(subAgentUsage.values()).reduce(
                (sum, usage) => sum + usage.input,
                0
              );
              const subAgentsOutput = Array.from(subAgentUsage.values()).reduce(
                (sum, usage) => sum + usage.output,
                0
              );

              return {
                model: selectedModel,
                credits: getModelCreditCost(selectedModel),
                tokens: {
                  input: mainInput + subAgentsInput,
                  output: mainOutput + subAgentsOutput,
                  total:
                    mainInput + mainOutput + subAgentsInput + subAgentsOutput,
                  breakdown: {
                    main: { input: mainInput, output: mainOutput },
                    subAgents: subAgentsRecord,
                  },
                },
              };
            }
          },
          onError: (error) => {
            if (error instanceof Error) {
              logError(sessionLogger, error, {
                errorLocation: "toUIMessageStream",
                errorType: error.name,
              });
              if (error.message.includes("Rate limit")) {
                sessionLogger.warn("Rate limit exceeded in message stream");
                return t("rate-limit-message");
              }
              return error.message;
            }
            sessionLogger.error("Unknown error in message stream");
            return t("error-message");
          },
        })
      );

      await streamTextResult.consumeStream();

      const messagesFromResponse = (await streamTextResult.response).messages;

      const suggestionsStream = streamText({
        model: model.languageModel(defaultModel),
        system: nakafaSuggestions(),
        messages: [...finalMessages, ...messagesFromResponse],
        output: Output.object({
          schema: z.object({
            suggestions: z
              .array(z.string())
              .describe(
                "An array of suggested questions or statements that a user would want to ask or tell next"
              ),
          }),
        }),
        providerOptions: {
          gateway: { order } satisfies GatewayProvider,
          google: {
            thinkingConfig: {
              thinkingBudget: 0,
              includeThoughts: false,
            },
          } satisfies GoogleProvider,
        },
      });

      const dataPartId = crypto.randomUUID();

      for await (const chunk of suggestionsStream.partialOutputStream) {
        writer.write({
          id: dataPartId,
          type: "data-suggestions",
          data: {
            data:
              chunk.suggestions?.filter(
                (suggestion) => suggestion !== undefined
              ) ?? [],
          },
        });
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
