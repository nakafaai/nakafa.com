import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { covers } from "@repo/backend/confect/access/decision";
import type { SittingState } from "@repo/backend/confect/exams/sittings/schema";
import { sittingView } from "@repo/backend/confect/exams/sittings/view";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { PERSON_PLACEMENT_LIMIT } from "@repo/backend/confect/tenancy/placement";
import { Array as Arr, Effect } from "effect";

/** The most units a tenant holds (ADR 0011), so the units a student may reach are bounded. */
const TENANT_UNIT_LIMIT = 24;

/** The most sittings of one state that one unit or one cohort lists, so a student's list stays short. */
const SITTINGS_PER_STATE = 10;

/** The states of a sitting that a student may still take part in. */
const LIVE_STATES: readonly (typeof SittingState.Type)[] = [
  "scheduled",
  "open",
];

/**
 * The sittings of a student who may take part in them: the unit sittings of each unit
 * that a student grant covers, and the cohort sittings of each cohort the student is
 * placed in. Every read is bounded, and no sitting holds a token or a token hash.
 */
export const mine = Effect.fn("exams.sittings.mine")(function* () {
  const member = yield* Member;
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
        .index("by_unitId_and_cohortId_and_state", (query) =>
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
        .index("by_cohortId_and_state", (query) =>
          query.eq("cohortId", placement.cohortId).eq("state", state)
        )
        .take(SITTINGS_PER_STATE)
        .pipe(Effect.orDie)
    )
  );
  const rows = Arr.flatten(Arr.flatten([...unitRows, ...cohortRows]));
  return Arr.map(rows, sittingView);
});
