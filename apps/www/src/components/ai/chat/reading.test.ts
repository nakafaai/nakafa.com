// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { Array as Arr, Schema } from "effect";
import { readerView, withOlderPage } from "@/components/ai/chat/reading";
import { ReaderMessagePage, ReaderOlder, ReaderReady } from "@/lib/chat/reader";

const threadId = "thread-1";

/** A prompt of the chat at `order`, as Agent lists it. */
function message(order: number): NinaMessage {
  return {
    _creationTime: order,
    id: `prompt_${order}`,
    key: `${threadId}-${order}-0`,
    order,
    parts: [],
    role: "user",
    status: "success",
    stepOrder: 0,
    text: `Prompt ${order}`,
  };
}

/** A turn that answers the prompt at `order`, as the conversation tells it. */
function turn(order: number): typeof NinaTurnSummary.Type {
  return {
    order,
    promptMessageId: `prompt_${order}`,
    state: { finishedAt: order, status: "complete" },
    usage: [],
  };
}

/** A page of messages as the server sends it: the JSON text that encodes them. */
function messagesJson(messages: readonly NinaMessage[]) {
  return Schema.encodeSync(ReaderMessagePage)(messages);
}

/**
 * The first read of a chat, decoded as the client decodes it. Its messages and
 * turns are the first pages, and each list says whether it has more.
 */
function firstRead(
  messages: readonly NinaMessage[],
  turns: readonly (typeof NinaTurnSummary.Type)[],
  messagesDone = false,
  turnsDone = false
) {
  return Schema.decodeUnknownSync(ReaderReady)({
    chat: {
      _creationTime: 1,
      _id: "chat-1",
      threadId,
      type: "study",
      updatedAt: 1,
      visibility: "private",
    },
    messages: {
      continueCursor: "messages-2",
      isDone: messagesDone,
      json: messagesJson(messages),
    },
    status: "ready",
    turn: null,
    turns: {
      continueCursor: "turns-2",
      isDone: turnsDone,
      page: turns,
    },
  });
}

/**
 * An older page the reader loaded, decoded as the client decodes it. Its turns
 * come only when the reader asked for them, which `turns === null` says not.
 */
function olderPage(
  messages: readonly NinaMessage[],
  turns: readonly (typeof NinaTurnSummary.Type)[] | null,
  messagesDone = false,
  turnsDone = false
) {
  return Schema.decodeUnknownSync(ReaderOlder)({
    messages: {
      continueCursor: "messages-3",
      isDone: messagesDone,
      json: messagesJson(messages),
    },
    turns:
      turns === null
        ? null
        : { continueCursor: "turns-3", isDone: turnsDone, page: turns },
  });
}

describe("reader view", () => {
  it("shows the messages of every page oldest first, whatever order the server sends them", () => {
    const view = readerView(firstRead([message(2), message(1)], [turn(1)]));

    expect(Arr.map(view.messages, (item) => item.order)).toStrictEqual([1, 2]);
    expect(view.messagesCursor).toBe("messages-2");
    expect(view.turnsCursor).toBe("turns-2");
    expect(view.endedTurns).toStrictEqual([turn(1)]);
  });

  it("holds no cursor for a list that has no page left", () => {
    const view = readerView(firstRead([message(1)], [], true, true));

    expect(view.messagesCursor).toBeUndefined();
    expect(view.turnsCursor).toBeUndefined();
  });
});

describe("older pages of a reader's view", () => {
  it("puts an older page before the messages shown, and keeps each message once", () => {
    const view = readerView(firstRead([message(3), message(2)], [turn(2)]));

    const next = withOlderPage(
      view,
      olderPage([message(2), message(1)], [turn(1)], true)
    );

    expect(Arr.map(next.messages, (item) => item.order)).toStrictEqual([
      1, 2, 3,
    ]);
    expect(next.endedTurns).toStrictEqual([turn(2), turn(1)]);
    expect(next.messagesCursor).toBeUndefined();
    expect(next.turnsCursor).toBe("turns-3");
  });

  it("keeps the turns it has when the older page asks for none", () => {
    const view = readerView(firstRead([message(2)], [turn(2)]));

    const next = withOlderPage(view, olderPage([message(1)], null));

    expect(next.endedTurns).toStrictEqual([turn(2)]);
    expect(next.turnsCursor).toBe("turns-2");
    expect(next.messagesCursor).toBe("messages-3");
  });

  it("ends the turns once an older page reads the last of them", () => {
    const view = readerView(firstRead([message(2)], [turn(2)]));

    const next = withOlderPage(
      view,
      olderPage([message(1)], [turn(1)], false, true)
    );

    expect(next.turnsCursor).toBeUndefined();
  });
});
