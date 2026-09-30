import { Agent } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  ActionCtx,
  QueryRunner,
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
import { assembleContext, boundStep } from "@repo/backend/confect/nina/history";
import { readPageContext } from "@repo/backend/confect/nina/page";
import { formatFocusPrompt } from "@repo/backend/confect/nina/prompt/focus";
import { createNinaSystemPrompt } from "@repo/backend/confect/nina/prompt/system";
import { repairToolCall } from "@repo/backend/confect/nina/repair";
import { createNinaPrepareStep } from "@repo/backend/confect/nina/step";
import { createUsageHandler } from "@repo/backend/confect/nina/usage";
import { isStepCount } from "ai";
import { Effect } from "effect";

/** A focused turn never answers without its rechecked, signed question. */
const readFocus = Effect.fn("nina.generate.focus")(
  function* (turnId: NinaTurnsDoc["_id"]) {
    const source = yield* (yield* QueryRunner)(refs.internal.nina.focus.read, {
      turnId,
    });
    if (!source) {
      return yield* new NinaGenerationError({ reason: "unknown" });
    }
    return yield* formatFocusPrompt(source);
  },
  Effect.mapError(() => new NinaGenerationError({ reason: "unknown" }))
);

/** The scheduled Confect action owns generation; Agent owns its persistent stream. */
export const generateResponse = Effect.fn("nina.generate")(function* (
  turn: Extract<NinaTurnsDoc, { phase: "active" }>
) {
  const ctx = yield* ActionCtx;
  const services = yield* Effect.context<ActionCtx>();
  // SDK callbacks are framework boundaries. Domain programs keep composing Effects.
  const runPromise = Effect.runPromiseWith(services);
  const usageHandler = yield* createUsageHandler(turn._id);
  const runtime = {
    currentDate: new Date(turn._creationTime).toISOString(),
  };
  const context = createNinaAgentContext({
    page: turn.page,
    user: turn.user,
    runtime,
  });
  const { focus, pageContent, summary } = yield* Effect.all(
    {
      focus: turn.page.nina.focus ? readFocus(turn._id) : Effect.undefined,
      pageContent: turn.page.needsFetch
        ? readPageContext(context.url)
        : Effect.undefined,
      summary: (yield* QueryRunner)(refs.internal.nina.summaries.read, {
        chatId: turn.chatId,
      }).pipe(Effect.orDie),
    },
    { concurrency: "unbounded" }
  );
  const instructions = createNinaSystemPrompt({
    ...(focus === undefined ? {} : { focus }),
    ...(pageContent === undefined ? {} : { pageContent }),
    ...(summary ? { summary: summary.text } : {}),
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
            streamFailure ??= new NinaGenerationError({
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
