// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { Array as Arr, Result, Schema } from "effect";
import {
  type ReaderView,
  readerView,
  withOlderPage,
} from "@/components/ai/chat/reading";
import { ReaderMessagePage, ReaderOlder, ReaderReady } from "@/lib/chat/reader";

const threadId = "thread-1";

type Turn = typeof NinaTurnSummary.Type;

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
function turn(order: number): Turn {
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
  turns: readonly Turn[],
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
 * come only when the reader asked for them, so leaving `turns` out means none.
 */
function olderPage(
  messages: readonly NinaMessage[],
  turns?: readonly Turn[],
  messagesDone = false,
  turnsDone = false
) {
  return Schema.decodeUnknownSync(ReaderOlder)({
    messages: {
      continueCursor: "messages-3",
      isDone: messagesDone,
      json: messagesJson(messages),
    },
    ...(turns === undefined
      ? {}
      : {
          turns: { continueCursor: "turns-3", isDone: turnsDone, page: turns },
        }),
  });
}

/** The view of a first read, which the tests expect to decode. */
function viewOf(read: ReaderReady): ReaderView {
  return Result.getOrThrow(readerView(read));
}

/** The view after an older page, which the tests expect to decode. */
function withPage(view: ReaderView, page: ReaderOlder): ReaderView {
  return Result.getOrThrow(withOlderPage(view, page));
}

describe("reader view", () => {
  it("shows the messages of every page oldest first, whatever order the server sends them", () => {
    const view = viewOf(firstRead([message(2), message(1)], [turn(1)]));

    expect(Arr.map(view.messages, (item) => item.order)).toStrictEqual([1, 2]);
    expect(view.messagesCursor).toBe("messages-2");
    expect(view.turnsCursor).toBe("turns-2");
    expect(view.endedTurns).toStrictEqual([turn(1)]);
  });

  it("holds no cursor for a list that has no page left", () => {
    const view = viewOf(firstRead([message(1)], [], true, true));

    expect(view.messagesCursor).toBeUndefined();
    expect(view.turnsCursor).toBeUndefined();
  });

  it("fails the view of a page of messages that does not decode, rather than throwing", () => {
    const read = firstRead([message(1)], []);

    expect(
      Result.isFailure(
        readerView({
          ...read,
          messages: { ...read.messages, json: "not a page" },
        })
      )
    ).toBe(true);
  });
});

describe("older pages of a reader's view", () => {
  it("puts an older page before the messages shown, and keeps each message once", () => {
    const view = viewOf(firstRead([message(3), message(2)], [turn(2)]));

    const next = withPage(
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
    const view = viewOf(firstRead([message(2)], [turn(2)]));

    const next = withPage(view, olderPage([message(1)]));

    expect(next.endedTurns).toStrictEqual([turn(2)]);
    expect(next.turnsCursor).toBe("turns-2");
    expect(next.messagesCursor).toBe("messages-3");
  });

  it("ends the turns once an older page reads the last of them", () => {
    const view = viewOf(firstRead([message(2)], [turn(2)]));

    const next = withPage(
      view,
      olderPage([message(1)], [turn(1)], false, true)
    );

    expect(next.turnsCursor).toBeUndefined();
  });

  it("keeps each turn once when an older page repeats", () => {
    const view = viewOf(firstRead([message(2)], [turn(2)]));
    const page = olderPage([message(1)], [turn(1)]);

    const next = withPage(withPage(view, page), page);

    expect(next.endedTurns).toStrictEqual([turn(2), turn(1)]);
  });

  it("fails an older page whose messages do not decode, rather than throwing", () => {
    const view = viewOf(firstRead([message(2)], [turn(2)]));
    const broken = Schema.decodeSync(ReaderOlder)({
      messages: {
        continueCursor: "messages-3",
        isDone: false,
        json: "not a page",
      },
    });

    expect(Result.isFailure(withOlderPage(view, broken))).toBe(true);
  });
});
