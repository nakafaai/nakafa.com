import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Exam } from "@repo/backend/confect/exams/access";
import { examAccess } from "@repo/backend/confect/exams/authority";
import { examSummary } from "@repo/backend/confect/exams/exam";
import { roomRow } from "@repo/backend/confect/exams/rooms";
import spec from "@repo/backend/confect/exams/rooms.spec";
import { sittingAuthority } from "@repo/backend/confect/exams/sittings/authority";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Effect, Layer, Number as Num, Struct } from "effect";

/** The most rooms that one page of an exam's list holds. A larger request is clamped to it. */
const ROOM_PAGE_LIMIT = 50;

/**
 * One stored room as the list shows it. A room of a cohort names the cohort, and any other room
 * names its unit. Both are read in the unit's time zone, which the room's times are read in.
 */
const roomOf = Effect.fn("exams.rooms.room")(function* (row: ExamSittingsDoc) {
  const reader = yield* DatabaseReader;
  const unit = yield* reader
    .table("tenantUnits")
    .get(row.unitId)
    .pipe(Effect.orDie);
  if (row.cohortId === null) {
    return roomRow(row, { kind: "unit", name: unit.name }, unit.timeZone);
  }
  const cohort = yield* reader
    .table("tenantCohorts")
    .get(row.cohortId)
    .pipe(Effect.orDie);
  return roomRow(row, { kind: "cohort", name: cohort.name }, unit.timeZone);
});

/**
 * One page of the rooms of the exam, in the order the opening times give them, from the
 * earliest. The index reads the exam's rooms in that order, and an optional state narrows
 * the page in the same read. Each room is kept only if the caller's sitting view allows it,
 * so a Principal or a Deputy sees the rooms of the school and a Teacher sees the rooms of their
 * units. A page asks for at most `ROOM_PAGE_LIMIT` rooms, and a larger request is clamped.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("exams.rooms.list")(function* ({ paginationOpts, state }) {
    const exam = yield* Exam;
    const rooms = (yield* DatabaseReader)
      .table("examSittings")
      .index("by_examId_and_opensAt", (query) => query.eq("examId", exam._id));
    const options = Struct.assign(paginationOpts, {
      numItems: Num.clamp(paginationOpts.numItems, {
        maximum: ROOM_PAGE_LIMIT,
        minimum: 1,
      }),
    });
    const page = yield* (
      state === undefined
        ? rooms.paginate(options)
        : rooms.paginate(options, (filter) =>
            filter.eq(filter.field("state"), state)
          )
    ).pipe(Effect.orDie);
    const viewable = yield* Effect.filter(page.page, (row) =>
      sittingAuthority
        .allowed({ ...row, exam })
        .pipe(Effect.map((actions) => Arr.contains(actions, "sitting.view")))
    );
    const rows = yield* Effect.forEach(viewable, roomOf);
    return Struct.assign(page, { page: rows });
  })
);

/** The summary of the exam whose rooms the list shows, for the page's header. */
const exam = FunctionImpl.make(
  databaseSchema,
  spec,
  "exam",
  Effect.fn("exams.rooms.exam")(function* () {
    return examSummary(yield* Exam);
  })
);

/** Implements the rooms group of `rooms.spec.ts`: the list of an exam's rooms, and the exam's summary. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(exam),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(examAccess),
  GroupImpl.finalize
);
