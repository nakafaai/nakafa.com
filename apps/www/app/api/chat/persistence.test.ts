// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ModelIdSchema } from "@repo/ai/config/model";
import type {
  NinaContextSnapshot,
  NinaContextTransition,
} from "@repo/ai/nina/memory/pack";
import type { MyUIMessage } from "@repo/ai/types/message";
import { Effect } from "effect";
import { vi } from "vitest";
import { ChatMutationError, ChatQueryError } from "@/app/api/chat/errors";
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
const savedChatId = Effect.fn("ChatPersistenceTest.savedChatId")(function* () {
  mocks.fetchMutation.mockResolvedValueOnce({ chatId: "chat_existing" });

  const chatId = yield* createChatWithMessage({
    message,
    modelId,
    ...withNinaContext(),
    token: "session-token",
  });

  vi.clearAllMocks();
  mocks.mapUIMessagePartsToDBParts.mockReturnValue([]);

  return chatId;
});

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

  it.effect(
    "passes the selected model when creating a chat with the first user message",
    () =>
      Effect.gen(function* () {
        mocks.fetchMutation.mockResolvedValue({ chatId: "chat_new" });

        const chatId = yield* createChatWithMessage({
          message,
          modelId,
          ...withNinaContext(),
          token: "session-token",
        });

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
      })
  );

  it.effect(
    "maps chat creation failures into the mutation error contract",
    () =>
      Effect.gen(function* () {
        const cause = new Error("mutation unavailable");
        mocks.fetchMutation.mockRejectedValueOnce(cause);

        const error = yield* createChatWithMessage({
          message,
          modelId,
          ...withNinaContext(),
          token: "session-token",
        }).pipe(Effect.flip);

        expect(error).toBeInstanceOf(ChatMutationError);
        expect(error).toMatchObject({
          cause,
          operation: "create-chat",
        });
      })
  );

  it.effect(
    "passes the selected model when saving a message to an existing chat",
    () =>
      Effect.gen(function* () {
        const chatId = yield* savedChatId();
        mocks.fetchQuery.mockResolvedValue(null);

        const result = yield* saveChatMessage({
          chatId,
          message,
          modelId,
          ...withNinaContext(),
          token: "session-token",
        });

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
      })
  );

  it.effect("maps message save failures into the mutation error contract", () =>
    Effect.gen(function* () {
      const chatId = yield* savedChatId();
      const cause = new Error("mutation unavailable");
      mocks.fetchMutation.mockRejectedValueOnce(cause);

      const error = yield* saveChatMessage({
        chatId,
        message,
        modelId,
        ...withNinaContext(),
        token: "session-token",
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(ChatMutationError);
      expect(error).toMatchObject({
        cause,
        operation: "save-message",
      });
    })
  );

  it.effect(
    "loads the newest stored Nina context for pinned-chat continuation",
    () =>
      Effect.gen(function* () {
        const chatId = yield* savedChatId();
        mocks.fetchQuery.mockResolvedValue(ninaContextSnapshot);

        const result = yield* loadPinnedNinaContext({
          chatId,
          messageIdentifier: message.id,
          token: "session-token",
        });

        expect(result).toEqual(ninaContextSnapshot);
        expect(mocks.fetchQuery).toHaveBeenCalledWith(
          expect.anything(),
          { chatId, messageIdentifier: message.id },
          { token: "session-token" }
        );
      })
  );

  it.effect(
    "ignores missing pinned Nina context instead of inventing chat context",
    () =>
      Effect.gen(function* () {
        const chatId = yield* savedChatId();
        mocks.fetchQuery.mockResolvedValue(null);

        const result = yield* loadPinnedNinaContext({
          chatId,
          messageIdentifier: message.id,
          token: "session-token",
        });

        expect(result).toBeUndefined();
      })
  );

  it.effect("maps pinned-context failures into the query error contract", () =>
    Effect.gen(function* () {
      const chatId = yield* savedChatId();
      const cause = new Error("query unavailable");
      mocks.fetchQuery.mockRejectedValueOnce(cause);

      const error = yield* loadPinnedNinaContext({
        chatId,
        messageIdentifier: message.id,
        token: "session-token",
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(ChatQueryError);
      expect(error).toMatchObject({
        cause,
        operation: "load-context",
      });
    })
  );

  it.effect(
    "saves an existing chat rewrite through one atomic Convex mutation",
    () =>
      Effect.gen(function* () {
        const chatId = yield* savedChatId();

        yield* saveChatMessage({
          chatId,
          message,
          modelId,
          ...withNinaContext(),
          token: "session-token",
        });

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
      })
  );

  it.effect(
    "loads rewrite-aware pinned context before saving a replacement",
    () =>
      Effect.gen(function* () {
        const chatId = yield* savedChatId();
        mocks.fetchQuery.mockResolvedValueOnce(ninaContextSnapshot);

        const pinnedContext = yield* loadPinnedNinaContext({
          chatId,
          messageIdentifier: message.id,
          token: "session-token",
        });
        yield* saveChatMessage({
          chatId,
          message,
          modelId,
          ...withNinaContext(),
          token: "session-token",
        });

        expect(pinnedContext).toEqual(ninaContextSnapshot);
        expect(mocks.fetchQuery.mock.invocationCallOrder[0]).toBeLessThan(
          mocks.fetchMutation.mock.invocationCallOrder[0]
        );
        expect(mocks.fetchQuery).toHaveBeenCalledWith(
          expect.anything(),
          { chatId, messageIdentifier: message.id },
          { token: "session-token" }
        );
      })
  );

  it.effect("loads paginated messages until the page stream is done", () =>
    Effect.gen(function* () {
      const chatId = yield* savedChatId();
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

      const messages = yield* loadMessages({
        chatId,
        token: "session-token",
      });

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
    })
  );

  it.effect("maps message page failures into the query error contract", () =>
    Effect.gen(function* () {
      const chatId = yield* savedChatId();
      const cause = new Error("query unavailable");
      mocks.fetchQuery.mockRejectedValueOnce(cause);

      const error = yield* loadMessages({
        chatId,
        token: "session-token",
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(ChatQueryError);
      expect(error).toMatchObject({
        cause,
        operation: "load-messages",
      });
    })
  );

  it.effect(
    "stops loading when compression trims the retained transcript",
    () =>
      Effect.gen(function* () {
        const chatId = yield* savedChatId();
        mocks.fetchQuery.mockResolvedValue({
          continueCursor: "cursor-1",
          isDone: false,
          page: [message],
        });
        mocks.compressMessages.mockReturnValue({ messages: [], tokens: 0 });

        const messages = yield* loadMessages({
          chatId,
          token: "session-token",
        });

        expect(messages).toEqual([]);
        expect(mocks.fetchQuery).toHaveBeenCalledTimes(1);
      })
  );
});
