import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createForumStore,
  type ForumConversationView,
} from "@/lib/store/forum";

const classId = "class_1";
const forumAId = "forum_a" as Id<"schoolClassForums">;
const forumBId = "forum_b" as Id<"schoolClassForums">;
const postId = "post_1" as Id<"schoolClassForumPosts">;

describe("forum store", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("increments session versions per forum independently", () => {
    const store = createForumStore(classId);

    store.getState().restartConversationSession(forumAId);
    store.getState().restartConversationSession(forumAId);
    store.getState().restartConversationSession(forumBId);

    expect(store.getState().conversationSessionVersions).toEqual({
      [forumAId]: 2,
      [forumBId]: 1,
    });
  });

  it("saves semantic conversation snapshots by value", () => {
    const store = createForumStore(classId);
    const headerView = {
      kind: "header",
      offset: 12,
      postId,
    } satisfies ForumConversationView;

    store.getState().saveConversationView(forumAId, headerView);
    store.getState().saveConversationView(forumAId, { ...headerView });
    store.getState().saveConversationView(forumAId, {
      kind: "date",
      date: 1_744_775_200_000,
      offset: 12,
      postId,
    });

    store.getState().saveConversationView(forumAId, {
      kind: "date",
      date: 1_744_775_200_000,
      offset: 12,
      postId,
    });

    expect(store.getState().savedConversationViews[forumAId]).toEqual({
      kind: "date",
      date: 1_744_775_200_000,
      offset: 12,
      postId,
    });
  });

  it("treats identical bottom snapshots as the same view", () => {
    const store = createForumStore(classId);

    store.getState().saveConversationView(forumAId, { kind: "bottom" });
    store.getState().saveConversationView(forumAId, { kind: "bottom" });

    expect(store.getState().savedConversationViews[forumAId]).toEqual({
      kind: "bottom",
    });
  });

  it("clears transient reply state without touching snapshots or sessions", () => {
    const store = createForumStore(classId);

    store.getState().setReplyTo({ postId, userName: "Nabil" });
    store.getState().restartConversationSession(forumAId);
    store.getState().saveConversationView(forumAId, { kind: "bottom" });
    store.getState().clearTransientConversationState();

    expect(store.getState().replyTo).toBeNull();
    expect(store.getState().conversationSessionVersions[forumAId]).toBe(1);
    expect(store.getState().savedConversationViews[forumAId]).toEqual({
      kind: "bottom",
    });
  });
});
