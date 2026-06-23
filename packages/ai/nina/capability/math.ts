import { runMathAgent } from "@repo/ai/agents/math/agent";
import type { ModelId } from "@repo/ai/config/model";
import {
  recordSpecialistUsage,
  recoverSpecialistFailure,
  specialistSuccess,
} from "@repo/ai/nina/capability/result";
import { MATH_CAPABILITY } from "@repo/ai/nina/capability/spec";
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
  mathToolInputSchema,
} from "@repo/ai/schema/tools";
import type { AgentContext } from "@repo/ai/types/agents";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Locale } from "@repo/contents/_types/content";
import type { LogContext } from "@repo/utilities/logging/types";
import { tool, type UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

/**
 * Creates the deterministic math evidence tool for one Nina turn.
 * CAS-backed evidence is appended to the workspace before later model steps
 * receive the tool result text.
 */
export const createMathCapabilityTool = Effect.fn("nina.capability.math.tool")(
  function* ({
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
        "Verify user-provided or retrieved math with deterministic evidence for arithmetic, algebra, equations, calculus, series, matrices, statistics, probability, geometry, and discrete math. Do not use this for the first or only source for educational practice content; use Nakafa first, then math verifies the selected content.",
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

              const result = yield* runMathAgent({
                context,
                locale,
                modelId,
                task: formatSpecialistToolTask(input),
                writer,
              }).pipe(
                Effect.map((result) =>
                  specialistSuccess({
                    artifacts: result.artifacts,
                    capability: MATH_CAPABILITY,
                    text: result.text,
                    usage: result.usage,
                  })
                ),
                Effect.catchAll((error) =>
                  recoverSpecialistFailure({
                    component: MATH_CAPABILITY,
                    error,
                    errorLocation: "runMathAgent",
                    reporter,
                  })
                )
              );

              yield* recordSpecialistUsage({
                addUsage: usage.addUsage,
                component: MATH_CAPABILITY,
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
  }
);
