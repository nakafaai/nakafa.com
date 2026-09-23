// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ModelIdSchema } from "@repo/ai/config/model";
import type {
  NinaContextSnapshot,
  NinaContextTransition,
} from "@repo/ai/nina/memory/pack";
import type { MyUIMessage } from "@repo/ai/types/message";
import { ConvexError } from "convex/values";
import { Effect } from "effect";
import {
  ChatAdmissionError,
  ChatMutationError,
  ChatQueryError,
} from "@/app/api/chat/errors";
import {
  createChatWithMessage,
  loadMessages,
  loadPinnedNinaContext,
  releaseChatTurn,
  reserveChatTurn,
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

const ninaContext = { ninaContextSnapshot, ninaContextTransition };

/** Returns one typed chat ID through the public persistence path. */
const savedChatId = Effect.fn("ChatPersistenceTest.savedChatId")(function* () {
  mocks.fetchMutation.mockResolvedValueOnce({ chatId: "chat_existing" });

  const chatId = yield* createChatWithMessage({
    message,
    modelId,
    ...ninaContext,
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
          ...ninaContext,
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
          ...ninaContext,
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
          ...ninaContext,
          token: "session-token",
        });

        expect(result).toBe(chatId);
        expect(mocks.fetchMutation).toHaveBeenCalledTimes(1);
        expect(mocks.fetchQuery).not.toHaveBeenCalled();
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
        ...ninaContext,
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
          ...ninaContext,
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

  it.live.each([
    { kind: "empty", parts: [] },
    {
      kind: "file",
      parts: [
        {
          type: "file",
          mediaType: "image/png",
          url: "https://example.com/image.png",
        },
      ],
    },
    {
      kind: "tool",
      parts: [
        {
          type: "tool-math",
          toolCallId: "math",
          state: "output-error",
          input: undefined,
          errorText: "Unavailable",
        },
      ],
    },
    { kind: "text", parts: [{ type: "text", text: "tiny" }] },
  ] satisfies { kind: string; parts: MyUIMessage["parts"] }[])(
    "bounds long $kind histories to one newest page while preserving complete ordered messages",
    ({ parts }) =>
      Effect.gen(function* () {
        const chatId = yield* savedChatId();
        const messages = Array.from({ length: 50 }, (_, index) => ({
          ...message,
          id: String(index),
          parts,
        }));
        mocks.fetchQuery.mockResolvedValue({
          continueCursor: "older-history",
          isDone: false,
          page: [...messages].reverse(),
        });
        expect(yield* loadMessages({ chatId, token: "session-token" })).toEqual(
          messages
        );
        expect(mocks.fetchQuery).toHaveBeenCalledTimes(1);
        expect(mocks.fetchQuery).toHaveBeenCalledWith(
          expect.anything(),
          { chatId, paginationOpts: { cursor: null, numItems: 50 } },
          { token: "session-token" }
        );
        expect(mocks.compressMessages).toHaveBeenCalledWith(messages);
      })
  );

  it.live(
    "compresses older text while retaining the entire current message",
    () =>
      Effect.gen(function* () {
        const { compressMessages } = yield* Effect.promise(() =>
          vi.importActual<typeof import("@repo/ai/lib/message")>(
            "@repo/ai/lib/message"
          )
        );
        const chatId = yield* savedChatId();
        mocks.compressMessages.mockImplementation(compressMessages);
        const older = {
          ...message,
          id: "older",
          parts: [{ type: "text", text: "large ".repeat(30_000) }],
        } satisfies MyUIMessage;
        const current = {
          ...message,
          id: "current",
          parts: [
            { type: "text", text: "Follow up" },
            {
              type: "file",
              url: "https://example.com/chart.png",
              mediaType: "image/png",
            },
          ],
        } satisfies MyUIMessage;
        mocks.fetchQuery.mockResolvedValue({
          continueCursor: "older",
          isDone: false,
          page: [current, older],
        });
        expect(yield* loadMessages({ chatId, token: "session-token" })).toEqual(
          [current]
        );
        expect(mocks.fetchQuery).toHaveBeenCalledTimes(1);
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
});

describe("atomic chat admission adapter", () => {
  beforeEach(() => vi.resetAllMocks());
  it.effect(
    "keeps the hold on the server and releases it on preparation failure",
    () =>
      Effect.gen(function* () {
        mocks.fetchMutation.mockResolvedValueOnce("turn-held");
        const turnId = yield* reserveChatTurn(modelId, "session-token");
        expect(turnId).toBe("turn-held");
        expect(mocks.fetchMutation).toHaveBeenLastCalledWith(
          expect.anything(),
          { modelId },
          { token: "session-token" }
        );
        mocks.fetchMutation.mockResolvedValueOnce(null);
        yield* releaseChatTurn(turnId, "session-token");
        expect(mocks.fetchMutation).toHaveBeenLastCalledWith(
          expect.anything(),
          { turnId },
          { token: "session-token" }
        );
      })
  );
  it.effect(
    "distinguishes insufficient credits from an unavailable backend",
    () =>
      Effect.gen(function* () {
        for (const code of ["INSUFFICIENT_CREDITS", "RATE_LIMITED"]) {
          mocks.fetchMutation.mockRejectedValueOnce(
            new ConvexError({ code, message: "Admission rejected" })
          );
          const rejected = yield* Effect.flip(
            reserveChatTurn(modelId, "session-token")
          );
          expect(rejected).toBeInstanceOf(ChatAdmissionError);
          expect(rejected).toMatchObject({ code });
        }
        mocks.fetchMutation.mockRejectedValueOnce(new Error("offline"));
        const unavailable = yield* Effect.flip(
          reserveChatTurn(modelId, "session-token")
        );
        expect(unavailable).toMatchObject({
          _tag: "ChatMutationError",
          operation: "reserve-turn",
        });
      })
  );
  it.effect(
    "reports release failures so durable expiry can recover the hold",
    () =>
      Effect.gen(function* () {
        mocks.fetchMutation.mockResolvedValueOnce("turn-held");
        const turnId = yield* reserveChatTurn(modelId, "session-token");
        mocks.fetchMutation.mockRejectedValueOnce(new Error("offline"));
        const failure = yield* Effect.flip(
          releaseChatTurn(turnId, "session-token")
        );
        expect(failure).toMatchObject({
          _tag: "ChatMutationError",
          operation: "release-turn",
        });
      })
  );
});
