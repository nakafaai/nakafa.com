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
import { abandonTurn } from "@repo/backend/confect/nina/abandon";
import spec from "@repo/backend/confect/nina/lifecycle.spec";
import { settleTurn, stopTurn } from "@repo/backend/confect/nina/settlement";
import { startsLate, sweepTurns } from "@repo/backend/confect/nina/sweep";
import { sinceAdmission } from "@repo/backend/confect/nina/timing";
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
    if (yield* startsLate(turn)) {
      yield* settleTurn(turn, "failed", "response-timeout");
      return null;
    }
    const startedAt = yield* Clock.currentTimeMillis;
    // The claim is the first write of a run and comes before any model call.
    // Its time since the admission is the wait for the run to start.
    const state = { status: "running" as const, startedAt };
    const timing = { claimedMs: sinceAdmission(turn, startedAt) };
    const claimed = { ...turn, state, timing };
    // The turn is loaded already, so it is written back whole: a `patch` would
    // read it once more.
    yield* (yield* DatabaseWriter)
      .table("ninaTurns")
      .replace(turn._id, claimed)
      .pipe(Effect.orDie);
    return claimed;
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
 * the run's own exit, the settlement that a stop schedules, and the recovery
 * sweep all come here. Reconciles committed Agent output before releasing an
 * interrupted turn's credits. A turn the learner stopped ends as cancelled,
 * whatever ended its run. Only the run's own exit knows which stages the turn
 * reached and what the history of its prompt cost, so only it passes `timing`
 * and `history`, and the settlement reads `timing` as a run that came back to
 * end its own turn: it reports its failure itself, so the settlement does not
 * report the turn as a lost run.
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
      args.failure,
      args.timing,
      args.history
    );
    return null;
  }, Effect.catchDefect(lifecycleFailure))
);

/**
 * The check that admission schedules for the moment a queued turn must have
 * started. It settles a turn whose run never started, which no run is left to
 * settle, as timed out with its credits back. A turn that was claimed or
 * settled by then is left alone: a started run settles itself, and the sweep
 * backs it up.
 */
const expire = FunctionImpl.make(
  schema,
  spec,
  "expire",
  Effect.fn("nina.lifecycle.expire")(function* (args) {
    const turn = yield* readTurn(args.turnId);
    if (turn?.phase !== "active" || turn.state.status !== "queued") {
      return null;
    }
    yield* settleTurn(turn, "failed", "response-timeout");
    return null;
  }, Effect.catchDefect(lifecycleFailure))
);

/**
 * The last try of the sweep for a turn that stayed open past its deadline:
 * `recover` has been tried at each of its runs since and the turn is still
 * open. It ends the turn without relying on the Agent journal, so the chat is
 * free again and the credits are back. A turn that settled meanwhile is left
 * alone.
 */
const abandon = FunctionImpl.make(
  schema,
  spec,
  "abandon",
  Effect.fn("nina.lifecycle.abandon")(function* (args) {
    const turn = yield* readTurn(args.turnId);
    if (turn?.phase !== "active") {
      return null;
    }
    yield* abandonTurn(turn);
    return null;
  }, Effect.catchDefect(lifecycleFailure))
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
 * stop and is shown as cancelled at once. It settles when its run has exited,
 * after the stop grace for a run that is gone, or when the learner sends the
 * next prompt, whichever comes first, and always after its stream was cut off.
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
  Layer.provide(expire),
  Layer.provide(abandon),
  Layer.provide(sweep),
  Layer.provide(cancel),
  Layer.provide(atomic),
  Layer.provide(session),
  GroupImpl.finalize
);
