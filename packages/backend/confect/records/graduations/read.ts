import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import {
  GraduationAction,
  type GraduationCohort,
  type GraduationOverview,
  suggestedDate,
} from "@repo/backend/confect/records/graduation";
import {
  finalUnit,
  graduationOf,
  graduationView,
  lineOf,
} from "@repo/backend/confect/records/graduations/facts";
import spec from "@repo/backend/confect/records/graduations.spec";
import type { ReadinessRow } from "@repo/backend/confect/records/letter";
import { openNisn, schoolKeys } from "@repo/backend/confect/roster/entry";
import { Cohort } from "@repo/backend/confect/tenancy/access";
import {
  cohortAuthority,
  periodAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { lastGradeOf } from "@repo/backend/confect/tenancy/promotion/destination";
import { Array as Arr, Effect, Option, Struct } from "effect";

/** The most units, and the most class groups of one period, the graduation pages list. */
const UNIT_LIMIT = 20;
const COHORT_LIMIT = 100;

/**
 * The graduating class groups the viewer opens: each active class group of the last grade of
 * the active period of each active unit, when the viewer opens its graduation, as the principal,
 * the Admin, or Staff. Ordered by unit, then by name.
 */
export const cohorts = FunctionImpl.make(
  databaseSchema,
  spec,
  "cohorts",
  Effect.fn("records.graduations.cohorts")(function* () {
    const { tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const units = yield* reader
      .table("tenantUnits")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenant._id).eq("status", "active")
      )
      .take(UNIT_LIMIT)
      .pipe(Effect.orDie);
    const perUnit = yield* Effect.forEach(units, (unit) =>
      Effect.gen(function* () {
        const active = yield* reader
          .table("tenantPeriods")
          .index("by_unitId_and_status", (query) =>
            query.eq("unitId", unit._id).eq("status", "active")
          )
          .first()
          .pipe(Effect.orDie);
        const last = lastGradeOf(unit.level);
        if (Option.isNone(active) || Option.isNone(last)) {
          return [];
        }
        const rows = yield* reader
          .table("tenantCohorts")
          .index("by_periodId_and_nameKey", (query) =>
            query.eq("periodId", active.value._id)
          )
          .take(COHORT_LIMIT)
          .pipe(Effect.orDie);
        const open = yield* Effect.filter(
          Arr.filter(
            rows,
            (row) => row.status === "active" && row.grade === last.value
          ),
          (row) =>
            cohortAuthority.check("graduation.view", row).pipe(
              Effect.as(true),
              Effect.catchTag("AccessDenied", () => Effect.succeed(false))
            )
        );
        return Arr.map(open, (row): typeof GraduationCohort.Type => ({
          id: row._id,
          name: row.name,
          period: active.value.name,
          unit: unit.name,
        }));
      })
    );
    return Arr.flatten(perUnit);
  })
);

/**
 * A graduating class group's page: the class group and its period, the unit's name and NPSN,
 * the unit's decision or none, the date the rules suggest for it, and what the viewer may do:
 * record the decision on the period, and issue the class group's letters.
 */
export const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("records.graduations.get")(function* () {
    const row = yield* Cohort;
    const unit = yield* finalUnit(row);
    const period = yield* (yield* DatabaseReader)
      .table("tenantPeriods")
      .get(row.periodId)
      .pipe(Effect.orDie);
    const [graduation, onPeriod, onCohort] = yield* Effect.all([
      graduationOf(row.periodId),
      periodAuthority.allowed(period),
      cohortAuthority.allowed(row),
    ]);
    const overview: typeof GraduationOverview.Type = {
      can: Arr.filter(GraduationAction.literals, (action) =>
        Arr.contains(
          action === "graduation.decide" ? onPeriod : onCohort,
          action
        )
      ),
      cohort: {
        id: row._id,
        name: row.name,
        period: period.name,
        periodId: period._id,
      },
      decision: Option.getOrNull(Option.map(graduation, graduationView)),
      suggested: suggestedDate(unit.level, period.end),
      unit: { name: unit.name, npsn: unit.npsn ?? null },
    };
    return overview;
  })
);

/**
 * One page of a graduating class group: each student placed in it, in the order of their
 * placement, with their transcript data, their SKL, and what is missing for it.
 */
export const sheet = FunctionImpl.make(
  databaseSchema,
  spec,
  "sheet",
  Effect.fn("records.graduations.sheet")(function* ({ paginationOpts }) {
    const row = yield* Cohort;
    const unit = yield* finalUnit(row);
    const graduation = yield* graduationOf(row.periodId);
    const page = yield* (yield* DatabaseReader)
      .table("tenantCohortMembers")
      .index("by_cohortId_and_personId", (query) =>
        query.eq("cohortId", row._id)
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const lines = yield* Effect.forEach(
      page.page,
      (placement) =>
        lineOf(row, unit, graduation, placement.personId).pipe(
          Effect.map(({ line }) => line)
        ),
      { concurrency: "unbounded" }
    );
    return Struct.assign(page, { page: lines });
  })
);

/**
 * One page of the e-Ijazah readiness rows of a graduating class group: each line with the
 * student's NISN opened under the school key, for the school's own export (ADR 0033, S6).
 */
export const readiness = FunctionImpl.make(
  databaseSchema,
  spec,
  "readiness",
  Effect.fn("records.graduations.readiness")(function* ({ paginationOpts }) {
    const row = yield* Cohort;
    const unit = yield* finalUnit(row);
    const keys = yield* schoolKeys(row.tenantId);
    const graduation = yield* graduationOf(row.periodId);
    const page = yield* (yield* DatabaseReader)
      .table("tenantCohortMembers")
      .index("by_cohortId_and_personId", (query) =>
        query.eq("cohortId", row._id)
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const rows = yield* Effect.forEach(
      page.page,
      (placement) =>
        Effect.gen(function* () {
          const { entry, line } = yield* lineOf(
            row,
            unit,
            graduation,
            placement.personId
          );
          const nisn = Option.isSome(entry)
            ? yield* openNisn(keys, entry.value)
            : Option.none();
          const readinessRow: typeof ReadinessRow.Type = {
            ...line,
            nisn: Option.getOrNull(nisn),
          };
          return readinessRow;
        }),
      { concurrency: "unbounded" }
    );
    return Struct.assign(page, { page: rows });
  })
);
