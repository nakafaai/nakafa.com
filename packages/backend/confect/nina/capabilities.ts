import { createTool, type UsageHandler } from "@convex-dev/agent";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import type {
  ActionCtx,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import {
  CapabilityOutputSchema,
  streamCapability,
} from "@repo/backend/confect/nina/capability/progress";
import type { ModelId } from "@repo/backend/confect/nina/config/model";
import type { AgentContext } from "@repo/backend/confect/nina/contract/agent";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import {
  formatSpecialistToolTask,
  mathToolInputSchema,
  nakafaToolInputSchema,
  researchToolInputSchema,
} from "@repo/backend/confect/nina/contract/tools";
import { runMathAgent } from "@repo/backend/confect/nina/math/agent";
import { runNakafaAgent } from "@repo/backend/confect/nina/nakafa/agent";
import {
  decideNinaCapability,
  deniedCapabilityResult,
} from "@repo/backend/confect/nina/policy/capability";
import { runResearchAgent } from "@repo/backend/confect/nina/research/agent";
import { getSourceReferencesFromMessages } from "@repo/backend/confect/nina/research/source";
import type { Locale } from "@repo/contents/content";
import { Effect, Stream } from "effect";

const outputSchema = createEffectSchema(CapabilityOutputSchema);

/** Agent tools own progressive evidence; no HTTP writer or persistence adapter. */
export const createCapabilities = Effect.fn("nina.capabilities")(function* (
  userId: Docs["users"]["_id"],
  context: AgentContext,
  locale: Locale,
  modelId: ModelId,
  usageHandler: UsageHandler
) {
  const services = yield* Effect.context<ActionCtx | QueryRunner>();
  return {
    nakafa: createTool({
      description:
        "Retrieve Nakafa educational evidence: lessons, articles, Quran, examples, practice, and other sections of the current page. Select educational content here before verifying its mathematics.",
      inputSchema: nakafaToolInputSchema,
      outputSchema,
      execute: (_ctx, input, { abortSignal }) =>
        Stream.toAsyncIterableWith(
          streamCapability(
            (publish) =>
              Effect.gen(function* () {
                const decision = decideNinaCapability({
                  capability: "nakafa",
                  context,
                });
                if (decision.state !== "allowed") {
                  return deniedCapabilityResult({
                    capability: "nakafa",
                    decision,
                  });
                }
                return yield* runNakafaAgent({
                  userId,
                  context,
                  locale,
                  modelId,
                  task: formatSpecialistToolTask(input),
                  publish,
                  usageHandler,
                }).pipe(
                  Effect.catchTag("NakafaGenerationError", () =>
                    Effect.succeed({
                      failure: "failed" as const,
                      text: "Nakafa retrieval failed. Use only evidence already available; do not invent content.",
                    })
                  )
                );
              }),
            {
              continuation:
                "Ask Nakafa for a named section or a narrower request to read the omitted part.",
              signal: abortSignal,
            }
          ),
          services
        ),
    }),
    deepResearch: createTool({
      description:
        "Research external, official, current or source-backed information with web search and source analysis. Preserve the user's source constraints.",
      inputSchema: researchToolInputSchema,
      outputSchema,
      execute: (_ctx, input, { messages, toolCallId, abortSignal }) =>
        Stream.toAsyncIterableWith(
          streamCapability(
            (publish) =>
              Effect.gen(function* () {
                const decision = decideNinaCapability({
                  capability: "deepResearch",
                  context,
                });
                if (decision.state !== "allowed") {
                  return deniedCapabilityResult({
                    capability: "deepResearch",
                    decision,
                  });
                }
                return yield* runResearchAgent({
                  userId,
                  context,
                  locale,
                  modelId,
                  task: formatSpecialistToolTask(input),
                  sourceReferences: getSourceReferencesFromMessages(messages),
                  toolCallId,
                  publish,
                  usageHandler,
                }).pipe(
                  Effect.catchTags({
                    ResearchGenerationError: () =>
                      Effect.succeed({
                        failure: "failed" as const,
                        text: "External research failed. State the limitation and use only retrieved evidence; do not invent sources.",
                      }),
                    ResearchSourceLimitError: ({ maximum }) =>
                      Effect.succeed({
                        failure: "sourceLimit" as const,
                        text: `No sources were fetched. Ask the user to send at most ${maximum} source URLs per request. Do not silently omit their sources or start another research call for this request.`,
                      }),
                  })
                );
              }),
            {
              continuation:
                "Ask a narrower research question to gather the omitted sources.",
              signal: abortSignal,
            }
          ),
          services
        ),
    }),
    math: createTool({
      description:
        "Verify the exact mathematical examples, expressions, answer keys and numeric claims using deterministic computation. Retrieve educational practice content with Nakafa first.",
      inputSchema: mathToolInputSchema,
      outputSchema,
      execute: (_ctx, input, { abortSignal }) =>
        Stream.toAsyncIterableWith(
          streamCapability(
            (publish) =>
              Effect.gen(function* () {
                const decision = decideNinaCapability({
                  capability: "math",
                  context,
                });
                if (decision.state !== "allowed") {
                  return deniedCapabilityResult({
                    capability: "math",
                    decision,
                  });
                }
                return yield* runMathAgent({
                  userId,
                  context,
                  locale,
                  modelId,
                  task: formatSpecialistToolTask(input),
                  publish,
                  usageHandler,
                }).pipe(
                  Effect.catchTag("MathGenerationError", () =>
                    Effect.succeed({
                      failure: "failed" as const,
                      text: "Deterministic math verification failed. State the limitation; do not claim an unverified calculation is correct.",
                    })
                  )
                );
              }),
            {
              continuation:
                "Verify fewer expressions per request to get the omitted results.",
              signal: abortSignal,
            }
          ),
          services
        ),
    }),
  };
});
