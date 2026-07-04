import { Effect, Ref, SubscriptionRef } from "effect";
import { startViewportPlacement } from "@/components/school/classes/forum/conversation/viewport/placement";
import type { ViewportRuntime } from "@/components/school/classes/forum/conversation/viewport/runtime";
import { updateViewportState } from "@/components/school/classes/forum/conversation/viewport/state";

/** Navigates to the latest semantic back target and discards stale back entries. */
export function handleBackNavigation(runtime: ViewportRuntime) {
  return Effect.gen(function* () {
    const state = yield* SubscriptionRef.get(runtime.stateRef);
    const backView = state.backStack.at(-1);

    if (!backView) {
      return;
    }

    yield* updateViewportState(runtime, (current) => ({
      ...current,
      backStack: current.backStack.slice(0, -1),
      highlightedPostId: null,
    }));
    const activeTranscript = yield* Ref.get(runtime.activeTranscriptRef);

    if (
      backView.kind === "post" &&
      !activeTranscript?.rowIndexByPostId.has(backView.postId)
    ) {
      yield* startViewportPlacement(runtime, {
        highlightPostId: null,
        view: { kind: "bottom" },
      });
      return;
    }

    yield* startViewportPlacement(runtime, {
      align: backView.kind === "post" ? "center" : undefined,
      highlightPostId: null,
      view: backView,
    });
  });
}
