import { Effect, Ref, SubscriptionRef } from "effect";
import {
  type ConversationView,
  isConversationViewAtPost,
} from "@/components/school/classes/forum/conversation/data/view/model";
import { startViewportHighlight } from "@/components/school/classes/forum/conversation/viewport/highlight";
import type {
  ViewportMeasurement,
  ViewportState,
} from "@/components/school/classes/forum/conversation/viewport/model";
import { pushViewportBackView } from "@/components/school/classes/forum/conversation/viewport/model";
import { startViewportPlacement } from "@/components/school/classes/forum/conversation/viewport/placement";
import type {
  ForumPostId,
  ViewportRuntime,
} from "@/components/school/classes/forum/conversation/viewport/runtime";
import { updateViewportState } from "@/components/school/classes/forum/conversation/viewport/state";

/** Starts navigation to one post and preserves the current semantic back target. */
export function handlePostNavigation(
  runtime: ViewportRuntime,
  postId: ForumPostId
) {
  return Effect.gen(function* () {
    const activeTranscript = yield* Ref.get(runtime.activeTranscriptRef);

    if (!activeTranscript?.rowIndexByPostId.has(postId)) {
      return;
    }

    const targetView = { kind: "post", postId } satisfies ConversationView;
    const measurement = yield* Ref.get(runtime.lastMeasurementRef);
    const state = yield* SubscriptionRef.get(runtime.stateRef);
    const backView = getPostNavigationBackView({
      capturedView: runtime.adapters.scroller.captureView(),
      measurement,
      state,
      targetPostId: postId,
    });

    if (runtime.adapters.scroller.isViewVisible(targetView)) {
      yield* updateViewportState(runtime, (state) => ({
        ...state,
        backStack: backView
          ? pushViewportBackView(state.backStack, backView)
          : state.backStack,
        latestAffinity: "detached",
        lifecycle: "ready",
        pendingPlacement: null,
      }));

      yield* startViewportHighlight(runtime, postId);
      return;
    }

    yield* updateViewportState(runtime, (state) => ({
      ...state,
      backStack: backView
        ? pushViewportBackView(state.backStack, backView)
        : state.backStack,
      highlightedPostId: null,
      latestAffinity: "detached",
    }));

    yield* startViewportPlacement(runtime, {
      align: "center",
      highlightPostId: postId,
      view: targetView,
    });
  });
}

/** Selects the semantic view a post jump should return to. */
function getPostNavigationBackView({
  capturedView,
  measurement,
  state,
  targetPostId,
}: {
  capturedView: ConversationView | null;
  measurement: ViewportMeasurement | null;
  state: ViewportState;
  targetPostId: ForumPostId;
}) {
  const currentView = capturedView ?? measurement?.view ?? null;
  const shouldUseLatestBackTarget =
    state.latestAffinity === "latest" ||
    state.pendingPlacement?.view.kind === "bottom" ||
    measurement?.isAtLatest;

  if (!currentView) {
    return shouldUseLatestBackTarget
      ? ({ kind: "bottom" } satisfies ConversationView)
      : null;
  }

  if (isConversationViewAtPost(currentView, targetPostId)) {
    return shouldUseLatestBackTarget
      ? ({ kind: "bottom" } satisfies ConversationView)
      : null;
  }

  return currentView;
}
