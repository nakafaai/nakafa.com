import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { type ModelId, model, order } from "@repo/ai/lib/providers";
import type { MyUIMessage } from "@repo/ai/lib/types";
import { cleanSlug, compressMessages } from "@repo/ai/lib/utils";
import { nakafaSuggestions } from "@repo/ai/prompt/suggestions";
import { nakafaPrompt } from "@repo/ai/prompt/system";
import { tools } from "@repo/ai/tools";
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
import { getTranslations } from "next-intl/server";
import * as z from "zod";

const MAX_STEPS = 10;

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
    messages,
    locale,
    slug,
    model: selectedModel,
  }: {
    messages: MyUIMessage[];
    locale: string;
    slug: string;
    model: ModelId;
  } = await req.json();

  const url = `/${locale}/${cleanSlug(slug)}`;

  // Check if the slug is verified by calling api
  const verified = await api.contents
    .getContent({
      slug: `${locale}/${cleanSlug(slug)}`,
    })
    .then((res) => res.data !== "");

  const currentDate = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

  const { latitude, longitude, city, country } = geolocation(req);

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
      country: country ?? "Unknown",
    },
    url,
  });

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
            country: country ?? "Unknown",
          },
        }),
        messages: finalMessages,
        stopWhen: stepCountIs(MAX_STEPS),
        tools,
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
            model: model.languageModel("google-flash"),
            schema: tool.inputSchema,
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
              } satisfies GoogleGenerativeAIProviderOptions,
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
            reasoningSummary: "detailed", // 'auto' for condensed or 'detailed' for comprehensive
          } satisfies OpenAIResponsesProviderOptions,
          google: {
            thinkingConfig: {
              thinkingBudget: -1, // Dynamic thinking budget
              includeThoughts: true,
            },
          } satisfies GoogleGenerativeAIProviderOptions,
        },
      });

      writer.merge(
        streamTextResult.toUIMessageStream({
          sendReasoning: true,
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
      ).messages.filter((message) => message.role === "assistant");

      const streamObjectResult = streamObject({
        model: model.languageModel("google-flash"),
        system: nakafaSuggestions(),
        messages: messagesFromResponse,
        schemaName: "Suggestions",
        schemaDescription:
          "An array of suggested questions or statements that a student would want to ask or tell next",
        schema: z.object({
          suggestions: z.array(z.string()),
        }),
        providerOptions: {
          gateway: { order },
          google: {
            thinkingConfig: {
              thinkingBudget: 0,
              includeThoughts: false,
            },
          } satisfies GoogleGenerativeAIProviderOptions,
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
          data:
            chunk.suggestions?.filter(
              // Because of some AI SDK type weirdness,
              // we need to filter out undefined suggestions
              (suggestion) => suggestion !== undefined
            ) ?? [],
        });
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
