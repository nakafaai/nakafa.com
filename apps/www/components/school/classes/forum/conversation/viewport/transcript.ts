import { Effect, Ref, SubscriptionRef } from "effect";
import {
  getOpeningPlacement,
  type ViewportEvent,
} from "@/components/school/classes/forum/conversation/viewport/model";
import { startViewportPlacement } from "@/components/school/classes/forum/conversation/viewport/placement";
import type { ViewportRuntime } from "@/components/school/classes/forum/conversation/viewport/runtime";

/** Syncs active transcript data and starts the initial or latest placement. */
export function handleViewportTranscript(
  runtime: ViewportRuntime,
  event: Extract<ViewportEvent, { type: "transcript" }>
) {
  return Effect.gen(function* () {
    const currentState = yield* SubscriptionRef.get(runtime.stateRef);
    const detachedView =
      currentState.latestAffinity === "latest"
        ? null
        : runtime.adapters.scroller.captureView();
    yield* Ref.set(runtime.activeTranscriptRef, event.activeTranscript);

    if (currentState.lifecycle === "opening") {
      const placement = getOpeningPlacement({
        activeTranscript: event.activeTranscript,
        savedSnapshot: event.savedSnapshot,
        unreadCue: event.unreadCue,
      });

      return yield* startViewportPlacement(runtime, placement);
    }

    if (currentState.latestAffinity !== "latest") {
      if (
        currentState.pendingPlacement?.view.kind === "post" &&
        event.activeTranscript.rowIndexByPostId.has(
          currentState.pendingPlacement.view.postId
        )
      ) {
        return yield* startViewportPlacement(
          runtime,
          currentState.pendingPlacement
        );
      }

      if (
        detachedView?.kind === "post" &&
        event.activeTranscript.rowIndexByPostId.has(detachedView.postId)
      ) {
        return yield* startViewportPlacement(runtime, {
          highlightPostId: null,
          motion: "instant",
          view: detachedView,
        });
      }

      return;
    }

    yield* startViewportPlacement(runtime, {
      highlightPostId: null,
      motion: "instant",
      view: { kind: "bottom" },
    });
  });
}
