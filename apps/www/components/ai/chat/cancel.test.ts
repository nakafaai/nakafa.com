import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { ChatView } from "@repo/backend/confect/chats/view";
import { Option, Schema } from "effect";
import { optimisticCancel } from "@/components/ai/chat/cancel";
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
