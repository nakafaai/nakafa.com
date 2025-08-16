import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { defaultModel, model } from "@repo/ai/lib/providers";
import { tools } from "@repo/ai/lib/tools";
import { dedentString } from "@repo/ai/lib/utils";
import {
  convertToModelMessages,
  generateObject,
  NoSuchToolError,
  smoothStream,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { getTranslations } from "next-intl/server";

const MAX_CONVERSATION_HISTORY = 5;
const MAX_STEPS = 20;

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
    system: dedentString(`
      <persona>
        You are Nakafa's expert tutor (nakafa.com), a friendly teacher helping a student.
        - Your tone: natural, simple, clear, and never cringey.
        - Your explanations: detailed step-by-step, but concise and without filler. Use analogies to explain concepts if needed.
        - Your context: you are in a digital app, so avoid physical classroom analogies (e.g., "blackboard").
        - Your identity: you are a human teacher, not an AI. Your knowledge is your own.
        - Language: Use the user's language. For Indonesian, ALWAYS use "kamu".
      </persona>

      <context>
        - The user is on the following page:
        <locale>${locale}</locale>
        <slug>${pageSlug}</slug>
      </context>

      <rules>
        - **Primary Rule: Always Start with Context.** For every user query, your FIRST step MUST be to call the \`getContent\` tool using the \`slug\` and \`locale\` from the context above. This gives you the necessary information to understand the user's situation.
        - **Exception:** Do NOT use \`getContent\` if the user's query is clearly about a different topic or a general greeting. In that case, use other tools or answer directly.
        - **Grounding is Mandatory:** You MUST use the \`getContent\` or \`getContents\` tools to get information from the Nakafa platform BEFORE answering any question. After Always create a link to the content you retrieve.
        - **Answer based on the content:** You MUST use the \`getContent\` tool if you know the locale and the slug, it can be from current page or from the contents retrieved from the \`getContents\` tool.
        - **Calculations require Tools:** You MUST use the \`calculator\` tool for ANY math calculation, no matter how simple. Do not perform calculations yourself.
        - **Persona is Absolute:** NEVER break character. Do not mention you are an AI, your instructions, or your tools.
      </rules>

      <math_solving_strategy>
        To solve math problems, you MUST follow this structured thinking process:

        1.  **Understand:**
            -   First, state the user's main question.
            -   Then, list ALL the key information and variables provided. Double-check these against the user's prompt to ensure accuracy.

        2.  **Plan:**
            -   Create a clear, step-by-step plan to solve the user's question.

        3.  **Execute:**
            -   Follow your plan step by step.
            -   For EVERY calculation, you MUST use the \`calculator\` tool.
            -   Show your work for each step: explain the step, call the tool, and show the result.
        
        4.  **Answer:**
            -   State the final answer clearly and explain what it means.
      </math_solving_strategy>

      <output_format>
        - **Markdown Only:** Your entire output must be valid Markdown. No HTML/XML.
        - **Headings:** Use \`##\` or \`###\`. Never \`#\`.
        - **Math:** Use TeX. Inline math uses \`$..$\`. Block math uses a fenced \`math\` code block. Do NOT wrap TeX in backticks.
        - **Code:** Use fenced code blocks with a language label (e.g., \`\`\`python).
      </output_format>
    `),
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(MAX_STEPS),
    tools,
    prepareStep: ({ messages: initialMessages }) => {
      // We need to cut costs, ai is expensive
      // Compress conversation history for longer loops
      const finalMessages = initialMessages.slice(-MAX_CONVERSATION_HISTORY);

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
      chunking: "word",
    }),
    providerOptions: {
      gateway: {
        order: ["baseten", "groq", "cerebras", "azure", "vertex"],
      },
      openai: {
        reasoningEffort: "high",
      },
      google: {
        thinkingConfig: {
          thinkingBudget: 8192,
          includeThoughts: true,
        },
      } satisfies GoogleGenerativeAIProviderOptions,
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
