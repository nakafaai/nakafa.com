import { Agent, createTool, type UsageHandler } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import {
  ActionCtx,
  type QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import type { CapabilityProgress } from "@repo/backend/confect/nina/capability/progress";
import type { TaskAgentData } from "@repo/backend/confect/nina/contract/agent";
import { NinaReadOptionsSchema } from "@repo/backend/confect/nina/contract/data";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import { textOutputSchema } from "@repo/backend/confect/nina/contract/tools";
import {
  nakafaQuran,
  nakafaRead,
  nakafaSearch,
  nakafaTaxonomy,
} from "@repo/backend/confect/nina/nakafa/descriptions";
import { makeNakafaGenerationError } from "@repo/backend/confect/nina/nakafa/error";
import { nakafaAgentPrompt } from "@repo/backend/confect/nina/nakafa/prompt";
import {
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

/** Runs the Nakafa agent through MCP-equivalent content tools. */
export const runNakafaAgent = Effect.fn("nakafa.runNakafaAgent")(function* ({
  userId,
  task,
  publish,
  usageHandler,
  modelId,
  locale,
  context,
}: TaskAgentData & {
  readonly publish: CapabilityProgress;
  readonly usageHandler: UsageHandler;
}) {
  const ctx = yield* ActionCtx;
  const { model, timeout } = (yield* Gateway).language({
    purpose: "specialist",
    model: modelId,
  });
  const agent = new Agent(components.nina, {
    name: "nakafa",
    languageModel: model,
    usageHandler,
  });
  const services = yield* Effect.context<QueryRunner>();
  const runPromise = Effect.runPromiseWith(services);
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
          temperature: 0,
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
          timeout,
        }
      ),
    catch: makeNakafaGenerationError,
  });

  return {
    text:
      pipe(
        result.steps,
        Arr.flatMap((step) =>
          Arr.map(step.toolResults, (toolResult) => String(toolResult.output))
        ),
        Arr.join("\n\n")
      ) || result.text,
  };
});
