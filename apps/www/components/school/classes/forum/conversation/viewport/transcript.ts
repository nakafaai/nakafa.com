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
    yield* Ref.set(runtime.activeTranscriptRef, event.activeTranscript);
    const currentState = yield* SubscriptionRef.get(runtime.stateRef);

    if (currentState.lifecycle === "opening") {
      const placement = getOpeningPlacement({
        activeTranscript: event.activeTranscript,
        savedSnapshot: event.savedSnapshot,
        unreadCue: event.unreadCue,
      });

      return yield* startViewportPlacement(runtime, placement);
    }

    if (currentState.latestAffinity !== "latest") {
      return;
    }

    yield* startViewportPlacement(runtime, {
      highlightPostId: null,
      motion: "instant",
      view: { kind: "bottom" },
    });
  });
}
