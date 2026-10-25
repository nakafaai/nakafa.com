import type {
  ExamAttemptsDoc,
  ExamSittingsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { covers } from "@repo/backend/confect/access/decision";
import { HOME_RESULT_LIMIT } from "@repo/backend/confect/exams/home/bounds";
import { attemptResults } from "@repo/backend/confect/exams/results/rows";
import { attemptOf } from "@repo/backend/confect/exams/sittings/attempt";
import type { SittingState } from "@repo/backend/confect/exams/sittings/schema";
import { sittingViews } from "@repo/backend/confect/exams/sittings/view";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { PERSON_PLACEMENT_LIMIT } from "@repo/backend/confect/tenancy/placement";
import {
  Array as Arr,
  Effect,
  HashMap,
  Number as Num,
  Option,
  Order,
  Tuple,
} from "effect";

/** The most units a tenant holds (ADR 0011), so the units a student may reach are bounded. */
export const TENANT_UNIT_LIMIT = 24;

/**
 * The most sittings of one state that one unit or one cohort lists. A unit can run more rooms
 * of one state at once than a short list holds. The state indexes end in the opening time, so
 * the bound keeps the sittings that open first, and each read stays bounded.
 */
const SITTINGS_PER_STATE = 50;

/**
 * The most closing attempts and the most submitted attempts of one student that the list reads,
 * each newest first. Each state has its own index, so the bound counts only attempts of that state,
 * and it never hides an attempt of a live sitting, which the list reads by its sitting. A closed
 * sitting beyond the newest of these is not listed.
 */
const ATTEMPT_LIMIT = 100;

/** The states of an attempt in a closed sitting, which the list keeps so its results stay reachable. */
const CLOSED_ATTEMPT_STATES = ["closing", "submitted"] as const;

/** The states of a sitting that a student may still take part in. */
export const LIVE_STATES: readonly (typeof SittingState.Type)[] = [
  "scheduled",
  "open",
];

/**
 * The live sittings of a student who may take part in them: the unit sittings of each unit that
 * a student grant covers, and the cohort sittings of each cohort the student is placed in.
 */
const liveSittings = Effect.fn("exams.sittings.mine.live")(function* (
  member: Member["Service"]
) {
  const reader = yield* DatabaseReader;
  const units = yield* reader
    .table("tenantUnits")
    .index("by_tenantId_and_status", (query) =>
      query.eq("tenantId", member.tenant._id).eq("status", "active")
    )
    .take(TENANT_UNIT_LIMIT)
    .pipe(Effect.orDie);
  const coveredUnits = Arr.filter(units, (unit) =>
    Arr.some(
      member.grants,
      (grant) => grant.role.key === "student" && covers(grant.scope, [unit._id])
    )
  );
  const unitRows = yield* Effect.forEach(coveredUnits, (unit) =>
    Effect.forEach(LIVE_STATES, (state) =>
      reader
        .table("examSittings")
        .index("by_unitId_and_cohortId_and_state_and_opensAt", (query) =>
          query.eq("unitId", unit._id).eq("cohortId", null).eq("state", state)
        )
        .take(SITTINGS_PER_STATE)
        .pipe(Effect.orDie)
    )
  );
  const placements = yield* reader
    .table("tenantCohortMembers")
    .index("by_personId", (query) => query.eq("personId", member.person._id))
    .take(PERSON_PLACEMENT_LIMIT)
    .pipe(Effect.orDie);
  const cohortRows = yield* Effect.forEach(placements, (placement) =>
    Effect.forEach(LIVE_STATES, (state) =>
      reader
        .table("examSittings")
        .index("by_cohortId_and_state_and_opensAt", (query) =>
          query.eq("cohortId", placement.cohortId).eq("state", state)
        )
        .take(SITTINGS_PER_STATE)
        .pipe(Effect.orDie)
    )
  );
  return Arr.flatten(Arr.flatten([...unitRows, ...cohortRows]));
});

/**
 * The student's closing and submitted attempts, each state newest first. Each state is read on
 * its own index, so the student's other attempts never push these out of the bound.
 */
const closedAttempts = Effect.fn("exams.sittings.mine.attempts")(function* (
  personId: TenantPeopleDoc["_id"]
) {
  const reader = yield* DatabaseReader;
  const byState = yield* Effect.forEach(CLOSED_ATTEMPT_STATES, (state) =>
    reader
      .table("examAttempts")
      .index(
        "by_personId_and_state",
        (query) => query.eq("person", personId).eq("state", state),
        "desc"
      )
      .take(ATTEMPT_LIMIT)
      .pipe(Effect.orDie)
  );
  return Arr.flatten(byState);
});

/**
 * The closed sittings whose attempt of the student is closing or submitted. A closed sitting stays
 * in the student's list, so its results stay reachable once the teacher releases them.
 */
const closedSittings = Effect.fn("exams.sittings.mine.closed")(function* (
  attempts: readonly ExamAttemptsDoc[]
) {
  const reader = yield* DatabaseReader;
  const sittings = yield* Effect.forEach(
    attempts,
    (attempt) =>
      reader.table("examSittings").get(attempt.sitting).pipe(Effect.orDie),
    { concurrency: "unbounded" }
  );
  return Arr.filter(sittings, (sitting) => sitting.state === "closed");
});

/** The closed sittings with the newest opening first, which the student's results list shows first. */
const byNewestOpening = Order.flip(
  Order.mapInput(
    Order.Number,
    (sitting: Pick<ExamSittingsDoc, "opensAt">) => sitting.opensAt
  )
);

/**
 * The student's points in a sitting once the teacher releases the results, out of the points of every
 * question of its exam. A sitting whose results wait for the teacher has no score, so the read reads nothing for it.
 */
const scoreOf = Effect.fn("exams.sittings.mine.score")(function* (
  sitting: ExamSittingsDoc,
  personId: TenantPeopleDoc["_id"]
) {
  if (sitting.resultsReleasedAt === undefined) {
    return null;
  }
  const reader = yield* DatabaseReader;
  const exam = yield* reader
    .table("exams")
    .get(sitting.examId)
    .pipe(Effect.orDie);
  const questions = yield* Effect.forEach(
    exam.questions,
    (questionId) =>
      reader.table("examQuestions").get(questionId).pipe(Effect.orDie),
    { concurrency: "unbounded" }
  );
  const results = yield* attemptResults(sitting._id, personId);
  return {
    points: Num.sumAll(Arr.map(results, (result) => result.points)),
    total: Num.sumAll(Arr.map(questions, (question) => question.points)),
  };
});

/**
 * The sittings of a student who may take part in them, each with the student's own attempt, its state,
 * and whether its results are released. The live sittings come from the units and cohorts that the
 * student may reach, and each one reads its own attempt, so no window hides it. The closed sittings come
 * from the student's closing and submitted attempts, and the newest `HOME_RESULT_LIMIT` of them are listed,
 * so only those are scored. Every read is bounded, and no sitting holds a token or a token hash.
 */
export const mine = Effect.fn("exams.sittings.mine")(function* () {
  const member = yield* Member;
  const live = yield* liveSittings(member);
  const liveAttempts = yield* Effect.forEach(
    live,
    (sitting) => attemptOf(sitting._id, member.person._id),
    { concurrency: "unbounded" }
  );
  const closing = yield* closedAttempts(member.person._id);
  const closed = Arr.take(
    Arr.sort(yield* closedSittings(closing), byNewestOpening),
    HOME_RESULT_LIMIT
  );
  const rows = [...live, ...closed];
  const held = HashMap.fromIterable(
    Arr.map([...Arr.getSomes(liveAttempts), ...closing], (attempt) =>
      Tuple.make(attempt.sitting, attempt)
    )
  );
  const views = yield* sittingViews(rows);
  const scores = yield* Effect.forEach(
    rows,
    (row) => scoreOf(row, member.person._id),
    { concurrency: "unbounded" }
  );
  return Arr.zipWith(rows, Arr.zip(views, scores), (row, [view, score]) => {
    const attempt = Option.getOrNull(HashMap.get(held, row._id));
    return {
      ...view,
      attempt: attempt?.state ?? null,
      attemptId: attempt?._id ?? null,
      resultsReleased: row.resultsReleasedAt !== undefined,
      score,
    };
  });
});
