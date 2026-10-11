import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { readChat } from "@repo/backend/confect/chats/access/read";
import { openChat } from "@repo/backend/confect/chats/title";
import session from "@repo/backend/confect/middleware/session.impl";
import { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import spec from "@repo/backend/confect/nina/conversation.spec";
import { Effect, Layer, Option, Schema } from "effect";

const get = FunctionImpl.make(
  schema,
  spec,
  "get",
  Effect.fn("nina.conversation.get")(function* ({ chatId }) {
    const viewer = yield* getOptionalAppUserForRead();
    const chat = yield* readChat(chatId, viewer?.appUser._id ?? null);
    const turn = yield* (yield* DatabaseReader)
      .table("ninaTurns")
      .index("by_chatId_and_order", (q) => q.eq("chatId", chatId), "desc")
      .first()
      .pipe(Effect.orDie);
    return {
      chat: yield* openChat(chat),
      turn: Option.isSome(turn)
        ? yield* Schema.decodeEffect(NinaTurnSummary)(turn.value).pipe(
            Effect.orDie
          )
        : null,
    };
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(get),
  Layer.provide(session),
  GroupImpl.finalize
);
