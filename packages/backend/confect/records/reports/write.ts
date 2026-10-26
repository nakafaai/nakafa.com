import type { GenericId } from "@confect/core";
import { FunctionImpl } from "@confect/server";
import type { ReportCardsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Report } from "@repo/backend/confect/records/access";
import {
  contentHash,
  releasedSubjects,
  reportOf,
  reportView,
} from "@repo/backend/confect/records/card";
import {
  ReportClosed,
  ReportNotPlaced,
} from "@repo/backend/confect/records/errors";
import type { reportCardValidator } from "@repo/backend/confect/records/report";
import spec from "@repo/backend/confect/records/reports.spec";
import { Cohort } from "@repo/backend/confect/tenancy/access";
import { placementOf } from "@repo/backend/confect/tenancy/authority";
import { Clock, Duration, Effect, Option, Struct } from "effect";

/** Replaces one report card with its next state, and answers it as its readers see it. */
const replaceReport = Effect.fn("records.reports.replace")(function* (
  id: GenericId.GenericId<"reportCards">,
  next: typeof reportCardValidator.Type
) {
  yield* (yield* DatabaseWriter)
    .table("reportCards")
    .replace(id, next)
    .pipe(Effect.orDie);
  const row = yield* (yield* DatabaseReader)
    .table("reportCards")
    .get(id)
    .pipe(Effect.orDie);
  return reportView(row);
});

/** The fields of a report card as stored, without the document's own. */
const storedOf = (report: ReportCardsDoc) =>
  Struct.omit(report, ["_creationTime", "_id"]);

/**
 * Writes the homeroom teacher's note on a placed student's report card, which starts
 * the draft at the first note. Only a draft takes a note: a handed-in report is taken
 * back first.
 */
export const write = FunctionImpl.make(
  databaseSchema,
  spec,
  "write",
  Effect.fn("records.reports.write")(function* ({ note, personId }) {
    const cohort = yield* Cohort;
    const placement = yield* placementOf(cohort.periodId, personId);
    if (!Option.exists(placement, (found) => found.cohortId === cohort._id)) {
      return yield* new ReportNotPlaced();
    }
    const existing = yield* reportOf(cohort._id, personId);
    if (Option.exists(existing, (report) => report.state !== "draft")) {
      return yield* new ReportClosed();
    }
    const now = yield* Clock.currentTimeMillis;
    if (Option.isSome(existing)) {
      return yield* replaceReport(existing.value._id, {
        ...storedOf(existing.value),
        note,
        updatedAt: now,
      });
    }
    const id = yield* (yield* DatabaseWriter)
      .table("reportCards")
      .insert({
        cohortId: cohort._id,
        createdAt: now,
        note,
        periodId: cohort.periodId,
        personId,
        state: "draft",
        tenantId: cohort.tenantId,
        updatedAt: now,
      })
      .pipe(Effect.orDie);
    const row = yield* (yield* DatabaseReader)
      .table("reportCards")
      .get(id)
      .pipe(Effect.orDie);
    return reportView(row);
  })
);

/** Hands a draft in for the principal's approval. */
export const complete = FunctionImpl.make(
  databaseSchema,
  spec,
  "complete",
  Effect.fn("records.reports.complete")(function* () {
    const report = yield* Report;
    if (report.state !== "draft") {
      return yield* new ReportClosed();
    }
    const now = yield* Clock.currentTimeMillis;
    return yield* replaceReport(report._id, {
      ...storedOf(report),
      completedAt: now,
      state: "completed",
      updatedAt: now,
    });
  })
);

/** Takes a handed-in report back to a draft, while the principal has not approved it. */
export const reopen = FunctionImpl.make(
  databaseSchema,
  spec,
  "reopen",
  Effect.fn("records.reports.reopen")(function* () {
    const report = yield* Report;
    if (report.state !== "completed") {
      return yield* new ReportClosed();
    }
    const now = yield* Clock.currentTimeMillis;
    return yield* replaceReport(report._id, {
      ...Struct.omit(storedOf(report), ["completedAt"]),
      state: "draft",
      updatedAt: now,
    });
  })
);

/**
 * Approves a handed-in report. The released grades are copied onto it, its content
 * hash is taken, and its PDF is drawn next, which locks it. The approval is the
 * principal's; the lock is journaled with the hash once the PDF is stored.
 */
export const approve = FunctionImpl.make(
  databaseSchema,
  spec,
  "approve",
  Effect.fn("records.reports.approve")(function* () {
    const report = yield* Report;
    const { person } = yield* Member;
    if (report.state !== "completed") {
      return yield* new ReportClosed();
    }
    const now = yield* Clock.currentTimeMillis;
    const subjects = yield* releasedSubjects(report);
    const hash = yield* contentHash({
      approvedAt: now,
      id: report._id,
      note: report.note,
      personId: report.personId,
      subjects,
    });
    const view = yield* replaceReport(report._id, {
      ...storedOf(report),
      approvedAt: now,
      approvedBy: person._id,
      hash,
      state: "approved",
      subjects,
      updatedAt: now,
    });
    yield* (yield* Scheduler)
      .runAfter(Duration.zero, refs.internal.records.prints.draw, {
        reportId: report._id,
      })
      .pipe(Effect.orDie);
    return view;
  })
);
