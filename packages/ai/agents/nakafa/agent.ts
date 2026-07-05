import {
  nakafaQuran,
  nakafaRead,
  nakafaSearch,
  nakafaTaxonomy,
} from "@repo/ai/agents/nakafa/descriptions";
import { nakafaAgentPrompt } from "@repo/ai/agents/nakafa/prompt";
import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import {
  prepareAnswerFromNakafaEvidenceStep,
  prepareReadStep,
  prepareTaxonomyAnswerStep,
  readSearchFollowup,
} from "@repo/ai/agents/nakafa/step";
import { quran } from "@repo/ai/agents/nakafa/tools/quran";
import { read } from "@repo/ai/agents/nakafa/tools/read";
import { search } from "@repo/ai/agents/nakafa/tools/search";
import { taxonomy } from "@repo/ai/agents/nakafa/tools/taxonomy";
import { provider } from "@repo/ai/config/app";
import { getFastModelProviderOptions } from "@repo/ai/config/model";
import { gatewayProviderOptions } from "@repo/ai/config/routing";
import { subAgentGenerationTimeout } from "@repo/ai/config/timeouts";
import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import { textOutputSchema } from "@repo/ai/schema/tools";
import type { NakafaAgentParams } from "@repo/ai/types/agents";
import { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/_lib/agent/schema/quran";
import { NakafaAgentReadOptionsSchema } from "@repo/contents/_lib/agent/schema/read";
import { NakafaAgentSearchOptionsSchema } from "@repo/contents/_lib/agent/schema/search";
import { NakafaAgentTaxonomyOptionsSchema } from "@repo/contents/_lib/agent/schema/taxonomy";
import { generateText, isStepCount, tool } from "ai";
import { Effect } from "effect";

const nakafaSearchInputSchema = createEffectSchema(
  NakafaAgentSearchOptionsSchema
);
const nakafaReadInputSchema = createEffectSchema(NakafaAgentReadOptionsSchema);
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
  nakafa,
}: NakafaAgentParams) {
  const searchService = yield* NakafaSearch;
  let hasPendingContentRead = false;
  const result = yield* Effect.tryPromise({
    /** Runs the AI SDK Nakafa specialist loop with MCP-equivalent tools. */
    try: () =>
      generateText({
        model: provider.languageModel(modelId),
        providerOptions: {
          gateway: gatewayProviderOptions,
          google: getFastModelProviderOptions(modelId),
        },
        instructions: nakafaAgentPrompt({ locale, context }),
        messages: [{ role: "user", content: task }],
        temperature: 0,
        tools: {
          search: tool({
            description: nakafaSearch,
            inputSchema: nakafaSearchInputSchema,
            outputSchema: textOutputSchema,
            /** Runs content search and records whether the next step should read. */
            execute: (input, { toolCallId }) =>
              Effect.runPromise(
                search({ input, locale, toolCallId, writer }).pipe(
                  Effect.provideService(NakafaSearch, searchService),
                  Effect.tap((output) =>
                    Effect.sync(() => {
                      const followup = readSearchFollowup(input, output.result);

                      hasPendingContentRead =
                        hasPendingContentRead || followup.shouldReadContent;
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
            /** Reads a selected content reference through the injected service. */
            execute: (input, { toolCallId }) => {
              hasPendingContentRead = false;

              return Effect.runPromise(
                read({ input, toolCallId, writer }).pipe(provideNakafa(nakafa))
              );
            },
          }),
          quran: tool({
            description: nakafaQuran,
            inputSchema: nakafaQuranInputSchema,
            outputSchema: textOutputSchema,
            /** Reads Quran references through the injected Nakafa service. */
            execute: (input, { toolCallId }) =>
              Effect.runPromise(
                quran({ input, locale, toolCallId, writer }).pipe(
                  provideNakafa(nakafa)
                )
              ),
          }),
          taxonomy: tool({
            description: nakafaTaxonomy,
            inputSchema: nakafaTaxonomyInputSchema,
            outputSchema: textOutputSchema,
            /** Lists content taxonomy through the injected Nakafa service. */
            execute: (input, { toolCallId }) =>
              Effect.runPromise(
                taxonomy({ input, locale, toolCallId, writer }).pipe(
                  provideNakafa(nakafa)
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
          const hasReadToolCall = steps.some((step) =>
            step.toolCalls.some((toolCall) => toolCall.toolName === "read")
          );

          if (hasReadToolCall) {
            hasPendingContentRead = false;
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
        stopWhen: isStepCount(10),
        timeout: subAgentGenerationTimeout,
      }),
    catch: (error) => error,
  });

  return {
    text:
      result.steps
        .flatMap((step) =>
          step.toolResults.map((toolResult) => toolResult.output)
        )
        .join("\n\n") || result.text,
    usage: result.usage,
  };
});

/** Provides the app-owned Convex-backed Nakafa runtime service. */
function provideNakafa(service: Nakafa) {
  return Effect.provideService(Nakafa, service);
}
