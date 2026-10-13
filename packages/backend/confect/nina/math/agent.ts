import { Agent, createTool, type UsageHandler } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { limitDeadline } from "@repo/backend/confect/nina/capability/deadline";
import {
  type CapabilityProgress,
  specialistResult,
} from "@repo/backend/confect/nina/capability/progress";
import type { TaskAgentData } from "@repo/backend/confect/nina/contract/agent";
import { textOutputSchema } from "@repo/backend/confect/nina/contract/tools";
import type { UsageAgent } from "@repo/backend/confect/nina/contract/usage";
import {
  mathAlgebra,
  mathArithmetic,
  mathCalculus,
  mathDiscrete,
  mathEquation,
  mathGeometry,
  mathMatrix,
  mathProbability,
  mathSeries,
  mathStatistics,
} from "@repo/backend/confect/nina/math/descriptions";
import { makeMathGenerationError } from "@repo/backend/confect/nina/math/error";
import { mathPrompt } from "@repo/backend/confect/nina/math/prompt";
import { repairMathToolCall } from "@repo/backend/confect/nina/math/repair";
import {
  mathAlgebraInput,
  mathArithmeticInput,
  mathCalculusInput,
  mathDiscreteInput,
  mathEquationInput,
  mathGeometryInput,
  mathMatrixInput,
  mathProbabilityInput,
  mathSeriesInput,
  mathStatisticsInput,
} from "@repo/backend/confect/nina/math/schema";
import {
  MATH_STEPS,
  prepareMathStep,
} from "@repo/backend/confect/nina/math/step";
import { compute } from "@repo/backend/confect/nina/math/tools/compute";
import { MathService } from "@repo/math/service";
import { isStepCount } from "ai";
import { Effect } from "effect";

/**
 * Runs deterministic math tools through Agent, within the time the capability
 * has left and the steps of `MATH_STEPS`; its usage handler records provider
 * calls. An answer that ended at the output cap, or a loop that ended at its
 * step limit before an answer, is reported as cut short.
 *
 * References:
 * - AI SDK `prepareStep`: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 * - Program-of-Thoughts: https://arxiv.org/abs/2211.12588
 */
export const runMathAgent = Effect.fn("math.runMathAgent")(function* ({
  userId,
  task,
  locale,
  context,
  publish,
  usageHandler,
}: TaskAgentData & {
  readonly publish: CapabilityProgress;
  readonly usageHandler: UsageHandler;
}) {
  const ctx = yield* ActionCtx;
  const { model, timeout } = (yield* Gateway).language("specialist");
  const math = yield* MathService.make.pipe(
    Effect.mapError(makeMathGenerationError)
  );
  const agent = new Agent(components.nina, {
    name: "math" satisfies UsageAgent,
    languageModel: model,
    usageHandler,
  });
  const services = yield* Effect.context<ActionCtx | Gateway>();
  const runPromise = Effect.runPromiseWith(services);
  const limit = yield* limitDeadline(timeout);
  const result = yield* Effect.tryPromise({
    try: (signal) =>
      agent.generateText(
        ctx,
        { userId },
        {
          abortSignal: signal,
          messages: [{ role: "user", content: task }],
          model,
          repairToolCall: (options) =>
            runPromise(
              repairMathToolCall({
                ...options,
                task,
                userId,
                usageHandler,
              })
            ),
          instructions: mathPrompt({ locale, context }),
          prepareStep: prepareMathStep,
          stopWhen: isStepCount(MATH_STEPS),
          temperature: 0,
          timeout: limit,
          tools: {
            algebra: createTool({
              description: mathAlgebra,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathAlgebraInput,
              outputSchema: textOutputSchema,
            }),
            arithmetic: createTool({
              description: mathArithmetic,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathArithmeticInput,
              outputSchema: textOutputSchema,
            }),
            calculus: createTool({
              description: mathCalculus,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathCalculusInput,
              outputSchema: textOutputSchema,
            }),
            discrete: createTool({
              description: mathDiscrete,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathDiscreteInput,
              outputSchema: textOutputSchema,
            }),
            equation: createTool({
              description: mathEquation,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathEquationInput,
              outputSchema: textOutputSchema,
            }),
            geometry: createTool({
              description: mathGeometry,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathGeometryInput,
              outputSchema: textOutputSchema,
            }),
            matrix: createTool({
              description: mathMatrix,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathMatrixInput,
              outputSchema: textOutputSchema,
            }),
            probability: createTool({
              description: mathProbability,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathProbabilityInput,
              outputSchema: textOutputSchema,
            }),
            series: createTool({
              description: mathSeries,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathSeriesInput,
              outputSchema: textOutputSchema,
            }),
            statistics: createTool({
              description: mathStatistics,
              execute: (_context, input, { abortSignal, toolCallId }) =>
                runPromise(
                  compute({
                    input,
                    toolCallId,
                    publish,
                  }).pipe(Effect.provideService(MathService, math)),
                  { signal: abortSignal }
                ),
              inputSchema: mathStatisticsInput,
              outputSchema: textOutputSchema,
            }),
          },
        }
      ),
    catch: makeMathGenerationError,
  });
  return specialistResult(result.text, result.finishReason);
});
