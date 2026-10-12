import { Agent } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import {
  ChatStep,
  makeChatStep,
} from "@repo/backend/confect/nina/capability/deadline";
import {
  CapabilityTurn,
  createCapabilities,
} from "@repo/backend/confect/nina/capability/define";
import {
  type Held,
  restoreHeld,
} from "@repo/backend/confect/nina/capability/held";
import { registry } from "@repo/backend/confect/nina/capability/registry";
import {
  createNinaAgentContext,
  readNinaLearningPage,
} from "@repo/backend/confect/nina/contract/turn";
import type { UsageAgent } from "@repo/backend/confect/nina/contract/usage";
import {
  abortFailure,
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
import { DateTime, Effect, MutableHashMap } from "effect";

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
  const { capabilities, instructions, memories, paused, summary } =
    yield* readInstructions(turn, readNinaLearningPage(turn.page).url);
  // The turn reads once whether the learner paused memory: the prompt, the tools
  // Nina is offered and the policy of each call all follow it.
  const context = createNinaAgentContext({
    memory: !paused,
    page: turn.page,
    user: turn.user,
    runtime,
  });
  // Nina reads its own turns, so the Agent fetches no history and sends this as is.
  const input = yield* readInput(turn, {
    context: formatTurnContext({
      memories,
      page: turn.page,
      runtime,
      user: turn.user,
    }),
    through: summary?.throughOrder ?? null,
  });
  // The chat step's timer covers Nina's own call and the tools it starts, so
  // each step marks its start here and the tools count their time from it.
  const chatStep = yield* makeChatStep();
  // The words of a capability that declares a note, such as the memory tool,
  // are read in the next step of this turn and never stored, so the thread, the
  // transcript and later turns hold none.
  const held: Held = MutableHashMap.empty();
  const tools = yield* createCapabilities(registry).pipe(
    Effect.provideService(CapabilityTurn, {
      context,
      held,
      locale: turn.page.locale,
      usageHandler,
      userId: turn.userId,
    }),
    Effect.provideService(ChatStep, chatStep)
  );
  const handle = (yield* Gateway).language("chat");
  const agent = new Agent(components.nina, {
    name: "nina" satisfies UsageAgent,
    languageModel: handle.model,
    instructions,
    tools,
    usageHandler,
    contextOptions: { recentMessages: 0 },
    contextHandler: () => Promise.resolve(input),
  });
  let streamFailure: NinaGenerationError | undefined;
  const result = yield* Effect.tryPromise({
    try: (signal) => {
      // The stream, and the repair of a tool call inside it, end with the run
      // and with a stop.
      const stop = AbortSignal.any([signal, halt]);
      return agent.streamText(
        ctx,
        { threadId: turn.threadId, userId: turn.userId },
        {
          promptMessageId: turn.promptMessageId,
          // Nina is offered the capabilities the policy allows this turn, in
          // every step of it: not the memory tool while the learner's memory
          // is paused. The first step starts only with one of them.
          activeTools: capabilities,
          abortSignal: stop,
          onChunk: ({ chunk }) => timing.observe(chunk),
          onLanguageModelCallStart: () => timing.reach("readyMs"),
          onError: ({ error }) => {
            streamFailure ??= generationFailure(error);
          },
          onAbort: ({ reason }) => {
            streamFailure ??= abortFailure(reason);
          },
          prepareStep: (step) =>
            runPromise(
              startNinaStep(chatStep.begin, capabilities, {
                ...step,
                messages: boundStep(restoreHeld(step.messages, held)),
              })
            ),
          repairToolCall: (options) =>
            runPromise(
              repairToolCall({
                ...options,
                userId: turn.userId,
                usageHandler,
              }),
              { signal: stop }
            ),
          stopWhen: isStepCount(20),
          timeout: handle.timeout,
        },
        { saveStreamDeltas: { sendSources: true, returnImmediately: false } }
      );
    },
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
