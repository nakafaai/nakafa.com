import { FunctionImpl, GroupImpl } from "@confect/server";
import { NINA_MESSAGES_PAGE_SIZE } from "@repo/backend/client/nina/presentation";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { readChat } from "@repo/backend/confect/chats/access/read";
import { openChat } from "@repo/backend/confect/chats/title";
import { readerChat } from "@repo/backend/confect/chats/view";
import session from "@repo/backend/confect/middleware/session.impl";
import {
  NinaTurnSummary,
  readerTurn,
} from "@repo/backend/confect/nina/contract/turn";
import spec from "@repo/backend/confect/nina/conversation.spec";
import { Effect, Layer, Number as Num, Option, Schema, Struct } from "effect";

/**
 * The turn as the page shows it. A turn the learner stopped is cancelled for
 * them at once, from the moment of the stop, although it settles only when its
 * run exits, after the stop grace, or when they send the next prompt. The
 * settlement keeps that time, so the state the page shows does not move.
 */
function shownTurn(turn: NinaTurnsDoc) {
  if (turn.phase !== "active" || turn.cancelRequestedAt === undefined) {
    return turn;
  }
  return {
    ...turn,
    state: {
      status: "cancelled" as const,
      finishedAt: turn.cancelRequestedAt,
    },
  };
}

const get = FunctionImpl.make(
  schema,
  spec,
  "get",
  Effect.fn("nina.conversation.get")(function* ({ chatId, shareToken }) {
    const viewer = yield* getOptionalAppUserForRead();
    const viewerId = viewer?.appUser._id ?? null;
    const chat = yield* readChat(chatId, viewerId, shareToken);
    const turn = yield* (yield* DatabaseReader)
      .table("ninaTurns")
      .index("by_chatId_and_order", (q) => q.eq("chatId", chatId), "desc")
      .first()
      .pipe(Effect.orDie);
    const summary = Option.isSome(turn)
      ? yield* Schema.decodeEffect(NinaTurnSummary)(shownTurn(turn.value)).pipe(
          Effect.orDie
        )
      : null;
    const owner = chat.userId === viewerId;
    const view = yield* openChat(chat);
    // A reader is told where the turn stands, not what it cost the owner, and
    // the chat names neither the owner's account nor the turn that runs.
    return {
      chat: owner ? view : readerChat(view),
      turn: summary && !owner ? readerTurn(summary) : summary,
    };
  })
);

/**
 * One page of the turns of a conversation that ended, newest first, each as the
 * viewer is told of it (see `get`). The index range holds the turns that
 * ended and not the one that runs, so a write to the running turn does not run
 * this query again, and the query for the messages of the chat does not read a
 * turn at all.
 */
const turns = FunctionImpl.make(
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

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(get),
  Layer.provide(turns),
  Layer.provide(session),
  GroupImpl.finalize
);
