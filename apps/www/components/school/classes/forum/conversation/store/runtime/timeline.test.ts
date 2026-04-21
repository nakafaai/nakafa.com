import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it, vi } from "vitest";
import type { ForumPost } from "@/components/school/classes/forum/conversation/models";
import { createConversationStore } from "@/components/school/classes/forum/conversation/store/runtime";
import {
  applyTimelineWindow,
  showLatestFromCurrentState,
  showLiveTimeline,
} from "@/components/school/classes/forum/conversation/store/runtime/timeline";

const currentUserId = "user_1" as Id<"users">;
const forumId = "forum_1" as Id<"schoolClassForums">;

/** Creates one minimal forum post payload for runtime timeline tests. */
function createPost(id: string, sequence: number): ForumPost {
  const createdTime = Date.UTC(2026, 3, 21, 10, sequence, 0);

  return {
    _creationTime: createdTime,
    _id: id as Id<"schoolClassForumPosts">,
    attachments: [],
    body: id,
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: currentUserId,
    forumId,
    isUnread: false,
    mentions: [],
    myReactions: [],
    reactionCounts: [],
    reactionUsers: [],
    replyCount: 0,
    replyToBody: undefined,
    replyToUser: null,
    replyToUserId: undefined,
    sequence,
    updatedAt: createdTime,
    user: null,
  } satisfies ForumPost;
}

/** Creates one mutable runtime state object for timeline helper tests. */
function createState() {
  const store = createConversationStore({
    currentUserId,
    forumId,
    getDeps: () => ({
      fetchAround: async () => ({
        hasMoreAfter: false,
        hasMoreBefore: false,
        newestPostId: null,
        oldestPostId: null,
        posts: [],
      }),
      fetchNewer: async () => ({
        hasMore: false,
        newestPostId: null,
        posts: [],
      }),
      fetchOlder: async () => ({
        hasMore: false,
        oldestPostId: null,
        posts: [],
      }),
      loadLiveOlder: vi.fn(),
      saveConversationView: vi.fn(),
    }),
    prefersReducedMotion: false,
  });

  return store.getState();
}

describe("conversation/store/runtime/timeline", () => {
  it("applies one timeline window and optionally bumps the session version", () => {
    const state = createState();
    const posts = [createPost("post_1", 1)];

    applyTimelineWindow({
      bumpSession: true,
      state,
      timeline: {
        hasMoreAfter: false,
        hasMoreBefore: true,
        isAtLatestEdge: true,
        isJumpMode: false,
        newestPostId: posts[0]?._id ?? null,
        oldestPostId: posts[0]?._id ?? null,
        posts,
      },
      variant: "live",
    });

    expect(state.timelineSessionVersion).toBe(1);
    expect(state.variant).toBe("live");
    expect(state.timeline?.posts).toEqual(posts);

    applyTimelineWindow({
      bumpSession: false,
      state,
      timeline: state.timeline,
      variant: "focused",
    });

    expect(state.timelineSessionVersion).toBe(1);
    expect(state.variant).toBe("focused");
  });

  it("keeps a pending latest request when live posts have not loaded yet", () => {
    const state = createState();

    showLiveTimeline({
      bumpSession: true,
      requestLatest: true,
      smooth: false,
      state,
    });

    expect(state.timeline).toBeNull();
    expect(state.pendingLatestScroll).toEqual({ smooth: false });
    expect(state.timelineSessionVersion).toBe(1);
    expect(state.variant).toBe("live");
  });

  it("can enter live mode without a pending latest request before live posts exist", () => {
    const state = createState();

    showLiveTimeline({
      bumpSession: true,
      requestLatest: false,
      smooth: false,
      state,
    });

    expect(state.pendingLatestScroll).toBeNull();
    expect(state.timeline).toBeNull();
    expect(state.timelineSessionVersion).toBe(1);
  });

  it("can keep the current live session version when no posts exist and no bump was requested", () => {
    const state = createState();

    showLiveTimeline({
      bumpSession: false,
      requestLatest: true,
      smooth: false,
      state,
    });

    expect(state.pendingLatestScroll).toEqual({ smooth: false });
    expect(state.timelineSessionVersion).toBe(0);
  });

  it("builds the live timeline and issues a semantic latest scroll when requested", () => {
    const state = createState();
    const firstPost = createPost("post_1", 1);
    const secondPost = createPost("post_2", 2);

    state.liveHasMoreBefore = true;
    state.livePosts = [firstPost, secondPost];

    showLiveTimeline({
      bumpSession: false,
      requestLatest: true,
      smooth: true,
      state,
    });

    expect(state.pendingLatestScroll).toBeNull();
    expect(state.timeline).toMatchObject({
      hasMoreAfter: false,
      hasMoreBefore: true,
      newestPostId: secondPost._id,
      oldestPostId: firstPost._id,
    });
    expect(state.scrollRequest).toMatchObject({
      kind: "latest",
      smooth: true,
    });
  });

  it("builds the live timeline without issuing a scroll request when latest was not requested", () => {
    const state = createState();
    const livePost = createPost("post_live", 1);

    state.livePosts = [livePost];

    showLiveTimeline({
      bumpSession: false,
      requestLatest: false,
      smooth: false,
      state,
    });

    expect(state.timeline?.posts).toEqual([livePost]);
    expect(state.scrollRequest).toBeNull();
  });

  it("returns to live latest by clearing highlight and transient back history", () => {
    const state = createState();
    const livePost = createPost("post_live", 1);

    state.variant = "focused";
    state.highlightTimeoutId = 42;
    state.highlightedPostId = livePost._id;
    state.pendingHighlightPostId = livePost._id;
    state.backStack = [
      {
        dismissWhen: "exact-origin",
        originView: { kind: "bottom" },
      },
    ];
    state.livePosts = [livePost];

    showLatestFromCurrentState(state);

    expect(state.variant).toBe("live");
    expect(state.backStack).toEqual([]);
    expect(state.highlightTimeoutId).toBeNull();
    expect(state.highlightedPostId).toBeNull();
    expect(state.pendingHighlightPostId).toBeNull();
    expect(state.scrollRequest).toMatchObject({
      kind: "latest",
      smooth: true,
    });
  });
});
