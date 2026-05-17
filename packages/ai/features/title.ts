import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import {
  defaultModel,
  getFastModelProviderOptions,
} from "@repo/ai/config/models";
import { backgroundGenerationTimeout } from "@repo/ai/config/timeouts";
import { model } from "@repo/ai/config/vercel";
import {
  DEFAULT_TITLE,
  MAX_TITLE_LENGTH,
  TRUNCATED_TITLE_LENGTH,
} from "@repo/ai/features/constants";
import { createPrompt } from "@repo/ai/prompt/utils";
import type { MyUIMessage } from "@repo/ai/types/message";
import { generateText } from "ai";
import { Effect, Schema } from "effect";

/** Title generation failed before a usable model response was returned. */
export class TitleGenerationError extends Schema.TaggedError<TitleGenerationError>()(
  "TitleGenerationError",
  {
    message: Schema.String,
  }
) {}

/**
 * Generates a title for a chat based on conversation messages.
 *
 * @param params - Object containing messages to generate a title from
 * @param params.messages - Array of UI messages to analyze for title generation
 * @returns Generated title string, or default title if generation fails
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text
 */
export const generateTitle = Effect.fn("features.generateTitle")(function* ({
  messages,
}: {
  messages: MyUIMessage[];
}) {
  const { text } = yield* Effect.tryPromise({
    try: () =>
      generateText({
        model: model.languageModel(defaultModel),
        prompt: JSON.stringify(messages, null, 2),
        providerOptions: {
          gateway: gatewayProviderOptions,
          google: getFastModelProviderOptions(defaultModel),
        },
        system: createPrompt({
          taskContext: `
            # Title Task

            You are an expert title generator.
            Generate a short, descriptive title for the message in the prompt.
          `,
          detailedTaskInstructions: `
          # Title Rules

          - Focus on the main topic or question being asked
          - Keep it between 3-5 words
          - Ensure it is not more than ${MAX_TITLE_LENGTH} characters long
          - The title should be creative and unique
          - The title should be a summary of the user's message
          - Do not mention internal system names such as CAS, SymPy, agent, tool, engine, or service
          - Do not use quotes or colons`,
          outputFormatting: `
            # Output Format

            Output only the title, nothing else.
          `,
        }),
        timeout: backgroundGenerationTimeout,
      }),
    catch: (error) =>
      new TitleGenerationError({
        message: `Unable to generate title: ${error}`,
      }),
  }).pipe(
    Effect.catchTag("TitleGenerationError", () =>
      Effect.succeed({ text: DEFAULT_TITLE })
    )
  );

  const cleanedTitle = text.replace(/^["']|["']$/g, "");

  if (cleanedTitle.length <= MAX_TITLE_LENGTH) {
    return cleanedTitle;
  }

  return `${cleanedTitle.slice(0, TRUNCATED_TITLE_LENGTH)}...`;
});
