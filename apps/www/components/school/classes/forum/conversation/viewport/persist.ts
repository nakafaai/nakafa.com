import { Effect, Fiber, Ref } from "effect";
import { createConversationScrollSnapshot } from "@/components/school/classes/forum/conversation/data/scroll/snapshot";
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

/** Persists one stable latest snapshot or detached invalidation snapshot. */
export function persistCurrentSnapshot(runtime: ViewportRuntime) {
  return Effect.gen(function* () {
    const activeTranscript = yield* Ref.get(runtime.activeTranscriptRef);
    const state = yield* Ref.get(runtime.stateRef);
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
