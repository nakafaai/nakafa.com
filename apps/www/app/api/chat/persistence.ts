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

/** Maps one UI message into the Convex payload shared by create/save mutations. */
function createPersistedMessage({
  message,
  modelId,
  ninaContextSnapshot,
  ninaContextTransition,
}: {
  readonly message: MyUIMessage;
  readonly modelId: ModelId;
  readonly ninaContextSnapshot: NinaContextSnapshot;
  readonly ninaContextTransition: NinaContextTransition;
}) {
  return {
    identifier: message.id,
    modelId,
    ninaContextSnapshot,
    ninaContextTransition,
    role: message.role,
  };
}

/** Creates a new study chat with the first persisted user message. */
export const createChatWithMessage = Effect.fn("chat.createChatWithMessage")(
  function* ({
    message,
    modelId,
    ninaContextSnapshot,
    ninaContextTransition,
    token,
  }: {
    readonly message: MyUIMessage;
    readonly modelId: ModelId;
    readonly ninaContextSnapshot: NinaContextSnapshot;
    readonly ninaContextTransition: NinaContextTransition;
    readonly token: string;
  }) {
    const dbParts = mapUIMessagePartsToDBParts({ messageParts: message.parts });
    const result = yield* Effect.tryPromise(() =>
      fetchMutation(
        convexApi.chats.mutations.createChatWithMessage,
        {
          type: "study",
          message: createPersistedMessage({
            message,
            modelId,
            ninaContextSnapshot,
            ninaContextTransition,
          }),
          parts: dbParts,
        },
        { token }
      )
    );

    return result.chatId;
  }
);

/**
 * Saves one user message to an existing chat after context has been resolved.
 *
 * Convex owns transcript rewrite replacement atomically by message identifier,
 * so the app adapter never performs a separate delete before this mutation.
 */
export const saveChatMessage = Effect.fn("chat.saveChatMessage")(function* ({
  chatId,
  message,
  modelId,
  ninaContextSnapshot,
  ninaContextTransition,
  token,
}: {
  readonly chatId: Id<"chats">;
  readonly message: MyUIMessage;
  readonly modelId: ModelId;
  readonly ninaContextSnapshot: NinaContextSnapshot;
  readonly ninaContextTransition: NinaContextTransition;
  readonly token: string;
}) {
  const dbParts = mapUIMessagePartsToDBParts({ messageParts: message.parts });

  yield* Effect.tryPromise(() =>
    fetchMutation(
      convexApi.chats.mutations.saveMessage,
      {
        message: {
          chatId,
          ...createPersistedMessage({
            message,
            modelId,
            ninaContextSnapshot,
            ninaContextTransition,
          }),
        },
        parts: dbParts,
      },
      { token }
    )
  );

  return chatId;
});

/**
 * Loads the newest stored Nina snapshot that can pin the incoming turn.
 *
 * Convex resolves existing message identifiers against the retained transcript,
 * so rewrite tails cannot leak future context into the replacement message.
 * Decoding happens here so app routing never replays unvalidated metadata.
 */
export const loadPinnedNinaContext = Effect.fn("chat.loadPinnedNinaContext")(
  function* ({
    chatId,
    messageIdentifier,
    token,
  }: {
    readonly chatId: Id<"chats">;
    readonly messageIdentifier: string;
    readonly token: string;
  }) {
    const storedContext = yield* Effect.tryPromise(() =>
      fetchQuery(
        convexApi.chats.queries.getPinnedNinaContextForTurn,
        { chatId, messageIdentifier },
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
