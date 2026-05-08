import { model } from "@repo/ai/config/vercel";
import {
  DEFAULT_TITLE,
  MAX_TITLE_LENGTH,
  TRUNCATED_TITLE_LENGTH,
} from "@repo/ai/features/constants";
import { createPrompt } from "@repo/ai/prompt/utils";
import type { MyUIMessage } from "@repo/ai/types/message";
import { generateText } from "ai";
import { Effect } from "effect";

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
  const { text } = yield* Effect.tryPromise(() =>
    generateText({
      model: model.languageModel("grok-4.1-fast-non-reasoning"),
      prompt: JSON.stringify(messages, null, 2),
      system: createPrompt({
        taskContext:
          "You are an expert title generator. You are given a message in prompt and you need to generate a short, descriptive title based on it.",
        detailedTaskInstructions: `
          - Focus on the main topic or question being asked
          - Keep it between 3-5 words
          - Ensure it is not more than ${MAX_TITLE_LENGTH} characters long
          - The title should be creative and unique
          - The title should be a summary of the user's message
          - Do not use quotes or colons`,
        outputFormatting: "Output only the title, nothing else",
      }),
    })
  ).pipe(Effect.catchAll(() => Effect.succeed({ text: DEFAULT_TITLE })));

  const cleanedTitle = text.replace(/^["']|["']$/g, "");

  if (cleanedTitle.length <= MAX_TITLE_LENGTH) {
    return cleanedTitle;
  }

  return `${cleanedTitle.slice(0, TRUNCATED_TITLE_LENGTH)}...`;
});
