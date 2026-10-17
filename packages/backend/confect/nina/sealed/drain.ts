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
  Predicate,
  Schema,
} from "effect";

/**
 * The bytes one seal may take, in the longest shape the step limit allows: a turn of
 * 20 tool steps with 24,000-character outputs. The counted seal of that shape measured
 * 1,976,386 bytes (ADR 0024), and the reserve rounds it up. A seal starts only while the
 * run's counted bytes and this reserve still fit the budget.
 */
export const SEAL_RESERVE_BYTES = 2_000_000;

/** How many seals of one turn fail before the sweep holds the turn for good (ADR 0024). */
export const SEAL_TRIES = 3;

/**
 * How many failed seals one run makes before it stops. A failing turn is retried in
 * later runs, and a run that failed this often has met a broad fault, so it stops and
 * leaves the rest to the next run.
 */
export const SEAL_FAILURES_PER_RUN = 3;

/** Candidate turns that one read of the drain takes. */
const CANDIDATE_PAGE = 10;

/** The hold that the sweep sets on a turn whose seal failed `SEAL_TRIES` times. */
const FAILED_HOLD: typeof NinaSealHold.Type = "failedAttempts";

/** What one run has done so far: the bytes its seals counted, and its failures. */
const Run = Schema.Struct({
  failures: Schema.Int,
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
 * Seals one candidate and says what it cost. A failed seal is logged with its turn and
 * its cause, and counted on the turn (`recordSealFailure`), and it costs the run
 * nothing that the budget counts.
 */
const attempt = Effect.fn("nina.sealed.drain.attempt")(function* (
  turnId: Docs["ninaTurns"]["_id"]
) {
  const { runMutation } = yield* MutationRunner;
  const exit = yield* runMutation(refs.internal.nina.sealed.seal, {
    turnId,
  }).pipe(Effect.exit);
  if (Exit.isSuccess(exit)) {
    return { bytes: exit.value.bytes, failed: false };
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
  return { bytes: 0, failed: true };
});

/**
 * Seals the candidates of one page in order, and says whether the run must stop. The
 * first seal of a run always runs. A later one runs only while the counted bytes plus
 * one reserve fit the budget, and while the run has failed fewer than
 * `SEAL_FAILURES_PER_RUN` times.
 */
const sealIds = Effect.fn("nina.sealed.drain.ids")(function* (
  budget: number,
  ids: readonly Docs["ninaTurns"]["_id"][],
  run: Run
): Effect.fn.Return<typeof Progress.Type, never, MutationRunner> {
  if (!Arr.isReadonlyArrayNonEmpty(ids)) {
    return { run, stopped: false };
  }
  if (
    run.started &&
    (run.spent + SEAL_RESERVE_BYTES > budget ||
      run.failures >= SEAL_FAILURES_PER_RUN)
  ) {
    return { run, stopped: true };
  }
  const outcome = yield* attempt(Arr.headNonEmpty(ids));
  return yield* sealIds(budget, Arr.tailNonEmpty(ids), {
    failures: run.failures + (outcome.failed ? 1 : 0),
    spent: run.spent + outcome.bytes,
    started: true,
  });
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
 * `SEAL_RESERVE_BYTES`, fit the budget, so the run ends within the budget as long as
 * no seal costs more than the reserve. A failed seal does not end the run, so a broken
 * turn never holds the turns behind it, and the run stops after `SEAL_FAILURES_PER_RUN`
 * failures.
 */
export const drainSeals = Effect.fn("nina.sealed.drain")(function* (
  budget: number
) {
  yield* drainPages(budget, null, {
    failures: 0,
    spent: 0,
    started: false,
  });
  return null;
});
