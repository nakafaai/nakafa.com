import type {
  ExamAttemptsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ResultSitting } from "@repo/backend/confect/exams/results/access";
import { attemptResults } from "@repo/backend/confect/exams/results/rows";
import { isAnswered } from "@repo/backend/confect/exams/sittings/response";
import type { AttemptState } from "@repo/backend/confect/exams/sittings/schema";
import type { PaginationOptions } from "convex/server";
import { Array as Arr, Effect, Number as Num, Struct } from "effect";

/** The most students that one page of the students' list holds. A larger request is clamped to it. */
const STUDENT_PAGE_SIZE = 100;

/**
 * One attempt as the students' list shows it. An attempt that is not submitted has no scored rows yet,
 * so its score, answered count, and pending count are `null`.
 */
const studentRow = Effect.fn("exams.results.students.row")(function* (
  attempt: ExamAttemptsDoc
) {
  const person = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .get(attempt.person)
    .pipe(Effect.orDie);
  const base = {
    attemptId: attempt._id,
    name: person.name,
    state: attempt.state,
    submittedAt: attempt.submittedAt ?? null,
  };
  if (attempt.state !== "submitted") {
    return { ...base, answered: null, pending: null, points: null };
  }
  const rows = yield* attemptResults(attempt.sitting, attempt.person);
  return {
    ...base,
    answered: Arr.filter(rows, (row) => isAnswered(row.response)).length,
    pending: Arr.filter(rows, (row) => row.verdict === "pending").length,
    points: Num.sumAll(Arr.map(rows, (row) => row.points)),
  };
});

/**
 * One page of the attempts of a sitting, in the order of the index that reads them: every attempt, or
 * only the attempts in one state, which the index reads in deadline order.
 */
const attemptPage = Effect.fn("exams.results.students.page")(function* (
  sittingId: ExamSittingsDoc["_id"],
  paginationOpts: PaginationOptions,
  state: typeof AttemptState.Type | undefined
) {
  const attempts = (yield* DatabaseReader).table("examAttempts");
  if (state === undefined) {
    return yield* attempts
      .index("by_sittingId", (query) => query.eq("sitting", sittingId))
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
  }
  return yield* attempts
    .index("by_sittingId_and_state_and_deadline", (query) =>
      query.eq("sitting", sittingId).eq("state", state)
    )
    .paginate(paginationOpts)
    .pipe(Effect.orDie);
});

/**
 * One page of the sitting's students, for a viewer of its results. A page asks for at most
 * `STUDENT_PAGE_SIZE` attempts, and a larger request is clamped to that size, so every read is bounded.
 * A `state` reads only the attempts in that state.
 */
export const byStudent = Effect.fn("exams.results.students")(function* (args: {
  paginationOpts: PaginationOptions;
  state?: typeof AttemptState.Type;
}) {
  const sitting = yield* ResultSitting;
  const page = yield* attemptPage(
    sitting._id,
    Struct.assign(args.paginationOpts, {
      numItems: Num.clamp(args.paginationOpts.numItems, {
        maximum: STUDENT_PAGE_SIZE,
        minimum: 1,
      }),
    }),
    args.state
  );
  const rows = yield* Effect.forEach(page.page, studentRow, {
    concurrency: "unbounded",
  });
  return Struct.assign(page, { page: rows });
});
