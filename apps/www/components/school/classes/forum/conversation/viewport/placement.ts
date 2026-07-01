import { Effect } from "effect";
import type {
  ViewportMeasurement,
  ViewportPlacement,
} from "@/components/school/classes/forum/conversation/viewport/model";
import type { ViewportRuntime } from "@/components/school/classes/forum/conversation/viewport/runtime";
import { updateViewportState } from "@/components/school/classes/forum/conversation/viewport/state";

/** Requests one virtualizer placement and records the pending target. */
export function startViewportPlacement(
  runtime: ViewportRuntime,
  placement: ViewportPlacement
) {
  return Effect.gen(function* () {
    const didPlace = runtime.adapters.scroller.place(placement);

    if (!didPlace) {
      yield* updateViewportState(runtime, (state) => ({
        ...state,
        lifecycle: "ready",
        pendingPlacement: null,
      }));
      return;
    }

    yield* updateViewportState(runtime, (state) => ({
      ...state,
      highlightedPostId: null,
      latestAffinity: placement.view.kind === "bottom" ? "latest" : "detached",
      lifecycle: "placing",
      pendingPlacement: placement,
    }));
  });
}

/** Returns whether the current measurement satisfies the pending placement. */
export function hasReachedViewportPlacement({
  measurement,
  placement,
  runtime,
}: {
  measurement: ViewportMeasurement;
  placement: ViewportPlacement;
  runtime: ViewportRuntime;
}) {
  if (placement.completion === "settled") {
    return runtime.adapters.scroller.isViewSettled(placement.view);
  }

  if (placement.view.kind === "bottom") {
    return measurement.isAtLatest;
  }

  return runtime.adapters.scroller.isViewReached(placement.view);
}
