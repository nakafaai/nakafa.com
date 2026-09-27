import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { readChat } from "@repo/backend/confect/chats/access/read";
import spec from "@repo/backend/confect/chats/queries.spec";
import {
  hydrateMessagePage,
  loadPinnedContextMessages,
} from "@repo/backend/confect/chats/transcript/read";
import { getMessageByIdentifier } from "@repo/backend/confect/chats/transcript/write";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

const getChat = FunctionImpl.make(
  databaseSchema,
  spec,
  "getChat",
  Effect.fn("chats.queries.getChat")(function* (args) {
    const viewer = yield* getOptionalAppUserForRead();
    const viewerUserId = viewer?.appUser._id ?? null;
    const chat = yield* readChat(args.chatId, viewerUserId);
    return chat;
  })
);
const getChats = FunctionImpl.make(
  databaseSchema,
  spec,
  "getChats",
  Effect.fn("chats.queries.getChats")(function* (args) {
    const database = yield* DatabaseReader;
    const { userId, q: searchQuery, visibility, type, paginationOpts } = args;
    if (visibility === "private") {
      return {
        continueCursor: "",
        isDone: true,
        page: [],
      };
    }
    if (searchQuery && searchQuery.trim().length > 0) {
      return yield* database
        .table("chats")
        .search("search_title", (q) => {
          let builder = q.search("title", searchQuery).eq("userId", userId);
          builder = builder.eq("visibility", "public");
          if (type) {
            builder = builder.eq("type", type);
          }
          return builder;
        })
        .paginate(paginationOpts)
        .pipe(Effect.orDie);
    }
    if (type) {
      return yield* database
        .table("chats")
        .index(
          "by_userId_and_visibility_and_type",
          (q) =>
            q.eq("userId", userId).eq("visibility", "public").eq("type", type),
          "desc"
        )
        .paginate(paginationOpts)
        .pipe(Effect.orDie);
    }
    return yield* database
      .table("chats")
      .index(
        "by_userId_and_visibility",
        (q) => q.eq("userId", userId).eq("visibility", "public"),
        "desc"
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
  })
);
const getOwnChats = FunctionImpl.make(
  databaseSchema,
  spec,
  "getOwnChats",
  Effect.fn("chats.queries.getOwnChats")(function* (args) {
    const database = yield* DatabaseReader;
    const { q: searchQuery, visibility, type, paginationOpts } = args;
    const viewer = yield* getOptionalAppUserForRead();
    if (!viewer) {
      return {
        continueCursor: "",
        isDone: true,
        page: [],
      };
    }
    const userId = viewer.appUser._id;
    if (searchQuery && searchQuery.trim().length > 0) {
      return yield* database
        .table("chats")
        .search("search_title", (q) => {
          let builder = q.search("title", searchQuery).eq("userId", userId);
          if (visibility) {
            builder = builder.eq("visibility", visibility);
          }
          if (type) {
            builder = builder.eq("type", type);
          }
          return builder;
        })
        .paginate(paginationOpts)
        .pipe(Effect.orDie);
    }
    if (visibility && type) {
      return yield* database
        .table("chats")
        .index(
          "by_userId_and_visibility_and_type",
          (q) =>
            q
              .eq("userId", userId)
              .eq("visibility", visibility)
              .eq("type", type),
          "desc"
        )
        .paginate(paginationOpts)
        .pipe(Effect.orDie);
    }
    if (type) {
      return yield* database
        .table("chats")
        .index(
          "by_userId_and_type",
          (q) => q.eq("userId", userId).eq("type", type),
          "desc"
        )
        .paginate(paginationOpts)
        .pipe(Effect.orDie);
    }
    if (visibility) {
      return yield* database
        .table("chats")
        .index(
          "by_userId_and_visibility",
          (q) => q.eq("userId", userId).eq("visibility", visibility),
          "desc"
        )
        .paginate(paginationOpts)
        .pipe(Effect.orDie);
    }
    return yield* database
      .table("chats")
      .index("by_userId", (q) => q.eq("userId", userId), "desc")
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
  })
);
const getChatTitle = FunctionImpl.make(
  databaseSchema,
  spec,
  "getChatTitle",
  Effect.fn("chats.queries.getChatTitle")(function* (args) {
    const database = yield* DatabaseReader;
    const chat = yield* database
      .table("chats")
      .get(args.chatId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!chat) {
      return null;
    }
    if (chat.visibility === "public") {
      return chat.title ?? null;
    }
    const viewer = yield* getOptionalAppUserForRead();
    const viewerUserId = viewer?.appUser._id ?? null;
    if (viewerUserId !== chat.userId) {
      return null;
    }
    return chat.title ?? null;
  })
);
const getPinnedNinaContextForTurn = FunctionImpl.make(
  databaseSchema,
  spec,
  "getPinnedNinaContextForTurn",
  Effect.fn("chats.queries.getPinnedNinaContextForTurn")(function* (args) {
    const viewer = yield* getOptionalAppUserForRead();
    const viewerUserId = viewer?.appUser._id ?? null;
    yield* readChat(args.chatId, viewerUserId);
    const existingMessage = yield* getMessageByIdentifier(
      args.chatId,
      args.messageIdentifier
    );
    const messages = yield* loadPinnedContextMessages(
      args.chatId,
      existingMessage?._creationTime
    );
    return (
      messages.find((message) => message.ninaContextSnapshot)
        ?.ninaContextSnapshot ?? null
    );
  })
);
const loadMessagesPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "loadMessagesPage",
  Effect.fn("chats.queries.loadMessagesPage")(function* (args) {
    const database = yield* DatabaseReader;
    const viewer = yield* getOptionalAppUserForRead();
    const viewerUserId = viewer?.appUser._id ?? null;
    yield* readChat(args.chatId, viewerUserId);
    const page = yield* database
      .table("messages")
      .index("by_chatId", (q) => q.eq("chatId", args.chatId), "desc")
      .paginate(args.paginationOpts)
      .pipe(Effect.orDie);
    return {
      ...page,
      page: yield* hydrateMessagePage(page.page),
    };
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getChat),
  Layer.provide(getChats),
  Layer.provide(getOwnChats),
  Layer.provide(getChatTitle),
  Layer.provide(getPinnedNinaContextForTurn),
  Layer.provide(loadMessagesPage),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
