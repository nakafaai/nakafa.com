import {
  type GatewayProvider,
  type GoogleProvider,
  type ModelId,
  model,
  type OpenAIProvider,
  order,
} from "@repo/ai/lib/providers";
import { generateTitle } from "@repo/ai/lib/title";
import { cleanSlug, compressMessages } from "@repo/ai/lib/utils";
import { nakafaSuggestions } from "@repo/ai/prompt/suggestions";
import { nakafaPrompt } from "@repo/ai/prompt/system";
import { tools } from "@repo/ai/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { mapUIMessagePartsToDBParts } from "@repo/backend/convex/chats/utils";
import { api } from "@repo/connection/routes";
import { CorsValidator } from "@repo/security";
import { createChildLogger, logError } from "@repo/utilities/logging";
import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateObject,
  NoSuchToolError,
  smoothStream,
  stepCountIs,
  streamObject,
  streamText,
} from "ai";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { jsonrepair } from "jsonrepair";
import { getTranslations } from "next-intl/server";
import * as z from "zod";
import { getToken } from "@/lib/auth/server";

const MAX_STEPS = 10;
const QURAN_SLUG_PARTS_COUNT = 3;

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

const corsValidator = new CorsValidator();

export async function POST(req: Request) {
  // Only allow requests from allowed domain
  if (!corsValidator.isRequestFromAllowedDomain(req)) {
    return corsValidator.createForbiddenResponse();
  }

  const t = await getTranslations("Ai");

  const {
    message,
    chatId,
    locale,
    slug,
    model: selectedModel,
  }: {
    message: MyUIMessage | undefined;
    chatId: Id<"chats"> | undefined;
    locale: string;
    slug: string;
    model: ModelId;
  } = await req.json();

  const url = `/${locale}/${cleanSlug(slug)}`;

  // Check if the slug is verified by calling api
  const [verified, token] = await Promise.all([getVerified(url), getToken()]);

  const currentDate = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

  const { latitude, longitude, city, countryRegion, country } =
    geolocation(req);

  // Create logger with context for this chat session
  const sessionLogger = createChildLogger({
    service: "chat-api",
    currentPage: {
      locale,
      slug: cleanSlug(slug),
      verified,
    },
    currentDate,
    userLocation: {
      latitude: latitude ?? "Unknown",
      longitude: longitude ?? "Unknown",
      city: city ?? "Unknown",
      countryRegion: countryRegion ?? "Unknown",
      country: country ?? "Unknown",
    },
    url,
  });

  if (!token) {
    sessionLogger.error("Token is not found");
    return new Response("Unauthorized", { status: 401 });
  }

  if (!message) {
    sessionLogger.error("Message is not provided");
    return new Response("Bad Request", { status: 400 });
  }

  let chatIdToUse: Id<"chats"> | undefined = chatId;

  const dbParts = mapUIMessagePartsToDBParts({
    messageParts: message.parts,
  });

  // Upsert user message with parts (supports regenerate if message.id exists)
  if (chatIdToUse) {
    // Upsert message with parts for existing chat
    await fetchMutation(
      convexApi.chats.mutations.upsertMessageWithParts,
      {
        message: {
          chatId: chatIdToUse,
          role: message.role,
          identifier: message.id,
        },
        parts: dbParts,
        messageId: message.id,
      },
      { token }
    );
  } else {
    const result = await fetchMutation(
      convexApi.chats.mutations.createChatWithMessage,
      {
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

  const messages = await fetchQuery(
    convexApi.chats.queries.loadMessages,
    {
      chatId: chatIdToUse,
    },
    { token }
  );

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

  const finalMessages = convertToModelMessages(compressedMessages);

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
    onFinish: async ({ messages: updatedMessages, responseMessage }) => {
      // If updatedMessage length is 2, means it is new chat, so we need to update the chat title
      if (updatedMessages.length === 2) {
        const title = await generateTitle({ messages: updatedMessages });
        await fetchMutation(
          convexApi.chats.mutations.updateChatTitle,
          {
            chatId: chatIdToUse,
            title,
          },
          { token }
        );
      }

      // Upsert assistant response with parts
      await fetchMutation(
        convexApi.chats.mutations.upsertMessageWithParts,
        {
          message: {
            chatId: chatIdToUse,
            role: responseMessage.role,
            identifier: responseMessage.id,
          },
          parts: mapUIMessagePartsToDBParts({
            messageParts: responseMessage.parts,
          }),
          messageId: responseMessage.id,
        },
        { token }
      );
    },
    execute: async ({ writer }) => {
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
          userLocation: {
            latitude: latitude ?? "Unknown",
            longitude: longitude ?? "Unknown",
            city: city ?? "Unknown",
            countryRegion: countryRegion ?? "Unknown",
            country: country ?? "Unknown",
          },
        }),
        messages: finalMessages,
        stopWhen: stepCountIs(MAX_STEPS),
        tools: tools({ writer }),
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

          const tool =
            availableTools[toolCall.toolName as keyof typeof availableTools];

          const { object: repairedArgs } = await generateObject({
            model: model.languageModel("grok-4-fast-non-reasoning"),
            schema: tool.inputSchema,
            prompt: [
              `The model tried to call the tool "${toolCall.toolName}"` +
                " with the following arguments:",
              JSON.stringify(toolCall.input, null, 2),
              "The tool accepts the following schema:",
              JSON.stringify(inputSchema(toolCall), null, 2),
              "Please fix the arguments.",
            ].join("\n"),
            experimental_repairText: async ({ text }) => jsonrepair(text),
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
              return {
                model: selectedModel,
                token: {
                  input: part.totalUsage.inputTokens,
                  output: part.totalUsage.outputTokens,
                  total: part.totalUsage.totalTokens,
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
      const messagesFromResponse = (
        await streamTextResult.response
      ).messages.filter((m) => m.role === "assistant");

      const streamObjectResult = streamObject({
        model: model.languageModel("grok-4-fast-non-reasoning"),
        system: nakafaSuggestions(),
        messages: [...finalMessages, ...messagesFromResponse],
        schemaName: "Suggestions",
        schemaDescription:
          "An array of suggested questions or statements that a student would want to ask or tell next",
        schema: z.object({
          suggestions: z.array(z.string()),
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
      for await (const chunk of streamObjectResult.partialObjectStream) {
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

async function getVerified(url: string) {
  const cleanedUrl = cleanSlug(url);

  // [0] is locale, [1] is slug
  const slugParts = cleanedUrl.split("/");

  if (slugParts[1] === "quran") {
    if (slugParts.length !== QURAN_SLUG_PARTS_COUNT) {
      return false;
    }
    // example: locale/quran/surah
    const surah = slugParts[2];
    const { data: surahData, error: surahError } = await api.contents.getSurah({
      surah: Number.parseInt(surah, 10),
    });
    if (surahError) {
      return false;
    }
    return surahData !== null;
  }

  const { data: contentData, error: contentError } =
    await api.contents.getContent({
      slug: cleanedUrl,
    });

  if (contentError) {
    return false;
  }

  return contentData !== null;
}
