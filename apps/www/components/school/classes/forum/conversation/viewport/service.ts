import { Effect, Exit, Queue, Scope, SubscriptionRef } from "effect";
import { ConversationViewportAdapters } from "@/components/school/classes/forum/conversation/viewport/adapter";
import { runViewportEventLoop } from "@/components/school/classes/forum/conversation/viewport/events";
import type { ViewportEvent } from "@/components/school/classes/forum/conversation/viewport/model";
import { flushCurrentSnapshot } from "@/components/school/classes/forum/conversation/viewport/persist";
import { makeViewportRuntime } from "@/components/school/classes/forum/conversation/viewport/runtime";

/** Creates one Effect-owned Viewport service instance for an opened Forum Conversation. */
export const makeConversationViewport = Effect.gen(function* () {
  const adapters = yield* ConversationViewportAdapters;
  const scope = yield* Scope.make();
  const runtime = yield* makeViewportRuntime(adapters, scope);
  yield* Effect.forkIn(runViewportEventLoop(runtime), scope);
  return {
    /** Emits each derived Viewport state update for React subscription. */
    changes: SubscriptionRef.changes(runtime.stateRef),
    /** Enqueues one serialized Viewport event. */
    dispatch: (event: ViewportEvent) =>
      Queue.offer(runtime.eventQueue, event).pipe(Effect.asVoid),
    /** Persists the current semantic snapshot immediately when one exists. */
    flushSnapshot: flushCurrentSnapshot(runtime),
    /** Reads the current derived Viewport state. */
    getState: SubscriptionRef.get(runtime.stateRef),
    /** Stops the event loop and releases all Viewport fibers. */
    shutdown: Queue.shutdown(runtime.eventQueue).pipe(
      Effect.andThen(Scope.close(scope, Exit.succeed(undefined)))
    ),
  };
});

/** Public Effect-owned viewport interface exposed to React boundaries. */
export type ConversationViewport = Effect.Success<
  typeof makeConversationViewport
>;
