import { Effect, Ref, SubscriptionRef } from "effect";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import type { ConversationView } from "@/components/school/classes/forum/conversation/data/view/model";
import { startViewportHighlight } from "@/components/school/classes/forum/conversation/viewport/highlight";
import {
  getViewportLatestAffinity,
  hasViewportMeasurementMoved,
  isViewportDetachedScroll,
  type ViewportEvent,
  type ViewportMeasurement,
  type ViewportPlacement,
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
    const activeTranscript = yield* Ref.get(runtime.activeTranscriptRef);
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
    const pendingPlacementForAffinity = reachedPendingPlacement
      ? null
      : pendingPlacement;
    const latestAffinity = getViewportLatestAffinity({
      currentAffinity: currentState.latestAffinity,
      hasUserDetachedFromLatest,
      isAtLatest: measurement.isAtLatest,
      pendingPlacement: pendingPlacementForAffinity,
    });
    const shouldRetryPendingPlacement =
      source === "frame" &&
      pendingPlacement !== null &&
      !(hasUserDetachedFromLatest || reachedPendingPlacement);
    const reachedLatestPlacement =
      pendingPlacement?.view.kind === "bottom" &&
      reachedPendingPlacement &&
      measurement.isAtLatest;
    const didScrollMeasurementMove =
      source === "scroll" &&
      previousMeasurement !== null &&
      hasViewportMeasurementMoved({
        measurement,
        previousMeasurement,
      });
    const didManualScrollInterruptPlacement =
      didScrollMeasurementMove &&
      pendingPlacement !== null &&
      !reachedPendingPlacement &&
      hasScrollMeasurementInterruptedPlacement({
        activeTranscript,
        hasUserDetachedFromLatest,
        measurement,
        pendingPlacement,
        previousMeasurement,
      });
    const didManualScrollLeaveBackTarget =
      currentState.backStack.length > 0 &&
      pendingPlacement === null &&
      !measurement.isAtLatest &&
      didScrollMeasurementMove;
    const shouldCancelPendingPlacement =
      hasUserDetachedFromLatest ||
      didManualScrollInterruptPlacement ||
      reachedPendingPlacement;
    const shouldClearBackStack =
      currentState.backStack.length > 0 &&
      ((measurement.isAtLatest &&
        (pendingPlacement === null || reachedLatestPlacement)) ||
        didManualScrollLeaveBackTarget ||
        didManualScrollInterruptPlacement);

    yield* updateViewportState(runtime, (state) => ({
      ...state,
      backStack: shouldClearBackStack ? [] : state.backStack,
      hasOverflow: measurement.hasOverflow,
      isAtLatest: measurement.isAtLatest,
      latestAffinity,
      lifecycle: shouldCancelPendingPlacement ? "ready" : state.lifecycle,
      pendingPlacement: shouldCancelPendingPlacement
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

/** Returns whether one manual measurement should cancel the pending Placement. */
function hasScrollMeasurementInterruptedPlacement({
  activeTranscript,
  hasUserDetachedFromLatest,
  measurement,
  pendingPlacement,
  previousMeasurement,
}: {
  activeTranscript: ActiveTranscriptModel | null;
  hasUserDetachedFromLatest: boolean;
  measurement: ViewportMeasurement;
  pendingPlacement: ViewportPlacement;
  previousMeasurement: ViewportMeasurement;
}) {
  if (pendingPlacement.view.kind === "bottom") {
    return hasUserDetachedFromLatest;
  }

  const targetIndex = getViewportViewRowIndex(
    activeTranscript,
    pendingPlacement.view
  );
  const previousIndex = getViewportViewRowIndex(
    activeTranscript,
    previousMeasurement.view
  );
  const nextIndex = getViewportViewRowIndex(activeTranscript, measurement.view);

  if (targetIndex === null || previousIndex === null || nextIndex === null) {
    return false;
  }

  return (
    Math.abs(nextIndex - targetIndex) > Math.abs(previousIndex - targetIndex)
  );
}

/** Maps one semantic Viewport view to its Transcript row index when possible. */
function getViewportViewRowIndex(
  activeTranscript: ActiveTranscriptModel | null,
  view: ConversationView | null
) {
  if (!(activeTranscript && view)) {
    return null;
  }

  if (view.kind === "bottom") {
    return Math.max(0, activeTranscript.rows.length - 1);
  }

  return activeTranscript.rowIndexByPostId.get(view.postId) ?? null;
}

/** Cancels semantic jump state when direct user input takes over scrolling. */
export function handleViewportUserScroll(
  runtime: ViewportRuntime,
  event: Extract<ViewportEvent, { type: "user-scroll" }>
) {
  return updateViewportState(runtime, (state) => {
    const latestAffinity = event.awayFromLatest
      ? "detached"
      : state.latestAffinity;
    const hasNoJumpState =
      state.backStack.length === 0 && state.pendingPlacement === null;

    if (hasNoJumpState && latestAffinity === state.latestAffinity) {
      return state;
    }

    return {
      ...state,
      backStack: [],
      latestAffinity,
      lifecycle: "ready",
      pendingPlacement: null,
    };
  });
}
