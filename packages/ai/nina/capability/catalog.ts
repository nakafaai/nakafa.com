import { runMathAgent } from "@repo/ai/agents/math/agent";
import { runNakafaAgent } from "@repo/ai/agents/nakafa/agent";
import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { read as readNakafa } from "@repo/ai/agents/nakafa/tools/read";
import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import { runResearchAgent } from "@repo/ai/agents/research/agent";
import type { ModelId } from "@repo/ai/config/model";
import { getSourceReferencesFromMessages } from "@repo/ai/lib/source";
import {
  recordSpecialistUsage,
  recoverSpecialistFailure,
  specialistSuccess,
} from "@repo/ai/nina/capability/result";
import {
  decideNinaCapability,
  formatDeniedCapability,
} from "@repo/ai/nina/policy/capability";
import { getCanonicalNakafaContentUrl } from "@repo/ai/nina/runtime/page";
import { NinaReporter } from "@repo/ai/nina/runtime/report";
import type { NinaToolSet } from "@repo/ai/nina/runtime/step";
import type { trackUsage } from "@repo/ai/nina/runtime/usage";
import {
  formatSpecialistToolTask,
  mathToolInputSchema,
  nakafaToolInputSchema,
  researchToolInputSchema,
} from "@repo/ai/schema/tools";
import type { AgentContext } from "@repo/ai/types/agents";
import type { MyUIMessage } from "@repo/ai/types/message";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import type { Locale } from "@repo/contents/_types/content";
import type { LogContext } from "@repo/utilities/logging/types";
import { tool, type UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

type NinaUsage = Effect.Effect.Success<ReturnType<typeof trackUsage>>;

/**
 * Builds Nina's internal AI SDK tool catalog for one turn.
 *
 * App-owned content/search adapters enter through Effect services; AI SDK
 * callback shapes and writer access remain inside the harness runtime.
 */
export const createNinaCapabilityCatalog = Effect.fn("nina.capability.catalog")(
  function* ({
    context,
    locale,
    logContext,
    modelId,
    consumePageFetch,
    usage,
    writer,
  }: {
    readonly consumePageFetch: () => boolean;
    readonly context: AgentContext;
    readonly locale: Locale;
    readonly logContext: LogContext;
    readonly modelId: ModelId;
    readonly usage: NinaUsage;
    readonly writer: UIMessageStreamWriter<MyUIMessage>;
  }) {
    const nakafa = yield* Nakafa;
    const search = yield* NakafaSearch;
    const reporter = yield* NinaReporter;

    return {
      [TOOL_NAMES.nakafa]: tool({
        description:
          "Retrieve Nakafa educational evidence for lessons, study topics, current pages, articles, Quran references, examples, warmups, review tasks, tryout preparation, and structured exercises. Use this before math when content must be selected. Preserve requested deliverables in the structured input.",
        inputSchema: nakafaToolInputSchema,
        /** Runs the Nakafa specialist with one-time current-page fetch support. */
        execute: (input, { toolCallId }) => {
          const decision = decideNinaCapability({
            capability: TOOL_NAMES.nakafa,
            context,
          });
          if (decision.state !== "allowed") {
            return formatDeniedCapability({
              capability: TOOL_NAMES.nakafa,
              decision,
            });
          }

          const needsPageFetch = consumePageFetch();

          return Effect.runPromise(
            Effect.gen(function* () {
              if (needsPageFetch) {
                const contentRef = getCanonicalNakafaContentUrl(context.url);

                return yield* readNakafa({
                  input: {
                    content_ref:
                      NakafaAgentContentRefInputSchema.make(contentRef),
                  },
                  toolCallId,
                  writer,
                }).pipe(Effect.provideService(Nakafa, nakafa));
              }

              const result = yield* runNakafaAgent({
                context: { ...context, needsPageFetch },
                locale,
                modelId,
                nakafa,
                task: formatSpecialistToolTask(input),
                writer,
              }).pipe(
                Effect.provideService(NakafaSearch, search),
                Effect.map(specialistSuccess),
                Effect.catchAll((error) =>
                  recoverSpecialistFailure({
                    component: TOOL_NAMES.nakafa,
                    error,
                    errorLocation: "runNakafaAgent",
                    reporter,
                  })
                )
              );

              yield* recordSpecialistUsage({
                addUsage: usage.addUsage,
                component: TOOL_NAMES.nakafa,
                logContext,
                result,
              });

              return result.text;
            })
          );
        },
      }),
      [TOOL_NAMES.deepResearch]: tool({
        description:
          "Research external, official, current, latest, cited, or source-backed information with web search and source analysis.",
        inputSchema: researchToolInputSchema,
        /** Runs the external research specialist and records its token usage. */
        execute: (input, { messages, toolCallId }) =>
          Effect.runPromise(
            Effect.gen(function* () {
              const decision = decideNinaCapability({
                capability: TOOL_NAMES.deepResearch,
                context,
              });
              if (decision.state !== "allowed") {
                return formatDeniedCapability({
                  capability: TOOL_NAMES.deepResearch,
                  decision,
                });
              }

              const result = yield* runResearchAgent({
                context,
                locale,
                modelId,
                task: formatSpecialistToolTask(input),
                sourceReferences: getSourceReferencesFromMessages(messages),
                toolCallId,
                writer,
              }).pipe(
                Effect.map(specialistSuccess),
                Effect.catchAll((error) =>
                  recoverSpecialistFailure({
                    component: TOOL_NAMES.deepResearch,
                    error,
                    errorLocation: "runResearchAgent",
                    reporter,
                  })
                )
              );

              yield* recordSpecialistUsage({
                addUsage: usage.addUsage,
                component: TOOL_NAMES.deepResearch,
                logContext,
                result,
              });

              return result.text;
            })
          ),
      }),
      [TOOL_NAMES.math]: tool({
        description:
          "Verify user-provided or retrieved math with deterministic evidence for arithmetic, algebra, equations, calculus, series, matrices, statistics, probability, geometry, and discrete math. Do not use this as the first or only source for educational practice content; use Nakafa first, then math verifies the selected content.",
        inputSchema: mathToolInputSchema,
        /** Runs the deterministic math specialist and records its token usage. */
        execute: (input) =>
          Effect.runPromise(
            Effect.gen(function* () {
              const decision = decideNinaCapability({
                capability: TOOL_NAMES.math,
                context,
              });
              if (decision.state !== "allowed") {
                return formatDeniedCapability({
                  capability: TOOL_NAMES.math,
                  decision,
                });
              }

              const result = yield* runMathAgent({
                context,
                locale,
                modelId,
                task: formatSpecialistToolTask(input),
                writer,
              }).pipe(
                Effect.map(specialistSuccess),
                Effect.catchAll((error) =>
                  recoverSpecialistFailure({
                    component: TOOL_NAMES.math,
                    error,
                    errorLocation: "runMathAgent",
                    reporter,
                  })
                )
              );

              yield* recordSpecialistUsage({
                addUsage: usage.addUsage,
                component: TOOL_NAMES.math,
                logContext,
                result,
              });

              return result.text;
            })
          ),
      }),
    } satisfies NinaToolSet;
  }
);
