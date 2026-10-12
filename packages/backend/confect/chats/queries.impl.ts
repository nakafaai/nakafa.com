import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { readChat } from "@repo/backend/confect/chats/access/read";
import { listChats } from "@repo/backend/confect/chats/list";
import spec from "@repo/backend/confect/chats/queries.spec";
import { findShare, openShareToken } from "@repo/backend/confect/chats/share";
import { openChat } from "@repo/backend/confect/chats/title";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

const getChat = FunctionImpl.make(
  databaseSchema,
  spec,
  "getChat",
  Effect.fn("chats.queries.getChat")(function* (args) {
    const viewer = yield* getOptionalAppUserForRead();
    return yield* openChat(
      yield* readChat(args.chatId, viewer?.appUser._id ?? null, args.shareToken)
    );
  })
);
/**
 * Lists nothing. A shared chat is reached by its link alone, so no list of
 * another learner's chats exists, and the lists a learner sees of their own
 * chats come from `getOwnChats`.
 *
 * Temporary compatibility, the expand step of packages/backend/AGENTS.md: a
 * browser tab that was opened before share tokens still asks for the chats of a
 * profile and would fail on a missing function. Owner: ADR 0001. Exit: the
 * release has been on production for 12 hours, the time the project's skew
 * protection keeps a browser on the web deployment it loaded. Cleanup: delete
 * this function, its entry in `queries.spec.ts` and its test.
 */
const getChats = FunctionImpl.make(
  databaseSchema,
  spec,
  "getChats",
  Effect.fn("chats.queries.getChats")(() =>
    Effect.succeed({
      continueCursor: "",
      isDone: true,
      page: [],
    })
  )
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
/** The title of a chat for its owner; a chat id alone gives no title. */
const getChatTitle = FunctionImpl.make(
  databaseSchema,
  spec,
  "getChatTitle",
  Effect.fn("chats.queries.getChatTitle")(function* (args) {
    const viewer = yield* getOptionalAppUserForRead();
    return yield* readChat(args.chatId, viewer?.appUser._id ?? null).pipe(
      Effect.flatMap(openChat),
      Effect.map((chat) => chat.title ?? null),
      Effect.catchTag("ChatAccessError", () => Effect.succeed(null))
    );
  })
);
/**
 * The token of a chat's share, for the owner who copies the link. Anyone else
 * gets none, and so does the owner of a chat that is not shared.
 */
const getShareToken = FunctionImpl.make(
  databaseSchema,
  spec,
  "getShareToken",
  Effect.fn("chats.queries.getShareToken")(function* (args) {
    const viewer = yield* getOptionalAppUserForRead();
    if (!viewer) {
      return null;
    }
    const share = yield* findShare(args.chatId);
    if (share?.userId !== viewer.appUser._id) {
      return null;
    }
    return yield* openShareToken(share);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getChat),
  Layer.provide(getChats),
  Layer.provide(getOwnChats),
  Layer.provide(getChatTitle),
  Layer.provide(getShareToken),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
