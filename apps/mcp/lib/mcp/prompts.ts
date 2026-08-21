import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ErrorCode,
  GetPromptRequestSchema,
  type GetPromptResult,
  ListPromptsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import { LocaleSchema } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import { Effect, Result, Schema, Struct } from "effect";
import { type NakafaMcpSchema, toMcpJsonObjectSchema } from "@/lib/mcp/effect";

const NonEmptyPromptStringSchema = Schema.Trim.pipe(
  Schema.check(Schema.isMinLength(1))
);
const MCP_PROMPT_PARSE_OPTIONS = {
  onExcessProperty: "error",
} as const;
const FindLessonPromptArgsSchema = Schema.Struct({
  locale: LocaleSchema.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(routing.defaultLocale))
  ).annotate({ description: "Preferred content locale." }),
  topic: NonEmptyPromptStringSchema.annotate({
    description: "Learning topic or question to search.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const AnswerFromContentPromptArgsSchema = Schema.Struct({
  content_ref: NakafaAgentContentRefInputSchema,
  question: NonEmptyPromptStringSchema.annotate({
    description: "User question that must be answered from the content.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const QuranReferencePromptArgsSchema = Schema.Struct({
  from_verse: NonEmptyPromptStringSchema.pipe(
    Schema.withDecodingDefaultType(Effect.succeed("1"))
  ).annotate({ description: "First verse number to include." }),
  locale: LocaleSchema.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(routing.defaultLocale))
  ).annotate({ description: "Translation locale." }),
  question: Schema.optional(
    NonEmptyPromptStringSchema.annotate({
      description: "Optional user question about the Quran reference.",
    })
  ),
  surah: NonEmptyPromptStringSchema.annotate({
    description: "Surah number.",
  }),
  to_verse: Schema.optional(
    NonEmptyPromptStringSchema.annotate({
      description: "Optional last verse number to include.",
    })
  ),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
interface NakafaMcpPrompt {
  readonly argsSchema: NakafaMcpSchema;
  readonly description: string;
  readonly get: (args: unknown) => GetPromptResult;
  readonly name: string;
  readonly title: string;
}
const NAKAFA_MCP_PROMPTS: readonly NakafaMcpPrompt[] = [
  {
    argsSchema: FindLessonPromptArgsSchema,
    description:
      "Guide an agent to search Nakafa lessons and choose the most relevant public content.",
    get: getFindLessonPrompt,
    name: "nakafa_find_lesson",
    title: "Find Nakafa Lesson",
  },
  {
    argsSchema: AnswerFromContentPromptArgsSchema,
    description:
      "Guide an agent to answer a question using one retrieved Nakafa content item.",
    get: getAnswerFromContentPrompt,
    name: "nakafa_answer_from_content",
    title: "Answer From Nakafa Content",
  },
  {
    argsSchema: QuranReferencePromptArgsSchema,
    description:
      "Guide an agent to retrieve Quran verses from Nakafa with translation and citation.",
    get: getQuranReferencePrompt,
    name: "nakafa_quran_reference",
    title: "Nakafa Quran Reference",
  },
];
/** Registers reusable Nakafa prompts through Effect Schema validation. */
export function registerNakafaMcpPrompts(server: McpServer) {
  const promptsByName = new Map(
    NAKAFA_MCP_PROMPTS.map((prompt) => [prompt.name, prompt])
  );
  server.server.registerCapabilities({
    prompts: {
      listChanged: true,
    },
  });
  server.server.setRequestHandler(ListPromptsRequestSchema, () => ({
    prompts: NAKAFA_MCP_PROMPTS.map(toMcpPromptDefinition),
  }));
  server.server.setRequestHandler(GetPromptRequestSchema, (request) => {
    const prompt = promptsByName.get(request.params.name);
    if (!prompt) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Prompt ${request.params.name} not found`
      );
    }
    return prompt.get(request.params.arguments ?? {});
  });
}
/** Converts one Effect-backed prompt into MCP prompt-list metadata. */
function toMcpPromptDefinition(prompt: NakafaMcpPrompt) {
  return {
    arguments: getPromptArguments(prompt.argsSchema),
    description: prompt.description,
    name: prompt.name,
    title: prompt.title,
  };
}
/** Builds a prompt for finding relevant Nakafa lessons. */
function getFindLessonPrompt(args: unknown) {
  const { locale, topic } = decodePromptArguments(
    FindLessonPromptArgsSchema,
    args,
    "nakafa_find_lesson"
  );
  return {
    messages: [
      {
        content: {
          text: [
            `Find Nakafa learning content for: ${topic}`,
            `Preferred locale: ${locale}`,
            "Use `nakafa_search_content`, inspect returned summaries, then cite the best canonical URL.",
          ].join("\n"),
          type: "text" as const,
        },
        role: "user" as const,
      },
    ],
  };
}
/** Builds a prompt for grounded answers from one Nakafa content item. */
function getAnswerFromContentPrompt(args: unknown) {
  const { content_ref, question } = decodePromptArguments(
    AnswerFromContentPromptArgsSchema,
    args,
    "nakafa_answer_from_content"
  );
  return {
    messages: [
      {
        content: {
          text: [
            `Answer this question from Nakafa content: ${question}`,
            `Content reference: ${content_ref}`,
            "Use `nakafa_get_content`, answer only from the returned markdown, and cite the canonical URL.",
          ].join("\n"),
          type: "text" as const,
        },
        role: "user" as const,
      },
    ],
  };
}
/** Builds a prompt for Quran reference lookups. */
function getQuranReferencePrompt(args: unknown) {
  const { from_verse, locale, question, surah, to_verse } =
    decodePromptArguments(
      QuranReferencePromptArgsSchema,
      args,
      "nakafa_quran_reference"
    );
  return {
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
          type: "text" as const,
        },
        role: "user" as const,
      },
    ],
  };
}
/** Decodes one prompt argument payload into the matching Effect schema type. */
function decodePromptArguments<TSchema extends NakafaMcpSchema>(
  schema: TSchema,
  args: unknown,
  promptName: string
) {
  const decoded = Schema.decodeUnknownResult(
    schema,
    MCP_PROMPT_PARSE_OPTIONS
  )(args);
  if (Result.isSuccess(decoded)) {
    return decoded.success;
  }
  throw new McpError(
    ErrorCode.InvalidParams,
    `Invalid arguments for prompt ${promptName}: ${decoded.failure.message}`
  );
}
/** Derives MCP prompt argument metadata from generated Effect JSON Schema. */
function getPromptArguments(schema: NakafaMcpSchema) {
  const jsonSchema = toMcpJsonObjectSchema(schema);
  const required = new Set(jsonSchema.required);
  return Object.entries(jsonSchema.properties).map(([name, property]) => ({
    description:
      typeof property.description === "string"
        ? property.description
        : undefined,
    name,
    required: required.has(name),
  }));
}
