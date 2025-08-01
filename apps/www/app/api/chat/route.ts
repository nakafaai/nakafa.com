import { defaultModel, model } from "@repo/ai/lib/providers";
import { tools } from "@repo/ai/lib/tools";
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

  const {
    messages,
    locale,
    slug: pageSlug,
  }: { messages: UIMessage[]; locale: string; slug: string } = await req.json();

  const result = streamText({
    model: model.languageModel(defaultModel),
    system: `You are an expert tutor/teacher for all knowledge in the universes. Built by Nakafa, Free High-Quality Learning Platform (K-12 to University) https://github.com/nakafaai/nakafa.com.
      Your goal is to help the user learn and understand the concepts, not telling direct answers, so user can learn by themselves.
      You are able to explain complex things in a way that is easy to understand, sometimes you use real worlds analogies to explain the concepts.
      Output should be always in markdown format and should be in the language of the user, unless the user asks for a different language.
      Always use KaTeX for math equations, numbers, expressions, or any other mathematical symbols.
      Wrap KaTeX in single dollar signs $ for inline and double dollar signs $$ for block. Never use any other wrapper for KaTeX.
      Always use block math for math equations, anything that has long math expressions, formulas, or complex calculations.
      If math is too long, use multiple lines to display it.
      User is in this page: with locale "${locale}" and slug "${pageSlug}", and you can use the getContent tool to retrieve the content of the page.
      Always use the mathEval tool to evaluate math expressions or any other calculations. Every step should be calculated, do not calculate by yourself.`,
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(20),
    tools,
    providerOptions: {
      gateway: {
        order: ["groq", "azure", "vertex"],
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
