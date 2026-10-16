import { FunctionImpl } from "@confect/server";
import { NINA_MESSAGES_PAGE_SIZE } from "@repo/backend/client/nina/presentation";
import schema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { readChat } from "@repo/backend/confect/chats/access/read";
import {
  NinaTurnSummary,
  readerTurn,
} from "@repo/backend/confect/nina/contract/turn";
import spec from "@repo/backend/confect/nina/conversation.spec";
import { Effect, Number as Num, Schema, Struct } from "effect";

/**
 * One page of the turns of a conversation that ended, newest first, each as the
 * viewer is told of it (see `get` in `conversation.impl.ts`). The index range
 * holds the turns that ended and not the one that runs, so a write to the turn
 * that runs, such as the usage a run records after each model response, does not
 * run this query again. The admission and the settlement of a turn do, because
 * they write the chat as well, which this query reads, and so does a write to a
 * turn that ended, such as its suggestions. The query for the messages of the
 * chat does not read a turn at all.
 */
export const turns = FunctionImpl.make(
  schema,
  spec,
  "turns",
  Effect.fn("nina.conversation.turns")(function* ({
    chatId,
    paginationOpts,
    shareToken,
  }) {
    const viewer = yield* getOptionalAppUserForRead();
    const viewerId = viewer?.appUser._id ?? null;
    const chat = yield* readChat(chatId, viewerId, shareToken);
    const page = yield* (yield* DatabaseReader)
      .table("ninaTurns")
      .index(
        "by_chatId_and_phase_and_order",
        (index) => index.eq("chatId", chatId).eq("phase", "settled"),
        "desc"
      )
      .paginate(
        Struct.assign(paginationOpts, {
          numItems: Num.min(paginationOpts.numItems, NINA_MESSAGES_PAGE_SIZE),
        })
      )
      .pipe(Effect.orDie);
    const owner = chat.userId === viewerId;
    return {
      ...page,
      page: yield* Effect.forEach(page.page, (turn) =>
        Schema.decodeEffect(NinaTurnSummary)(turn).pipe(
          Effect.map((summary) => (owner ? summary : readerTurn(summary))),
          Effect.orDie
        )
      ),
    };
  })
);
