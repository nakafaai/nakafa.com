import type { ExamAttemptsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { covers } from "@repo/backend/confect/access/decision";
import type { SittingState } from "@repo/backend/confect/exams/sittings/schema";
import { sittingViews } from "@repo/backend/confect/exams/sittings/view";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { PERSON_PLACEMENT_LIMIT } from "@repo/backend/confect/tenancy/placement";
import { Array as Arr, Effect, HashMap, Option, Tuple } from "effect";

/** The most units a tenant holds (ADR 0011), so the units a student may reach are bounded. */
export const TENANT_UNIT_LIMIT = 24;

/**
 * The most sittings of one state that one unit or one cohort lists. A unit can run more rooms
 * of one state at once than a short list holds. The state indexes end in the opening time, so
 * the bound keeps the sittings that open first, and each read stays bounded.
 */
const SITTINGS_PER_STATE = 50;

/**
 * The most attempts of one student that the list reads, newest first. A student holds one attempt
 * in each sitting, so this bounds the sittings whose state and results the list shows.
 */
const ATTEMPT_LIMIT = 100;

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
 * The closed sittings whose attempt of the student was submitted. A closed sitting stays in the
 * student's list, so its results stay reachable once the teacher releases them.
 */
const closedSittings = Effect.fn("exams.sittings.mine.closed")(function* (
  submitted: readonly ExamAttemptsDoc[]
) {
  const reader = yield* DatabaseReader;
  const sittings = yield* Effect.forEach(
    submitted,
    (attempt) =>
      reader.table("examSittings").get(attempt.sitting).pipe(Effect.orDie),
    { concurrency: "unbounded" }
  );
  return Arr.filter(sittings, (sitting) => sitting.state === "closed");
});

/**
 * The sittings of a student who may take part in them, each with the student's own attempt state
 * and whether its results are released. The live sittings come from the units and cohorts that the
 * student may reach, and the closed sittings come from the student's submitted attempts. Every read
 * is bounded, and no sitting holds a token or a token hash.
 */
export const mine = Effect.fn("exams.sittings.mine")(function* () {
  const member = yield* Member;
  const reader = yield* DatabaseReader;
  const attempts = yield* reader
    .table("examAttempts")
    .index(
      "by_personId",
      (query) => query.eq("person", member.person._id),
      "desc"
    )
    .take(ATTEMPT_LIMIT)
    .pipe(Effect.orDie);
  const held = HashMap.fromIterable(
    Arr.map(attempts, (attempt) => Tuple.make(attempt.sitting, attempt.state))
  );
  const live = yield* liveSittings(member);
  const closed = yield* closedSittings(
    Arr.filter(attempts, (attempt) => attempt.state === "submitted")
  );
  const rows = [...live, ...closed];
  const views = yield* sittingViews(rows);
  return Arr.zipWith(rows, views, (row, view) => ({
    ...view,
    attempt: Option.getOrNull(HashMap.get(held, row._id)),
    resultsReleased: row.resultsReleasedAt !== undefined,
  }));
});
