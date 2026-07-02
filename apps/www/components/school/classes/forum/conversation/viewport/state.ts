import { SubscriptionRef } from "effect";
import {
  deriveViewportState,
  type ViewportState,
} from "@/components/school/classes/forum/conversation/viewport/model";
import type {
  ViewportRuntime,
  ViewportStateDraft,
} from "@/components/school/classes/forum/conversation/viewport/runtime";

/** Applies one canonical state update and rederives rendered control facts. */
export function updateViewportState(
  runtime: ViewportRuntime,
  updater: (state: ViewportState) => ViewportStateDraft
) {
  return SubscriptionRef.update(runtime.stateRef, (state) =>
    deriveViewportState(updater(state))
  );
}
