import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { defaultModel, model } from "@repo/ai/lib/providers";
import { tools } from "@repo/ai/lib/tools";
import { nakafaPrompt } from "@repo/ai/prompt/system";
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
const CHUNK_PATTERN = /[^-]*---/;

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const t = await getTranslations("Ai");

  const {
    messages,
    locale,
    slug: pageSlug,
  }: { messages: UIMessage[]; locale: string; slug: string } = await req.json();

  const stream = createUIMessageStream({
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
        system: nakafaPrompt({ locale, slug: pageSlug }),
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
          chunking: CHUNK_PATTERN,
        }),
        providerOptions: {
          gateway: {
            order: ["baseten", "groq", "cerebras", "azure", "vertex"],
          },
          google: {
            thinkingConfig: {
              thinkingBudget: -1, // Dynamic thinking
              includeThoughts: true,
            },
          } satisfies GoogleGenerativeAIProviderOptions,
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
