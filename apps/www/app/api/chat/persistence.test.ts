// @vitest-environment node
import { ModelIdSchema } from "@repo/ai/config/model";
import type {
  NinaContextSnapshot,
  NinaContextTransition,
} from "@repo/ai/nina/memory/pack";
import type { MyUIMessage } from "@repo/ai/types/message";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createChatWithMessage,
  loadMessages,
  loadPinnedNinaContext,
  saveChatMessage,
} from "@/app/api/chat/persistence";

const mocks = vi.hoisted(() => ({
  compressMessages: vi.fn(),
  fetchMutation: vi.fn(),
  fetchQuery: vi.fn(),
  mapDBMessagesToUIMessages: vi.fn(),
  mapUIMessagePartsToDBParts: vi.fn(),
}));

vi.mock("@repo/ai/lib/message", () => ({
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
const modelId = ModelIdSchema.make("nakafa-lite");
const ninaContextSnapshot = {
  capturedAt: "2026-05-09T00:00:00.000Z",
  learning: {
    locale: "id",
    slug: "materi/matematika/integral/jumlahan-riemann",
    url: "https://nakafa.com/id/materi/matematika/integral/jumlahan-riemann",
    verified: true,
  },
  source: "current-page",
  tools: {
    allowDeepResearch: true,
    allowMath: true,
    allowNakafa: true,
    allowPageFetch: true,
    evidenceScope: "verified-page",
  },
} satisfies NinaContextSnapshot;
const ninaContextTransition = {
  reason: "page-context",
  toContextKey: "canonical:materi/matematika/integral/jumlahan-riemann",
} satisfies NinaContextTransition;

/** Adds the required Nina context fields for chat persistence tests. */
function withNinaContext() {
  return {
    ninaContextSnapshot,
    ninaContextTransition,
  };
}

/** Returns one typed chat ID through the public persistence path. */
async function savedChatId() {
  mocks.fetchMutation.mockResolvedValueOnce({ chatId: "chat_existing" });

  const chatId = await Effect.runPromise(
    createChatWithMessage({
      message,
      modelId,
      ...withNinaContext(),
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
      createChatWithMessage({
        message,
        modelId,
        ...withNinaContext(),
        token: "session-token",
      })
    );

    expect(chatId).toBe("chat_new");
    expect(mocks.fetchMutation).toHaveBeenCalledWith(
      expect.anything(),
      {
        message: {
          identifier: "message-1",
          modelId,
          ninaContextSnapshot,
          ninaContextTransition,
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
      saveChatMessage({
        chatId,
        message,
        modelId,
        ...withNinaContext(),
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
          modelId,
          ninaContextSnapshot,
          ninaContextTransition,
          role: "user",
        },
        parts: [],
      },
      { token: "session-token" }
    );
  });

  it("loads the newest stored Nina context for pinned-chat continuation", async () => {
    const chatId = await savedChatId();
    mocks.fetchQuery.mockResolvedValue(ninaContextSnapshot);

    const result = await Effect.runPromise(
      loadPinnedNinaContext({
        chatId,
        token: "session-token",
      })
    );

    expect(result).toEqual(ninaContextSnapshot);
    expect(mocks.fetchQuery).toHaveBeenCalledWith(
      expect.anything(),
      { chatId },
      { token: "session-token" }
    );
  });

  it("ignores missing pinned Nina context instead of inventing chat context", async () => {
    const chatId = await savedChatId();
    mocks.fetchQuery.mockResolvedValue(null);

    const result = await Effect.runPromise(
      loadPinnedNinaContext({
        chatId,
        token: "session-token",
      })
    );

    expect(result).toBeUndefined();
  });

  it("saves an existing chat rewrite through one atomic Convex mutation", async () => {
    const chatId = await savedChatId();

    await Effect.runPromise(
      saveChatMessage({
        chatId,
        message,
        modelId,
        ...withNinaContext(),
        token: "session-token",
      })
    );

    expect(mocks.fetchQuery).not.toHaveBeenCalled();
    expect(mocks.fetchMutation).toHaveBeenCalledTimes(1);
    expect(mocks.fetchMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        message: expect.objectContaining({
          chatId,
          modelId,
        }),
      }),
      { token: "session-token" }
    );
  });

  it("loads pinned context before saving a possible rewrite replacement", async () => {
    const chatId = await savedChatId();
    mocks.fetchQuery.mockResolvedValueOnce(ninaContextSnapshot);

    const pinnedContext = await Effect.runPromise(
      loadPinnedNinaContext({
        chatId,
        token: "session-token",
      })
    );
    await Effect.runPromise(
      saveChatMessage({
        chatId,
        message,
        modelId,
        ...withNinaContext(),
        token: "session-token",
      })
    );

    expect(pinnedContext).toEqual(ninaContextSnapshot);
    expect(mocks.fetchQuery.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.fetchMutation.mock.invocationCallOrder[0]
    );
    expect(mocks.fetchQuery).toHaveBeenCalledWith(
      expect.anything(),
      { chatId },
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
