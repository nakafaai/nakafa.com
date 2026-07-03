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

/** Independent transcript jump actions derived from canonical viewport state. */
export interface ViewportJumpControl {
  showBack: boolean;
  showLatest: boolean;
}

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
  | { type: "persist" }
  | { type: "user-scroll" };

export interface ViewportState {
  backStack: ConversationView[];
  hasOverflow: boolean;
  highlightedPostId: Id<"schoolClassForumPosts"> | null;
  isAtLatest: boolean;
  jumpControl: ViewportJumpControl;
  latestAffinity: "detached" | "latest";
  lifecycle: "opening" | "placing" | "ready";
  pendingPlacement: ViewportPlacement | null;
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
  state: Omit<ViewportState, "jumpControl"> & {
    jumpControl?: ViewportJumpControl;
  }
) {
  const jumpControl = getViewportJumpControl(state);

  return {
    ...state,
    jumpControl,
  } satisfies ViewportState;
}

/** Selects the jump actions allowed to render for the current viewport. */
export function getViewportJumpControl({
  backStack,
  hasOverflow,
  isAtLatest,
}: Pick<ViewportState, "backStack" | "hasOverflow" | "isAtLatest">) {
  return {
    showBack: !isAtLatest && backStack.length > 0,
    showLatest: !isAtLatest && hasOverflow,
  } satisfies ViewportJumpControl;
}

/** Returns the next latest affinity after one normalized Viewport measurement. */
export function getViewportLatestAffinity({
  currentAffinity,
  hasUserDetachedFromLatest,
  isAtLatest,
  pendingPlacement,
}: {
  currentAffinity: ViewportState["latestAffinity"];
  hasUserDetachedFromLatest: boolean;
  isAtLatest: boolean;
  pendingPlacement: ViewportPlacement | null;
}) {
  if (pendingPlacement?.view.kind === "post") {
    return "detached";
  }

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

/** Returns whether one latest-position Snapshot still matches the Transcript. */
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

  if (!(snapshot.wasAtBottom && snapshot.view.kind === "bottom")) {
    return false;
  }

  return snapshot.lastPostId === activeTranscript.lastPostId;
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
    return {
      highlightPostId: null,
      motion: "instant",
      view: { kind: "bottom" },
    } satisfies ViewportPlacement;
  }

  if (unreadCue && activeTranscript.rowIndexByPostId.has(unreadCue.postId)) {
    return {
      align: "start",
      highlightPostId: null,
      motion: "instant",
      view: { kind: "post", postId: unreadCue.postId },
    } satisfies ViewportPlacement;
  }

  return {
    highlightPostId: null,
    motion: "instant",
    view: { kind: "bottom" },
  } satisfies ViewportPlacement;
}
