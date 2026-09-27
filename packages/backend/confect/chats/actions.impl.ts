import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ActionCtx as ActionCtxService,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { requireAuthForAction } from "@repo/backend/confect/auth/session";
import spec from "@repo/backend/confect/chats/actions.spec";
import { Duration, Effect, Layer } from "effect";

/**
 * Enqueues saveAssistantResponse as a scheduled internal mutation.
 * Guarantees exactly-once execution with automatic retry, unlike a direct
 * fetchMutation call which has no retry on transient failures.
 *
 * @see https://docs.convex.dev/scheduling/scheduled-functions
 */
const scheduleSaveAssistantResponse = FunctionImpl.make(
  databaseSchema,
  spec,
  "scheduleSaveAssistantResponse",
  Effect.fn("chats.actions.scheduleSaveAssistantResponse")(function* (args) {
    const ctx = yield* ActionCtxService;
    const scheduler = yield* Scheduler;
    const { appUser } = yield* requireAuthForAction(ctx);
    yield* scheduler.runAfter(
      Duration.zero,
      refs.internal.chats.assistantResponses.saveAssistantResponse,
      { userId: appUser._id, ...args }
    );
    return null;
  })
);
const scheduleSaveAssistantFailure = FunctionImpl.make(
  databaseSchema,
  spec,
  "scheduleSaveAssistantFailure",
  Effect.fn("chats.actions.scheduleSaveAssistantFailure")(function* (args) {
    const ctx = yield* ActionCtxService;
    const scheduler = yield* Scheduler;
    const { appUser } = yield* requireAuthForAction(ctx);
    yield* scheduler.runAfter(
      Duration.zero,
      refs.internal.chats.assistantResponses.saveAssistantFailure,
      { userId: appUser._id, ...args }
    );
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(scheduleSaveAssistantResponse),
  Layer.provide(scheduleSaveAssistantFailure),
  GroupImpl.finalize
);
