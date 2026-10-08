import {
  Effect,
  Exit,
  type Fiber,
  Queue,
  Ref,
  Scope,
  SubscriptionRef,
} from "effect";
import { ConversationViewportAdapters } from "@/components/school/classes/forum/conversation/viewport/adapter";
import { runViewportEventLoop } from "@/components/school/classes/forum/conversation/viewport/events";
import {
  initialViewportState,
  type ViewportEvent,
  type ViewportMeasurement,
} from "@/components/school/classes/forum/conversation/viewport/model";
import { flushCurrentSnapshot } from "@/components/school/classes/forum/conversation/viewport/persist";
import {
  type ActiveTranscript,
  type ForumPostId,
  VIEWPORT_EVENT_CAPACITY,
  type ViewportRuntime,
} from "@/components/school/classes/forum/conversation/viewport/runtime";

/** Creates one Effect-owned Viewport service instance for an opened Forum Conversation. */
export const makeConversationViewport = Effect.gen(function* () {
  const adapters = yield* ConversationViewportAdapters;
  const eventQueue = yield* Queue.bounded<ViewportEvent>(
    VIEWPORT_EVENT_CAPACITY
  );
  const scope = yield* Scope.make();
  const stateRef = yield* SubscriptionRef.make(initialViewportState);
  const activeTranscriptRef = yield* Ref.make<ActiveTranscript>(null);
  const highlightFiberRef = yield* Ref.make<Fiber.Fiber<void, never> | null>(
    null
  );
  const highlightTokenRef = yield* Ref.make(0);
  const persistFiberRef = yield* Ref.make<Fiber.Fiber<void, never> | null>(
    null
  );
  const lastMeasurementRef = yield* Ref.make<ViewportMeasurement | null>(null);
  const lastReadPostIdRef = yield* Ref.make<ForumPostId | null>(null);
  const runtime = {
    activeTranscriptRef,
    adapters,
    eventQueue,
    highlightFiberRef,
    highlightTokenRef,
    lastMeasurementRef,
    lastReadPostIdRef,
    persistFiberRef,
    scope,
    stateRef,
  } satisfies ViewportRuntime;
  yield* Effect.forkIn(runViewportEventLoop(runtime), scope);
  return {
    /** Emits each derived Viewport state update for React subscription. */
    changes: SubscriptionRef.changes(stateRef),
    /** Enqueues one serialized Viewport event. */
    dispatch: (event: ViewportEvent) =>
      Queue.offer(eventQueue, event).pipe(Effect.asVoid),
    /** Persists the current semantic snapshot immediately when one exists. */
    flushSnapshot: flushCurrentSnapshot(runtime),
    /** Reads the current derived Viewport state. */
    getState: SubscriptionRef.get(stateRef),
    /** Stops the event loop and releases all Viewport fibers. */
    shutdown: Queue.shutdown(eventQueue).pipe(
      Effect.andThen(Scope.close(scope, Exit.succeed(undefined)))
    ),
  };
});

/** Public Effect-owned viewport interface exposed to React boundaries. */
export type ConversationViewport = Effect.Success<
  typeof makeConversationViewport
>;
