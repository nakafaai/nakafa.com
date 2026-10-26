import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  StorageReader,
} from "@repo/backend/confect/_generated/services";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Report } from "@repo/backend/confect/records/access";
import { reportAuthority } from "@repo/backend/confect/records/authority";
import {
  releasedSubjects,
  reportOf,
  reportView,
} from "@repo/backend/confect/records/card";
import {
  ReportAction,
  type ReportCohort,
  type ReportDetail,
  type ReportLine,
} from "@repo/backend/confect/records/report";
import spec from "@repo/backend/confect/records/reports.spec";
import { Cohort } from "@repo/backend/confect/tenancy/access";
import { cohortAuthority } from "@repo/backend/confect/tenancy/authority";
import { Array as Arr, Effect, Option, Struct } from "effect";

/** The most units, and the most class groups of one period, the report pages list. */
const UNIT_LIMIT = 20;
const COHORT_LIMIT = 100;

/**
 * The class groups whose report cards the viewer opens: each active class group of the
 * active period of each active unit, when the viewer may list its reports, as its
 * homeroom teacher, the principal, or the Admin. Ordered by unit, then by name.
 */
export const cohorts = FunctionImpl.make(
  databaseSchema,
  spec,
  "cohorts",
  Effect.fn("records.reports.cohorts")(function* () {
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
        if (Option.isNone(active)) {
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
          Arr.filter(rows, (row) => row.status === "active"),
          (row) =>
            cohortAuthority.check("report.list", row).pipe(
              Effect.as(true),
              Effect.catchTag("AccessDenied", () => Effect.succeed(false))
            )
        );
        return Arr.map(open, (row): typeof ReportCohort.Type => ({
          id: row._id,
          name: row.name,
          period: active.value.name,
        }));
      })
    );
    return Arr.flatten(perUnit);
  })
);

/**
 * One page of a cohort's report list: each student placed in the cohort, in the order of
 * their placement, with their report card, or none before the homeroom teacher starts it,
 * and what the viewer may do with it.
 */
export const sheet = FunctionImpl.make(
  databaseSchema,
  spec,
  "sheet",
  Effect.fn("records.reports.sheet")(function* ({ paginationOpts }) {
    const row = yield* Cohort;
    const reader = yield* DatabaseReader;
    const page = yield* reader
      .table("tenantCohortMembers")
      .index("by_cohortId_and_personId", (query) =>
        query.eq("cohortId", row._id)
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const writes = Arr.contains(
      yield* cohortAuthority.allowed(row),
      "report.write"
    );
    const lines = yield* Effect.forEach(
      page.page,
      (placement) =>
        Effect.gen(function* () {
          const [person, report] = yield* Effect.all([
            reader
              .table("tenantPeople")
              .get(placement.personId)
              .pipe(Effect.orDie),
            reportOf(row._id, placement.personId),
          ]);
          const allowed = Option.isSome(report)
            ? yield* reportAuthority.allowed(report.value)
            : [];
          const line: typeof ReportLine.Type = {
            can: Arr.filter(ReportAction.literals, (action) =>
              action === "report.write" ? writes : Arr.contains(allowed, action)
            ),
            report: Option.getOrNull(Option.map(report, reportView)),
            student: { id: person._id, name: person.name },
          };
          return line;
        }),
      { concurrency: "unbounded" }
    );
    return Struct.assign(page, { page: lines });
  })
);

/**
 * One report card with its subject lines: the student's released grades in the cohort
 * until the approval, and the copy taken at the approval after it. A locked report gives
 * the address of its PDF.
 */
export const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("records.reports.get")(function* () {
    const report = yield* Report;
    const person = yield* (yield* DatabaseReader)
      .table("tenantPeople")
      .get(report.personId)
      .pipe(Effect.orDie);
    const subjects =
      report.subjects === undefined
        ? yield* releasedSubjects(report)
        : report.subjects;
    // A locked report always holds its file, so a missing one is a defect.
    const file =
      report.storageId === undefined
        ? null
        : yield* (yield* StorageReader).getUrl(report.storageId).pipe(
            Effect.map((url) => url.href),
            Effect.orDie
          );
    const detail: typeof ReportDetail.Type = {
      ...reportView(report),
      file,
      student: { id: person._id, name: person.name },
      subjects,
    };
    return detail;
  })
);
