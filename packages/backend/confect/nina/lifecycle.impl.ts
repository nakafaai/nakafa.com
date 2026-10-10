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
import { settleTurn, stopTurn } from "@repo/backend/confect/nina/settlement";
import { sweepTurns } from "@repo/backend/confect/nina/sweep";
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

/**
 * Settles a turn whose run has ended, or that stayed open past its deadline:
 * the run's own exit and the recovery sweep both come here. Reconciles
 * committed Agent output before releasing an interrupted turn's credits. A turn
 * the learner stopped ends as cancelled, whatever ended its run.
 */
const recover = FunctionImpl.make(
  schema,
  spec,
  "recover",
  Effect.fn("nina.lifecycle.recover")(function* (args) {
    const turn = yield* readTurn(args.turnId);
    if (turn?.phase !== "active") {
      return null;
    }
    yield* settleTurn(
      turn,
      turn.cancelRequestedAt === undefined ? "failed" : "cancelled",
      args.failure
    );
    return null;
  }, Effect.catchDefect(lifecycleFailure))
);

/** True once a run has no reason to go on: its turn was stopped, settled or removed. */
const halted = FunctionImpl.make(
  schema,
  spec,
  "halted",
  Effect.fn("nina.lifecycle.halted")(function* (args) {
    const turn = yield* readTurn(args.turnId);
    return turn?.phase !== "active" || turn.cancelRequestedAt !== undefined;
  })
);

/** The cron entry: settles every turn that stayed open past its deadline. */
const sweep = FunctionImpl.make(
  schema,
  spec,
  "sweep",
  Effect.fn("nina.lifecycle.sweep")(function* (args) {
    yield* sweepTurns(args.resume);
    return null;
  })
);

/**
 * A queued turn has no run, so it settles at once. A running turn is asked to
 * stop and settles when its run has exited, never before the stream stops.
 */
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
    if (turn?.phase !== "active") {
      return null;
    }
    if (turn.state.status === "queued") {
      yield* settleTurn(turn, "cancelled");
      return null;
    }
    yield* stopTurn(turn);
    return null;
  }, Effect.catchDefect(lifecycleFailure))
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(claim),
  Layer.provide(presentation),
  Layer.provide(recover),
  Layer.provide(halted),
  Layer.provide(sweep),
  Layer.provide(cancel),
  Layer.provide(atomic),
  Layer.provide(session),
  GroupImpl.finalize
);
