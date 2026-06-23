import { runResearchAgent } from "@repo/ai/agents/research/agent";
import type { ModelId } from "@repo/ai/config/model";
import { getSourceReferencesFromMessages } from "@repo/ai/lib/source";
import {
  recordSpecialistUsage,
  recoverSpecialistFailure,
  specialistSuccess,
} from "@repo/ai/nina/capability/result";
import { RESEARCH_CAPABILITY } from "@repo/ai/nina/capability/spec";
import { traceLearningCapability } from "@repo/ai/nina/capability/trace";
import {
  decideNinaCapability,
  deniedCapabilityResult,
} from "@repo/ai/nina/policy/capability";
import { NinaReporter } from "@repo/ai/nina/runtime/report";
import { NinaStore } from "@repo/ai/nina/runtime/store";
import type { trackUsage } from "@repo/ai/nina/runtime/usage";
import { NinaWorkspaceRuntime } from "@repo/ai/nina/workspace/runtime";
import {
  formatSpecialistToolTask,
  researchToolInputSchema,
} from "@repo/ai/schema/tools";
import type { AgentContext } from "@repo/ai/types/agents";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Locale } from "@repo/contents/_types/content";
import type { LogContext } from "@repo/utilities/logging/types";
import { tool, type UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

/**
 * Creates the external research evidence tool for one Nina turn.
 * Returned evidence is appended to the shared workspace before the model sees
 * the tool result text.
 */
export const createResearchCapabilityTool = Effect.fn(
  "nina.capability.research.tool"
)(function* ({
  context,
  locale,
  logContext,
  modelId,
  responseMessageIdentifier,
  usage,
  writer,
}: {
  readonly context: AgentContext;
  readonly locale: Locale;
  readonly logContext: LogContext;
  readonly modelId: ModelId;
  readonly responseMessageIdentifier: string;
  readonly usage: Effect.Effect.Success<ReturnType<typeof trackUsage>>;
  readonly writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  const reporter = yield* NinaReporter;
  const store = yield* NinaStore;
  const workspace = yield* NinaWorkspaceRuntime;

  return tool({
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
          Effect.tap((result) => workspace.appendResult(result)),
          Effect.map((result) => result.text)
        )
      ),
  });
});
