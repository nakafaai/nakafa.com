import {
  Array as Arr,
  Effect,
  HashMap,
  Option,
  Ref,
  SubscriptionRef,
} from "effect";
import { startViewportPlacement } from "@/components/school/classes/forum/conversation/viewport/placement";
import type { ViewportRuntime } from "@/components/school/classes/forum/conversation/viewport/runtime";
import { updateViewportState } from "@/components/school/classes/forum/conversation/viewport/state";

/** Navigates to the latest semantic back target and discards stale back entries. */
export function handleBackNavigation(runtime: ViewportRuntime) {
  return Effect.gen(function* () {
    const state = yield* SubscriptionRef.get(runtime.stateRef);
    const lastBackView = Arr.last(state.backStack);

    if (Option.isNone(lastBackView)) {
      return;
    }
    const backView = lastBackView.value;

    yield* updateViewportState(runtime, (current) => ({
      ...current,
      backStack: Arr.dropRight(current.backStack, 1),
      highlightedPostId: null,
    }));
    const activeTranscript = yield* Ref.get(runtime.activeTranscriptRef);

    if (
      backView.kind === "post" &&
      !(
        activeTranscript &&
        HashMap.has(activeTranscript.rowIndexByPostId, backView.postId)
      )
    ) {
      yield* startViewportPlacement(runtime, {
        highlightPostId: null,
        view: { kind: "bottom" },
      });
      return;
    }

    yield* startViewportPlacement(runtime, {
      ...(backView.kind === "post" ? { align: "center" } : {}),
      highlightPostId: null,
      view: backView,
    });
  });
}
