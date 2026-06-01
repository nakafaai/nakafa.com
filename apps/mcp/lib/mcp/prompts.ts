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
import { Either, Schema } from "effect";
import { toMcpJsonObjectSchema } from "@/lib/mcp/effect";

const NonEmptyPromptStringSchema = Schema.Trim.pipe(Schema.minLength(1));
const MCP_PROMPT_PARSE_OPTIONS = {
  onExcessProperty: "error",
} as const;

const FindLessonPromptArgsSchema = Schema.Struct({
  locale: Schema.optionalWith(LocaleSchema, {
    default: () => routing.defaultLocale,
  }).annotations({ description: "Preferred content locale." }),
  topic: NonEmptyPromptStringSchema.annotations({
    description: "Learning topic or question to search.",
  }),
}).pipe(Schema.mutable);

const AnswerFromContentPromptArgsSchema = Schema.Struct({
  content_ref: NakafaAgentContentRefInputSchema,
  question: NonEmptyPromptStringSchema.annotations({
    description: "User question that must be answered from the content.",
  }),
}).pipe(Schema.mutable);

const ExplainExercisePromptArgsSchema = Schema.Struct({
  content_ref: NakafaAgentContentRefInputSchema,
  exercise_number: Schema.optional(
    NonEmptyPromptStringSchema.annotations({
      description:
        "Optional exercise number when the content ID points to a set.",
    })
  ),
}).pipe(Schema.mutable);

const QuranReferencePromptArgsSchema = Schema.Struct({
  from_verse: Schema.optionalWith(NonEmptyPromptStringSchema, {
    default: () => "1",
  }).annotations({ description: "First verse number to include." }),
  locale: Schema.optionalWith(LocaleSchema, {
    default: () => routing.defaultLocale,
  }).annotations({ description: "Translation locale." }),
  question: Schema.optional(
    NonEmptyPromptStringSchema.annotations({
      description: "Optional user question about the Quran reference.",
    })
  ),
  surah: NonEmptyPromptStringSchema.annotations({
    description: "Surah number.",
  }),
  to_verse: Schema.optional(
    NonEmptyPromptStringSchema.annotations({
      description: "Optional last verse number to include.",
    })
  ),
}).pipe(Schema.mutable);

interface NakafaMcpPrompt {
  readonly argsSchema: Schema.Schema.AnyNoContext;
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
    argsSchema: ExplainExercisePromptArgsSchema,
    description:
      "Guide an agent to explain a Nakafa exercise from its structured question, choices, answer, and explanation.",
    get: getExplainExercisePrompt,
    name: "nakafa_explain_exercise",
    title: "Explain Nakafa Exercise",
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

/** Builds a prompt for explaining one Nakafa exercise. */
function getExplainExercisePrompt(args: unknown) {
  const { content_ref, exercise_number } = decodePromptArguments(
    ExplainExercisePromptArgsSchema,
    args,
    "nakafa_explain_exercise"
  );

  return {
    messages: [
      {
        content: {
          text: [
            "Explain this Nakafa exercise step by step.",
            `Content reference: ${content_ref}`,
            `Exercise number: ${exercise_number ?? "use the question in the content ID"}`,
            "Use `nakafa_get_exercise`, preserve the published answer, and cite the canonical URL.",
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
function decodePromptArguments<TSchema extends Schema.Schema.AnyNoContext>(
  schema: TSchema,
  args: unknown,
  promptName: string
) {
  const decoded = Schema.decodeUnknownEither(
    schema,
    MCP_PROMPT_PARSE_OPTIONS
  )(args);

  if (Either.isRight(decoded)) {
    return decoded.right;
  }

  throw new McpError(
    ErrorCode.InvalidParams,
    `Invalid arguments for prompt ${promptName}: ${decoded.left.message}`
  );
}

/** Derives MCP prompt argument metadata from generated Effect JSON Schema. */
function getPromptArguments(schema: Schema.Schema.AnyNoContext) {
  const jsonSchema = toMcpJsonObjectSchema(schema);
  const required = new Set(jsonSchema.required);

  return Object.entries(jsonSchema.properties).map(([name, property]) => ({
    description: property.description,
    name,
    required: required.has(name),
  }));
}
