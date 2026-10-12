import { createTool, type UsageHandler } from "@convex-dev/agent";
import { CapabilityOutputSchema } from "@repo/backend/client/nina/capability";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import type {
  ActionCtx,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import {
  classify,
  type GatewayFailure,
} from "@repo/backend/confect/gateway/failure";
import type { Gateway } from "@repo/backend/confect/gateway/handle";
import type { ChatStep } from "@repo/backend/confect/nina/capability/deadline";
import { streamCapability } from "@repo/backend/confect/nina/capability/progress";
import type { LearningCapabilityName } from "@repo/backend/confect/nina/capability/spec";
import type { AgentContext } from "@repo/backend/confect/nina/contract/agent";
import { createEffectSchema } from "@repo/backend/confect/nina/contract/sdk";
import {
  formatSpecialistToolTask,
  mathToolInputSchema,
  memoryToolInputSchema,
  nakafaToolInputSchema,
  researchToolInputSchema,
} from "@repo/backend/confect/nina/contract/tools";
import { runMathAgent } from "@repo/backend/confect/nina/math/agent";
import { type Found, runMemory } from "@repo/backend/confect/nina/memory/tool";
import { runNakafaAgent } from "@repo/backend/confect/nina/nakafa/agent";
import {
  decideNinaCapability,
  deniedCapabilityResult,
} from "@repo/backend/confect/nina/policy/capability";
import { runResearchAgent } from "@repo/backend/confect/nina/research/agent";
import {
  getNakafaReferencesFromMessages,
  getSourceReferencesFromMessages,
} from "@repo/backend/confect/nina/research/source";
import type { Locale } from "@repo/contents/content";
import { Array as Arr, Effect, Stream } from "effect";

const outputSchema = createEffectSchema(CapabilityOutputSchema);

/**
 * Agent tools own progressive evidence; no HTTP writer or persistence adapter.
 * `found` is where the memory tool leaves the words it finds, for the turn to
 * hand to the model's next step, so that no word is stored with the result.
 */
export const createCapabilities = Effect.fn("nina.capabilities")(function* (
  userId: Docs["users"]["_id"],
  context: AgentContext,
  locale: Locale,
  usageHandler: UsageHandler,
  found: Found
) {
  const services = yield* Effect.context<
    ActionCtx | ChatStep | Gateway | QueryRunner
  >();
  return {
    nakafa: createTool({
      description:
        "Retrieve Nakafa educational evidence: lessons, articles, Quran, examples, practice, and other sections of the current page. Select educational content here before verifying its mathematics.",
      inputSchema: nakafaToolInputSchema,
      outputSchema,
      execute: (_ctx, input, { messages, abortSignal }) =>
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
                  task: formatSpecialistToolTask(input),
                  addresses: Arr.map(
                    getNakafaReferencesFromMessages(messages),
                    (link) => link.href
                  ),
                  publish,
                  usageHandler,
                }).pipe(
                  Effect.catchTag("NakafaGenerationError", (error) =>
                    failed(
                      "nakafa",
                      { gateway: classify(error.cause) },
                      "Nakafa retrieval failed. Use only evidence already available; do not invent content."
                    )
                  )
                );
              }),
            {
              capability: "nakafa",
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
                  task: formatSpecialistToolTask(input),
                  sourceReferences: getSourceReferencesFromMessages(messages),
                  toolCallId,
                  publish,
                  usageHandler,
                }).pipe(
                  Effect.catchTags({
                    ResearchGenerationError: (error) =>
                      failed(
                        "deepResearch",
                        error,
                        "External research failed. Tell the learner what this attempt could not verify, which is the request itself, and name a direct channel they can check next. Use only retrieved evidence, do not invent sources, and do not claim that anything is absent or does not exist."
                      ),
                    ResearchSourceLimitError: ({ maximum }) =>
                      Effect.succeed({
                        outcome: "limit" as const,
                        text: `No sources were fetched. Ask the user to send at most ${maximum} source URLs per request. Do not silently omit their sources or start another research call for this request.`,
                      }),
                  })
                );
              }),
            {
              capability: "deepResearch",
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
                  task: formatSpecialistToolTask(input),
                  publish,
                  usageHandler,
                }).pipe(
                  Effect.catchTag("MathGenerationError", (error) =>
                    failed(
                      "math",
                      { gateway: classify(error.cause) },
                      "Deterministic math verification failed. State the limitation; do not claim an unverified calculation is correct."
                    )
                  )
                );
              }),
            {
              capability: "math",
              continuation:
                "Verify fewer expressions per request to get the omitted results.",
              signal: abortSignal,
            }
          ),
          services
        ),
    }),
    memory: createTool({
      description:
        "Search what the learner told Nina before and saved as memories, such as their target, exam date, level, how they like explanations, or what they find hard. Use it when the learner points back to something they told you that is neither in the Learner section nor in the Memories list, or when a good answer depends on a personal fact that is probably saved and is not in front of you. Do not use it for lesson content, for facts in this conversation, or more than twice in one turn.",
      inputSchema: memoryToolInputSchema,
      outputSchema,
      execute: (_ctx, input, { abortSignal, toolCallId }) =>
        Stream.toAsyncIterableWith(
          streamCapability(
            () =>
              runMemory({
                found,
                query: input.query,
                toolCallId,
                userId,
              }).pipe(
                Effect.catchDefect(() =>
                  failed(
                    "memory",
                    { phase: "read" },
                    "Memory could not be read right now. Tell the learner you could not check what they told you before, ask them again, and do not guess it."
                  )
                )
              ),
            {
              capability: "memory",
              continuation:
                "Ask again with a narrower query to read the memories that were left out.",
              signal: abortSignal,
            }
          ),
          services
        ),
    }),
  };
});

/**
 * Ends a capability that left nothing usable. The log gets the routing facts
 * of what failed, never a provider message or a prompt; Nina and the learner
 * only get `text`.
 */
function failed(
  capability: LearningCapabilityName,
  facts: {
    readonly gateway?: GatewayFailure | undefined;
    readonly phase?: string;
    readonly rejected?: boolean;
  },
  text: string
) {
  return Effect.as(
    Effect.logWarning("Nina capability failed", {
      capability,
      phase: facts.phase,
      reason: facts.gateway?.reason,
      rejected: facts.rejected,
      status: facts.gateway?.status,
      type: facts.gateway?.type,
    }),
    { outcome: "failed" as const, text }
  );
}
