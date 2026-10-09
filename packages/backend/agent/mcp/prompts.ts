import {
  ACTIVE_APP_LOCALE_CODES,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/agent/schema/read";
import { Array as Arr, Context, Effect, Schema } from "effect";
import { McpSchema, McpServer } from "effect/ai";

const NonEmptyPromptStringSchema = Schema.Trim.pipe(
  Schema.check(Schema.isMinLength(1))
);
const FindLessonPromptArgsSchema = Schema.Struct({
  locale: ActiveAppLocaleCodeSchema.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(ACTIVE_APP_LOCALE_CODES[0]))
  ),
  topic: NonEmptyPromptStringSchema,
});
const AnswerFromContentPromptArgsSchema = Schema.Struct({
  content_ref: NakafaAgentContentRefInputSchema,
  question: NonEmptyPromptStringSchema,
});
const QuranReferencePromptArgsSchema = Schema.Struct({
  from_verse: NonEmptyPromptStringSchema.pipe(
    Schema.withDecodingDefaultType(Effect.succeed("1"))
  ),
  locale: ActiveAppLocaleCodeSchema.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(ACTIVE_APP_LOCALE_CODES[0]))
  ),
  question: Schema.optional(NonEmptyPromptStringSchema),
  surah: NonEmptyPromptStringSchema,
  to_verse: Schema.optional(NonEmptyPromptStringSchema),
});

/** Registers the three established read-only Nakafa workflow prompts. */
export const registerNakafaMcpPrompts = Effect.fn(
  "agent.mcp.registerNakafaMcpPrompts"
)(function* () {
  const server = yield* McpServer.McpServer;
  yield* server.addPrompt({
    annotations: Context.empty(),
    completions: {},
    handle: getFindLessonPrompt,
    prompt: McpSchema.Prompt.make({
      arguments: [
        { name: "locale", required: false },
        { name: "topic", required: true },
      ],
      description:
        "Guide an agent to search Nakafa lessons and choose relevant public content.",
      name: "nakafa_find_lesson",
      title: "Find Nakafa Lesson",
    }),
  });
  yield* server.addPrompt({
    annotations: Context.empty(),
    completions: {},
    handle: getAnswerFromContentPrompt,
    prompt: McpSchema.Prompt.make({
      arguments: [
        { name: "content_ref", required: true },
        { name: "question", required: true },
      ],
      description:
        "Guide an agent to answer a question from one retrieved Nakafa content item.",
      name: "nakafa_answer_from_content",
      title: "Answer From Nakafa Content",
    }),
  });
  yield* server.addPrompt({
    annotations: Context.empty(),
    completions: {},
    handle: getQuranReferencePrompt,
    prompt: McpSchema.Prompt.make({
      arguments: [
        { name: "from_verse", required: false },
        { name: "locale", required: false },
        { name: "question", required: false },
        { name: "surah", required: true },
        { name: "to_verse", required: false },
      ],
      description:
        "Guide an agent to retrieve Quran verses with translation and citation.",
      name: "nakafa_quran_reference",
      title: "Nakafa Quran Reference",
    }),
  });
});

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

function promptResult(lines: readonly string[]) {
  return McpSchema.GetPromptResult.make({
    messages: [
      {
        content: {
          text: Arr.join(lines, "\n"),
          type: "text",
        },
        role: "user",
      },
    ],
  });
}

function decodePromptArguments<
  TSchema extends Schema.ConstraintDecoder<unknown, never>,
>(schema: TSchema, input: unknown, promptName: string) {
  return Schema.decodeUnknownEffect(schema, {
    onExcessProperty: "error",
  })(input).pipe(
    Effect.mapError((cause) =>
      McpSchema.InvalidParams.make({
        message: `Invalid arguments for prompt ${promptName}: ${cause.message}`,
      })
    )
  );
}
