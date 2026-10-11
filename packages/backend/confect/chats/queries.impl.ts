import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { readChat } from "@repo/backend/confect/chats/access/read";
import { listChats } from "@repo/backend/confect/chats/list";
import spec from "@repo/backend/confect/chats/queries.spec";
import { openChat } from "@repo/backend/confect/chats/title";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

const getChat = FunctionImpl.make(
  databaseSchema,
  spec,
  "getChat",
  Effect.fn("chats.queries.getChat")(function* (args) {
    const viewer = yield* getOptionalAppUserForRead();
    const viewerUserId = viewer?.appUser._id ?? null;
    return yield* openChat(yield* readChat(args.chatId, viewerUserId));
  })
);
const getChats = FunctionImpl.make(
  databaseSchema,
  spec,
  "getChats",
  Effect.fn("chats.queries.getChats")(function* (args) {
    if (args.visibility === "private") {
      return {
        continueCursor: "",
        isDone: true,
        page: [],
      };
    }
    return yield* listChats({ ...args, visibility: "public" });
  })
);
const getOwnChats = FunctionImpl.make(
  databaseSchema,
  spec,
  "getOwnChats",
  Effect.fn("chats.queries.getOwnChats")(function* (args) {
    const viewer = yield* getOptionalAppUserForRead();
    if (!viewer) {
      return {
        continueCursor: "",
        isDone: true,
        page: [],
      };
    }
    return yield* listChats({ ...args, userId: viewer.appUser._id });
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
    if (chat.visibility === "private") {
      const viewer = yield* getOptionalAppUserForRead();
      if ((viewer?.appUser._id ?? null) !== chat.userId) {
        return null;
      }
    }
    return (yield* openChat(chat)).title ?? null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getChat),
  Layer.provide(getChats),
  Layer.provide(getOwnChats),
  Layer.provide(getChatTitle),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
