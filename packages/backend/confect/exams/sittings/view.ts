import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Array as Arr, Effect, HashMap } from "effect";

/**
 * The fields of a stored sitting that its view shows as they are. The view holds no token,
 * no token hash, no sealed token, and no scheduled job, so a read never returns them
 * (ADR 0013).
 */
const ownFields = (row: ExamSittingsDoc) => ({
  closesAt: row.closesAt,
  cohortId: row.cohortId,
  examId: row.examId,
  id: row._id,
  opensAt: row.opensAt,
  room: row.room,
  state: row.state,
  unitId: row.unitId,
});

/**
 * One stored sitting as `SittingView` declares it: its own fields, the title of its exam,
 * and the IANA time zone of its unit.
 */
export const sittingView = Effect.fn("exams.sittings.view")(function* (
  row: ExamSittingsDoc
) {
  const reader = yield* DatabaseReader;
  const exam = yield* reader.table("exams").get(row.examId).pipe(Effect.orDie);
  const unit = yield* reader
    .table("tenantUnits")
    .get(row.unitId)
    .pipe(Effect.orDie);
  return { ...ownFields(row), examTitle: exam.title, timeZone: unit.timeZone };
});

/**
 * The views of several stored sittings, in their order. Each exam and each unit is read
 * once, however many of the sittings share it, so a list reads no document twice.
 */
export const sittingViews = Effect.fn("exams.sittings.views")(function* (
  rows: readonly ExamSittingsDoc[]
) {
  const reader = yield* DatabaseReader;
  const examIds = Arr.dedupe(Arr.map(rows, (row) => row.examId));
  const unitIds = Arr.dedupe(Arr.map(rows, (row) => row.unitId));
  const exams = yield* Effect.forEach(examIds, (id) =>
    reader.table("exams").get(id).pipe(Effect.orDie)
  );
  const units = yield* Effect.forEach(unitIds, (id) =>
    reader.table("tenantUnits").get(id).pipe(Effect.orDie)
  );
  const titles = HashMap.fromIterable(
    Arr.zip(
      examIds,
      Arr.map(exams, (exam) => exam.title)
    )
  );
  const zones = HashMap.fromIterable(
    Arr.zip(
      unitIds,
      Arr.map(units, (unit) => unit.timeZone)
    )
  );
  return yield* Effect.forEach(rows, (row) =>
    Effect.all({
      examTitle: Effect.fromOption(HashMap.get(titles, row.examId)),
      timeZone: Effect.fromOption(HashMap.get(zones, row.unitId)),
    }).pipe(
      Effect.orDie,
      Effect.map((context) => ({ ...ownFields(row), ...context }))
    )
  );
});
