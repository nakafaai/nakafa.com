import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ScrollToIndexOpts } from "virtua";
import { CONVERSATION_EDGE_TOLERANCE } from "@/components/school/classes/forum/conversation/data/scroll/metrics";
import type { ActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import type { ConversationUnreadCue } from "@/components/school/classes/forum/conversation/data/transcript/unread";
import {
  areConversationViewsEqual,
  type ConversationView,
} from "@/components/school/classes/forum/conversation/data/view/model";
import type { ConversationScrollSnapshot } from "@/components/school/classes/forum/store/session";

type PlacementAlign = NonNullable<ScrollToIndexOpts["align"]>;
type PlacementMotion = "instant" | "smooth";

export interface ViewportMeasurement {
  bottomDistance: number;
  hasOverflow: boolean;
  isAtLatest: boolean;
  lastVisiblePostId: Id<"schoolClassForumPosts"> | null;
  offset: number;
  view: ConversationView | null;
}

export interface ViewportPlacement {
  align?: PlacementAlign;
  completion: "reached" | "settled";
  highlightPostId: Id<"schoolClassForumPosts"> | null;
  motion?: PlacementMotion;
  view: ConversationView;
}

export type ViewportEvent =
  | {
      activeTranscript: ActiveTranscriptModel;
      savedSnapshot: ConversationScrollSnapshot | null;
      type: "transcript";
      unreadCue: ConversationUnreadCue | null;
    }
  | {
      measurement: ViewportMeasurement | null;
      source: "frame" | "scroll";
      type: "measure";
    }
  | { postId: Id<"schoolClassForumPosts">; type: "post" }
  | { type: "back" }
  | { token: number; type: "highlight-expired" }
  | { type: "latest" }
  | { type: "persist" };

export interface ViewportState {
  backStack: ConversationView[];
  hasOverflow: boolean;
  highlightedPostId: Id<"schoolClassForumPosts"> | null;
  isAtLatest: boolean;
  latestAffinity: "detached" | "latest";
  lifecycle: "opening" | "placing" | "ready";
  pendingPlacement: ViewportPlacement | null;
  shouldShowLatestButton: boolean;
}

export const initialViewportState = deriveViewportState({
  backStack: [],
  highlightedPostId: null,
  hasOverflow: false,
  isAtLatest: true,
  latestAffinity: "latest",
  lifecycle: "opening",
  pendingPlacement: null,
});

/** Derives render facts from the canonical Forum Conversation Viewport state. */
export function deriveViewportState(
  state: Omit<ViewportState, "shouldShowLatestButton"> & {
    shouldShowLatestButton?: boolean;
  }
) {
  const latestIsBackTarget = state.backStack.at(-1)?.kind === "bottom";
  const shouldShowLatestButton =
    state.hasOverflow &&
    !latestIsBackTarget &&
    !(state.isAtLatest || state.pendingPlacement?.view.kind === "bottom");

  return {
    ...state,
    shouldShowLatestButton,
  } satisfies ViewportState;
}

/** Returns the next latest affinity after one normalized Viewport measurement. */
export function getViewportLatestAffinity({
  currentAffinity,
  hasUserDetachedFromLatest,
  isAtLatest,
}: {
  currentAffinity: ViewportState["latestAffinity"];
  hasUserDetachedFromLatest: boolean;
  isAtLatest: boolean;
}) {
  if (isAtLatest) {
    return "latest";
  }

  if (hasUserDetachedFromLatest) {
    return "detached";
  }

  return currentAffinity;
}

/** Returns whether one scroll measurement should detach from latest affinity. */
export function isViewportDetachedScroll({
  measurement,
  pendingPlacement,
  previousMeasurement,
}: {
  measurement: ViewportMeasurement;
  pendingPlacement: ViewportPlacement | null;
  previousMeasurement: ViewportMeasurement | null;
}) {
  if (!pendingPlacement) {
    return true;
  }

  if (pendingPlacement.view.kind !== "bottom") {
    return false;
  }

  if (!previousMeasurement) {
    return false;
  }

  return (
    measurement.bottomDistance >
    previousMeasurement.bottomDistance + CONVERSATION_EDGE_TOLERANCE
  );
}

/** Adds one semantic view to the back stack without duplicating the current entry. */
export function pushViewportBackView(
  backStack: readonly ConversationView[],
  view: ConversationView
) {
  const current = backStack.at(-1);

  if (areConversationViewsEqual(current, view)) {
    return [...backStack];
  }

  return [...backStack, view];
}

/** Returns whether one Snapshot still points at the current Transcript shape. */
export function canRestoreViewportSnapshot({
  activeTranscript,
  snapshot,
}: {
  activeTranscript: ActiveTranscriptModel;
  snapshot: ConversationScrollSnapshot | null;
}) {
  if (!snapshot) {
    return false;
  }

  if (snapshot.lastPostId !== activeTranscript.lastPostId) {
    return false;
  }

  if (snapshot.view.kind === "post") {
    return activeTranscript.rowIndexByPostId.has(snapshot.view.postId);
  }

  return true;
}

/** Selects the first Placement for a freshly opened Forum Conversation. */
export function getOpeningPlacement({
  activeTranscript,
  savedSnapshot,
  unreadCue,
}: {
  activeTranscript: ActiveTranscriptModel;
  savedSnapshot: ConversationScrollSnapshot | null;
  unreadCue: ConversationUnreadCue | null;
}) {
  if (
    savedSnapshot &&
    canRestoreViewportSnapshot({ activeTranscript, snapshot: savedSnapshot })
  ) {
    const restoredView = savedSnapshot.view;

    if (restoredView.kind === "bottom") {
      return {
        completion: "reached",
        highlightPostId: null,
        motion: "instant",
        view: { kind: "bottom" },
      } satisfies ViewportPlacement;
    }

    return {
      align: "center",
      completion: "settled",
      highlightPostId: null,
      motion: "instant",
      view: restoredView,
    } satisfies ViewportPlacement;
  }

  if (unreadCue && activeTranscript.rowIndexByPostId.has(unreadCue.postId)) {
    return {
      align: "start",
      completion: "reached",
      highlightPostId: null,
      motion: "instant",
      view: { kind: "post", postId: unreadCue.postId },
    } satisfies ViewportPlacement;
  }

  return {
    completion: "reached",
    highlightPostId: null,
    motion: "instant",
    view: { kind: "bottom" },
  } satisfies ViewportPlacement;
}
