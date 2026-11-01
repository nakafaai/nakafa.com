import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { CLASS_LIMIT } from "@repo/backend/confect/classroom/class";
import { Period } from "@repo/backend/confect/tenancy/access";
import { activeHomeroomOf } from "@repo/backend/confect/tenancy/authority";
import { COHORT_LIMIT } from "@repo/backend/confect/tenancy/cohort";
import spec from "@repo/backend/confect/tenancy/cohorts.spec";
import { Array as Arr, Effect, Option } from "effect";

/** The most placements one cohort's count reads, past any class group a school forms. */
const COHORT_COUNT_LIMIT = 300;

/**
 * What a settings table shows of each cohort of one period: its homeroom teacher, and how many
 * students and active classes it holds. A count reads its rows, so this read costs each cohort its
 * placements and its classes. Only the settings tables ask for it, one query for the whole table.
 */
export const overview = FunctionImpl.make(
  databaseSchema,
  spec,
  "overview",
  Effect.fn("tenancy.cohorts.overview")(function* () {
    const period = yield* Period;
    const reader = yield* DatabaseReader;
    const cohorts = yield* reader
      .table("tenantCohorts")
      .index("by_periodId_and_grade_and_nameKey", (query) =>
        query.eq("periodId", period._id)
      )
      .take(COHORT_LIMIT)
      .pipe(Effect.orDie);

    return yield* Effect.forEach(
      cohorts,
      (cohort) =>
        Effect.gen(function* () {
          const placed = yield* reader
            .table("tenantCohortMembers")
            .index("by_cohortId_and_personId", (query) =>
              query.eq("cohortId", cohort._id)
            )
            .take(COHORT_COUNT_LIMIT)
            .pipe(Effect.orDie);
          const classes = yield* reader
            .table("classes")
            .index("by_cohortId_and_status_and_nameKey", (query) =>
              query.eq("cohortId", cohort._id).eq("status", "active")
            )
            .take(CLASS_LIMIT)
            .pipe(Effect.orDie);
          const assignment = yield* activeHomeroomOf(cohort._id);
          const homeroom = Option.isSome(assignment)
            ? yield* reader
                .table("tenantPeople")
                .get(assignment.value.personId)
                .pipe(Effect.orDie)
            : null;

          return {
            classes: Arr.length(classes),
            homeroom: homeroom === null ? null : homeroom.name,
            id: cohort._id,
            name: cohort.name,
            students: Arr.length(placed),
          };
        }),
      { concurrency: "unbounded" }
    );
  })
);
