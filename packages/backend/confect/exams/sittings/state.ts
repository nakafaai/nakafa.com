import { AttemptState } from "@repo/backend/confect/exams/sittings/schema";
import { Effect, Predicate, Schema } from "effect";

/** The actions a proctor takes on an attempt, as ADR 0013's table names them. */
export const ProctorAction = Schema.Literals(["lock", "unlock", "addMinutes"]);

/**
 * The attempt states that ADR 0013's proctor table covers. The table does not decide
 * `submitted`, so it is not accepted here.
 */
export const ProctoredState = Schema.Literals([
  "inProgress",
  "locked",
  "closing",
]);

/** How an accepted action moves the attempt's deadline. */
const DeadlineChange = Schema.Literals(["kept", "moved", "now"]);

/** The result of an accepted action: the attempt's new state and its deadline change. */
export const Outcome = Schema.Struct({
  deadline: DeadlineChange,
  state: ProctoredState,
});

/**
 * Why the table refuses an action. `state` means the attempt's state does not allow
 * it. `deadline` means `addMinutes` came after the deadline.
 */
const RefusalReason = Schema.Literals(["state", "deadline"]);

/** A proctor action that the table of ADR 0013 refuses for its attempt. */
export class ProctorActionRefused extends Schema.TaggedError<ProctorActionRefused>()(
  "ProctorActionRefused",
  {
    action: ProctorAction,
    reason: RefusalReason,
    state: AttemptState,
  }
) {}

/** One cell of the table: the outcome of an action, or the reason it is refused. */
type Cell = (
  beforeDeadline: boolean
) => typeof Outcome.Type | typeof RefusalReason.Type;

/**
 * ADR 0013's table of proctor actions, row by row. `beforeDeadline` tells whether the
 * server clock has not reached the attempt's deadline yet. A `No change` cell keeps
 * its state and deadline, and it is still accepted.
 */
const table: Record<
  typeof ProctorAction.Type,
  Record<typeof ProctoredState.Type, Cell>
> = {
  addMinutes: {
    closing: () => "state",
    inProgress: (beforeDeadline) =>
      beforeDeadline ? { deadline: "moved", state: "inProgress" } : "deadline",
    locked: (beforeDeadline) =>
      beforeDeadline ? { deadline: "moved", state: "locked" } : "deadline",
  },
  lock: {
    closing: () => "state",
    inProgress: () => ({ deadline: "kept", state: "locked" }),
    locked: () => ({ deadline: "kept", state: "locked" }),
  },
  unlock: {
    closing: () => "state",
    inProgress: () => "state",
    locked: (beforeDeadline) => ({
      deadline: "kept",
      state: beforeDeadline ? "inProgress" : "closing",
    }),
  },
};

/**
 * Decides one proctor action on an attempt, by ADR 0013's table. A refused action fails
 * with `ProctorActionRefused` and the reason the table gives. The table does not decide
 * `submitted`, so an action on it is refused for its state.
 */
export const decideProctorAction = Effect.fn(
  "exams.sittings.decideProctorAction"
)(function* (
  action: typeof ProctorAction.Type,
  state: typeof AttemptState.Type,
  beforeDeadline: boolean
) {
  const cell = Schema.is(ProctoredState)(state)
    ? table[action][state](beforeDeadline)
    : "state";
  if (Predicate.isString(cell)) {
    return yield* new ProctorActionRefused({ action, reason: cell, state });
  }
  return cell;
});
