import type {
  ExamAttemptsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Sitting } from "@repo/backend/confect/exams/sittings/access";
import { sittingView } from "@repo/backend/confect/exams/sittings/view";
import type { PaginationOptions } from "convex/server";
import { Effect, Option } from "effect";

/** The animal of a claimed Person, from the account. An unclaimed Person has none. */
const mascotOf = Effect.fn("exams.sittings.dashboard.mascot")(function* (
  person: TenantPeopleDoc
) {
  if (person.account.state !== "claimed") {
    return null;
  }
  const user = yield* (yield* DatabaseReader)
    .table("users")
    .get(person.account.userId)
    .pipe(Effect.orDie);
  return user.mascot;
});

/**
 * One attempt as the dashboard shows it. The latest signal decides whether the student is
 * away: an exit or a disconnect with no return after it (round 2 and ADR 0013 decision 7).
 */
const attemptRow = Effect.fn("exams.sittings.dashboard.attempt")(function* (
  attempt: ExamAttemptsDoc
) {
  const reader = yield* DatabaseReader;
  const person = yield* reader
    .table("tenantPeople")
    .get(attempt.person)
    .pipe(Effect.orDie);
  const mascot = yield* mascotOf(person);
  const latest = yield* reader
    .table("examSignals")
    .index(
      "by_attemptId_and_at",
      (query) => query.eq("attempt", attempt._id),
      "desc"
    )
    .first()
    .pipe(Effect.orDie);
  return {
    away: Option.exists(
      latest,
      (signal) => signal.kind === "exit" || signal.kind === "disconnect"
    ),
    deadline: attempt.deadline,
    id: attempt._id,
    latestSignal: Option.match(latest, {
      onNone: () => null,
      onSome: (signal) => ({ at: signal.at, kind: signal.kind }),
    }),
    mascot,
    name: person.name,
    state: attempt.state,
  };
});

/**
 * The proctor's dashboard of a sitting: the sitting, and one page of its attempts in
 * the order the index holds them. A page follows the client's pagination options, and
 * no token or token hash is read (ADR 0013, round 2 decision 7).
 */
export const dashboard = Effect.fn("exams.sittings.dashboard")(
  function* (args: { paginationOpts: PaginationOptions }) {
    const sitting = yield* Sitting;
    const page = yield* (yield* DatabaseReader)
      .table("examAttempts")
      .index("by_sittingId", (query) => query.eq("sitting", sitting._id))
      .paginate(args.paginationOpts)
      .pipe(Effect.orDie);
    const rows = yield* Effect.forEach(page.page, attemptRow, {
      concurrency: "unbounded",
    });
    return {
      attempts: {
        continueCursor: page.continueCursor,
        isDone: page.isDone,
        page: rows,
      },
      sitting: sittingView(sitting),
    };
  }
);
