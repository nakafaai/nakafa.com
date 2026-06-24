import { runNakafaAgent } from "@repo/ai/agents/nakafa/agent";
import { NakafaSearch } from "@repo/ai/agents/nakafa/search";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { read as readNakafa } from "@repo/ai/agents/nakafa/tools/read";
import { runResearchAgent } from "@repo/ai/agents/research/agent";
import type { ModelId } from "@repo/ai/config/model";
import { getSourceReferencesFromMessages } from "@repo/ai/lib/source";
import {
  failedMathCapability,
  runMathCapability,
} from "@repo/ai/nina/capability/math";
import {
  capabilityResult,
  recordSpecialistUsage,
  recoverSpecialistFailure,
  specialistSuccess,
} from "@repo/ai/nina/capability/result";
import {
  MATH_CAPABILITY,
  NAKAFA_CAPABILITY,
  RESEARCH_CAPABILITY,
} from "@repo/ai/nina/capability/spec";
import { traceLearningCapability } from "@repo/ai/nina/capability/trace";
import {
  decideNinaCapability,
  deniedCapabilityResult,
} from "@repo/ai/nina/policy/capability";
import { getCanonicalNakafaContentUrl } from "@repo/ai/nina/runtime/page";
import { NinaReporter } from "@repo/ai/nina/runtime/report";
import type { NinaToolSet } from "@repo/ai/nina/runtime/step";
import { NinaStore } from "@repo/ai/nina/runtime/store";
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
import { MathReasoning } from "@repo/math/reason/service";
import type { LogContext } from "@repo/utilities/logging/types";
import { tool, type UIMessageStreamWriter } from "ai";
import { Effect, Option } from "effect";

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
    responseMessageIdentifier,
    consumePageFetch,
    usage,
    writer,
  }: {
    readonly consumePageFetch: () => boolean;
    readonly context: AgentContext;
    readonly locale: Locale;
    readonly logContext: LogContext;
    readonly modelId: ModelId;
    readonly responseMessageIdentifier: string;
    readonly usage: NinaUsage;
    readonly writer: UIMessageStreamWriter<MyUIMessage>;
  }) {
    const nakafa = yield* Nakafa;
    const search = yield* NakafaSearch;
    const reporter = yield* NinaReporter;
    const store = yield* NinaStore;
    const mathReasoning = yield* MathReasoning;

    return {
      [NAKAFA_CAPABILITY]: tool({
        description:
          "Retrieve Nakafa educational evidence for lessons, study topics, current pages, articles, Quran references, examples, warmups, review tasks, tryout preparation, and structured exercises. Use this before math when content must be selected. Preserve requested deliverables in the structured input.",
        inputSchema: nakafaToolInputSchema,
        /** Runs the Nakafa specialist with one-time current-page fetch support. */
        execute: (input, { toolCallId }) =>
          Effect.runPromise(
            traceLearningCapability({
              capability: NAKAFA_CAPABILITY,
              responseMessageIdentifier,
              toolCallId,
              run: Effect.gen(function* () {
                const decision = decideNinaCapability({
                  capability: NAKAFA_CAPABILITY,
                  context,
                });
                if (decision.state !== "allowed") {
                  return deniedCapabilityResult({
                    capability: NAKAFA_CAPABILITY,
                    decision,
                  });
                }

                const needsPageFetch = consumePageFetch();

                if (needsPageFetch) {
                  const contentRef = getCanonicalNakafaContentUrl(context.url);
                  const text = yield* readNakafa({
                    input: {
                      content_ref:
                        NakafaAgentContentRefInputSchema.make(contentRef),
                    },
                    toolCallId,
                    writer,
                  }).pipe(
                    Effect.provideService(Nakafa, nakafa),
                    Effect.catchAll((error) =>
                      recoverSpecialistFailure({
                        component: NAKAFA_CAPABILITY,
                        error,
                        errorLocation: "readNakafaCurrentPage",
                        reporter,
                      })
                    )
                  );

                  if (typeof text !== "string") {
                    return text;
                  }

                  return capabilityResult({
                    capability: NAKAFA_CAPABILITY,
                    status: "available",
                    text,
                  });
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
                  Effect.map((result) =>
                    specialistSuccess({
                      capability: NAKAFA_CAPABILITY,
                      text: result.text,
                      usage: result.usage,
                    })
                  ),
                  Effect.catchAll((error) =>
                    recoverSpecialistFailure({
                      component: NAKAFA_CAPABILITY,
                      error,
                      errorLocation: "runNakafaAgent",
                      reporter,
                    })
                  )
                );

                yield* recordSpecialistUsage({
                  addUsage: usage.addUsage,
                  component: NAKAFA_CAPABILITY,
                  logContext,
                  result,
                });

                return result;
              }),
            }).pipe(
              Effect.provideService(NinaReporter, reporter),
              Effect.provideService(NinaStore, store),
              Effect.map((result) => result.text)
            )
          ),
      }),
      [RESEARCH_CAPABILITY]: tool({
        description:
          "Research external, official, current, latest, cited, or source-backed information with web search and source analysis.",
        inputSchema: researchToolInputSchema,
        /** Runs the external research specialist and records its token usage. */
        execute: (input, { messages, toolCallId }) =>
          Effect.runPromise(
            traceLearningCapability({
              capability: RESEARCH_CAPABILITY,
              responseMessageIdentifier,
              toolCallId,
              run: Effect.gen(function* () {
                const decision = decideNinaCapability({
                  capability: RESEARCH_CAPABILITY,
                  context,
                });
                if (decision.state !== "allowed") {
                  return deniedCapabilityResult({
                    capability: RESEARCH_CAPABILITY,
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
                  Effect.map((result) =>
                    specialistSuccess({
                      capability: RESEARCH_CAPABILITY,
                      text: result.text,
                      usage: result.usage,
                    })
                  ),
                  Effect.catchAll((error) =>
                    recoverSpecialistFailure({
                      component: RESEARCH_CAPABILITY,
                      error,
                      errorLocation: "runResearchAgent",
                      reporter,
                    })
                  )
                );

                yield* recordSpecialistUsage({
                  addUsage: usage.addUsage,
                  component: RESEARCH_CAPABILITY,
                  logContext,
                  result,
                });

                return result;
              }),
            }).pipe(
              Effect.provideService(NinaReporter, reporter),
              Effect.provideService(NinaStore, store),
              Effect.map((result) => result.text)
            )
          ),
      }),
      [MATH_CAPABILITY]: tool({
        description:
          "Verify user-provided or retrieved first-slice math with deterministic evidence for algebra, equations, simplification, factoring, basic derivatives/integrals, and coordinate line/circle checks. Do not use this as the first or only source for educational practice content; use Nakafa first, then math verifies the selected content.",
        inputSchema: mathToolInputSchema,
        /** Runs the deterministic math specialist and records its token usage. */
        execute: (input, { toolCallId }) =>
          Effect.runPromise(
            traceLearningCapability({
              capability: MATH_CAPABILITY,
              responseMessageIdentifier,
              toolCallId,
              run: Effect.gen(function* () {
                const decision = decideNinaCapability({
                  capability: MATH_CAPABILITY,
                  context,
                });
                if (decision.state !== "allowed") {
                  return deniedCapabilityResult({
                    capability: MATH_CAPABILITY,
                    decision,
                  });
                }

                const result = yield* runMathCapability({
                  input,
                  locale,
                  responseMessageIdentifier,
                  toolCallId,
                  writer,
                }).pipe(
                  Effect.provideService(MathReasoning, mathReasoning),
                  Effect.map((result) => ({
                    ...result,
                    usage: Option.none(),
                  })),
                  Effect.catchAll((error) =>
                    reporter
                      .report({ error, source: "runMathCapability" })
                      .pipe(
                        Effect.as({
                          ...failedMathCapability(),
                          usage: Option.none(),
                        })
                      )
                  )
                );

                return result;
              }),
            }).pipe(
              Effect.provideService(NinaReporter, reporter),
              Effect.provideService(NinaStore, store),
              Effect.map((result) => result.text)
            )
          ),
      }),
    } satisfies NinaToolSet;
  }
);
