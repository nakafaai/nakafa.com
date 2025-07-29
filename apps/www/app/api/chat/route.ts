import { defaultModel, Model } from "@repo/ai/lib/providers";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { env } from "@/env";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const model = new Model({ apiKey: env.AI_GATEWAY_API_KEY });

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: model.languageModel(defaultModel),
    system: "You are a helpful assistant.",
    messages: convertToModelMessages(messages),
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
