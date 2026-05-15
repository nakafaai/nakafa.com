import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { routing } from "@repo/internationalization/src/routing";
import * as z from "zod";
import { NakafaMcpContentRefInputSchema } from "@/lib/mcp/schemas";

const LocaleSchema = z.enum(routing.locales);

/** Registers reusable Nakafa prompts for agent clients. */
export function registerNakafaMcpPrompts(server: McpServer) {
  registerFindLessonPrompt(server);
  registerAnswerFromContentPrompt(server);
  registerExplainExercisePrompt(server);
  registerQuranReferencePrompt(server);
}

/** Registers a prompt for finding relevant Nakafa lessons. */
function registerFindLessonPrompt(server: McpServer) {
  server.registerPrompt(
    "nakafa_find_lesson",
    {
      argsSchema: {
        locale: LocaleSchema.default(routing.defaultLocale).describe(
          "Preferred content locale."
        ),
        query: z
          .string()
          .min(1)
          .describe("Learning topic or question to search."),
      },
      description:
        "Guide an agent to search Nakafa lessons and choose the most relevant public content.",
      title: "Find Nakafa Lesson",
    },
    ({ locale, query }) => ({
      messages: [
        {
          content: {
            text: [
              `Find Nakafa learning content for: ${query}`,
              `Preferred locale: ${locale}`,
              "Use `nakafa_search_content`, inspect returned summaries, then cite the best canonical URL.",
            ].join("\n"),
            type: "text",
          },
          role: "user",
        },
      ],
    })
  );
}

/** Registers a prompt for grounded answers from one Nakafa content item. */
function registerAnswerFromContentPrompt(server: McpServer) {
  server.registerPrompt(
    "nakafa_answer_from_content",
    {
      argsSchema: {
        content_ref: NakafaMcpContentRefInputSchema,
        question: z
          .string()
          .min(1)
          .describe("User question that must be answered from the content."),
      },
      description:
        "Guide an agent to answer a question using one retrieved Nakafa content item.",
      title: "Answer From Nakafa Content",
    },
    ({ content_ref, question }) => ({
      messages: [
        {
          content: {
            text: [
              `Answer this question from Nakafa content: ${question}`,
              `Content reference: ${content_ref}`,
              "Use `nakafa_get_content`, answer only from the returned markdown, and cite the canonical URL.",
            ].join("\n"),
            type: "text",
          },
          role: "user",
        },
      ],
    })
  );
}

/** Registers a prompt for explaining one Nakafa exercise. */
function registerExplainExercisePrompt(server: McpServer) {
  server.registerPrompt(
    "nakafa_explain_exercise",
    {
      argsSchema: {
        content_ref: NakafaMcpContentRefInputSchema,
        exercise_number: z
          .string()
          .optional()
          .describe(
            "Optional exercise number when the content ID points to a set."
          ),
      },
      description:
        "Guide an agent to explain a Nakafa exercise from its structured question, choices, answer, and explanation.",
      title: "Explain Nakafa Exercise",
    },
    ({ content_ref, exercise_number }) => ({
      messages: [
        {
          content: {
            text: [
              "Explain this Nakafa exercise step by step.",
              `Content reference: ${content_ref}`,
              `Exercise number: ${exercise_number ?? "use the question in the content ID"}`,
              "Use `nakafa_get_exercise`, preserve the published answer, and cite the canonical URL.",
            ].join("\n"),
            type: "text",
          },
          role: "user",
        },
      ],
    })
  );
}

/** Registers a prompt for Quran reference lookups. */
function registerQuranReferencePrompt(server: McpServer) {
  server.registerPrompt(
    "nakafa_quran_reference",
    {
      argsSchema: {
        from_verse: z
          .string()
          .default("1")
          .describe("First verse number to include."),
        locale: LocaleSchema.default(routing.defaultLocale).describe(
          "Translation locale."
        ),
        question: z
          .string()
          .optional()
          .describe("Optional user question about the Quran reference."),
        surah: z.string().min(1).describe("Surah number."),
        to_verse: z
          .string()
          .optional()
          .describe("Optional last verse number to include."),
      },
      description:
        "Guide an agent to retrieve Quran verses from Nakafa with translation and citation.",
      title: "Nakafa Quran Reference",
    },
    ({ from_verse, locale, question, surah, to_verse }) => ({
      messages: [
        {
          content: {
            text: [
              `Retrieve Quran reference Surah ${surah}, verses ${from_verse}${to_verse ? `-${to_verse}` : ""}.`,
              `Locale: ${locale}`,
              question
                ? `Question: ${question}`
                : "Summarize the returned reference briefly.",
              "Use `nakafa_get_quran_reference` and cite the canonical Nakafa URL.",
            ].join("\n"),
            type: "text",
          },
          role: "user",
        },
      ],
    })
  );
}
