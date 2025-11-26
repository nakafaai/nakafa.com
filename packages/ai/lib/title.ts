import { model } from "@repo/ai/lib/providers";
import { createPrompt } from "@repo/ai/prompt/utils";
import type { MyUIMessage } from "@repo/ai/types/message";
import { generateText } from "ai";

const MAX_TITLE_LENGTH = 80;
const TRUNCATED_TITLE_LENGTH = 77;
const DEFAULT_TITLE = "New Chat";

export async function generateTitle({ messages }: { messages: MyUIMessage[] }) {
  try {
    const { text } = await generateText({
      model: model.languageModel("xai/grok-4.1-fast-non-reasoning"),
      prompt: JSON.stringify(messages, null, 2),
      system: createPrompt({
        taskContext:
          "You are an expert title generator. You are given a message in the prompt and you need to generate a short, descriptive title based on it.",
        detailedTaskInstructions: `
          - Focus on the main topic or question being asked
          - Keep it between 3-5 words
          - Ensure it is not more than ${MAX_TITLE_LENGTH} characters long
          - The title should be creative and unique
          - The title should be a summary of the user's message
          - Do not use quotes or colons`,
        outputFormatting: "Output only the title, nothing else",
      }),
    });

    // Remove leading and trailing quotes
    const cleanedTitle = text.replace(/^["']|["']$/g, "");

    // Truncate if necessary
    const finalTitle =
      cleanedTitle.length > MAX_TITLE_LENGTH
        ? `${cleanedTitle.substring(0, TRUNCATED_TITLE_LENGTH)}...`
        : cleanedTitle;

    return finalTitle;
  } catch {
    return DEFAULT_TITLE;
  }
}
