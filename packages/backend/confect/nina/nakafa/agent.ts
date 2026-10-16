import { Agent, createTool, type UsageHandler } from "@convex-dev/agent";
import { researchMaxSources } from "@repo/backend/client/nina/research";
import { components } from "@repo/backend/confect/_generated/components";
import {
  ActionCtx,
  type QueryRunner,
  type VectorSearch,
} from "@repo/backend/confect/_generated/services";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { limitDeadline } from "@repo/backend/confect/nina/capability/deadline";
import {
  type CapabilityProgress,
  specialistResult,
} from "@repo/backend/confect/nina/capability/progress";
import type { NakafaAgentData } from "@repo/backend/confect/nina/contract/agent";
import { NinaReadOptionsSchema } from "@repo/backend/confect/nina/contract/data";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import { textOutputSchema } from "@repo/backend/confect/nina/contract/tools";
import type { UsageAgent } from "@repo/backend/confect/nina/contract/usage";
import {
  nakafaQuran,
  nakafaRead,
  nakafaSearch,
  nakafaTaxonomy,
} from "@repo/backend/confect/nina/nakafa/descriptions";
import { makeNakafaGenerationError } from "@repo/backend/confect/nina/nakafa/error";
import { nakafaAgentPrompt } from "@repo/backend/confect/nina/nakafa/prompt";
import {
  prepareAddressStep,
  prepareAnswerFromNakafaEvidenceStep,
  prepareReadStep,
  prepareTaxonomyAnswerStep,
  readSearchFollowup,
} from "@repo/backend/confect/nina/nakafa/step";
import { quran } from "@repo/backend/confect/nina/nakafa/tools/quran";
import { read } from "@repo/backend/confect/nina/nakafa/tools/read";
import { search } from "@repo/backend/confect/nina/nakafa/tools/search";
import { taxonomy } from "@repo/backend/confect/nina/nakafa/tools/taxonomy";
import { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/agent/schema/quran/input";
import { NakafaAgentSearchOptionsSchema } from "@repo/contents/agent/schema/search";
import { NakafaAgentTaxonomyOptionsSchema } from "@repo/contents/agent/schema/taxonomy";
import { isStepCount } from "ai";
import { Array as Arr, Effect, pipe } from "effect";

const nakafaSearchInputSchema = createEffectSchema(
  NakafaAgentSearchOptionsSchema
);
const nakafaReadInputSchema = createEffectSchema(NinaReadOptionsSchema);
const nakafaQuranInputSchema = createEffectSchema(
  NakafaAgentQuranReferenceOptionsSchema
);
const nakafaTaxonomyInputSchema = createEffectSchema(
  NakafaAgentTaxonomyOptionsSchema
);

/**
 * Links to Nakafa's own site that one request may ask to read: as many as the
 * outside sources that research may read, so the limit the learner is told
 * holds for both. A page is read in full, so the number bounds the evidence
 * the specialist holds.
 */
const MAX_ADDRESSES = researchMaxSources;

/**
 * Runs the Nakafa agent through MCP-equivalent content tools, within the time
 * the capability has left. It reads the links to Nakafa's own site that the
 * learner sent before anything else, so the answer rests on those pages, and
 * it reads none of them when the learner sent more than it may read. Nothing
 * is omitted silently.
 */
export const runNakafaAgent = Effect.fn("nakafa.runNakafaAgent")(function* ({
  userId,
  task,
  addresses,
  publish,
  usageHandler,
  locale,
  context,
}: NakafaAgentData & {
  readonly publish: CapabilityProgress;
  readonly usageHandler: UsageHandler;
}) {
  if (addresses.length > MAX_ADDRESSES) {
    return {
      outcome: "limit" as const,
      text: `No pages were read. Ask the learner to send at most ${MAX_ADDRESSES} links to Nakafa pages per request. Do not silently omit their links or start another Nakafa call for this request.`,
    };
  }
  const ctx = yield* ActionCtx;
  const { model, timeout } = (yield* Gateway).language("specialist");
  const agent = new Agent(components.nina, {
    name: "nakafa" satisfies UsageAgent,
    languageModel: model,
    usageHandler,
  });
  const services = yield* Effect.context<
    Gateway | QueryRunner | VectorSearch
  >();
  const runPromise = Effect.runPromiseWith(services);
  const limit = yield* limitDeadline(timeout);
  let hasPendingContentRead = false;
  const result = yield* Effect.tryPromise({
    /** Runs the AI SDK Nakafa specialist loop with MCP-equivalent tools. */
    try: (signal) =>
      agent.generateText(
        ctx,
        { userId },
        {
          abortSignal: signal,
          model,
          instructions: nakafaAgentPrompt({ locale, context }),
          messages: [{ role: "user", content: task }],
          tools: {
            search: createTool({
              description: nakafaSearch,
              inputSchema: nakafaSearchInputSchema,
              outputSchema: textOutputSchema,
              /** Runs content search and records whether the next step should read. */
              execute: (_context, input, { toolCallId, abortSignal }) =>
                runPromise(
                  search({ input, locale, toolCallId, publish }).pipe(
                    Effect.tap((output) =>
                      Effect.sync(() => {
                        const followup = readSearchFollowup(
                          input,
                          output.result
                        );

                        hasPendingContentRead =
                          hasPendingContentRead || followup.shouldReadContent;
                      })
                    ),
                    Effect.map((output) => output.text)
                  ),
                  { signal: abortSignal }
                ),
            }),
            read: createTool({
              description: nakafaRead,
              inputSchema: nakafaReadInputSchema,
              outputSchema: textOutputSchema,
              /** Reads a selected content reference through the injected service. */
              execute: (_context, input, { toolCallId, abortSignal }) => {
                hasPendingContentRead = false;

                return runPromise(read({ input, toolCallId, publish }), {
                  signal: abortSignal,
                });
              },
            }),
            quran: createTool({
              description: nakafaQuran,
              inputSchema: nakafaQuranInputSchema,
              outputSchema: textOutputSchema,
              /** Reads Quran references through the injected Nakafa service. */
              execute: (_context, input, { toolCallId, abortSignal }) =>
                runPromise(quran({ input, locale, toolCallId, publish }), {
                  signal: abortSignal,
                }),
            }),
            taxonomy: createTool({
              description: nakafaTaxonomy,
              inputSchema: nakafaTaxonomyInputSchema,
              outputSchema: textOutputSchema,
              /** Lists content taxonomy through the injected Nakafa service. */
              execute: (_context, input, { toolCallId, abortSignal }) =>
                runPromise(taxonomy({ input, locale, toolCallId, publish }), {
                  signal: abortSignal,
                }),
            }),
          },
          /**
           * Reference: AI SDK `prepareStep` supports per-step `toolChoice`,
           * `activeTools`, and message overrides.
           * https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
           */
          prepareStep: ({ messages, steps }) => {
            const addressStep = prepareAddressStep(addresses, messages, steps);

            if (addressStep) {
              return addressStep;
            }

            const hasReadToolCall = Arr.some(steps, (step) =>
              Arr.some(
                step.toolCalls,
                (toolCall) => toolCall.toolName === "read"
              )
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

            const taxonomyAnswerStep = prepareTaxonomyAnswerStep(
              messages,
              steps
            );

            if (taxonomyAnswerStep) {
              return taxonomyAnswerStep;
            }

            return prepareAnswerFromNakafaEvidenceStep(messages, steps);
          },
          stopWhen: isStepCount(10),
          timeout: limit,
        }
      ),
    catch: makeNakafaGenerationError,
  });

  return specialistResult(
    pipe(
      result.steps,
      Arr.flatMap((step) =>
        Arr.map(step.toolResults, (toolResult) => String(toolResult.output))
      ),
      Arr.join("\n\n")
    ) || result.text,
    result.finishReason
  );
});
