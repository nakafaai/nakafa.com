import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import type { NinaSealHold } from "@repo/backend/confect/nina/turns.spec";
import {
  Array as Arr,
  Cause,
  Clock,
  Effect,
  Exit,
  Option,
  Predicate,
  Schema,
} from "effect";

/**
 * The bytes that a later seal of a run must fit into the budget with the bytes the run
 * has counted. It is the counted seal of the longest shape that the measurement of ADR
 * 0024 covers, 20 tool steps with 24,000-character outputs, which counted 1,976,386
 * bytes, rounded up. That shape is an assumption of the measurement, not a maximum
 * that the step limit guarantees. A failed seal costs this reserve too, because a
 * rolled-back seal's reads are unknown. The first seal of a run always runs, so a larger
 * seal still finishes, and only the later seals of its run wait for the budget.
 */
export const SEAL_RESERVE_BYTES = 2_000_000;

/** How many seals of one turn fail before the sweep holds the turn for good (ADR 0024). */
export const SEAL_TRIES = 3;

/** Candidate turns that one read of the drain takes. */
const CANDIDATE_PAGE = 10;

/** The hold that the sweep sets on a turn whose seal failed `SEAL_TRIES` times. */
const FAILED_HOLD: typeof NinaSealHold.Type = "failedAttempts";

/** What one run has done so far: the bytes its seals counted, and whether it has started. */
const Run = Schema.Struct({
  spent: Schema.Finite,
  started: Schema.Boolean,
});
type Run = typeof Run.Type;

/** Where a run stands after some candidates: the run itself, and whether it must stop. */
const Progress = Schema.Struct({ run: Run, stopped: Schema.Boolean });

/**
 * The name of what failed, never its message, because a message may carry the learner's
 * text. A Schema error or a tagged error has its tag, and any other error its name.
 */
function causeName(cause: Cause.Cause<unknown>) {
  const error = Cause.squash(cause);
  if (Predicate.hasProperty(error, "_tag") && Predicate.isString(error._tag)) {
    return error._tag;
  }
  return error instanceof Error ? error.name : "unknown";
}

/**
 * Counts one failed seal on its turn, and holds the turn once it has failed
 * `SEAL_TRIES` times. A turn that is gone, sealed or already held is left alone.
 * The failed seal was rolled back whole, so this write is the only one it leaves.
 */
export const recordSealFailure = Effect.fn("nina.sealed.drain.record")(
  function* (turnId: Docs["ninaTurns"]["_id"]) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const turn = yield* reader
      .table("ninaTurns")
      .get(turnId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (
      turn?.phase !== "settled" ||
      turn.sealedAt !== undefined ||
      turn.sealHold !== undefined
    ) {
      return null;
    }
    const attempts = (turn.sealAttempts ?? 0) + 1;
    const held = attempts >= SEAL_TRIES;
    yield* writer
      .table("ninaTurns")
      .replace(turn._id, {
        ...turn,
        sealAttempts: attempts,
        sealFailedAt: yield* Clock.currentTimeMillis,
        ...(held ? { sealHold: FAILED_HOLD } : {}),
      })
      .pipe(Effect.orDie);
    return { attempts, held };
  }
);

/**
 * Seals one candidate and says what it costs the run, and whether the run must stop.
 * A seal that succeeds costs the bytes it counted. A failed seal costs
 * `SEAL_RESERVE_BYTES`, because it was rolled back and what it read is unknown. It is
 * logged with its turn and its cause, and counted on the turn (`recordSealFailure`).
 * The run then goes on only while its budget fits the next seal (`sealIds`). Under the
 * production budget a failed seal ends the run, and the turn is tried again in later
 * runs until `SEAL_TRIES` holds it. The seal fails with `SealUnavailable` only when the
 * key ring cannot be read. That fault is not the turn's, so the run stops at once, with
 * one log and no failure counted on the turn.
 */
const attempt = Effect.fn("nina.sealed.drain.attempt")(function* (
  turnId: Docs["ninaTurns"]["_id"]
) {
  const { runMutation } = yield* MutationRunner;
  const exit = yield* runMutation(refs.internal.nina.sealed.seal, {
    turnId,
  }).pipe(Effect.exit);
  if (Exit.isSuccess(exit)) {
    return { bytes: exit.value.bytes, stop: false };
  }
  if (Option.exists(Exit.findErrorOption(exit), isUnavailable)) {
    yield* Effect.logError(
      "Nina stopped sealing settled turns: the key ring cannot be read",
      { cause: causeName(exit.cause) }
    );
    return { bytes: SEAL_RESERVE_BYTES, stop: true };
  }
  const failure = yield* runMutation(refs.internal.nina.sealed.recordFailure, {
    turnId,
  }).pipe(Effect.orDie);
  yield* Effect.logError("Nina could not seal a settled turn", {
    attempts: failure?.attempts,
    cause: causeName(exit.cause),
    held: failure?.held,
    turnId,
  });
  return { bytes: SEAL_RESERVE_BYTES, stop: false };
});

/** Whether a typed failure of the seal is the broad fault, `SealUnavailable`. */
function isUnavailable(error: { readonly _tag: string }) {
  return error._tag === "SealUnavailable";
}

/**
 * Seals the candidates of one page in order, and says whether the run must stop. The
 * first seal of a run always runs. A later one runs only while the counted bytes plus
 * one reserve fit the budget. A seal that stops the run ends the page at once.
 */
const sealIds = Effect.fn("nina.sealed.drain.ids")(function* (
  budget: number,
  ids: readonly Docs["ninaTurns"]["_id"][],
  run: Run
): Effect.fn.Return<typeof Progress.Type, never, MutationRunner> {
  if (!Arr.isReadonlyArrayNonEmpty(ids)) {
    return { run, stopped: false };
  }
  if (run.started && run.spent + SEAL_RESERVE_BYTES > budget) {
    return { run, stopped: true };
  }
  const outcome = yield* attempt(Arr.headNonEmpty(ids));
  const next = { spent: run.spent + outcome.bytes, started: true };
  if (outcome.stop) {
    return { run: next, stopped: true };
  }
  return yield* sealIds(budget, Arr.tailNonEmpty(ids), next);
});

/** Reads the candidates page by page, and seals each page while the run goes on. */
const drainPages = Effect.fn("nina.sealed.drain.pages")(function* (
  budget: number,
  cursor: string | null,
  run: Run
): Effect.fn.Return<null, never, MutationRunner | QueryRunner> {
  const { runQuery } = yield* QueryRunner;
  const page = yield* runQuery(refs.internal.nina.sealed.candidates, {
    cursor,
    numItems: CANDIDATE_PAGE,
  }).pipe(Effect.orDie);
  const after = yield* sealIds(budget, page.ids, run);
  if (after.stopped || page.isDone) {
    return null;
  }
  return yield* drainPages(budget, page.continueCursor, after.run);
});

/**
 * Seals the settled turns that still hold plain rows, oldest first, within `budget`
 * bytes of database I/O (ADR 0024). The sweep gives each run its share of the day's
 * allowance. The first seal of a run always runs, so a turn never waits behind a
 * budget. A later seal runs only while the bytes this run has counted, plus one
 * `SEAL_RESERVE_BYTES`, fit the budget. A failed seal is counted on its turn and costs
 * one reserve. Under the production budget that ends the run after the failure, so a
 * turn that always fails delays the turns behind it by at most `SEAL_TRIES` runs: it is
 * then held, and the next run seals the turns behind it. Only the broad fault of an
 * unreadable key ring stops a run at once, without a failure on any turn.
 */
export const drainSeals = Effect.fn("nina.sealed.drain")(function* (
  budget: number
) {
  yield* drainPages(budget, null, {
    spent: 0,
    started: false,
  });
  return null;
});
