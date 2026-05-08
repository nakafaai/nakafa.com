import {
  nakafaExercise,
  nakafaQuran,
  nakafaRead,
  nakafaSearch,
  nakafaTaxonomy,
} from "@repo/ai/agents/nakafa/descriptions";
import { nakafaAgentPrompt } from "@repo/ai/agents/nakafa/prompt";
import { exercise } from "@repo/ai/agents/nakafa/tools/exercise";
import { quran } from "@repo/ai/agents/nakafa/tools/quran";
import { read } from "@repo/ai/agents/nakafa/tools/read";
import { search } from "@repo/ai/agents/nakafa/tools/search";
import { taxonomy } from "@repo/ai/agents/nakafa/tools/taxonomy";
import { model } from "@repo/ai/config/vercel";
import type { NakafaAgentParams } from "@repo/ai/types/agents";
import {
  NakafaAgentExerciseOptionsSchema,
  NakafaAgentQuranReferenceOptionsSchema,
  NakafaAgentReadOptionsSchema,
  NakafaAgentSearchOptionsSchema,
  NakafaAgentTaxonomyOptionsSchema,
} from "@repo/contents/_lib/agent/schemas";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import { generateText, stepCountIs, tool } from "ai";
import { Effect } from "effect";
import * as z from "zod";

/** Runs the Nakafa agent through MCP-equivalent content tools. */
export const runNakafaAgent = Effect.fn("nakafa.runNakafaAgent")(function* ({
  task,
  writer,
  modelId,
  locale,
  context,
}: NakafaAgentParams) {
  const result = yield* Effect.tryPromise(() =>
    generateText({
      model: model.languageModel(modelId),
      system: nakafaAgentPrompt({ locale, context }),
      messages: [{ role: "user", content: task }],
      tools: {
        search: tool({
          description: nakafaSearch,
          inputSchema: NakafaAgentSearchOptionsSchema,
          outputSchema: z.string(),
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              search({ input, toolCallId, writer }).pipe(
                Effect.provide(Nakafa.Default)
              )
            ),
        }),
        read: tool({
          description: nakafaRead,
          inputSchema: NakafaAgentReadOptionsSchema,
          outputSchema: z.string(),
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              read({ input, toolCallId, writer }).pipe(
                Effect.provide(Nakafa.Default)
              )
            ),
        }),
        exercise: tool({
          description: nakafaExercise,
          inputSchema: NakafaAgentExerciseOptionsSchema,
          outputSchema: z.string(),
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              exercise({ input, toolCallId, writer }).pipe(
                Effect.provide(Nakafa.Default)
              )
            ),
        }),
        quran: tool({
          description: nakafaQuran,
          inputSchema: NakafaAgentQuranReferenceOptionsSchema,
          outputSchema: z.string(),
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              quran({ input, toolCallId, writer }).pipe(
                Effect.provide(Nakafa.Default)
              )
            ),
        }),
        taxonomy: tool({
          description: nakafaTaxonomy,
          inputSchema: NakafaAgentTaxonomyOptionsSchema,
          outputSchema: z.string(),
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              taxonomy({ input, toolCallId, writer }).pipe(
                Effect.provide(Nakafa.Default)
              )
            ),
        }),
      },
      stopWhen: stepCountIs(10),
    })
  );

  return {
    text: result.text,
    usage: result.totalUsage,
  };
});
