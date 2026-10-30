import type {
  ExamAttemptsDoc,
  ExamSittingsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ResultSitting } from "@repo/backend/confect/exams/results/access";
import { attemptAnswers } from "@repo/backend/confect/exams/results/mine";
import { namedPeople } from "@repo/backend/confect/exams/results/named";
import { attemptResults } from "@repo/backend/confect/exams/results/rows";
import {
  attemptIn,
  attemptOf,
} from "@repo/backend/confect/exams/sittings/attempt";
import { isAnswered } from "@repo/backend/confect/exams/sittings/response";
import type { AttemptState } from "@repo/backend/confect/exams/sittings/schema";
import type { PaginationOptions } from "convex/server";
import { Array as Arr, Effect, Number as Num, Option, Struct } from "effect";

/** The most students that one page of the students' list holds. A larger request is clamped to it. */
const STUDENT_PAGE_SIZE = 100;

/**
 * One attempt as the students' list shows it, with the name of the student who holds it. An attempt that
 * is not submitted has no scored rows yet, so its score, answered count, pending count, and integrity
 * indication are `null`.
 */
const studentRow = Effect.fn("exams.results.students.row")(function* (
  attempt: ExamAttemptsDoc,
  person: TenantPeopleDoc
) {
  const base = {
    attemptId: attempt._id,
    name: person.name,
    state: attempt.state,
    submittedAt: attempt.submittedAt ?? null,
  };
  if (attempt.state !== "submitted") {
    return {
      ...base,
      answered: null,
      awaySeconds: null,
      exits: null,
      pending: null,
      points: null,
    };
  }
  const rows = yield* attemptResults(attempt.sitting, attempt.person);
  return {
    ...base,
    answered: Arr.filter(rows, (row) => isAnswered(row.response)).length,
    awaySeconds: attempt.integrity?.awaySeconds ?? 0,
    exits: attempt.integrity?.exits ?? 0,
    pending: Arr.filter(rows, (row) => row.verdict === "pending").length,
    points: Num.sumAll(Arr.map(rows, (row) => row.points)),
  };
});

/** The row of an attempt that the list read by its index, with the student's name read beside it. */
const attemptRow = Effect.fn("exams.results.students.attempt.row")(function* (
  attempt: ExamAttemptsDoc
) {
  const person = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .get(attempt.person)
    .pipe(Effect.orDie);
  return yield* studentRow(attempt, person);
});

/**
 * The row of one person whose name a search matched: the person's attempt in the sitting, or none when
 * the person holds no attempt there, or holds one in another state than the `state` the list keeps.
 */
const personRow = Effect.fn("exams.results.students.person")(function* (
  sittingId: ExamSittingsDoc["_id"],
  person: TenantPeopleDoc,
  state: typeof AttemptState.Type | undefined
) {
  const attempt = Option.filter(
    yield* attemptOf(sittingId, person._id),
    (found) => state === undefined || found.state === state
  );
  if (Option.isNone(attempt)) {
    return Option.none();
  }
  return Option.some(yield* studentRow(attempt.value, person));
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
 * A `state` reads only the attempts in that state. A `search` reads the school's people whose names
 * match it, best match first (`namedPeople`), and keeps those who hold an attempt in the sitting, so a
 * page of a search can hold fewer rows than it read.
 */
export const byStudent = Effect.fn("exams.results.students")(function* (args: {
  paginationOpts: PaginationOptions;
  search?: string;
  state?: typeof AttemptState.Type;
}) {
  const sitting = yield* ResultSitting;
  const paginationOpts = Struct.assign(args.paginationOpts, {
    numItems: Num.clamp(args.paginationOpts.numItems, {
      maximum: STUDENT_PAGE_SIZE,
      minimum: 1,
    }),
  });
  if (args.search !== undefined) {
    const people = yield* namedPeople(
      sitting.tenantId,
      args.search,
      paginationOpts
    );
    const rows = yield* Effect.forEach(
      people.page,
      (person) => personRow(sitting._id, person, args.state),
      { concurrency: "unbounded" }
    );
    return Struct.assign(people, { page: Arr.getSomes(rows) });
  }
  const page = yield* attemptPage(sitting._id, paginationOpts, args.state);
  const rows = yield* Effect.forEach(page.page, attemptRow, {
    concurrency: "unbounded",
  });
  return Struct.assign(page, { page: rows });
});

/**
 * One student's scored answers for a viewer of the sitting's results, as the panel beside the students'
 * list shows them (two panes): the student's name, the points the attempt earned, and each question with
 * its answer, its points, and its verdict. An attempt that is not submitted has no scored answers yet, so
 * it reads `null`. The attempt must belong to the sitting.
 */
export const attemptResult = Effect.fn("exams.results.students.attempt")(
  function* (args: { attemptId: ExamAttemptsDoc["_id"] }) {
    const sitting = yield* ResultSitting;
    const attempt = yield* attemptIn(sitting, args.attemptId, "result.view");
    if (attempt.state !== "submitted") {
      return null;
    }
    const person = yield* (yield* DatabaseReader)
      .table("tenantPeople")
      .get(attempt.person)
      .pipe(Effect.orDie);
    return {
      name: person.name,
      ...(yield* attemptAnswers(sitting, attempt.person)),
    };
  }
);
