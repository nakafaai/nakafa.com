import { Agent } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { createCapabilities } from "@repo/backend/confect/nina/capabilities";
import {
  ChatStep,
  makeChatStep,
} from "@repo/backend/confect/nina/capability/deadline";
import { createNinaAgentContext } from "@repo/backend/confect/nina/contract/turn";
import {
  generationFailure,
  NinaGenerationError,
} from "@repo/backend/confect/nina/failure";
import { boundStep } from "@repo/backend/confect/nina/history";
import { readInput } from "@repo/backend/confect/nina/input";
import { readInstructions } from "@repo/backend/confect/nina/instructions";
import { formatTurnContext } from "@repo/backend/confect/nina/prompt/runtime";
import { repairToolCall } from "@repo/backend/confect/nina/repair";
import { startNinaStep } from "@repo/backend/confect/nina/step";
import type { RunTiming } from "@repo/backend/confect/nina/timing";
import { createUsageHandler } from "@repo/backend/confect/nina/usage";
import { isStepCount } from "ai";
import { DateTime, Effect } from "effect";

/**
 * The scheduled Confect action owns generation; Agent owns its persistent
 * stream. Aborting `halt` ends the generation early and lets Agent clean up its
 * stream before this returns. `timing` notes when the model is first called and
 * when its stream first shows something to the learner.
 */
export const generateResponse = Effect.fn("nina.generate")(function* (
  turn: Extract<NinaTurnsDoc, { phase: "active" }>,
  halt: AbortSignal,
  timing: RunTiming
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
  const { instructions, summary } = yield* readInstructions(turn, context.url);
  // Nina reads its own turns, so the Agent fetches no history and sends this as is.
  const input = yield* readInput(turn, {
    context: formatTurnContext({ page: turn.page, runtime, user: turn.user }),
    through: summary?.throughOrder ?? null,
  });
  // The chat step's timer covers Nina's own call and the tools it starts, so
  // each step marks its start here and the tools count their time from it.
  const chatStep = yield* makeChatStep();
  const tools = yield* createCapabilities(
    turn.userId,
    context,
    turn.page.locale,
    usageHandler
  ).pipe(Effect.provideService(ChatStep, chatStep));
  const handle = (yield* Gateway).language("chat");
  const agent = new Agent(components.nina, {
    name: "nina",
    languageModel: handle.model,
    instructions,
    tools,
    usageHandler,
    contextOptions: { recentMessages: 0 },
    contextHandler: () => Promise.resolve(input),
  });
  let streamFailure: NinaGenerationError | undefined;
  const result = yield* Effect.tryPromise({
    try: (signal) =>
      agent.streamText(
        ctx,
        { threadId: turn.threadId, userId: turn.userId },
        {
          promptMessageId: turn.promptMessageId,
          abortSignal: AbortSignal.any([signal, halt]),
          onChunk: ({ chunk }) => timing.observe(chunk),
          onLanguageModelCallStart: () => timing.reach("readyMs"),
          onError: ({ error }) => {
            streamFailure ??= generationFailure(error);
          },
          onAbort: () => {
            streamFailure ??= new NinaGenerationError({
              reason: "interrupted",
            });
          },
          prepareStep: (step) =>
            runPromise(
              startNinaStep(chatStep.begin, {
                ...step,
                messages: boundStep(step.messages),
              })
            ),
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
    return yield* new NinaGenerationError({ reason: "content-blocked" });
  }
  if (completed[0] === "length" || completed[0] === "tool-calls") {
    return yield* new NinaGenerationError({ reason: "response-limit" });
  }
  return yield* new NinaGenerationError({ reason: "unknown" });
});
