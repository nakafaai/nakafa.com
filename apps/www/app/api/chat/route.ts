import { defaultModel, model } from "@repo/ai/lib/providers";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: model.languageModel(defaultModel),
    system: "You are a helpful assistant.",
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5), // enable multi-step agentic flow
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    onError: (error) => {
      if (error instanceof Error && error.message.includes("Rate limit")) {
        return "Rate limit exceeded. Please try again later.";
      }
      return "An error occurred.";
    },
  });
}
