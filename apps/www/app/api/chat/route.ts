import { defaultModel, model } from "@repo/ai/lib/providers";
import { getContentTool } from "@repo/ai/lib/tools";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { getTranslations } from "next-intl/server";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const t = await getTranslations("Ai");

  const { messages, slug: pageSlug }: { messages: UIMessage[]; slug: string } =
    await req.json();

  const result = streamText({
    model: model.languageModel(defaultModel),
    system: `You are an expert tutor/teacher for all knowledge in the universes. Built by Nakafa. Able to explain complex things in a way that is easy to understand.
      User is in this page: "${pageSlug}", and you can use the getContent tool to retrieve the content of the page.
      Output should be always in markdown format and should be in the language of the user.`,
    messages: convertToModelMessages(messages),
    toolChoice: "required",
    stopWhen: stepCountIs(5),
    tools: {
      getContent: getContentTool,
    },
    providerOptions: {
      gateway: {
        order: ["groq", "azure"],
      },
    },
  });

  return result.toUIMessageStreamResponse({
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
  });
}
