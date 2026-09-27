import { Agent, type UsageHandler } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  ActionCtx,
  MutationRunner,
} from "@repo/backend/confect/_generated/services";
import { createCapabilities } from "@repo/backend/confect/nina/capabilities";
import { getModelProviderOptions } from "@repo/backend/confect/nina/config/model";
import { getGatewayModel } from "@repo/backend/confect/nina/config/provider";
import { gatewayProviderOptions } from "@repo/backend/confect/nina/config/routing";
import { chatStreamTimeout } from "@repo/backend/confect/nina/config/timeouts";
import { createNinaAgentContext } from "@repo/backend/confect/nina/contract/turn";
import {
  generationFailure,
  NinaGenerationError,
} from "@repo/backend/confect/nina/failure";
import { boundHistory } from "@repo/backend/confect/nina/history";
import { generatePresentation } from "@repo/backend/confect/nina/presentation";
import { createNinaSystemPrompt } from "@repo/backend/confect/nina/prompt/system";
import { repairToolCall } from "@repo/backend/confect/nina/repair";
import { createNinaPrepareStep } from "@repo/backend/confect/nina/step";
import { NinaUsage } from "@repo/backend/confect/nina/usage.spec";
import { isStepCount } from "ai";
import { Effect, Schema } from "effect";

/** The scheduled Confect action owns generation; Agent owns its persistent stream. */
export const generateResponse = Effect.fn("nina.generate")(function* (
  turn: Extract<NinaTurnsDoc, { phase: "active" }>
) {
  const ctx = yield* ActionCtx;
  const mutate = yield* MutationRunner;
  const services = yield* Effect.context<ActionCtx>();
  // SDK callbacks are framework boundaries. Domain programs keep composing Effects.
  const runPromise = Effect.runPromiseWith(services);
  const usageHandler: UsageHandler = (_ctx, event) =>
    runPromise(
      Schema.decodeUnknownEffect(NinaUsage)({
        agent: event.agentName,
        model: event.model,
        provider: event.provider,
        input: event.usage.inputTokens ?? 0,
        output: event.usage.outputTokens ?? 0,
      }).pipe(
        Effect.flatMap((usage) =>
          mutate(refs.internal.nina.usage.record, { turnId: turn._id, usage })
        ),
        Effect.asVoid
      )
    );
  const runtime = {
    currentDate: new Date(turn._creationTime).toISOString(),
  };
  const context = createNinaAgentContext({
    page: turn.page,
    user: turn.user,
    runtime,
  });
  const instructions = createNinaSystemPrompt({
    page: turn.page,
    user: turn.user,
    runtime,
  });
  const tools = yield* createCapabilities(
    turn.userId,
    context,
    turn.page.locale,
    turn.modelId,
    usageHandler
  );
  const agent = new Agent(components.nina, {
    name: "nina",
    languageModel: yield* getGatewayModel(turn.modelId).pipe(
      Effect.mapError(
        () => new NinaGenerationError({ reason: "service-configuration" })
      )
    ),
    instructions,
    tools,
    usageHandler,
    contextOptions: { recentMessages: 50, excludeToolMessages: false },
    contextHandler: (_ctx, { allMessages }) =>
      runPromise(boundHistory(allMessages)),
  });
  const prepare = createNinaPrepareStep({
    instructions,
    needsPageFetch: turn.page.needsFetch,
  });
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
            streamFailure ??= new NinaGenerationError({
              reason: "interrupted",
            });
          },
          prepareStep: (step) =>
            runPromise(
              boundHistory(step.messages).pipe(
                Effect.map((messages) => prepare({ ...step, messages }))
              )
            ),
          repairToolCall: (options) =>
            runPromise(
              repairToolCall({
                ...options,
                userId: turn.userId,
                needsPageFetch: turn.page.needsFetch,
                url: context.url,
                usageHandler,
              })
            ),
          stopWhen: isStepCount(20),
          providerOptions: {
            gateway: gatewayProviderOptions,
            google: getModelProviderOptions(turn.modelId),
          },
          timeout: { ...chatStreamTimeout, totalMs: 420_000 },
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
    yield* generatePresentation(turn, usageHandler);
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
