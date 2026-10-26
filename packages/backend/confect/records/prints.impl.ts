import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
  QueryRunner,
  StorageActionWriter,
} from "@repo/backend/confect/_generated/services";
import { reportAuthority } from "@repo/backend/confect/records/authority";
import { drawReportPdf } from "@repo/backend/confect/records/pdf";
import spec from "@repo/backend/confect/records/prints.spec";
import type { PrintableReport } from "@repo/backend/confect/records/report";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Clock, Effect, Layer, Struct } from "effect";

/** The PDF's media type. */
const PDF_TYPE = "application/pdf";

/** The approved report a print names. Only an approval schedules a print, so another state is a defect. */
const approvedReport = Effect.fn("records.prints.approved")(function* (
  reportId: GenericId.GenericId<"reportCards">
) {
  const report = yield* (yield* DatabaseReader)
    .table("reportCards")
    .get(reportId)
    .pipe(Effect.orDie);
  if (
    report.state !== "approved" ||
    report.hash === undefined ||
    report.subjects === undefined ||
    report.approvedAt === undefined ||
    report.approvedBy === undefined
  ) {
    return yield* Effect.die("A print names a report that is not approved.");
  }
  return {
    ...report,
    approvedAt: report.approvedAt,
    approvedBy: report.approvedBy,
    hash: report.hash,
    subjects: report.subjects,
  };
});

/**
 * The printable copy of an approved report: the names of its school, period, cohort,
 * and student, the copy of its grades and note, and the public check's address of its
 * hash, in the language of the cohort's unit.
 */
const printable = FunctionImpl.make(
  databaseSchema,
  spec,
  "printable",
  Effect.fn("records.prints.printable")(function* ({ reportId }) {
    const report = yield* approvedReport(reportId);
    const reader = yield* DatabaseReader;
    const cohort = yield* reader
      .table("tenantCohorts")
      .get(report.cohortId)
      .pipe(Effect.orDie);
    const [tenant, period, unit, person] = yield* Effect.all([
      reader.table("tenants").get(report.tenantId).pipe(Effect.orDie),
      reader.table("tenantPeriods").get(report.periodId).pipe(Effect.orDie),
      reader.table("tenantUnits").get(cohort.unitId).pipe(Effect.orDie),
      reader.table("tenantPeople").get(report.personId).pipe(Effect.orDie),
    ]);
    const locale = unit.contentLanguage;
    const copy: typeof PrintableReport.Type = {
      approvedAt: report.approvedAt,
      cohort: cohort.name,
      hash: report.hash,
      locale,
      note: report.note,
      period: period.name,
      school: tenant.name,
      student: person.name,
      subjects: report.subjects,
      verifyUrl: new URL(`/${locale}/verify/${report.hash}`, SITE_ORIGIN).href,
    };
    return copy;
  })
);

/** Draws an approved report's PDF, stores it, and locks the report with it. */
const draw = FunctionImpl.make(
  databaseSchema,
  spec,
  "draw",
  Effect.fn("records.prints.draw")(function* ({ reportId }) {
    const copy = yield* (yield* QueryRunner)
      .runQuery(refs.internal.records.prints.printable, { reportId })
      .pipe(Effect.orDie);
    const bytes = yield* drawReportPdf(copy);
    const storageId = yield* (yield* StorageActionWriter).store(
      new Blob([bytes], { type: PDF_TYPE })
    );
    yield* (yield* MutationRunner)
      .runMutation(refs.internal.records.prints.lock, { reportId, storageId })
      .pipe(Effect.orDie);
    return null;
  })
);

/**
 * Locks an approved report with its stored PDF, and journals the lock with the report's
 * hash, as the principal who approved it (ADR 0033, Journal changes).
 */
const lock = FunctionImpl.make(
  databaseSchema,
  spec,
  "lock",
  Effect.fn("records.prints.lock")(function* ({ reportId, storageId }) {
    const report = yield* approvedReport(reportId);
    const now = yield* Clock.currentTimeMillis;
    yield* (yield* DatabaseWriter)
      .table("reportCards")
      .replace(reportId, {
        ...Struct.omit(report, ["_creationTime", "_id"]),
        lockedAt: now,
        state: "locked",
        storageId,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    const locked = yield* (yield* DatabaseReader)
      .table("reportCards")
      .get(reportId)
      .pipe(Effect.orDie);
    const approver = yield* (yield* DatabaseReader)
      .table("tenantPeople")
      .get(report.approvedBy)
      .pipe(Effect.orDie);
    yield* reportAuthority.record(personActor(approver), locked, {
      hash: report.hash,
      type: "report.locked",
    });
    return null;
  })
);

/** The drawing of approved reports' PDFs and their lock. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(printable),
  Layer.provide(draw),
  Layer.provide(lock),
  GroupImpl.finalize
);
