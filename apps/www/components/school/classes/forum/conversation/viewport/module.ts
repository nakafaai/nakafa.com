import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  Effect,
  Exit,
  Fiber,
  Queue,
  Ref,
  Scope,
  type Stream,
  SubscriptionRef,
} from "effect";
import { createConversationScrollSnapshot } from "@/components/school/classes/forum/conversation/data/scroll/snapshot";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import {
  type ConversationView,
  isConversationViewAtPost,
} from "@/components/school/classes/forum/conversation/data/view/model";
import type { ViewportAdapters } from "@/components/school/classes/forum/conversation/viewport/adapter";
import {
  deriveViewportState,
  getOpeningPlacement,
  getViewportLatestAffinity,
  initialViewportState,
  isViewportDetachedScroll,
  pushViewportBackView,
  type ViewportEvent,
  type ViewportMeasurement,
  type ViewportPlacement,
  type ViewportState,
} from "@/components/school/classes/forum/conversation/viewport/model";

const HIGHLIGHT_DURATION_MS = 5000;
const PERSIST_DELAY_MS = 160;
const VIEWPORT_EVENT_CAPACITY = 64;

interface RuntimeState {
  activeTranscriptRef: Ref.Ref<ActiveTranscriptModel | null>;
  adapters: ViewportAdapters;
  eventQueue: Queue.Queue<ViewportEvent>;
  highlightFiberRef: Ref.Ref<Fiber.RuntimeFiber<void, never> | null>;
  lastMeasurementRef: Ref.Ref<ViewportMeasurement | null>;
  lastReadPostIdRef: Ref.Ref<Id<"schoolClassForumPosts"> | null>;
  persistFiberRef: Ref.Ref<Fiber.RuntimeFiber<void, never> | null>;
  scope: Scope.CloseableScope;
  stateRef: SubscriptionRef.SubscriptionRef<ViewportState>;
}

export interface ConversationViewport {
  changes: Stream.Stream<ViewportState>;
  dispatch: (event: ViewportEvent) => Effect.Effect<void>;
  getState: Effect.Effect<ViewportState>;
  shutdown: Effect.Effect<void>;
}

/** Creates one Effect-owned Viewport Module instance for an opened Forum Conversation. */
export function makeConversationViewport(
  adapters: ViewportAdapters
): Effect.Effect<ConversationViewport> {
  return Effect.gen(function* () {
    const eventQueue = yield* Queue.bounded<ViewportEvent>(
      VIEWPORT_EVENT_CAPACITY
    );
    const scope = yield* Scope.make();
    const stateRef = yield* SubscriptionRef.make(initialViewportState);
    const activeTranscriptRef = yield* Ref.make<ActiveTranscriptModel | null>(
      null
    );
    const highlightFiberRef = yield* Ref.make<Fiber.RuntimeFiber<
      void,
      never
    > | null>(null);
    const persistFiberRef = yield* Ref.make<Fiber.RuntimeFiber<
      void,
      never
    > | null>(null);
    const lastMeasurementRef = yield* Ref.make<ViewportMeasurement | null>(
      null
    );
    const lastReadPostIdRef =
      yield* Ref.make<Id<"schoolClassForumPosts"> | null>(null);
    const runtime = {
      activeTranscriptRef,
      adapters,
      eventQueue,
      highlightFiberRef,
      lastMeasurementRef,
      lastReadPostIdRef,
      persistFiberRef,
      scope,
      stateRef,
    } satisfies RuntimeState;

    yield* Effect.forkIn(runEventLoop(runtime), scope);

    return {
      changes: stateRef.changes,
      dispatch: (event) => Queue.offer(eventQueue, event).pipe(Effect.asVoid),
      getState: SubscriptionRef.get(stateRef),
      shutdown: Queue.shutdown(eventQueue).pipe(
        Effect.zipRight(Scope.close(scope, Exit.succeed(undefined)))
      ),
    } satisfies ConversationViewport;
  });
}

function runEventLoop(runtime: RuntimeState) {
  return Queue.take(runtime.eventQueue).pipe(
    Effect.flatMap((event) => handleEvent(runtime, event)),
    Effect.forever
  );
}

function handleEvent(runtime: RuntimeState, event: ViewportEvent) {
  switch (event.type) {
    case "back":
      return handleBack(runtime);
    case "highlight-expired":
      return updateState(runtime, (state) => ({
        ...state,
        highlightedPostId: null,
      }));
    case "latest":
      return startPlacement(runtime, {
        completion: "reached",
        highlightPostId: null,
        view: { kind: "bottom" },
      });
    case "measure":
      return handleMeasurement(runtime, event.measurement, event.source);
    case "persist":
      return persistCurrentSnapshot(runtime);
    case "post":
      return handlePost(runtime, event.postId);
    case "transcript":
      return handleTranscript(runtime, event);
    default:
      return Effect.void;
  }
}

function handleTranscript(
  runtime: RuntimeState,
  event: Extract<ViewportEvent, { type: "transcript" }>
) {
  return Effect.gen(function* () {
    yield* Ref.set(runtime.activeTranscriptRef, event.activeTranscript);
    const currentState = yield* SubscriptionRef.get(runtime.stateRef);

    if (currentState.lifecycle === "opening") {
      const placement = getOpeningPlacement({
        activeTranscript: event.activeTranscript,
        savedSnapshot: event.savedSnapshot,
        unreadCue: event.unreadCue,
      });

      return yield* startPlacement(runtime, placement);
    }

    if (currentState.latestAffinity !== "latest") {
      return;
    }

    yield* startPlacement(runtime, {
      completion: "reached",
      highlightPostId: null,
      motion: "instant",
      view: { kind: "bottom" },
    });
  });
}

function handleMeasurement(
  runtime: RuntimeState,
  measurement: ViewportMeasurement | null,
  source: "frame" | "scroll"
) {
  if (!measurement) {
    return Effect.void;
  }

  return Effect.gen(function* () {
    const previousMeasurement = yield* Ref.get(runtime.lastMeasurementRef);
    yield* Ref.set(runtime.lastMeasurementRef, measurement);
    const currentState = yield* SubscriptionRef.get(runtime.stateRef);
    const pendingPlacement = currentState.pendingPlacement;
    const hasUserDetachedFromLatest =
      source === "scroll" &&
      !measurement.isAtLatest &&
      isViewportDetachedScroll({
        measurement,
        pendingPlacement,
        previousMeasurement,
      });
    const reachedPendingPlacement = pendingPlacement
      ? hasReachedPendingPlacement(runtime, pendingPlacement, measurement)
      : false;
    const latestAffinity = getViewportLatestAffinity({
      currentAffinity: currentState.latestAffinity,
      hasUserDetachedFromLatest,
      isAtLatest: measurement.isAtLatest,
    });
    const shouldRetryPendingPlacement =
      source === "frame" &&
      pendingPlacement !== null &&
      !reachedPendingPlacement;

    yield* updateState(runtime, (state) => ({
      ...state,
      hasOverflow: measurement.hasOverflow,
      isAtLatest: measurement.isAtLatest,
      latestAffinity,
      lifecycle: reachedPendingPlacement ? "ready" : state.lifecycle,
      pendingPlacement: reachedPendingPlacement ? null : state.pendingPlacement,
    }));

    if (shouldRetryPendingPlacement && pendingPlacement) {
      runtime.adapters.scroller.place(pendingPlacement);
    }

    if (reachedPendingPlacement && pendingPlacement?.highlightPostId) {
      yield* startHighlight(runtime, pendingPlacement.highlightPostId);
    }

    yield* markLastVisiblePostRead(runtime, measurement.lastVisiblePostId);
    if (!pendingPlacement) {
      yield* clearReachedBackTarget(runtime);
    }
    yield* scheduleSnapshotPersist(runtime);
  });
}

function handlePost(
  runtime: RuntimeState,
  postId: Id<"schoolClassForumPosts">
) {
  return Effect.gen(function* () {
    const activeTranscript = yield* Ref.get(runtime.activeTranscriptRef);

    if (!activeTranscript?.rowIndexByPostId.has(postId)) {
      return;
    }

    const targetView = { kind: "post", postId } satisfies ConversationView;
    const currentView = runtime.adapters.scroller.captureView();

    if (runtime.adapters.scroller.isViewSettled(targetView)) {
      if (currentView && !isConversationViewAtPost(currentView, postId)) {
        yield* updateState(runtime, (state) => ({
          ...state,
          backStack: pushViewportBackView(state.backStack, currentView),
          latestAffinity: "detached",
        }));
      }

      yield* startHighlight(runtime, postId);
      return;
    }

    yield* updateState(runtime, (state) => ({
      ...state,
      backStack:
        currentView && !isConversationViewAtPost(currentView, postId)
          ? pushViewportBackView(state.backStack, currentView)
          : state.backStack,
      highlightedPostId: null,
      latestAffinity: "detached",
    }));

    yield* startPlacement(runtime, {
      align: "center",
      completion: "settled",
      highlightPostId: postId,
      view: targetView,
    });
  });
}

function handleBack(runtime: RuntimeState) {
  return Effect.gen(function* () {
    const state = yield* SubscriptionRef.get(runtime.stateRef);
    const backView = state.backStack.at(-1);

    if (!backView) {
      return;
    }

    yield* updateState(runtime, (current) => ({
      ...current,
      backStack: current.backStack.slice(0, -1),
      highlightedPostId: null,
    }));

    if (
      backView.kind === "post" &&
      !(yield* hasPost(runtime, backView.postId))
    ) {
      yield* startPlacement(runtime, {
        completion: "reached",
        highlightPostId: null,
        view: { kind: "bottom" },
      });
      return;
    }

    yield* startPlacement(runtime, {
      align: backView.kind === "post" ? "center" : undefined,
      completion: backView.kind === "post" ? "settled" : "reached",
      highlightPostId: null,
      view: backView,
    });
  });
}

function startPlacement(runtime: RuntimeState, placement: ViewportPlacement) {
  return Effect.gen(function* () {
    const didPlace = runtime.adapters.scroller.place(placement);

    if (!didPlace) {
      yield* updateState(runtime, (state) => ({
        ...state,
        lifecycle: "ready",
        pendingPlacement: null,
      }));
      return;
    }

    yield* updateState(runtime, (state) => ({
      ...state,
      highlightedPostId: null,
      latestAffinity: placement.view.kind === "bottom" ? "latest" : "detached",
      lifecycle: "placing",
      pendingPlacement: placement,
    }));
  });
}

function hasReachedPendingPlacement(
  runtime: RuntimeState,
  placement: ViewportPlacement,
  measurement: ViewportMeasurement
) {
  if (placement.completion === "settled") {
    return runtime.adapters.scroller.isViewSettled(placement.view);
  }

  if (placement.view.kind === "bottom") {
    return measurement.isAtLatest;
  }

  return runtime.adapters.scroller.isViewReached(placement.view);
}

function startHighlight(
  runtime: RuntimeState,
  postId: Id<"schoolClassForumPosts">
) {
  return Effect.gen(function* () {
    const currentFiber = yield* Ref.get(runtime.highlightFiberRef);

    if (currentFiber) {
      yield* Fiber.interrupt(currentFiber);
    }

    yield* updateState(runtime, (state) => ({
      ...state,
      highlightedPostId: postId,
    }));

    const fiber = yield* Effect.forkIn(
      runtime.adapters.timer
        .sleep(HIGHLIGHT_DURATION_MS)
        .pipe(
          Effect.zipRight(
            Queue.offer(runtime.eventQueue, { type: "highlight-expired" })
          ),
          Effect.asVoid
        ),
      runtime.scope
    );

    yield* Ref.set(runtime.highlightFiberRef, fiber);
  });
}

function markLastVisiblePostRead(
  runtime: RuntimeState,
  postId: Id<"schoolClassForumPosts"> | null
) {
  if (!postId) {
    return Effect.void;
  }

  return Effect.gen(function* () {
    const lastReadPostId = yield* Ref.get(runtime.lastReadPostIdRef);

    if (lastReadPostId === postId) {
      return;
    }

    yield* Ref.set(runtime.lastReadPostIdRef, postId);
    yield* Effect.forkIn(
      runtime.adapters.read
        .markPostRead(postId)
        .pipe(Effect.catchTag("ViewportReadError", () => Effect.void)),
      runtime.scope
    );
  });
}

function clearReachedBackTarget(runtime: RuntimeState) {
  return Effect.gen(function* () {
    const state = yield* SubscriptionRef.get(runtime.stateRef);
    const backView = state.backStack.at(-1);

    if (!(backView && runtime.adapters.scroller.isViewReached(backView))) {
      return;
    }

    yield* updateState(runtime, (current) => ({
      ...current,
      backStack: current.backStack.slice(0, -1),
    }));
  });
}

function scheduleSnapshotPersist(runtime: RuntimeState) {
  return Effect.gen(function* () {
    const currentFiber = yield* Ref.get(runtime.persistFiberRef);

    if (currentFiber) {
      yield* Fiber.interrupt(currentFiber);
    }

    const fiber = yield* Effect.forkIn(
      runtime.adapters.timer
        .sleep(PERSIST_DELAY_MS)
        .pipe(Effect.zipRight(persistCurrentSnapshot(runtime))),
      runtime.scope
    );

    yield* Ref.set(runtime.persistFiberRef, fiber);
  });
}

function persistCurrentSnapshot(runtime: RuntimeState) {
  return Effect.gen(function* () {
    const activeTranscript = yield* Ref.get(runtime.activeTranscriptRef);
    const state = yield* SubscriptionRef.get(runtime.stateRef);
    const measurement =
      runtime.adapters.scroller.measure() ??
      (yield* Ref.get(runtime.lastMeasurementRef));

    if (state.lifecycle !== "ready" || state.pendingPlacement) {
      return;
    }

    if (!(activeTranscript && measurement?.view)) {
      return;
    }

    yield* runtime.adapters.session
      .saveSnapshot(
        createConversationScrollSnapshot({
          isAtBottom: measurement.isAtLatest,
          lastPostId: activeTranscript.lastPostId,
          offset: measurement.offset,
          renderedRowCount: activeTranscript.rows.length,
          view: measurement.view,
        })
      )
      .pipe(Effect.catchTag("ViewportSessionError", () => Effect.void));
  });
}

function updateState(
  runtime: RuntimeState,
  updater: (state: ViewportState) => Omit<
    ViewportState,
    "shouldShowLatestButton"
  > & {
    shouldShowLatestButton?: boolean;
  }
) {
  return SubscriptionRef.update(runtime.stateRef, (state) =>
    deriveViewportState(updater(state))
  );
}

function hasPost(runtime: RuntimeState, postId: Id<"schoolClassForumPosts">) {
  return Effect.map(
    Ref.get(runtime.activeTranscriptRef),
    (activeTranscript) => !!activeTranscript?.rowIndexByPostId.has(postId)
  );
}
