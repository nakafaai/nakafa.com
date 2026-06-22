import type { ModelId } from "@repo/ai/config/model";
import { compressMessages } from "@repo/ai/lib/message";
import type {
  NinaContextSnapshot,
  NinaContextTransition,
} from "@repo/ai/nina/memory/pack";
import { NinaContextSnapshotSchema } from "@repo/ai/nina/memory/pack";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { CHAT_MESSAGES_PAGE_SIZE } from "@repo/backend/convex/chats/constants";
import { mapUIMessagePartsToDBParts } from "@repo/backend/convex/chats/messageParts/uiToDb";
import { mapDBMessagesToUIMessages } from "@repo/backend/convex/chats/utils";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { Effect, Option, Schema } from "effect";

/** Generated Convex page shape returned by the chat-message pagination query. */
type ChatMessagesPage = FunctionReturnType<
  typeof convexApi.chats.queries.loadMessagesPage
>;

/**
 * Persists the user message to an existing chat, or creates a new chat with
 * the message if no chatId is provided.
 *
 * @returns The resolved chat ID (either the existing one or the newly created one).
 */
export const saveOrCreateChat = Effect.fn("chat.saveOrCreateChat")(function* ({
  chatId,
  message,
  modelId,
  ninaContextSnapshot,
  ninaContextTransition,
  token,
}: {
  readonly chatId: Id<"chats"> | undefined;
  readonly message: MyUIMessage;
  readonly modelId: ModelId;
  readonly ninaContextSnapshot: NinaContextSnapshot;
  readonly ninaContextTransition: NinaContextTransition;
  readonly token: string;
}) {
  const dbParts = mapUIMessagePartsToDBParts({ messageParts: message.parts });

  if (chatId) {
    const existingMessage = yield* Effect.tryPromise(() =>
      fetchQuery(
        convexApi.chats.queries.getMessageMatch,
        {
          chatId,
          identifier: message.id,
        },
        { token }
      )
    );

    if (existingMessage) {
      let hasMore = true;

      while (hasMore) {
        const result = yield* Effect.tryPromise(() =>
          fetchMutation(
            convexApi.chats.mutations.deleteMessageBatch,
            {
              chatId,
              fromCreationTime: existingMessage.creationTime,
            },
            { token }
          )
        );

        hasMore = result.hasMore;
      }
    }

    yield* Effect.tryPromise(() =>
      fetchMutation(
        convexApi.chats.mutations.saveMessage,
        {
          message: {
            chatId,
            role: message.role,
            identifier: message.id,
            modelId,
            ninaContextSnapshot,
            ninaContextTransition,
          },
          parts: dbParts,
        },
        { token }
      )
    );
    return chatId;
  }

  const result = yield* Effect.tryPromise(() =>
    fetchMutation(
      convexApi.chats.mutations.createChatWithMessage,
      {
        type: "study",
        message: {
          role: message.role,
          identifier: message.id,
          modelId,
          ninaContextSnapshot,
          ninaContextTransition,
        },
        parts: dbParts,
      },
      { token }
    )
  );
  return result.chatId;
});

/**
 * Loads the newest stored Nina snapshot for an existing chat.
 *
 * The Convex query is bounded and ownership-checked. Decoding happens here so
 * app chat routing never replays unvalidated persisted context metadata.
 */
export const loadPinnedNinaContext = Effect.fn("chat.loadPinnedNinaContext")(
  function* ({
    chatId,
    token,
  }: {
    readonly chatId: Id<"chats">;
    readonly token: string;
  }) {
    const storedContext = yield* Effect.tryPromise(() =>
      fetchQuery(
        convexApi.chats.queries.getLatestNinaContext,
        { chatId },
        { token }
      )
    );

    const decoded = Schema.decodeUnknownOption(NinaContextSnapshotSchema)(
      storedContext
    );

    if (Option.isNone(decoded)) {
      return;
    }

    return decoded.value;
  }
);

/**
 * Fetches a chat transcript page-by-page until the retained context is enough
 * for model input. Older pages stop loading once compression would trim them.
 *
 * @returns An ordered array of UI messages for the given chat context.
 */
export const loadMessages = Effect.fn("chat.loadMessages")(function* ({
  chatId,
  token,
}: {
  readonly chatId: Id<"chats">;
  readonly token: string;
}) {
  let cursor: string | null = null;
  let messages: MyUIMessage[] = [];

  while (true) {
    const page: ChatMessagesPage = yield* Effect.tryPromise(() =>
      fetchQuery(
        convexApi.chats.queries.loadMessagesPage,
        {
          chatId,
          paginationOpts: {
            cursor,
            numItems: CHAT_MESSAGES_PAGE_SIZE,
          },
        },
        { token }
      )
    );
    const nextMessages = mapDBMessagesToUIMessages([...page.page].reverse());
    messages = [...nextMessages, ...messages];

    const compressed = compressMessages(messages);

    if (compressed.messages.length < messages.length || page.isDone) {
      return compressed.messages;
    }

    cursor = page.continueCursor;
  }
});
