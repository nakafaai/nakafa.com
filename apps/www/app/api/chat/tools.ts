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
  formatSpecialistToolTask,
  mathToolInputSchema,
  nakafaToolInputSchema,
  researchToolInputSchema,
} from "@repo/ai/schema/tools";
import type { AgentContext } from "@repo/ai/types/agents";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import type { LogContext } from "@repo/utilities/logging/types";
import { tool, type UIMessageStreamWriter } from "ai";
import { Effect } from "effect";
import { getCanonicalNakafaContentUrl } from "@/app/api/chat/content";
import { search as nakafaSearch } from "@/app/api/chat/nakafa";
import { nakafaContent } from "@/app/api/chat/nakafa-content";
import {
  recordSpecialistUsage,
  recoverSpecialistFailure,
  specialistSuccess,
} from "@/app/api/chat/specialist";
import type { trackUsage } from "@/app/api/chat/usage";

type ChatUsage = Effect.Effect.Success<ReturnType<typeof trackUsage>>;

/** Inputs needed to bind Nina's specialist tools to app-owned services. */
export interface NinaToolSetInput {
  readonly context: AgentContext;
  readonly locale: Locale;
  readonly logContext: LogContext;
  readonly modelId: ModelId;
  readonly reportError: (error: unknown, source: string) => void;
  readonly usage: ChatUsage;
  readonly writer: UIMessageStreamWriter<MyUIMessage>;
}

/** Builds the AI SDK tool set for one Nina agent turn. */
export function createNinaToolSet({
  context,
  locale,
  logContext,
  modelId,
  reportError,
  usage,
  writer,
}: NinaToolSetInput) {
  let fetchedPage = false;

  return {
    [TOOL_NAMES.nakafa]: tool({
      description:
        "Retrieve Nakafa educational evidence for lessons, study topics, current pages, articles, Quran references, examples, warmups, review tasks, tryout preparation, and structured exercises. Use this before math when content must be selected. Preserve requested deliverables in the structured input.",
      inputSchema: nakafaToolInputSchema,
      /** Runs the Nakafa specialist with one-time current-page fetch support. */
      execute: (input, { toolCallId }) => {
        const needsPageFetch = context.needsPageFetch && !fetchedPage;

        if (needsPageFetch) {
          fetchedPage = true;
        }

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
              }).pipe(Effect.provideService(Nakafa, nakafaContent));
            }

            const result = yield* runNakafaAgent({
              context: { ...context, needsPageFetch },
              locale,
              modelId,
              nakafa: nakafaContent,
              task: formatSpecialistToolTask(input),
              writer,
            }).pipe(
              Effect.provideService(NakafaSearch, nakafaSearch),
              Effect.map(specialistSuccess),
              Effect.catchAll((error) =>
                recoverSpecialistFailure({
                  component: TOOL_NAMES.nakafa,
                  error,
                  errorLocation: "runNakafaAgent",
                  reportError,
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
                  reportError,
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
                  reportError,
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
  };
}
