import { orchestratorTools } from "@repo/ai/agents/orchestrator";
import { nakafaPrompt } from "@repo/ai/agents/orchestrator/prompt";
import {
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
} from "@repo/ai/clients/weather/client";
import {
  defaultModel,
  hasEnoughCredits,
  type ModelId,
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
import {
  mapDBMessagesToUIMessages,
  mapUIMessagePartsToDBParts,
} from "@repo/backend/convex/chats/utils";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
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
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { getTranslations } from "next-intl/server";
import * as z from "zod";
import { getToken } from "@/lib/auth/server";
import { CHAT_ERRORS } from "./constants";
import { getUserInfo, getVerified } from "./utils";

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

export async function POST(req: Request) {
  if (!corsValidator.isRequestFromAllowedDomain(req)) {
    return corsValidator.createForbiddenResponse();
  }

  const {
    message,
    id,
    locale,
    slug,
    model: selectedModel,
  }: {
    message: MyUIMessage | undefined;
    id: Id<"chats"> | undefined;
    locale: Locale;
    slug: string;
    model: ModelId;
  } = await req.json();

  const url = `/${locale}/${cleanSlug(slug)}`;
  const shouldVerify = possibleVerifiedUrls.some((segment) =>
    url.includes(segment)
  );

  // Get token first (fast operation), then parallelize dependent calls
  // This allows userInfo to be fetched in parallel with translations and verification
  // Optimization: ~150ms saved by parallelizing userInfo with other independent operations
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

  // Parallelize all operations that can run concurrently
  // All three are independent at this point (token already acquired)
  const tPromise = getTranslations("Ai");
  const verifiedPromise = shouldVerify
    ? getVerified(url)
    : Promise.resolve(false);
  const userInfoPromise = getUserInfo(token);

  const [t, verified, userInfo] = await Promise.all([
    tPromise,
    verifiedPromise,
    userInfoPromise,
  ]);
  const userRole = userInfo.role ?? undefined;
  const userCredits = userInfo.credits;

  if (!hasEnoughCredits(userCredits, selectedModel)) {
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
    userRole,
    url,
  });

  let chatIdToUse: Id<"chats"> | undefined = id;

  const dbParts = mapUIMessagePartsToDBParts({
    messageParts: message.parts,
  });

  // Replace user message with parts
  if (chatIdToUse) {
    // Replace message with parts for existing chat
    await fetchMutation(
      convexApi.chats.mutations.saveMessage,
      {
        message: {
          chatId: chatIdToUse,
          role: message.role,
          identifier: message.id,
        },
        parts: dbParts,
      },
      { token }
    );
  } else {
    const result = await fetchMutation(
      convexApi.chats.mutations.createChatWithMessage,
      {
        type: "study",
        message: {
          role: message.role,
          identifier: message.id,
        },
        parts: dbParts,
      },
      { token }
    );
    chatIdToUse = result.chatId;
  }

  const rawMessages = await fetchQuery(
    convexApi.chats.queries.loadMessages,
    {
      chatId: chatIdToUse,
    },
    { token }
  );

  // Transform raw DB messages to UI messages
  const messages = mapDBMessagesToUIMessages(rawMessages);

  // Capture whether this is the first message before any streaming occurs
  // This is more reliable than checking message count after streaming
  const isFirstMessage = messages.length === 1;

  // Use smart message compression to stay within token limits
  const originalMessageCount = messages.length;
  const { messages: compressedMessages, tokens } = compressMessages(messages);

  // Log compression results
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

  // Log chat session start
  sessionLogger.info("Chat session started");

  const stream = createUIMessageStream<MyUIMessage>({
    onError: (error) => {
      // Log the error with context
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
      // Generate title asynchronously using waitUntil
      // Convex real-time queries will automatically reflect the title change
      // Reference: https://docs.convex.dev/client/react#reactivity
      if (isFirstMessage) {
        waitUntil(
          generateTitle({ messages: updatedMessages })
            .then((title) =>
              fetchMutation(
                convexApi.chats.mutations.updateChatTitle,
                {
                  chatId: chatIdToUse,
                  title,
                },
                { token }
              )
            )
            .catch((error) => {
              logError(
                sessionLogger,
                error instanceof Error ? error : new Error(String(error)),
                {
                  errorLocation: "generateTitle/updateChatTitle",
                }
              );
            })
        );
      }

      // Persist assistant response and deduct credits asynchronously
      // Uses combined mutation for simplicity and atomicity
      // Token counts and modelId are passed in message object (schema already has these fields)
      const tokenData = responseMessage.metadata?.tokens;

      waitUntil(
        fetchMutation(
          convexApi.chats.mutations.saveAssistantResponse,
          {
            message: {
              chatId: chatIdToUse,
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
            {
              errorLocation: "saveAssistantResponse",
            }
          );
        })
      );
    },
    execute: async ({ writer }) => {
      // Use Map to track usage without type assertion
      const subAgentUsage = new Map<ToolName, ComponentUsage>();

      const streamTextResult = streamText({
        model: model.languageModel(selectedModel),
        system: nakafaPrompt({
          url,
          currentPage: {
            locale,
            slug,
            verified,
          },
          currentDate,
          userLocation,
          userRole,
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
            userRole,
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
            getTotal: () => ({
              input: 0,
              output: 0,
              total: 0,
              breakdown: { main: { input: 0, output: 0 }, subAgents: {} },
            }),
          },
        }),
        experimental_repairToolCall: async ({
          toolCall,
          tools: availableTools,
          inputSchema,
          error,
        }) => {
          // Log tool call repair attempt
          logError(sessionLogger, error, {
            errorLocation: "experimental_repairToolCall",
            toolName: toolCall.toolName,
            toolInput: toolCall.input,
            errorType: error.name,
          });

          if (NoSuchToolError.isInstance(error)) {
            sessionLogger.warn("Invalid tool name, not attempting repair");
            return null; // do not attempt to fix invalid tool names
          }

          const tool: Tool =
            availableTools[toolCall.toolName as keyof typeof availableTools];

          const { output: repairedArgs } = await generateText({
            model: model.languageModel(defaultModel),
            output: Output.object({
              schema: tool.inputSchema,
            }),
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
                  thinkingBudget: 0, // Disable thinking
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
            reasoningSummary: "detailed", // 'auto' for condensed or 'detailed' for comprehensive
            serviceTier: "priority",
          } satisfies OpenAIProvider,
          google: {
            thinkingConfig: {
              thinkingBudget: -1, // Dynamic thinking budget
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
              return {
                model: selectedModel,
              };
            }

            if (part.type === "finish") {
              const mainInput = part.totalUsage.inputTokens ?? 0;
              const mainOutput = part.totalUsage.outputTokens ?? 0;

              // Convert Map to record for metadata
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
            // Log the error with context
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

      // Return the messages from the response, to be used in the followup suggestions
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

      // Create a data part ID for the suggestions - this
      // ensures that only ONE data-suggestions part will
      // be visible in the frontend
      const dataPartId = crypto.randomUUID();

      // Read the suggestions from the stream
      for await (const chunk of suggestionsStream.partialOutputStream) {
        // Write the suggestions to the UIMessageStream
        writer.write({
          id: dataPartId,
          type: "data-suggestions",
          data: {
            data:
              chunk.suggestions?.filter(
                // Because of some AI SDK type weirdness,
                // we need to filter out undefined suggestions
                (suggestion) => suggestion !== undefined
              ) ?? [],
          },
        });
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
