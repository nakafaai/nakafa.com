import type { GenericId } from "@confect/core";
import type { ClassroomTasksDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { examAuthority } from "@repo/backend/confect/exams/authority";
import { scheduleSitting } from "@repo/backend/confect/exams/sittings/schedule";
import { RoomName } from "@repo/backend/confect/exams/sittings/schema";
import { openToken } from "@repo/backend/confect/exams/sittings/token";
import { readTenantKeys } from "@repo/backend/confect/vault/keys";
import { Clock, Duration, Effect, Schema } from "effect";

/** How long after its deadline a task that takes late work keeps its exam open. */
const LATE_WINDOW = Duration.days(7);

/**
 * Makes an exam document the work of a newly published task: the exam the teacher built in the
 * editor runs for the class's cohort from now until the deadline, or a week past it when the task
 * takes late work, in a room named after the cohort, and the task keeps the run. The caller must be
 * allowed to edit the exam, and the exam's questions must be ready, as any schedule needs.
 */
export const runTaskExam = Effect.fn("classroom.tasks.exam.run")(function* (
  task: ClassroomTasksDoc,
  examId: GenericId.GenericId<"exams">
) {
  const row = yield* Class;
  const reader = yield* DatabaseReader;
  const exam = yield* examAuthority.authorize("exam.edit", examId);
  const cohort = yield* reader
    .table("tenantCohorts")
    .get(row.cohortId)
    .pipe(Effect.orDie);
  const late =
    task.latePolicy === "accept" ? Duration.toMillis(LATE_WINDOW) : 0;
  const run = yield* scheduleSitting({
    closesAt: task.deadline + late,
    exam,
    group: { cohortId: row.cohortId, kind: "cohort" },
    opensAt: yield* Clock.currentTimeMillis,
    room: yield* Schema.decodeEffect(RoomName)(cohort.name).pipe(Effect.orDie),
  });
  yield* (yield* DatabaseWriter)
    .table("classroomTasks")
    .patch(task._id, { sittingId: run.id })
    .pipe(Effect.orDie);
  return yield* reader.table("classroomTasks").get(task._id).pipe(Effect.orDie);
});

/**
 * The exam of a task as the class reads it: the exam document, its run, and the run's token. A
 * class task's run is homework, not a proctored room, so the class's readers open its token, and a
 * student's press enters the exam player with it (ADR 0025). A task with no exam has none.
 */
export const taskExam = Effect.fn("classroom.tasks.exam.view")(function* (
  task: ClassroomTasksDoc
) {
  if (task.sittingId === undefined) {
    return null;
  }
  const run = yield* (yield* DatabaseReader)
    .table("examSittings")
    .get(task.sittingId)
    .pipe(Effect.orDie);
  const keys = yield* readTenantKeys(task.tenantId).pipe(Effect.orDie);
  return {
    examId: run.examId,
    sittingId: run._id,
    token: yield* openToken(keys, run._id, run.tokenSealed).pipe(Effect.orDie),
  };
});
