// @vitest-environment node
import { HttpClient } from "@confect/js";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { NINA_MESSAGES_PAGE_SIZE } from "@repo/backend/client/nina/presentation";
import { Id } from "@repo/backend/confect/_generated/id";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { ReaderMessagePage } from "@/lib/chat/reader";
import {
  readReaderHandler,
  readReaderOlderHandler,
} from "@/lib/chat/reader.server";

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/"),
}));

// The read talks to Convex through one scripted query, so each test answers
// the queries it expects and fails any other.
vi.mock("@/lib/convex/http", async () => {
  const { HttpClient: Client } = await import("@confect/js");
  const { Effect: Eff, Layer: Lay } = await import("effect");
  return {
    httpLayer: () =>
      Lay.effect(
        Client.HttpClient,
        Eff.map(Client.HttpClient, (client) => ({
          ...client,
          query: mocks.query,
        }))
      ).pipe(Lay.provide(Client.layer("https://example.convex.cloud"))),
  };
});

const chatId = Schema.decodeUnknownSync(Id("chats"))("chat-1");
const shareToken = "abcdefghijklmnopqrstuvwxyz0123456789-_ABCDE";
const threadId = "thread-1";
const chat = { _id: chatId, threadId, title: "Derivatives" };
const turn = {
  order: 0,
  promptMessageId: "prompt-0",
  state: { finishedAt: 1, status: "complete" },
  usage: [],
};
const message: NinaMessage = {
  _creationTime: 1,
  id: "user_0",
  key: `${threadId}-0-0`,
  order: 0,
  parts: [],
  role: "user",
  status: "success",
  stepOrder: 0,
  text: "Why?",
};
const page = (items: readonly unknown[], isDone = true) => ({
  continueCursor: isDone ? "" : "next",
  isDone,
  page: items,
});

/** What a scripted query answers: its value, or the failure Convex reports. */
type ScriptedAnswer = Effect.Effect<
  unknown,
  ChatAccessError | HttpClient.HttpClientError
>;

/** Answers each Convex query with its value, and dies on any other query. */
function answer(answers: ReadonlyArray<readonly [unknown, ScriptedAnswer]>) {
  mocks.query.mockImplementation((ref: unknown) =>
    Option.match(
      Arr.findFirst(answers, ([query]) => query === ref),
      {
        onNone: () => Effect.die("unexpected query"),
        onSome: ([, value]) => value,
      }
    )
  );
}

/** One page of messages, encoded as the server sends it. */
const messagesJson = (messages: readonly NinaMessage[]) =>
  Schema.encodeSync(ReaderMessagePage)(messages);

const request = { chatId, shareToken };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reading a shared chat", () => {
  it("reads the chat, its latest turn and the first page of each list with the token", async () => {
    answer([
      [nina.conversation.get, Effect.succeed({ chat, turn })],
      [nina.conversation.turns, Effect.succeed(page([turn], false))],
      [nina.messages.page, Effect.succeed({ ...page([message]), streams: [] })],
    ]);

    const read = await readReaderHandler({ data: request });

    expect(read).toStrictEqual({
      chat,
      messages: {
        continueCursor: "",
        isDone: true,
        json: messagesJson([message]),
      },
      status: "ready",
      turn,
      turns: { continueCursor: "next", isDone: false, page: [turn] },
    });
    expect(mocks.query).toHaveBeenCalledWith(nina.conversation.get, request);
    expect(mocks.query).toHaveBeenCalledWith(nina.conversation.turns, {
      ...request,
      paginationOpts: { cursor: null, numItems: NINA_MESSAGES_PAGE_SIZE },
    });
    expect(mocks.query).toHaveBeenCalledWith(nina.messages.page, {
      ...request,
      paginationOpts: { cursor: null, numItems: NINA_MESSAGES_PAGE_SIZE },
      threadId,
    });
  });

  it("answers unavailable, and reads nothing more, when the token does not open the chat", async () => {
    answer([
      [
        nina.conversation.get,
        Effect.fail(
          new ChatAccessError({
            code: "CHAT_NOT_FOUND",
            message: "Chat not found.",
          })
        ),
      ],
    ]);

    const read = await readReaderHandler({ data: request });

    expect(read).toStrictEqual({ status: "unavailable" });
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("fails the read on a failure that is not an access failure", async () => {
    answer([
      [
        nina.conversation.get,
        Effect.fail(
          new HttpClient.HttpClientError({ cause: new Error("down") })
        ),
      ],
    ]);

    await expect(readReaderHandler({ data: request })).rejects.toThrow();
  });

  it("refuses a message without the shape of an Agent message, rather than showing it", async () => {
    answer([
      [nina.conversation.get, Effect.succeed({ chat, turn })],
      [nina.conversation.turns, Effect.succeed(page([]))],
      [
        nina.messages.page,
        Effect.succeed({ ...page([{ id: "broken" }]), streams: [] }),
      ],
    ]);

    await expect(readReaderHandler({ data: request })).rejects.toThrow();
  });

  it("reads an older page of messages, and of turns only when the reader asks for them", async () => {
    answer([
      [nina.messages.page, Effect.succeed({ ...page([message]), streams: [] })],
      [nina.conversation.turns, Effect.succeed(page([turn]))],
    ]);

    const messagesOnly = await readReaderOlderHandler({
      data: { ...request, messagesCursor: "older", threadId },
    });
    expect(messagesOnly).toStrictEqual({
      messages: {
        continueCursor: "",
        isDone: true,
        json: messagesJson([message]),
      },
    });
    expect(mocks.query).not.toHaveBeenCalledWith(
      nina.conversation.turns,
      expect.anything()
    );

    const withTurns = await readReaderOlderHandler({
      data: {
        ...request,
        messagesCursor: "older",
        threadId,
        turnsCursor: "turns",
      },
    });
    expect(withTurns).toStrictEqual({
      messages: {
        continueCursor: "",
        isDone: true,
        json: messagesJson([message]),
      },
      turns: { continueCursor: "", isDone: true, page: [turn] },
    });
    expect(mocks.query).toHaveBeenCalledWith(nina.conversation.turns, {
      ...request,
      paginationOpts: { cursor: "turns", numItems: NINA_MESSAGES_PAGE_SIZE },
    });
  });
});
