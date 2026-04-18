import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ForumPost } from "@/lib/store/forum";

/** Represents one mounted transcript window and its current paging boundaries. */
export interface TimelineState {
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  isAtLatestEdge: boolean;
  isJumpMode: boolean;
  newestPostId: Id<"schoolClassForumPosts"> | null;
  oldestPostId: Id<"schoolClassForumPosts"> | null;
  posts: ForumPost[];
}

/** Tracks one transcript window together with its remount-worthy session id. */
export interface TimelineSessionState {
  sessionVersion: number;
  timeline: TimelineState | null;
}

/** Creates one empty transcript-session wrapper before any data is available. */
export function createInitialTimelineSessionState(): TimelineSessionState {
  return {
    sessionVersion: 0,
    timeline: null,
  };
}

/**
 * Replaces the active transcript session, bumping the remount key only after
 * the first real session has already been mounted.
 */
export function replaceTimelineSession(
  current: TimelineSessionState,
  timeline: TimelineState
): TimelineSessionState {
  return {
    sessionVersion:
      current.timeline === null
        ? current.sessionVersion
        : current.sessionVersion + 1,
    timeline,
  };
}

/** Updates the current transcript window without changing its session identity. */
export function updateTimelineWithinSession(
  current: TimelineSessionState,
  update: (timeline: TimelineState | null) => TimelineState | null
): TimelineSessionState {
  const nextTimeline = update(current.timeline);

  if (nextTimeline === current.timeline) {
    return current;
  }

  return {
    ...current,
    timeline: nextTimeline,
  };
}
