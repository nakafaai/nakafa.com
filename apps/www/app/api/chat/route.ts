import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { defaultModel, model, order } from "@repo/ai/lib/providers";
import type { MyUIMessage } from "@repo/ai/lib/types";
import { cleanSlug } from "@repo/ai/lib/utils";
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
  streamText,
  type UIMessage,
} from "ai";
import { getTranslations } from "next-intl/server";

const MAX_CONVERSATION_HISTORY = 20;
const MAX_STEPS = 20;

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const corsValidator = new CorsValidator();

export async function POST(req: Request) {
  // Only allow requests from allowed domain
  if (!corsValidator.isRequestFromAllowedDomain(req)) {
    return corsValidator.createForbiddenResponse();
  }

  const t = await getTranslations("Ai");

  const {
    messages,
    url,
    locale,
    slug,
  }: { messages: UIMessage[]; url: string; locale: string; slug: string } =
    await req.json();

  // Check if the slug is verified by calling api
  const verified = await api.contents
    .getContent({
      slug: `${locale}/${cleanSlug(slug)}`,
    })
    .then((res) => res.data !== "");

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
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
    execute: ({ writer }) => {
      const result = streamText({
        model: model.languageModel(defaultModel),
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
        messages: convertToModelMessages(messages),
        stopWhen: stepCountIs(MAX_STEPS),
        tools,
        prepareStep: ({ messages: initialMessages }) => {
          // We need to cut costs, ai is expensive
          // Compress conversation history for longer loops
          const finalMessages = initialMessages.slice(
            -(MAX_CONVERSATION_HISTORY / 2)
          );

          return {
            messages: finalMessages,
          };
        },
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
            model: model.languageModel(defaultModel),
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
          chunking: "line",
        }),
        providerOptions: {
          gateway: { order },
        },
      });

      writer.merge(
        result.toUIMessageStream({
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
    },
  });

  return createUIMessageStreamResponse({ stream });
}
