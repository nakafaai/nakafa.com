import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { encodeJsonText } from "@repo/utilities/json";
import { Record as Rec, Schema } from "effect";
import {
  type ConversationScrollSnapshot,
  createForumSessionStore,
} from "@/components/school/classes/forum/session/store";

const forumId = Schema.decodeUnknownSync(Id("schoolClassForums"))("forum_1");
const otherForumId = Schema.decodeUnknownSync(Id("schoolClassForums"))(
  "forum_2"
);
const lastPostId = Schema.decodeUnknownSync(Id("schoolClassForumPosts"))(
  "post_1"
);
const otherPostId = Schema.decodeUnknownSync(Id("schoolClassForumPosts"))(
  "post_2"
);
const replyTarget = {
  postId: lastPostId,
  userName: "Nabil",
} as const;
const otherReplyTarget = {
  postId: otherPostId,
  userName: "Fatih",
} as const;
const snapshot: ConversationScrollSnapshot = {
  lastPostId,
  offset: 240,
  renderedRowCount: 12,
  view: { kind: "bottom" },
  wasAtBottom: true,
};
const otherSnapshot: ConversationScrollSnapshot = {
  lastPostId: otherPostId,
  offset: 80,
  renderedRowCount: 4,
  view: { kind: "post", postId: otherPostId },
  wasAtBottom: false,
};
const STORAGE_KEY = "nakafa-forum-session:class-session-test";
const StoredForumSession = Schema.fromJsonString(
  Schema.Struct({
    state: Schema.Record(Schema.String, Schema.Unknown),
    version: Schema.Finite,
  })
);

describe("forum/store/session", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("stores one conversation scroll snapshot per forum", () => {
    const store = createForumSessionStore("class-session-test");

    store.getState().saveConversationScrollSnapshot(forumId, {
      lastPostId,
      offset: 240,
      renderedRowCount: 12,
      view: { kind: "post", postId: lastPostId },
      wasAtBottom: false,
    });

    expect(
      store.getState().conversationScrollSnapshotByForumId[forumId]
    ).toEqual({
      lastPostId,
      offset: 240,
      renderedRowCount: 12,
      view: { kind: "post", postId: lastPostId },
      wasAtBottom: false,
    });
  });

  it("stores one reply target per forum", () => {
    const store = createForumSessionStore("class-session-test");

    store.getState().setForumReplyTarget(forumId, replyTarget);
    store.getState().setForumReplyTarget(otherForumId, otherReplyTarget);

    expect(store.getState().replyTargetByForumId[forumId]).toEqual(replyTarget);
    expect(store.getState().replyTargetByForumId[otherForumId]).toEqual(
      otherReplyTarget
    );

    store.getState().setForumReplyTarget(forumId, null);

    expect(store.getState().replyTargetByForumId[forumId]).toBeUndefined();
    expect(store.getState().replyTargetByForumId[otherForumId]).toEqual(
      otherReplyTarget
    );
  });

  it("rehydrates snapshots manually and keeps volatile composer state out of storage", async () => {
    const writer = createForumSessionStore("class-session-test");

    writer.getState().saveConversationScrollSnapshot(forumId, {
      lastPostId,
      offset: 240,
      renderedRowCount: 12,
      view: { kind: "bottom" },
      wasAtBottom: true,
    });
    writer.getState().setForumReplyTarget(forumId, replyTarget);
    writer.getState().setHydrated(true);

    const reader = createForumSessionStore("class-session-test");

    expect(reader.persist.hasHydrated()).toBe(false);
    expect(reader.getState().conversationScrollSnapshotByForumId).toEqual({});
    expect(reader.getState().replyTargetByForumId).toEqual({});
    expect(reader.getState().isHydrated).toBe(false);

    await reader.persist.rehydrate();

    expect(reader.persist.hasHydrated()).toBe(true);
    expect(
      reader.getState().conversationScrollSnapshotByForumId[forumId]
    ).toEqual({
      lastPostId,
      offset: 240,
      renderedRowCount: 12,
      view: { kind: "bottom" },
      wasAtBottom: true,
    });
    expect(reader.getState().replyTargetByForumId).toEqual({});
    expect(reader.getState().isHydrated).toBe(false);
  });

  it("drops stale persisted scroll snapshots from older session versions", async () => {
    sessionStorage.setItem(
      "nakafa-forum-session:class-session-test",
      encodeJsonText({
        state: {
          conversationScrollSnapshotByForumId: {
            [forumId]: {
              cache: {},
              lastPostId,
              offset: 240,
              renderedRowCount: 12,
              view: { kind: "bottom" },
              wasAtBottom: true,
            },
          },
        },
        version: 3,
      })
    );
    const reader = createForumSessionStore("class-session-test");

    await reader.persist.rehydrate();

    expect(reader.getState().conversationScrollSnapshotByForumId).toEqual({});
  });

  it("removes one forum's reply target and keeps every other forum's entry", () => {
    const store = createForumSessionStore("class-session-test");
    store.getState().setForumReplyTarget(forumId, replyTarget);
    store.getState().setForumReplyTarget(otherForumId, otherReplyTarget);
    const kept = store.getState().replyTargetByForumId[otherForumId];

    store.getState().setForumReplyTarget(forumId, null);

    expect(Rec.keys(store.getState().replyTargetByForumId)).toEqual([
      otherForumId,
    ]);
    expect(store.getState().replyTargetByForumId[otherForumId]).toBe(kept);
  });

  it("keeps every other forum's scroll snapshot when one forum saves", () => {
    const store = createForumSessionStore("class-session-test");
    store
      .getState()
      .saveConversationScrollSnapshot(otherForumId, otherSnapshot);
    const kept =
      store.getState().conversationScrollSnapshotByForumId[otherForumId];

    store.getState().saveConversationScrollSnapshot(forumId, snapshot);

    expect(
      store.getState().conversationScrollSnapshotByForumId[otherForumId]
    ).toBe(kept);
    expect(
      store.getState().conversationScrollSnapshotByForumId[forumId]
    ).toEqual(snapshot);
  });

  it("keeps the saved snapshots and reply targets when hydration changes", () => {
    const store = createForumSessionStore("class-session-test");
    store.getState().saveConversationScrollSnapshot(forumId, snapshot);
    store.getState().setForumReplyTarget(forumId, replyTarget);
    const { conversationScrollSnapshotByForumId, replyTargetByForumId } =
      store.getState();

    store.getState().setHydrated(true);

    expect(store.getState().isHydrated).toBe(true);
    expect(store.getState().conversationScrollSnapshotByForumId).toBe(
      conversationScrollSnapshotByForumId
    );
    expect(store.getState().replyTargetByForumId).toBe(replyTargetByForumId);
  });

  it("keeps the saved snapshots when a reply target changes", () => {
    const store = createForumSessionStore("class-session-test");
    store.getState().saveConversationScrollSnapshot(forumId, snapshot);
    const { conversationScrollSnapshotByForumId } = store.getState();

    store.getState().setForumReplyTarget(forumId, replyTarget);

    expect(store.getState().conversationScrollSnapshotByForumId).toBe(
      conversationScrollSnapshotByForumId
    );
  });

  it("changes nothing when a stored value is set again", () => {
    const store = createForumSessionStore("class-session-test");
    store.getState().saveConversationScrollSnapshot(forumId, snapshot);
    store.getState().setForumReplyTarget(forumId, replyTarget);
    store.getState().setHydrated(true);
    const before = store.getState();
    const listener = vi.fn();
    store.subscribe(listener);

    store.getState().saveConversationScrollSnapshot(forumId, snapshot);
    store.getState().setForumReplyTarget(forumId, replyTarget);
    store.getState().setHydrated(true);

    expect(store.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it("changes nothing when a reply target is cleared for a forum without one", () => {
    const store = createForumSessionStore("class-session-test");
    const before = store.getState();
    const listener = vi.fn();
    store.subscribe(listener);

    store.getState().setForumReplyTarget(forumId, null);

    expect(store.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it("persists only the scroll snapshots in session storage under the class key", () => {
    const store = createForumSessionStore("class-session-test");
    store.getState().saveConversationScrollSnapshot(forumId, snapshot);
    store.getState().setForumReplyTarget(forumId, replyTarget);
    store.getState().setHydrated(true);

    const stored = Schema.decodeUnknownSync(StoredForumSession)(
      sessionStorage.getItem(STORAGE_KEY)
    );
    expect(stored.version).toBe(4);
    expect(Rec.keys(stored.state)).toEqual([
      "conversationScrollSnapshotByForumId",
    ]);
    expect(stored.state.conversationScrollSnapshotByForumId).toEqual({
      [forumId]: snapshot,
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
