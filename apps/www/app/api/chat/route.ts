import { defaultModel, Model } from "@repo/ai/lib/providers";
import { api } from "@repo/connection/routes";
import { convertToModelMessages, streamText, tool, type UIMessage } from "ai";
import { getTranslations } from "next-intl/server";
import { env } from "@/env";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const model = new Model({ apiKey: env.AI_GATEWAY_API_KEY });

export async function POST(req: Request) {
  const t = await getTranslations("Ai");

  const { messages, slug }: { messages: UIMessage[]; slug: string } =
    await req.json();

  const result = streamText({
    model: model.languageModel(defaultModel),
    system:
      "You are an expert tutor for all knowledge in the universes. Built by Nakafa. Able to explain complex things in a way that is easy to understand.",
    messages: convertToModelMessages(messages),
    toolChoice: "required",
    tools: {
      getContent: tool({
        description:
          "Retrieve a specific content from Nakafa platform. Returns the mdx of the content.",
        execute: async () => {
          const { data } = await api.contents.getContent({ slug });
          return data;
        },
      }),
    },
    providerOptions: {
      gateway: {
        order: ["groq"],
      },
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    onError: (error) => {
      if (error instanceof Error && error.message.includes("Rate limit")) {
        return t("rate-limit-message");
      }
      return t("error-message");
    },
  });
}
