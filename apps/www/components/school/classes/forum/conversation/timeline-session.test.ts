import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import {
  createInitialTimelineSessionState,
  replaceTimelineSession,
  type TimelineState,
  updateTimelineWithinSession,
} from "@/components/school/classes/forum/conversation/timeline-session";

const oldestPostId = "post_oldest" as Id<"schoolClassForumPosts">;
const newestPostId = "post_newest" as Id<"schoolClassForumPosts">;

/** Creates one minimal timeline state for pure session-version tests. */
function createTimelineState(
  overrides?: Partial<TimelineState>
): TimelineState {
  return {
    hasMoreAfter: false,
    hasMoreBefore: false,
    isAtLatestEdge: true,
    isJumpMode: false,
    newestPostId,
    oldestPostId,
    posts: [],
    ...overrides,
  };
}

describe("forum timeline session", () => {
  it("starts with one empty timeline session", () => {
    expect(createInitialTimelineSessionState()).toEqual({
      sessionVersion: 0,
      timeline: null,
    });
  });

  it("keeps the initial session version for the first mounted timeline", () => {
    const initial = createInitialTimelineSessionState();
    const timeline = createTimelineState();

    expect(replaceTimelineSession(initial, timeline)).toEqual({
      sessionVersion: 0,
      timeline,
    });
  });

  it("bumps the session version when one semantic timeline replaces another", () => {
    const current = {
      sessionVersion: 2,
      timeline: createTimelineState(),
    };
    const nextTimeline = createTimelineState({ isJumpMode: true });

    expect(replaceTimelineSession(current, nextTimeline)).toEqual({
      sessionVersion: 3,
      timeline: nextTimeline,
    });
  });

  it("keeps the same session when the timeline instance is unchanged", () => {
    const timeline = createTimelineState();
    const current = {
      sessionVersion: 4,
      timeline,
    };

    expect(updateTimelineWithinSession(current, () => timeline)).toBe(current);
  });

  it("updates the active timeline without bumping the session version", () => {
    const current = {
      sessionVersion: 4,
      timeline: createTimelineState(),
    };
    const nextTimeline = createTimelineState({ hasMoreBefore: true });

    expect(updateTimelineWithinSession(current, () => nextTimeline)).toEqual({
      sessionVersion: 4,
      timeline: nextTimeline,
    });
  });
});
