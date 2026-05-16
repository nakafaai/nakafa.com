import {
  nakafaExercise,
  nakafaQuran,
  nakafaRead,
  nakafaSearch,
  nakafaTaxonomy,
} from "@repo/ai/agents/nakafa/descriptions";
import { nakafaAgentPrompt } from "@repo/ai/agents/nakafa/prompt";
import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import {
  prepareAnswerFromNakafaEvidenceStep,
  prepareExerciseStep,
  prepareReadStep,
  prepareTaxonomyAnswerStep,
  selectExerciseRef,
  shouldReadAfterSearch,
} from "@repo/ai/agents/nakafa/step";
import { exercise } from "@repo/ai/agents/nakafa/tools/exercise";
import { quran } from "@repo/ai/agents/nakafa/tools/quran";
import { read } from "@repo/ai/agents/nakafa/tools/read";
import { search } from "@repo/ai/agents/nakafa/tools/search";
import { taxonomy } from "@repo/ai/agents/nakafa/tools/taxonomy";
import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import { getModelProviderOptions } from "@repo/ai/config/models";
import { model } from "@repo/ai/config/vercel";
import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import { textOutputSchema } from "@repo/ai/schema/tools";
import type { NakafaAgentParams } from "@repo/ai/types/agents";
import { NakafaAgentExerciseOptionsSchema } from "@repo/contents/_lib/agent/schema/exercise";
import { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/_lib/agent/schema/quran";
import { NakafaAgentReadOptionsSchema } from "@repo/contents/_lib/agent/schema/read";
import { NakafaAgentSearchOptionsSchema } from "@repo/contents/_lib/agent/schema/search";
import { NakafaAgentTaxonomyOptionsSchema } from "@repo/contents/_lib/agent/schema/taxonomy";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import { generateText, stepCountIs, tool } from "ai";
import { Effect, Option } from "effect";

const nakafaSearchInputSchema = createEffectSchema(
  NakafaAgentSearchOptionsSchema
);
const nakafaReadInputSchema = createEffectSchema(NakafaAgentReadOptionsSchema);
const nakafaExerciseInputSchema = createEffectSchema(
  NakafaAgentExerciseOptionsSchema
);
const nakafaQuranInputSchema = createEffectSchema(
  NakafaAgentQuranReferenceOptionsSchema
);
const nakafaTaxonomyInputSchema = createEffectSchema(
  NakafaAgentTaxonomyOptionsSchema
);

/** Runs the Nakafa agent through MCP-equivalent content tools. */
export const runNakafaAgent = Effect.fn("nakafa.runNakafaAgent")(function* ({
  task,
  writer,
  modelId,
  locale,
  context,
}: NakafaAgentParams) {
  const searchService = yield* NakafaSearch;
  let pendingExerciseRef = Option.none<string>();
  let hasPendingContentRead = false;
  const result = yield* Effect.tryPromise(() =>
    generateText({
      model: model.languageModel(modelId),
      providerOptions: {
        gateway: gatewayProviderOptions,
        google: getModelProviderOptions(modelId),
      },
      system: nakafaAgentPrompt({ locale, context }),
      messages: [{ role: "user", content: task }],
      temperature: 0,
      tools: {
        search: tool({
          description: nakafaSearch,
          inputSchema: nakafaSearchInputSchema,
          outputSchema: textOutputSchema,
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              search({ input, locale, toolCallId, writer }).pipe(
                Effect.provideService(NakafaSearch, searchService),
                Effect.tap((output) =>
                  Effect.sync(() => {
                    if (input.section !== "exercises") {
                      hasPendingContentRead =
                        hasPendingContentRead ||
                        shouldReadAfterSearch(input, output.result);
                      return;
                    }

                    pendingExerciseRef = selectExerciseRef(
                      input,
                      output.result
                    );
                  })
                ),
                Effect.map((output) => output.text)
              )
            ),
        }),
        read: tool({
          description: nakafaRead,
          inputSchema: nakafaReadInputSchema,
          outputSchema: textOutputSchema,
          execute: (input, { toolCallId }) => {
            hasPendingContentRead = false;

            return Effect.runPromise(
              read({ input, toolCallId, writer }).pipe(
                Effect.provide(Nakafa.Default)
              )
            );
          },
        }),
        exercise: tool({
          description: nakafaExercise,
          inputSchema: nakafaExerciseInputSchema,
          outputSchema: textOutputSchema,
          execute: (input, { toolCallId }) => {
            pendingExerciseRef = Option.none();

            return Effect.runPromise(
              exercise({ input, toolCallId, writer }).pipe(
                Effect.provide(Nakafa.Default)
              )
            );
          },
        }),
        quran: tool({
          description: nakafaQuran,
          inputSchema: nakafaQuranInputSchema,
          outputSchema: textOutputSchema,
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              quran({ input, locale, toolCallId, writer }).pipe(
                Effect.provide(Nakafa.Default)
              )
            ),
        }),
        taxonomy: tool({
          description: nakafaTaxonomy,
          inputSchema: nakafaTaxonomyInputSchema,
          outputSchema: textOutputSchema,
          execute: (input, { toolCallId }) =>
            Effect.runPromise(
              taxonomy({ input, locale, toolCallId, writer }).pipe(
                Effect.provide(Nakafa.Default)
              )
            ),
        }),
      },
      /**
       * Reference: AI SDK `prepareStep` supports per-step `toolChoice`,
       * `activeTools`, and message overrides.
       * https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
       */
      prepareStep: ({ messages, steps }) => {
        const hasExerciseToolCall = steps.some((step) =>
          step.toolCalls.some((toolCall) => toolCall.toolName === "exercise")
        );
        const hasReadToolCall = steps.some((step) =>
          step.toolCalls.some((toolCall) => toolCall.toolName === "read")
        );

        if (hasExerciseToolCall) {
          pendingExerciseRef = Option.none();
        }

        if (hasReadToolCall) {
          hasPendingContentRead = false;
        }

        const exerciseStep = prepareExerciseStep(
          pendingExerciseRef,
          messages,
          hasExerciseToolCall
        );

        if (exerciseStep) {
          return exerciseStep;
        }

        const readStep = prepareReadStep(
          hasPendingContentRead,
          messages,
          hasReadToolCall
        );

        if (readStep) {
          return readStep;
        }

        const taxonomyAnswerStep = prepareTaxonomyAnswerStep(messages, steps);

        if (taxonomyAnswerStep) {
          return taxonomyAnswerStep;
        }

        return prepareAnswerFromNakafaEvidenceStep(messages, steps);
      },
      stopWhen: stepCountIs(10),
    })
  );

  return {
    text:
      result.steps
        .flatMap((step) =>
          step.toolResults.map((toolResult) => toolResult.output)
        )
        .join("\n\n") || result.text,
    usage: result.totalUsage,
  };
});
