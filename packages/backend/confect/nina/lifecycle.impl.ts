import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { requireChatOwner } from "@repo/backend/confect/chats/access/owner";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/nina/lifecycle.spec";
import { settleTurn } from "@repo/backend/confect/nina/settlement";
import { NinaTurnError } from "@repo/backend/confect/nina/turns.spec";
import { Clock, Effect, Layer } from "effect";

const lifecycleFailure = () =>
  new NinaTurnError({
    code: "NINA_WRITE_FAILED",
    message: "Unable to update this Nina response.",
  });

const readTurn = Effect.fn("nina.lifecycle.read")(function* (
  turnId: Docs["ninaTurns"]["_id"]
) {
  return yield* (yield* DatabaseReader)
    .table("ninaTurns")
    .get(turnId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

const claim = FunctionImpl.make(
  schema,
  spec,
  "claim",
  Effect.fn("nina.lifecycle.claim")(function* (args) {
    const turn = yield* readTurn(args.turnId);
    if (turn?.phase !== "active" || turn.state.status !== "queued") {
      return null;
    }
    const reader = yield* DatabaseReader;
    const user = yield* reader
      .table("users")
      .get(turn.userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    const chat = yield* reader
      .table("chats")
      .get(turn.chatId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (
      !user ||
      isAccountDeletionPending(user) ||
      chat?.activeTurnId !== turn._id
    ) {
      yield* settleTurn(turn, "cancelled");
      return null;
    }
    const state = {
      status: "running" as const,
      startedAt: yield* Clock.currentTimeMillis,
    };
    yield* (yield* DatabaseWriter)
      .table("ninaTurns")
      .patch(turn._id, { state })
      .pipe(Effect.orDie);
    return { ...turn, state };
  }, Effect.catchDefect(lifecycleFailure))
);

const presentation = FunctionImpl.make(
  schema,
  spec,
  "presentation",
  Effect.fn("nina.lifecycle.presentation")(function* (args) {
    const turn = yield* readTurn(args.turnId);
    if (turn?.phase !== "settled" || turn.state.status !== "complete") {
      return null;
    }
    const reader = yield* DatabaseReader;
    const user = yield* reader
      .table("users")
      .get(turn.userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    const chat = yield* reader
      .table("chats")
      .get(turn.chatId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!user || isAccountDeletionPending(user) || !chat) {
      return null;
    }
    return turn;
  })
);

/** Reconcile committed Agent output before releasing an interrupted turn's credits. */
const recover = FunctionImpl.make(
  schema,
  spec,
  "recover",
  Effect.fn("nina.lifecycle.recover")(function* (args) {
    const turn = yield* readTurn(args.turnId);
    if (
      !turn ||
      (turn.state.status !== "running" && turn.state.status !== "queued")
    ) {
      return null;
    }
    yield* settleTurn(turn, "failed", args.failure);
    return null;
  }, Effect.catchDefect(lifecycleFailure))
);

const cancel = FunctionImpl.make(
  schema,
  spec,
  "cancel",
  Effect.fn("nina.lifecycle.cancel")(function* (args) {
    const { appUser } = yield* requireAuth();
    const chat = yield* requireChatOwner(args.chatId, appUser._id);
    if (!chat.activeTurnId) {
      return null;
    }
    const turn = yield* readTurn(chat.activeTurnId);
    if (
      turn &&
      (turn.state.status === "queued" || turn.state.status === "running")
    ) {
      yield* settleTurn(turn, "cancelled");
    }
    return null;
  }, Effect.catchDefect(lifecycleFailure))
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(claim),
  Layer.provide(presentation),
  Layer.provide(recover),
  Layer.provide(cancel),
  Layer.provide(atomic),
  Layer.provide(session),
  GroupImpl.finalize
);
