import { Agent } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { createCapabilities } from "@repo/backend/confect/nina/capabilities";
import { createNinaAgentContext } from "@repo/backend/confect/nina/contract/turn";
import {
  generationFailure,
  NinaGenerationError,
} from "@repo/backend/confect/nina/failure";
import { assembleContext, boundStep } from "@repo/backend/confect/nina/history";
import { readInstructions } from "@repo/backend/confect/nina/instructions";
import { repairToolCall } from "@repo/backend/confect/nina/repair";
import { createNinaPrepareStep } from "@repo/backend/confect/nina/step";
import { createUsageHandler } from "@repo/backend/confect/nina/usage";
import { isStepCount } from "ai";
import { DateTime, Effect } from "effect";

/** The scheduled Confect action owns generation; Agent owns its persistent stream. */
export const generateResponse = Effect.fn("nina.generate")(function* (
  turn: Extract<NinaTurnsDoc, { phase: "active" }>
) {
  const ctx = yield* ActionCtx;
  const services = yield* Effect.context<ActionCtx | Gateway>();
  // SDK callbacks are framework boundaries. Domain programs keep composing Effects.
  const runPromise = Effect.runPromiseWith(services);
  const usageHandler = yield* createUsageHandler(turn._id);
  const runtime = {
    currentDate: DateTime.formatIso(DateTime.makeUnsafe(turn._creationTime)),
  };
  const context = createNinaAgentContext({
    page: turn.page,
    user: turn.user,
    runtime,
  });
  const { instructions, summary } = yield* readInstructions(
    turn,
    context.url,
    runtime
  );
  const tools = yield* createCapabilities(
    turn.userId,
    context,
    turn.page.locale,
    turn.modelId,
    usageHandler
  );
  const handle = (yield* Gateway).language({
    purpose: "chat",
    model: turn.modelId,
  });
  const agent = new Agent(components.nina, {
    name: "nina",
    languageModel: handle.model,
    instructions,
    tools,
    usageHandler,
    contextOptions: { recentMessages: 50, excludeToolMessages: false },
    contextHandler: (_ctx, fetched) =>
      Promise.resolve(
        assembleContext({
          current: [
            ...fetched.inputMessages,
            ...fetched.inputPrompt,
            ...fetched.existingResponses,
          ],
          currentOrder: turn.order,
          recent: fetched.recent,
          throughOrder: summary?.throughOrder ?? null,
        })
      ),
  });
  const prepare = createNinaPrepareStep({ instructions });
  let streamFailure: NinaGenerationError | undefined;
  const result = yield* Effect.tryPromise({
    try: (signal) =>
      agent.streamText(
        ctx,
        { threadId: turn.threadId, userId: turn.userId },
        {
          promptMessageId: turn.promptMessageId,
          abortSignal: signal,
          onError: ({ error }) => {
            streamFailure ??= generationFailure(error);
          },
          onAbort: () => {
            streamFailure ??= NinaGenerationError.make({
              reason: "interrupted",
            });
          },
          prepareStep: (step) =>
            prepare({ ...step, messages: boundStep(step.messages) }),
          repairToolCall: (options) =>
            runPromise(
              repairToolCall({
                ...options,
                userId: turn.userId,
                usageHandler,
              })
            ),
          stopWhen: isStepCount(20),
          timeout: handle.timeout,
        },
        { saveStreamDeltas: { sendSources: true, returnImmediately: false } }
      ),
    catch: (cause) => streamFailure ?? generationFailure(cause),
  });
  if (streamFailure) {
    return yield* streamFailure;
  }
  const completed = yield* Effect.tryPromise({
    try: () => Promise.all([result.finishReason, result.text]),
    catch: generationFailure,
  });
  if (completed[0] === "stop" && completed[1].trim()) {
    return;
  }
  if (completed[0] === "content-filter") {
    return yield* NinaGenerationError.make({ reason: "content-blocked" });
  }
  if (completed[0] === "length" || completed[0] === "tool-calls") {
    return yield* NinaGenerationError.make({ reason: "response-limit" });
  }
  return yield* NinaGenerationError.make({ reason: "unknown" });
});
