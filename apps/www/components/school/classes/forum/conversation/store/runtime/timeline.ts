import {
  issueScrollRequest,
  syncDerivedState,
} from "@/components/school/classes/forum/conversation/store/runtime/derived";
import { clearHighlightState } from "@/components/school/classes/forum/conversation/store/runtime/navigation";
import type { ConversationRuntimeStore } from "@/components/school/classes/forum/conversation/store/runtime/types";
import { clearBackStack } from "@/components/school/classes/forum/conversation/utils/back-stack";
import { createLiveTimeline } from "@/components/school/classes/forum/conversation/utils/timeline";

/** Applies one timeline window and keeps the derived shell state in sync. */
export function applyTimelineWindow({
  bumpSession,
  state,
  timeline,
  variant,
}: {
  bumpSession: boolean;
  state: ConversationRuntimeStore;
  timeline: ConversationRuntimeStore["timeline"];
  variant: Extract<ConversationRuntimeStore["variant"], "focused" | "live">;
}) {
  state.timeline = timeline;
  state.variant = variant;

  if (bumpSession) {
    state.timelineSessionVersion += 1;
  }

  syncDerivedState(state);
}

/** Switches the runtime back to live mode and optionally requests latest scrolling. */
export function showLiveTimeline({
  state,
  requestLatest,
  smooth,
  bumpSession,
}: {
  bumpSession: boolean;
  requestLatest: boolean;
  smooth: boolean;
  state: ConversationRuntimeStore;
}) {
  state.variant = "live";

  if (state.livePosts.length === 0) {
    state.pendingLatestScroll = requestLatest ? { smooth } : null;
    state.timeline = null;

    if (bumpSession) {
      state.timelineSessionVersion += 1;
    }

    syncDerivedState(state);
    return;
  }

  state.pendingLatestScroll = null;

  applyTimelineWindow({
    bumpSession,
    state,
    timeline: createLiveTimeline(state.livePosts, state.liveHasMoreBefore),
    variant: "live",
  });

  if (!requestLatest) {
    return;
  }

  issueScrollRequest(state, {
    kind: "latest",
    smooth,
  });
}

/** Clears highlight state and returns to live latest in one user-visible action. */
export function showLatestFromCurrentState(state: ConversationRuntimeStore) {
  clearHighlightState(state);
  state.backStack = clearBackStack();

  showLiveTimeline({
    bumpSession: state.variant === "focused",
    requestLatest: true,
    smooth: !state.prefersReducedMotion,
    state,
  });
}
