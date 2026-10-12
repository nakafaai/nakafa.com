import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { ChatView } from "@repo/backend/confect/chats/view";
import { Option, Schema } from "effect";
import { optimisticCancel, readStopFailure } from "@/components/ai/chat/cancel";
import { createLocalStore } from "@/test/optimistic";

const NOW = 1_700_000_000_000;
const chatId = Schema.decodeUnknownSync(Id("chats"))("chat_1");
const userId = Schema.decodeUnknownSync(Id("users"))("user_1");

const chat = {
  _creationTime: 1,
  _id: chatId,
  threadId: "thread_1",
  title: "Limits",
  type: "study",
  updatedAt: 1,
  userId,
  visibility: "private",
} satisfies ChatView;

const turn = { order: 0, promptMessageId: "message_0_user", usage: [] };

describe("chat/cancel", () => {
  it("marks a running turn cancelled at the time of the press", () => {
    const local = createLocalStore();
    local.seed(
      nina.conversation.get,
      { chatId },
      { chat, turn: { ...turn, state: { startedAt: 1, status: "running" } } }
    );

    optimisticCancel(NOW)(local.store, { chatId });

    expect(
      Option.getOrUndefined(
        local.store.getQuery(nina.conversation.get, { chatId })
      )
    ).toEqual({
      chat,
      turn: { ...turn, state: { finishedAt: NOW, status: "cancelled" } },
    });
  });

  it("marks a queued turn cancelled", () => {
    const local = createLocalStore();
    local.seed(
      nina.conversation.get,
      { chatId },
      { chat, turn: { ...turn, state: { status: "queued" } } }
    );

    optimisticCancel(NOW)(local.store, { chatId });

    expect(local.written()).toHaveLength(1);
  });

  it("leaves a settled turn, a chat without a turn and an unloaded chat alone", () => {
    const settled = createLocalStore();
    settled.seed(
      nina.conversation.get,
      { chatId },
      { chat, turn: { ...turn, state: { finishedAt: 5, status: "complete" } } }
    );
    const empty = createLocalStore();
    empty.seed(nina.conversation.get, { chatId }, { chat, turn: null });
    const unloaded = createLocalStore();

    optimisticCancel(NOW)(settled.store, { chatId });
    optimisticCancel(NOW)(empty.store, { chatId });
    optimisticCancel(NOW)(unloaded.store, { chatId });

    expect(settled.written()).toEqual([]);
    expect(empty.written()).toEqual([]);
    expect(unloaded.written()).toEqual([]);
  });
});

describe("chat/cancel stop failure", () => {
  const stop = { failure: "could not stop", order: 3 };
  const working = {
    order: 3,
    state: { startedAt: 1, status: "running" },
  } as const;

  it("shows while the turn the learner stopped is still working", () => {
    expect(readStopFailure(stop, working)).toBe("could not stop");
    expect(
      readStopFailure(stop, { order: 3, state: { status: "queued" } })
    ).toBe("could not stop");
  });

  it("is gone once that turn has settled, whichever way", () => {
    for (const state of [
      { finishedAt: 5, status: "complete" },
      { finishedAt: 5, reason: "unknown", status: "failed" },
      { finishedAt: 5, status: "cancelled" },
      { status: "unanswered" },
    ] as const) {
      expect(readStopFailure(stop, { order: 3, state })).toBeNull();
    }
  });

  it("is gone when a new turn has started, even a working one", () => {
    expect(readStopFailure(stop, { ...working, order: 4 })).toBeNull();
  });

  it("belongs to a chat without a turn only until a turn appears", () => {
    const early = { failure: "could not stop", order: undefined };

    expect(readStopFailure(early, null)).toBe("could not stop");
    expect(readStopFailure(early, working)).toBeNull();
    expect(readStopFailure(stop, null)).toBeNull();
  });

  it("is nothing when no stop was refused", () => {
    expect(readStopFailure(null, working)).toBeNull();
    expect(readStopFailure(null, null)).toBeNull();
  });
});
