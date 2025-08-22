import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { defaultModel, model, order } from "@repo/ai/lib/providers";
import type { MyUIMessage } from "@repo/ai/lib/types";
import { cleanSlug } from "@repo/ai/lib/utils";
import { nakafaPrompt } from "@repo/ai/prompt/system";
import { tools } from "@repo/ai/tools";
import { api } from "@repo/connection/routes";
import { CorsValidator } from "@repo/security";
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

  const stream = createUIMessageStream<MyUIMessage>({
    onError: (error) => {
      if (error instanceof Error) {
        if (error.message.includes("Rate limit")) {
          return t("rate-limit-message");
        }
        return error.message;
      }
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
          if (NoSuchToolError.isInstance(error)) {
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
            if (error instanceof Error) {
              if (error.message.includes("Rate limit")) {
                return t("rate-limit-message");
              }
              return error.message;
            }
            return t("error-message");
          },
        })
      );
    },
  });

  return createUIMessageStreamResponse({ stream });
}
