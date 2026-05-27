import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { QueryCtx } from "@repo/backend/confect/_generated/services";
import {
  ChatStoreError,
  getMessageByIdentifier,
  hydrateMessagePage,
  readOwnedChat,
  validateChatAccess,
} from "@repo/backend/confect/modules/chat/chatStore.service";
import {
  getOptionalAppUser,
  requireAppUser,
} from "@repo/backend/confect/modules/identity/auth.service";
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
  readonly type?: "study";
  readonly userId: Id<"users">;
  readonly visibility?: "private" | "public";
}

type OwnChatListArgs = Omit<ChatListArgs, "userId">;

/** Reads a chat if the current viewer can access it. */
export const getChat = Effect.fn("chatQueries.getChat")(function* (args: {
  chatId: Id<"chats">;
}) {
  const ctx = yield* QueryCtx;
  const viewer = yield* getOptionalAppUser(ctx);
  const viewerUserId = viewer?.appUser._id ?? null;
  const chat = yield* Effect.promise(() => ctx.db.get(args.chatId));

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
export const getChats = Effect.fn("chatQueries.getChats")(function* (
  args: ChatListArgs
) {
  const ctx = yield* QueryCtx;
  const searchQuery = args.q?.trim();

  if (args.visibility === "private") {
    return emptyChatsPage;
  }

  if (searchQuery) {
    return yield* Effect.promise(() =>
      ctx.db
        .query("chats")
        .withSearchIndex("search_title", (query) => {
          let builder = query
            .search("title", searchQuery)
            .eq("userId", args.userId);
          builder = builder.eq("visibility", "public");

          if (args.type) {
            builder = builder.eq("type", args.type);
          }

          return builder;
        })
        .paginate(args.paginationOpts)
    );
  }

  if (args.type) {
    const type = args.type;

    return yield* Effect.promise(() =>
      ctx.db
        .query("chats")
        .withIndex("by_userId_and_visibility_and_type", (query) =>
          query
            .eq("userId", args.userId)
            .eq("visibility", "public")
            .eq("type", type)
        )
        .order("desc")
        .paginate(args.paginationOpts)
    );
  }

  return yield* Effect.promise(() =>
    ctx.db
      .query("chats")
      .withIndex("by_userId_and_visibility", (query) =>
        query.eq("userId", args.userId).eq("visibility", "public")
      )
      .order("desc")
      .paginate(args.paginationOpts)
  );
});

/** Lists the current user's chats with optional search and filters. */
export const getOwnChats = Effect.fn("chatQueries.getOwnChats")(function* (
  args: OwnChatListArgs
) {
  const ctx = yield* QueryCtx;
  const viewer = yield* getOptionalAppUser(ctx);
  const searchQuery = args.q?.trim();

  if (!viewer) {
    return emptyChatsPage;
  }

  const userId = viewer.appUser._id;

  if (searchQuery) {
    return yield* Effect.promise(() =>
      ctx.db
        .query("chats")
        .withSearchIndex("search_title", (query) => {
          let builder = query.search("title", searchQuery).eq("userId", userId);

          if (args.visibility) {
            builder = builder.eq("visibility", args.visibility);
          }

          if (args.type) {
            builder = builder.eq("type", args.type);
          }

          return builder;
        })
        .paginate(args.paginationOpts)
    );
  }

  if (args.visibility && args.type) {
    const visibility = args.visibility;
    const type = args.type;

    return yield* Effect.promise(() =>
      ctx.db
        .query("chats")
        .withIndex("by_userId_and_visibility_and_type", (query) =>
          query
            .eq("userId", userId)
            .eq("visibility", visibility)
            .eq("type", type)
        )
        .order("desc")
        .paginate(args.paginationOpts)
    );
  }

  if (args.type) {
    const type = args.type;

    return yield* Effect.promise(() =>
      ctx.db
        .query("chats")
        .withIndex("by_userId_and_type", (query) =>
          query.eq("userId", userId).eq("type", type)
        )
        .order("desc")
        .paginate(args.paginationOpts)
    );
  }

  if (args.visibility) {
    const visibility = args.visibility;

    return yield* Effect.promise(() =>
      ctx.db
        .query("chats")
        .withIndex("by_userId_and_visibility", (query) =>
          query.eq("userId", userId).eq("visibility", visibility)
        )
        .order("desc")
        .paginate(args.paginationOpts)
    );
  }

  return yield* Effect.promise(() =>
    ctx.db
      .query("chats")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .order("desc")
      .paginate(args.paginationOpts)
  );
});

/** Reads a chat title when public or owned by the current viewer. */
export const getChatTitle = Effect.fn("chatQueries.getChatTitle")(
  function* (args: { chatId: Id<"chats"> }) {
    const ctx = yield* QueryCtx;
    const chat = yield* Effect.promise(() => ctx.db.get(args.chatId));

    if (!chat) {
      return null;
    }

    if (chat.visibility === "public") {
      return chat.title ?? null;
    }

    const viewer = yield* getOptionalAppUser(ctx);
    return viewer?.appUser._id === chat.userId ? (chat.title ?? null) : null;
  }
);

/** Loads one hydrated page of chat messages. */
export const loadMessagesPage = Effect.fn("chatQueries.loadMessagesPage")(
  function* (args: { chatId: Id<"chats">; paginationOpts: PaginationOptions }) {
    const ctx = yield* QueryCtx;
    const viewer = yield* getOptionalAppUser(ctx);
    const viewerUserId = viewer?.appUser._id ?? null;
    const chat = yield* Effect.promise(() => ctx.db.get(args.chatId));

    if (!chat) {
      return yield* Effect.fail(
        new ChatStoreError({
          message: `Chat not found for chatId: ${args.chatId}`,
        })
      );
    }

    yield* validateChatAccess(chat, viewerUserId);

    const page = yield* Effect.promise(() =>
      ctx.db
        .query("messages")
        .withIndex("by_chatId", (query) => query.eq("chatId", args.chatId))
        .order("desc")
        .paginate(args.paginationOpts)
    );

    return {
      ...page,
      page: yield* hydrateMessagePage(page.page),
    };
  }
);

/** Reads the persisted message id for a stable client identifier. */
export const getMessageMatch = Effect.fn("chatQueries.getMessageMatch")(
  function* (args: { chatId: Id<"chats">; identifier: string }) {
    const ctx = yield* QueryCtx;
    const user = yield* requireAppUser(ctx);

    const ownedChat = yield* Effect.promise(() =>
      readOwnedChat(ctx, args.chatId, user.appUser._id)
    );

    if (ownedChat instanceof ChatStoreError) {
      return yield* Effect.fail(ownedChat);
    }

    const message = yield* Effect.promise(() =>
      getMessageByIdentifier(ctx, args.chatId, args.identifier)
    );

    if (!message) {
      return null;
    }

    return {
      creationTime: message._creationTime,
      messageId: message._id,
    };
  }
);
