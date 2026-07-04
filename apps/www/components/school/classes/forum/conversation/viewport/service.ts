import {
  Effect,
  Exit,
  Queue,
  Ref,
  Scope,
  type Stream,
  SubscriptionRef,
} from "effect";
import { ConversationViewportAdapters } from "@/components/school/classes/forum/conversation/viewport/adapter";
import { runViewportEventLoop } from "@/components/school/classes/forum/conversation/viewport/events";
import {
  initialViewportState,
  type ViewportEvent,
  type ViewportMeasurement,
  type ViewportState,
} from "@/components/school/classes/forum/conversation/viewport/model";
import { flushCurrentSnapshot } from "@/components/school/classes/forum/conversation/viewport/persist";
import {
  type ActiveTranscript,
  type ForumPostId,
  type RuntimeFiber,
  VIEWPORT_EVENT_CAPACITY,
  type ViewportRuntime,
} from "@/components/school/classes/forum/conversation/viewport/runtime";

/** Public Effect-owned viewport interface exposed to React boundaries. */
export interface ConversationViewport {
  /** Emits each derived Viewport state update for React subscription. */
  changes: Stream.Stream<ViewportState>;
  /** Enqueues one serialized Viewport event. */
  dispatch: (event: ViewportEvent) => Effect.Effect<void>;
  /** Persists the current semantic snapshot immediately when one exists. */
  flushSnapshot: Effect.Effect<void>;
  /** Reads the current derived Viewport state. */
  getState: Effect.Effect<ViewportState>;
  /** Stops the event loop and releases all Viewport fibers. */
  shutdown: Effect.Effect<void>;
}

/** Creates one Effect-owned Viewport service instance for an opened Forum Conversation. */
export function makeConversationViewport() {
  return Effect.gen(function* () {
    const adapters = yield* ConversationViewportAdapters;
    const eventQueue = yield* Queue.bounded<ViewportEvent>(
      VIEWPORT_EVENT_CAPACITY
    );
    const scope = yield* Scope.make();
    const stateRef = yield* SubscriptionRef.make(initialViewportState);
    const activeTranscriptRef = yield* Ref.make<ActiveTranscript>(null);
    const highlightFiberRef = yield* Ref.make<RuntimeFiber | null>(null);
    const highlightTokenRef = yield* Ref.make(0);
    const persistFiberRef = yield* Ref.make<RuntimeFiber | null>(null);
    const lastMeasurementRef = yield* Ref.make<ViewportMeasurement | null>(
      null
    );
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
      changes: stateRef.changes,
      dispatch: (event) => Queue.offer(eventQueue, event).pipe(Effect.asVoid),
      flushSnapshot: flushCurrentSnapshot(runtime),
      getState: SubscriptionRef.get(stateRef),
      shutdown: Queue.shutdown(eventQueue).pipe(
        Effect.zipRight(Scope.close(scope, Exit.succeed(undefined)))
      ),
    } satisfies ConversationViewport;
  });
}
