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
import { read } from "@repo/backend/confect/nina/nakafa/tools/read";
import {
  decideNinaCapability,
  deniedCapabilityResult,
} from "@repo/backend/confect/nina/policy/capability";
import { runResearchAgent } from "@repo/backend/confect/nina/research/agent";
import { getSourceReferencesFromMessages } from "@repo/backend/confect/nina/research/source";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/agent/schema/read";
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
  let pagePending = context.needsPageFetch;
  return {
    nakafa: createTool({
      description:
        "Retrieve Nakafa educational evidence, current pages, lessons, articles, Quran, examples and practice. Select educational content here before verifying its mathematics.",
      inputSchema: nakafaToolInputSchema,
      outputSchema,
      execute: (_ctx, input, { toolCallId, abortSignal }) =>
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
                if (pagePending) {
                  pagePending = false;
                  const text = yield* read({
                    input: {
                      content_ref: NakafaAgentContentRefInputSchema.make(
                        context.url
                      ),
                    },
                    toolCallId,
                    publish,
                  });
                  return { text };
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
                      text: "Nakafa retrieval failed. Use only evidence already available; do not invent content.",
                    })
                  )
                );
              }),
            abortSignal
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
                  Effect.catchTag("ResearchGenerationError", () =>
                    Effect.succeed({
                      text: "External research failed. State the limitation and use only retrieved evidence; do not invent sources.",
                    })
                  )
                );
              }),
            abortSignal
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
                      text: "Deterministic math verification failed. State the limitation; do not claim an unverified calculation is correct.",
                    })
                  )
                );
              }),
            abortSignal
          ),
          services
        ),
    }),
  };
});
