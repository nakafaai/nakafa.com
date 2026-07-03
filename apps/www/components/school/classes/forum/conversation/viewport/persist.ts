import { Effect, Fiber, Ref } from "effect";
import { createConversationScrollSnapshot } from "@/components/school/classes/forum/conversation/data/scroll/snapshot";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view/model";
import type { ViewportState } from "@/components/school/classes/forum/conversation/viewport/model";
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

    yield* persistCurrentSnapshot(runtime);
  });
}

/** Persists one stable snapshot from the viewport-owned captured measurement. */
export function persistCurrentSnapshot(runtime: ViewportRuntime) {
  return Effect.gen(function* () {
    const activeTranscript = yield* Ref.get(runtime.activeTranscriptRef);
    const state = yield* Ref.get(runtime.stateRef);
    const measurement = yield* Ref.get(runtime.lastMeasurementRef);
    const hasPendingLatestIntent = isPendingLatestIntent(state);

    if (!(state.lifecycle === "ready" || hasPendingLatestIntent)) {
      return;
    }

    if (state.pendingPlacement && !hasPendingLatestIntent) {
      return;
    }

    if (!(activeTranscript && measurement)) {
      return;
    }

    const isAtBottom = hasPendingLatestIntent || measurement.isAtLatest;
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
