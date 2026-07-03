import { Effect, Ref, SubscriptionRef } from "effect";
import { startViewportHighlight } from "@/components/school/classes/forum/conversation/viewport/highlight";
import {
  getViewportLatestAffinity,
  isViewportDetachedScroll,
  type ViewportMeasurement,
} from "@/components/school/classes/forum/conversation/viewport/model";
import { scheduleViewportSnapshotPersist } from "@/components/school/classes/forum/conversation/viewport/persist";
import { hasReachedViewportPlacement } from "@/components/school/classes/forum/conversation/viewport/placement";
import { markLastVisibleViewportPostRead } from "@/components/school/classes/forum/conversation/viewport/read";
import type { ViewportRuntime } from "@/components/school/classes/forum/conversation/viewport/runtime";
import { updateViewportState } from "@/components/school/classes/forum/conversation/viewport/state";

/** Applies one normalized scroll measurement to placement and control state. */
export function handleViewportMeasurement(
  runtime: ViewportRuntime,
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
      ? hasReachedViewportPlacement({
          measurement,
          placement: pendingPlacement,
          runtime,
        })
      : false;
    const latestAffinity = getViewportLatestAffinity({
      currentAffinity: currentState.latestAffinity,
      hasUserDetachedFromLatest,
      isAtLatest: measurement.isAtLatest,
      pendingPlacement,
    });
    const shouldRetryPendingPlacement =
      source === "frame" &&
      pendingPlacement !== null &&
      !(hasUserDetachedFromLatest || reachedPendingPlacement);
    const reachedLatestPlacement =
      pendingPlacement?.view.kind === "bottom" &&
      reachedPendingPlacement &&
      measurement.isAtLatest;
    const shouldClearBackStack =
      currentState.backStack.length > 0 &&
      measurement.isAtLatest &&
      (pendingPlacement === null || reachedLatestPlacement);

    yield* updateViewportState(runtime, (state) => ({
      ...state,
      backStack: shouldClearBackStack ? [] : state.backStack,
      hasOverflow: measurement.hasOverflow,
      isAtLatest: measurement.isAtLatest,
      latestAffinity,
      lifecycle:
        hasUserDetachedFromLatest || reachedPendingPlacement
          ? "ready"
          : state.lifecycle,
      pendingPlacement:
        hasUserDetachedFromLatest || reachedPendingPlacement
          ? null
          : state.pendingPlacement,
    }));

    if (shouldRetryPendingPlacement && pendingPlacement) {
      const didPlace = runtime.adapters.scroller.place(pendingPlacement);

      if (!didPlace) {
        yield* updateViewportState(runtime, (state) => ({
          ...state,
          lifecycle: "ready",
          pendingPlacement: null,
        }));
      }
    }

    if (reachedPendingPlacement && pendingPlacement?.highlightPostId) {
      yield* startViewportHighlight(runtime, pendingPlacement.highlightPostId);
    }

    yield* markLastVisibleViewportPostRead(
      runtime,
      measurement.lastVisiblePostId
    );
    yield* scheduleViewportSnapshotPersist(runtime);
  });
}

/** Cancels semantic jump state when direct user input takes over scrolling. */
export function handleViewportUserScroll(runtime: ViewportRuntime) {
  return updateViewportState(runtime, (state) => {
    if (state.backStack.length === 0 && state.pendingPlacement === null) {
      return state;
    }

    return {
      ...state,
      backStack: [],
      lifecycle: "ready",
      pendingPlacement: null,
    };
  });
}
