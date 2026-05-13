import type { MyUIMessage } from "@repo/ai/types/message";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadMessages, saveOrCreateChat } from "@/app/api/chat/persistence";

const mocks = vi.hoisted(() => ({
  compressMessages: vi.fn(),
  fetchMutation: vi.fn(),
  fetchQuery: vi.fn(),
  mapDBMessagesToUIMessages: vi.fn(),
  mapUIMessagePartsToDBParts: vi.fn(),
}));

vi.mock("@repo/ai/lib/utils", () => ({
  compressMessages: mocks.compressMessages,
}));

vi.mock("convex/nextjs", () => ({
  fetchMutation: mocks.fetchMutation,
  fetchQuery: mocks.fetchQuery,
}));

vi.mock("@repo/backend/convex/chats/messageParts/uiToDb", () => ({
  mapUIMessagePartsToDBParts: mocks.mapUIMessagePartsToDBParts,
}));

vi.mock("@repo/backend/convex/chats/utils", () => ({
  mapDBMessagesToUIMessages: mocks.mapDBMessagesToUIMessages,
}));

const message = {
  id: "message-1",
  parts: [],
  role: "user",
} satisfies MyUIMessage;

/** Returns one typed chat ID through the public persistence path. */
async function savedChatId() {
  mocks.fetchMutation.mockResolvedValueOnce({ chatId: "chat_existing" });

  const chatId = await Effect.runPromise(
    saveOrCreateChat({
      chatId: undefined,
      message,
      modelId: "nakafa-lite",
      token: "session-token",
    })
  );

  vi.clearAllMocks();
  mocks.mapUIMessagePartsToDBParts.mockReturnValue([]);

  return chatId;
}

describe("app/api/chat/persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.compressMessages.mockImplementation((messages) => ({
      messages,
      tokens: 0,
    }));
    mocks.mapDBMessagesToUIMessages.mockImplementation((messages) => messages);
    mocks.mapUIMessagePartsToDBParts.mockReturnValue([]);
  });

  it("passes the selected model when creating a chat with the first user message", async () => {
    mocks.fetchMutation.mockResolvedValue({ chatId: "chat_new" });

    const chatId = await Effect.runPromise(
      saveOrCreateChat({
        chatId: undefined,
        message,
        modelId: "nakafa-lite",
        token: "session-token",
      })
    );

    expect(chatId).toBe("chat_new");
    expect(mocks.fetchMutation).toHaveBeenCalledWith(
      expect.anything(),
      {
        message: {
          identifier: "message-1",
          modelId: "nakafa-lite",
          role: "user",
        },
        parts: [],
        type: "study",
      },
      { token: "session-token" }
    );
  });

  it("passes the selected model when saving a message to an existing chat", async () => {
    const chatId = await savedChatId();
    mocks.fetchQuery.mockResolvedValue(null);

    const result = await Effect.runPromise(
      saveOrCreateChat({
        chatId,
        message,
        modelId: "nakafa-lite",
        token: "session-token",
      })
    );

    expect(result).toBe(chatId);
    expect(mocks.fetchMutation).toHaveBeenCalledWith(
      expect.anything(),
      {
        message: {
          chatId,
          identifier: "message-1",
          modelId: "nakafa-lite",
          role: "user",
        },
        parts: [],
      },
      { token: "session-token" }
    );
  });

  it("deletes an existing message rewrite batch before saving the replacement", async () => {
    const chatId = await savedChatId();
    mocks.fetchQuery.mockResolvedValue({ creationTime: 123 });
    mocks.fetchMutation
      .mockResolvedValueOnce({ hasMore: true })
      .mockResolvedValueOnce({ hasMore: false })
      .mockResolvedValueOnce({});

    await Effect.runPromise(
      saveOrCreateChat({
        chatId,
        message,
        modelId: "nakafa-lite",
        token: "session-token",
      })
    );

    expect(mocks.fetchMutation).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      {
        chatId,
        fromCreationTime: 123,
      },
      { token: "session-token" }
    );
    expect(mocks.fetchMutation).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      {
        chatId,
        fromCreationTime: 123,
      },
      { token: "session-token" }
    );
    expect(mocks.fetchMutation).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      expect.objectContaining({
        message: expect.objectContaining({
          chatId,
          modelId: "nakafa-lite",
        }),
      }),
      { token: "session-token" }
    );
  });

  it("loads paginated messages until the page stream is done", async () => {
    const chatId = await savedChatId();
    const newerMessage = { ...message, id: "newer" };
    const olderMessage = { ...message, id: "older" };
    mocks.fetchQuery
      .mockResolvedValueOnce({
        continueCursor: "cursor-1",
        isDone: false,
        page: [newerMessage],
      })
      .mockResolvedValueOnce({
        continueCursor: "",
        isDone: true,
        page: [olderMessage],
      });

    const messages = await Effect.runPromise(
      loadMessages({ chatId, token: "session-token" })
    );

    expect(messages).toEqual([olderMessage, newerMessage]);
    expect(mocks.fetchQuery).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      {
        chatId,
        paginationOpts: {
          cursor: null,
          numItems: expect.any(Number),
        },
      },
      { token: "session-token" }
    );
    expect(mocks.fetchQuery).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      {
        chatId,
        paginationOpts: {
          cursor: "cursor-1",
          numItems: expect.any(Number),
        },
      },
      { token: "session-token" }
    );
  });

  it("stops loading when compression trims the retained transcript", async () => {
    const chatId = await savedChatId();
    mocks.fetchQuery.mockResolvedValue({
      continueCursor: "cursor-1",
      isDone: false,
      page: [message],
    });
    mocks.compressMessages.mockReturnValue({ messages: [], tokens: 0 });

    const messages = await Effect.runPromise(
      loadMessages({ chatId, token: "session-token" })
    );

    expect(messages).toEqual([]);
    expect(mocks.fetchQuery).toHaveBeenCalledTimes(1);
  });
});
