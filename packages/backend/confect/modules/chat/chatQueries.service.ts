import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  ChatStoreError,
  getMessageByIdentifier,
  hydrateMessagePage,
  readOwnedChat,
  validateChatAccess,
} from "@repo/backend/confect/modules/chat/chatStore.service";
import type {
  ChatType,
  ChatVisibility,
} from "@repo/backend/confect/modules/chat/chats.tables";
import {
  getOptionalAppUser,
  requireAppUser,
} from "@repo/backend/confect/modules/identity/auth/session.service";
import type { PaginationOptions } from "convex/server";
import { Effect } from "effect";

const emptyChatsPage = {
  continueCursor: "",
  isDone: true,
  page: [],
};

interface ChatListArgs {
  readonly paginationOpts: PaginationOptions;
  readonly q?: string;
  readonly type?: ChatType;
  readonly userId: Id<"users">;
  readonly visibility?: ChatVisibility;
}

type OwnChatListArgs = Omit<ChatListArgs, "userId">;

/** Reads a chat if the current viewer can access it. */
export const getChat = Effect.fnUntraced(function* (args: {
  chatId: Id<"chats">;
}) {
  const reader = yield* DatabaseReader;
  const viewer = yield* getOptionalAppUser();
  const viewerUserId = viewer?.appUser._id ?? null;
  const chat = yield* reader
    .table("chats")
    .get(args.chatId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!chat) {
    return yield* Effect.fail(
      new ChatStoreError({
        message: `Chat not found for chatId: ${args.chatId}`,
      })
    );
  }

  return yield* validateChatAccess(chat, viewerUserId);
});

/** Lists public chats for a user with optional search and type filters. */
export const getChats = Effect.fnUntraced(function* (args: ChatListArgs) {
  const reader = yield* DatabaseReader;
  const searchQuery = args.q?.trim();

  if (args.visibility === "private") {
    return emptyChatsPage;
  }

  if (searchQuery) {
    return yield* reader
      .table("chats")
      .search("search_title", (query) => {
        let builder = query
          .search("title", searchQuery)
          .eq("userId", args.userId);
        builder = builder.eq("visibility", "public");

        if (args.type) {
          builder = builder.eq("type", args.type);
        }

        return builder;
      })
      .paginate(args.paginationOpts);
  }

  if (args.type) {
    const type = args.type;

    return yield* reader
      .table("chats")
      .index(
        "by_userId_and_visibility_and_type",
        (query) =>
          query
            .eq("userId", args.userId)
            .eq("visibility", "public")
            .eq("type", type),
        "desc"
      )
      .paginate(args.paginationOpts);
  }

  return yield* reader
    .table("chats")
    .index(
      "by_userId_and_visibility",
      (query) => query.eq("userId", args.userId).eq("visibility", "public"),
      "desc"
    )
    .paginate(args.paginationOpts);
});

/** Lists the current user's chats with optional search and filters. */
export const getOwnChats = Effect.fnUntraced(function* (args: OwnChatListArgs) {
  const reader = yield* DatabaseReader;
  const viewer = yield* getOptionalAppUser();
  const searchQuery = args.q?.trim();

  if (!viewer) {
    return emptyChatsPage;
  }

  const userId = viewer.appUser._id;

  if (searchQuery) {
    return yield* reader
      .table("chats")
      .search("search_title", (query) => {
        let builder = query.search("title", searchQuery).eq("userId", userId);

        if (args.visibility) {
          builder = builder.eq("visibility", args.visibility);
        }

        if (args.type) {
          builder = builder.eq("type", args.type);
        }

        return builder;
      })
      .paginate(args.paginationOpts);
  }

  if (args.visibility && args.type) {
    const visibility = args.visibility;
    const type = args.type;

    return yield* reader
      .table("chats")
      .index(
        "by_userId_and_visibility_and_type",
        (query) =>
          query
            .eq("userId", userId)
            .eq("visibility", visibility)
            .eq("type", type),
        "desc"
      )
      .paginate(args.paginationOpts);
  }

  if (args.type) {
    const type = args.type;

    return yield* reader
      .table("chats")
      .index(
        "by_userId_and_type",
        (query) => query.eq("userId", userId).eq("type", type),
        "desc"
      )
      .paginate(args.paginationOpts);
  }

  if (args.visibility) {
    const visibility = args.visibility;

    return yield* reader
      .table("chats")
      .index(
        "by_userId_and_visibility",
        (query) => query.eq("userId", userId).eq("visibility", visibility),
        "desc"
      )
      .paginate(args.paginationOpts);
  }

  return yield* reader
    .table("chats")
    .index("by_userId", (query) => query.eq("userId", userId), "desc")
    .paginate(args.paginationOpts);
});

/** Reads a chat title when public or owned by the current viewer. */
export const getChatTitle = Effect.fnUntraced(function* (args: {
  chatId: Id<"chats">;
}) {
  const reader = yield* DatabaseReader;
  const chat = yield* reader
    .table("chats")
    .get(args.chatId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!chat) {
    return null;
  }

  if (chat.visibility === "public") {
    return chat.title ?? null;
  }

  const viewer = yield* getOptionalAppUser();
  return viewer?.appUser._id === chat.userId ? (chat.title ?? null) : null;
});

/** Loads one hydrated page of chat messages. */
export const loadMessagesPage = Effect.fnUntraced(function* (args: {
  chatId: Id<"chats">;
  paginationOpts: PaginationOptions;
}) {
  const reader = yield* DatabaseReader;
  const viewer = yield* getOptionalAppUser();
  const viewerUserId = viewer?.appUser._id ?? null;
  const chat = yield* reader
    .table("chats")
    .get(args.chatId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!chat) {
    return yield* Effect.fail(
      new ChatStoreError({
        message: `Chat not found for chatId: ${args.chatId}`,
      })
    );
  }

  yield* validateChatAccess(chat, viewerUserId);

  const page = yield* reader
    .table("messages")
    .index("by_chatId", (query) => query.eq("chatId", args.chatId), "desc")
    .paginate(args.paginationOpts);

  return {
    ...page,
    page: yield* hydrateMessagePage(page.page),
  };
});

/** Reads the persisted message id for a stable client identifier. */
export const getMessageMatch = Effect.fnUntraced(function* (args: {
  chatId: Id<"chats">;
  identifier: string;
}) {
  const user = yield* requireAppUser();

  yield* readOwnedChat({
    chatId: args.chatId,
    userId: user.appUser._id,
  });

  const message = yield* getMessageByIdentifier({
    chatId: args.chatId,
    identifier: args.identifier,
  });

  if (!message) {
    return null;
  }

  return {
    creationTime: message._creationTime,
    messageId: message._id,
  };
});
