import { Effect, Ref, SubscriptionRef } from "effect";
import { startViewportHighlight } from "@/components/school/classes/forum/conversation/viewport/highlight";
import {
  getViewportLatestAffinity,
  isViewportDetachedScroll,
  type ViewportMeasurement,
} from "@/components/school/classes/forum/conversation/viewport/model";
import { clearReachedBackTarget } from "@/components/school/classes/forum/conversation/viewport/navigate/back";
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
    });
    const shouldRetryPendingPlacement =
      source === "frame" &&
      pendingPlacement !== null &&
      !(hasUserDetachedFromLatest || reachedPendingPlacement);

    yield* updateViewportState(runtime, (state) => ({
      ...state,
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
      runtime.adapters.scroller.place(pendingPlacement);
    }

    if (reachedPendingPlacement && pendingPlacement?.highlightPostId) {
      yield* startViewportHighlight(runtime, pendingPlacement.highlightPostId);
    }

    yield* markLastVisibleViewportPostRead(
      runtime,
      measurement.lastVisiblePostId
    );
    if (!pendingPlacement) {
      yield* clearReachedBackTarget(runtime);
    }
    yield* scheduleViewportSnapshotPersist(runtime);
  });
}
