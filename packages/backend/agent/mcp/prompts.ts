import {
  type GetPromptResult,
  INVALID_PARAMS,
  type McpServer,
  ProtocolError,
} from "@modelcontextprotocol/server";
import {
  ACTIVE_APP_LOCALE_CODES,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { toMcpSchema } from "@repo/backend/agent/mcp/schema";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import { Effect, Schema, Struct } from "effect";

const NonEmptyPromptStringSchema = Schema.Trim.pipe(
  Schema.check(Schema.isMinLength(1))
);
const FindLessonPromptArgsSchema = Schema.Struct({
  locale: ActiveAppLocaleCodeSchema.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(ACTIVE_APP_LOCALE_CODES[0]))
  ).annotate({ description: "Preferred content locale." }),
  topic: NonEmptyPromptStringSchema.annotate({
    description: "Learning topic or question to search.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const AnswerFromContentPromptArgsSchema = Schema.Struct({
  content_ref: NakafaAgentContentRefInputSchema,
  question: NonEmptyPromptStringSchema.annotate({
    description: "Question that must be answered from the content.",
  }),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const QuranReferencePromptArgsSchema = Schema.Struct({
  from_verse: NonEmptyPromptStringSchema.pipe(
    Schema.withDecodingDefaultType(Effect.succeed("1"))
  ).annotate({ description: "First verse number to include." }),
  locale: ActiveAppLocaleCodeSchema.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(ACTIVE_APP_LOCALE_CODES[0]))
  ).annotate({ description: "Translation locale." }),
  question: Schema.optional(
    NonEmptyPromptStringSchema.annotate({
      description: "Optional question about the Quran reference.",
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

/** Registers the three established read-only Nakafa workflow prompts. */
export function registerNakafaMcpPrompts(server: McpServer) {
  server.registerPrompt(
    "nakafa_find_lesson",
    {
      argsSchema: toMcpSchema(FindLessonPromptArgsSchema),
      description:
        "Guide an agent to search Nakafa lessons and choose relevant public content.",
      title: "Find Nakafa Lesson",
    },
    (input) => Effect.runPromise(getFindLessonPrompt(input))
  );
  server.registerPrompt(
    "nakafa_answer_from_content",
    {
      argsSchema: toMcpSchema(AnswerFromContentPromptArgsSchema),
      description:
        "Guide an agent to answer a question from one retrieved Nakafa content item.",
      title: "Answer From Nakafa Content",
    },
    (input) => Effect.runPromise(getAnswerFromContentPrompt(input))
  );
  server.registerPrompt(
    "nakafa_quran_reference",
    {
      argsSchema: toMcpSchema(QuranReferencePromptArgsSchema),
      description:
        "Guide an agent to retrieve Quran verses with translation and citation.",
      title: "Nakafa Quran Reference",
    },
    (input) => Effect.runPromise(getQuranReferencePrompt(input))
  );
}

const getFindLessonPrompt = Effect.fn("agent.mcp.getFindLessonPrompt")(
  function* (input: unknown) {
    const { locale, topic } = yield* decodePromptArguments(
      FindLessonPromptArgsSchema,
      input,
      "nakafa_find_lesson"
    );
    return promptResult([
      `Find Nakafa learning content for: ${topic}`,
      `Preferred locale: ${locale}`,
      "Use `nakafa_search_content`, inspect returned summaries, then cite the best canonical URL.",
    ]);
  }
);

const getAnswerFromContentPrompt = Effect.fn(
  "agent.mcp.getAnswerFromContentPrompt"
)(function* (input: unknown) {
  const { content_ref: contentRef, question } = yield* decodePromptArguments(
    AnswerFromContentPromptArgsSchema,
    input,
    "nakafa_answer_from_content"
  );
  return promptResult([
    `Answer this question from Nakafa content: ${question}`,
    `Content reference: ${contentRef}`,
    "Use `nakafa_get_content`, answer only from the returned Markdown, and cite the canonical URL.",
  ]);
});

const getQuranReferencePrompt = Effect.fn("agent.mcp.getQuranReferencePrompt")(
  function* (input: unknown) {
    const { from_verse, locale, question, surah, to_verse } =
      yield* decodePromptArguments(
        QuranReferencePromptArgsSchema,
        input,
        "nakafa_quran_reference"
      );
    return promptResult([
      `Retrieve Quran reference Surah ${surah}, verses ${from_verse}${to_verse ? `-${to_verse}` : ""}.`,
      `Locale: ${locale}`,
      question
        ? `Question: ${question}`
        : "Summarize the returned reference briefly.",
      "Use `nakafa_get_quran_reference` and cite the canonical Nakafa URL.",
    ]);
  }
);

function promptResult(lines: readonly string[]): GetPromptResult {
  return {
    messages: [
      {
        content: { text: lines.join("\n"), type: "text" },
        role: "user",
      },
    ],
  };
}

function decodePromptArguments<
  TSchema extends Schema.ConstraintDecoder<unknown, never>,
>(schema: TSchema, input: unknown, promptName: string) {
  return Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(
    input
  ).pipe(
    Effect.mapError(
      (cause) =>
        new ProtocolError(
          INVALID_PARAMS,
          `Invalid arguments for prompt ${promptName}: ${cause.message}`
        )
    )
  );
}
