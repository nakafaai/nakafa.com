import { Effect, Fiber, Ref } from "effect";
import { createConversationScrollSnapshot } from "@/components/school/classes/forum/conversation/data/scroll/snapshot";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view/model";
import {
  hasViewportMeasurementMoved,
  isViewportDetachedScroll,
  type ViewportMeasurement,
  type ViewportState,
} from "@/components/school/classes/forum/conversation/viewport/model";
import {
  PERSIST_DELAY_MS,
  type ViewportRuntime,
} from "@/components/school/classes/forum/conversation/viewport/runtime";

/** Debounces snapshot persistence after scroll measurement changes. */
export function scheduleViewportSnapshotPersist(runtime: ViewportRuntime) {
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

/** Saves the current snapshot immediately and clears pending debounce work. */
export function flushCurrentSnapshot(runtime: ViewportRuntime) {
  return Effect.gen(function* () {
    const currentFiber = yield* Ref.get(runtime.persistFiberRef);

    if (currentFiber) {
      yield* Fiber.interrupt(currentFiber);
      yield* Ref.set(runtime.persistFiberRef, null);
    }

    const previousMeasurement = yield* captureLiveMeasurement(runtime);
    yield* persistCurrentSnapshot(runtime, { previousMeasurement });
  });
}

/** Captures live scroller geometry before synchronous boundary persistence. */
function captureLiveMeasurement(runtime: ViewportRuntime) {
  return Effect.gen(function* () {
    const previousMeasurement = yield* Ref.get(runtime.lastMeasurementRef);
    const measurement = yield* Effect.sync(() =>
      runtime.adapters.scroller.measure()
    );

    if (!measurement) {
      return previousMeasurement;
    }

    yield* Ref.set(runtime.lastMeasurementRef, measurement);
    return previousMeasurement;
  });
}

/** Persists one stable snapshot from the viewport-owned captured measurement. */
export function persistCurrentSnapshot(
  runtime: ViewportRuntime,
  options: { previousMeasurement?: ViewportMeasurement | null } = {}
) {
  return Effect.gen(function* () {
    const activeTranscript = yield* Ref.get(runtime.activeTranscriptRef);
    const state = yield* Ref.get(runtime.stateRef);
    const measurement = yield* Ref.get(runtime.lastMeasurementRef);
    const hasPendingLatestIntent = isPendingLatestIntent(state);
    const hasInterruptedPlacement = hasFlushInterruptedPlacement({
      measurement,
      previousMeasurement: options.previousMeasurement ?? null,
      state,
    });
    const shouldPersistLatestIntent =
      hasPendingLatestIntent && !hasInterruptedPlacement;

    if (
      !(
        state.lifecycle === "ready" ||
        shouldPersistLatestIntent ||
        hasInterruptedPlacement
      )
    ) {
      return;
    }

    if (!(activeTranscript && measurement)) {
      return;
    }

    const isAtBottom = shouldPersistLatestIntent || measurement.isAtLatest;
    const view = getPersistedSnapshotView({
      isAtBottom,
      measurementView: measurement.view,
    });

    yield* runtime.adapters.session
      .saveSnapshot(
        createConversationScrollSnapshot({
          isAtBottom,
          lastPostId: activeTranscript.lastPostId,
          offset: measurement.offset,
          renderedRowCount: activeTranscript.rows.length,
          view,
        })
      )
      .pipe(Effect.catchTag("ViewportSessionError", () => Effect.void));
  });
}

/** Returns whether synchronous flush observed a moved pending placement before the event queue did. */
function hasFlushInterruptedPlacement({
  measurement,
  previousMeasurement,
  state,
}: {
  measurement: ViewportMeasurement | null;
  previousMeasurement: ViewportMeasurement | null;
  state: ViewportState;
}) {
  const pendingPlacement = state.pendingPlacement;

  if (!(measurement && pendingPlacement && previousMeasurement)) {
    return false;
  }

  if (pendingPlacement.view.kind === "bottom") {
    return isViewportDetachedScroll({
      measurement,
      pendingPlacement,
      previousMeasurement,
    });
  }

  return hasViewportMeasurementMoved({ measurement, previousMeasurement });
}

/** Returns a semantic snapshot view, using bottom only for latest or detached invalidation snapshots. */
function getPersistedSnapshotView({
  isAtBottom,
  measurementView,
}: {
  isAtBottom: boolean;
  measurementView: ConversationView | null;
}) {
  if (isAtBottom) {
    return { kind: "bottom" } satisfies ConversationView;
  }

  return measurementView ?? ({ kind: "bottom" } satisfies ConversationView);
}

/** Returns whether a pending placement should persist the user's latest intent. */
function isPendingLatestIntent(state: ViewportState) {
  const placement = state.pendingPlacement;

  return (
    state.lifecycle === "placing" &&
    placement?.view.kind === "bottom" &&
    placement.motion !== "instant"
  );
}
