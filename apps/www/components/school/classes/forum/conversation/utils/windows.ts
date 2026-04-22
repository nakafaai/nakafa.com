import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  createFocusedTranscriptWindows,
  createLatestTranscriptWindow,
  createNewerTranscriptWindow,
  createOlderTranscriptWindow,
  type ForumPostAnchorResult,
  type ForumPostsWindowResults,
  getForumPostsWindowResult,
  getNewestWindowIndexKey,
  getOldestWindowIndexKey,
  type TranscriptWindow,
} from "@/components/school/classes/forum/conversation/data/pages";
import {
  type ConversationView,
  isConversationViewAtPost,
} from "@/components/school/classes/forum/conversation/data/view";

type TranscriptMode = "focused" | "live";

interface ConversationRestore {
  mode: TranscriptMode;
  windows: TranscriptWindow[];
}

interface ConversationJumpRestore {
  captureBackOrigin: ConversationView | null;
  request: {
    exact: boolean;
    view: ConversationView;
  };
}

/** Builds the transcript window set for one semantic restore target. */
export async function buildConversationRestore({
  forumId,
  resolveAnchor,
  view,
}: {
  forumId: Id<"schoolClassForums">;
  resolveAnchor: (
    postId: Id<"schoolClassForumPosts">
  ) => Promise<ForumPostAnchorResult>;
  view: ConversationView;
}): Promise<ConversationRestore> {
  if (view.kind === "bottom") {
    return {
      mode: "live",
      windows: [createLatestTranscriptWindow(forumId)],
    };
  }

  const anchor = await resolveAnchor(view.postId);

  return {
    mode: "focused",
    windows: createFocusedTranscriptWindows(forumId, anchor),
  };
}

/** Returns the next older desc window when the current oldest edge can grow. */
export function getNextOlderConversationWindow({
  forumId,
  queryResults,
  windows,
}: {
  forumId: Id<"schoolClassForums">;
  queryResults: ForumPostsWindowResults;
  windows: TranscriptWindow[];
}) {
  const firstWindow = windows[0];

  if (!firstWindow) {
    return null;
  }

  const firstResult = getForumPostsWindowResult(queryResults[firstWindow.id]);
  const oldestIndexKey = getOldestWindowIndexKey(firstWindow, firstResult);

  if (!(firstResult?.hasMore && oldestIndexKey)) {
    return null;
  }

  return createOlderTranscriptWindow(forumId, oldestIndexKey);
}

/** Returns the next newer asc window when a focused transcript can grow. */
export function getNextNewerConversationWindow({
  forumId,
  mode,
  queryResults,
  windows,
}: {
  forumId: Id<"schoolClassForums">;
  mode: TranscriptMode;
  queryResults: ForumPostsWindowResults;
  windows: TranscriptWindow[];
}) {
  if (mode !== "focused") {
    return null;
  }

  const lastWindow = windows.at(-1);

  if (!(lastWindow && lastWindow.args.order === "asc")) {
    return null;
  }

  const lastResult = getForumPostsWindowResult(queryResults[lastWindow.id]);
  const newestIndexKey = getNewestWindowIndexKey(lastWindow, lastResult);

  if (!(lastResult?.hasMore && newestIndexKey)) {
    return null;
  }

  return createNewerTranscriptWindow(forumId, newestIndexKey);
}

/** Returns whether one reactive transcript window has finished loading. */
export function hasLoadedConversationWindow({
  queryResults,
  windowId,
}: {
  queryResults: ForumPostsWindowResults;
  windowId: string;
}) {
  return Boolean(getForumPostsWindowResult(queryResults[windowId]));
}

/** Builds the semantic jump request for go-to-message and back navigation. */
export function getConversationJumpRestore({
  backOrigin,
  currentView,
  jumpTargetPostId,
}: {
  backOrigin: ConversationView | null;
  currentView: ConversationView | null;
  jumpTargetPostId: Id<"schoolClassForumPosts">;
}): ConversationJumpRestore | null {
  const isBackRestore =
    backOrigin?.kind === "post" && backOrigin.postId === jumpTargetPostId;

  if (
    !isBackRestore &&
    isConversationViewAtPost(currentView, jumpTargetPostId)
  ) {
    return null;
  }

  if (isBackRestore && backOrigin) {
    return {
      captureBackOrigin: null,
      request: {
        exact: true,
        view: backOrigin,
      },
    };
  }

  return {
    captureBackOrigin: currentView,
    request: {
      exact: false,
      view: {
        kind: "post",
        offset: 0,
        postId: jumpTargetPostId,
      },
    },
  };
}
