import type {
  ClassesDoc,
  ClassroomTasksDoc,
  NotificationsDoc,
  TenantPeopleDoc,
  TenantsDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { mayIn, principalOf } from "@repo/backend/confect/classroom/roster";
import type { ClassDetail } from "@repo/backend/confect/notifications/schema";
import { Effect, Match, Option } from "effect";

/**
 * The class of a row, its author's name, and whether the recipient still reads the
 * class, each read when the row is read (ADR 0027). A class the recipient no
 * longer reads gives no detail, so the row shows nothing of it.
 */
const classPart = Effect.fn("notifications.detail.class")(function* (
  classId: ClassesDoc["_id"],
  authorId: TenantPeopleDoc["_id"],
  person: TenantPeopleDoc,
  tenant: TenantsDoc
) {
  const reader = yield* DatabaseReader;
  const klass = yield* reader.table("classes").get(classId).pipe(Effect.option);
  if (Option.isNone(klass) || klass.value.tenantId !== tenant._id) {
    return Option.none();
  }
  if (
    !(yield* mayIn(
      "forum.read",
      klass.value,
      yield* principalOf(person, tenant)
    ))
  ) {
    return Option.none();
  }
  const author = yield* reader
    .table("tenantPeople")
    .get(authorId)
    .pipe(Effect.option);
  return Option.some({
    actor: Option.match(author, {
      onNone: () => "",
      onSome: (found) => found.name,
    }),
    className: klass.value.name,
    classSlug: klass.value.slug,
  });
});

/** The detail of a task row: the class part, and the task's own address. A task that is gone gives none. */
const taskPart = Effect.fn("notifications.detail.task")(function* (
  taskId: ClassroomTasksDoc["_id"],
  person: TenantPeopleDoc,
  tenant: TenantsDoc
) {
  const task = yield* (yield* DatabaseReader)
    .table("classroomTasks")
    .get(taskId)
    .pipe(Effect.option);
  if (Option.isNone(task)) {
    return Option.none();
  }
  const part = yield* classPart(
    task.value.classId,
    task.value.authorId,
    person,
    tenant
  );
  return Option.map(part, (found) => ({
    ...found,
    channelId: null,
    discussion: null,
    messageId: null,
    task: task.value.slug,
  }));
});

/**
 * The detail of one row for its recipient: the mention's message and where it is,
 * or the announcement's class home. An invitation has none, and neither has a row
 * whose source is gone or whose class the recipient no longer reads.
 */
const detailOf = Effect.fn("notifications.detail")(function* (
  row: NotificationsDoc,
  person: TenantPeopleDoc,
  tenant: TenantsDoc
) {
  const reader = yield* DatabaseReader;
  const detail: Option.Option<typeof ClassDetail.Type> = yield* Match.value(
    row
  ).pipe(
    Match.discriminatorsExhaustive("changeType")({
      "announcement.posted": (announcement) =>
        Effect.gen(function* () {
          const post = yield* reader
            .table("classroomPosts")
            .get(announcement.postId)
            .pipe(Effect.option);
          if (Option.isNone(post)) {
            return Option.none();
          }
          const part = yield* classPart(
            post.value.classId,
            post.value.authorId,
            person,
            tenant
          );
          return Option.map(part, (found) => ({
            ...found,
            channelId: null,
            discussion: null,
            messageId: null,
            task: null,
          }));
        }),
      "assignment.published": (assignment) =>
        taskPart(assignment.taskId, person, tenant),
      "assignment.deadline": (assignment) =>
        taskPart(assignment.taskId, person, tenant),
      "assignment.missed": () => Effect.succeedNone,
      "forum.mentioned": (mention) =>
        Effect.gen(function* () {
          const message = yield* reader
            .table("classroomMessages")
            .get(mention.messageId)
            .pipe(Effect.option);
          if (Option.isNone(message)) {
            return Option.none();
          }
          const part = yield* classPart(
            message.value.classId,
            message.value.authorId,
            person,
            tenant
          );
          const thread =
            message.value.threadId === undefined
              ? Option.none()
              : yield* reader
                  .table("classroomThreads")
                  .get(message.value.threadId)
                  .pipe(Effect.option);
          return Option.map(part, (found) => ({
            ...found,
            channelId: message.value.channelId,
            discussion: Option.match(thread, {
              onNone: () => null,
              onSome: (discussion) => discussion.number,
            }),
            messageId: message.value._id,
            task: null,
          }));
        }),
      "person.invited": () => Effect.succeedNone,
      "exam.starting": () => Effect.succeedNone,
      "exam.reminder": () => Effect.succeedNone,
      "grade.released": () => Effect.succeedNone,
    })
  );
  return Option.getOrNull(detail);
});

/**
 * The sitting a sitting row opens, while the sitting still stands and has not closed: the exam's title, its room, when
 * it opens, and, on a guardian's row, the child's name. A row's sitting is always of the row's school, since the run
 * that writes the row reads the sitting's own school.
 */
const examOf = Effect.fn("notifications.detail.exam")(function* (
  row: Extract<
    NotificationsDoc,
    { readonly changeType: "exam.starting" | "exam.reminder" }
  >
) {
  const reader = yield* DatabaseReader;
  const sitting = yield* reader
    .table("examSittings")
    .get(row.sittingId)
    .pipe(Effect.option);
  if (Option.isNone(sitting) || sitting.value.state === "closed") {
    return null;
  }
  const exam = yield* reader
    .table("exams")
    .get(sitting.value.examId)
    .pipe(Effect.orDie);
  const student =
    row.changeType === "exam.reminder"
      ? yield* reader
          .table("tenantPeople")
          .get(row.studentPersonId)
          .pipe(
            Effect.map((person) => person.name),
            Effect.orDie
          )
      : null;
  return {
    examTitle: exam.title,
    opensAt: sitting.value.opensAt,
    room: sitting.value.room,
    sittingId: sitting.value._id,
    student,
  };
});

/**
 * The grade a grade row tells of, while it stays released: its class's name, and the student's name on a guardian's
 * row.
 */
const gradeOf = Effect.fn("notifications.detail.grade")(function* (
  row: Extract<NotificationsDoc, { readonly changeType: "grade.released" }>
) {
  const reader = yield* DatabaseReader;
  const grade = yield* reader
    .table("classGrades")
    .get(row.gradeId)
    .pipe(Effect.option);
  if (Option.isNone(grade) || grade.value.state !== "released") {
    return null;
  }
  const klass = yield* reader
    .table("classes")
    .get(grade.value.classId)
    .pipe(Effect.orDie);
  const student =
    row.studentPersonId === row.recipientPersonId
      ? null
      : yield* reader
          .table("tenantPeople")
          .get(row.studentPersonId)
          .pipe(
            Effect.map((person) => person.name),
            Effect.orDie
          );
  return { className: klass.name, student };
});

/** The task a late-task row tells of, while it stands: its class's name and the student's name. */
const missedOf = Effect.fn("notifications.detail.missed")(function* (
  row: Extract<NotificationsDoc, { readonly changeType: "assignment.missed" }>
) {
  const reader = yield* DatabaseReader;
  const task = yield* reader
    .table("classroomTasks")
    .get(row.taskId)
    .pipe(Effect.option);
  if (Option.isNone(task)) {
    return null;
  }
  const klass = yield* reader
    .table("classes")
    .get(task.value.classId)
    .pipe(Effect.orDie);
  const student = yield* reader
    .table("tenantPeople")
    .get(row.studentPersonId)
    .pipe(Effect.orDie);
  return { className: klass.name, student: student.name };
});

/** What a row shows of its source, each read when the row is read: its class detail, its sitting, and its grade. */
export const partsOf = Effect.fn("notifications.detail.parts")(function* (
  row: NotificationsDoc,
  person: TenantPeopleDoc,
  tenant: TenantsDoc
) {
  const detail = yield* detailOf(row, person, tenant);
  // Only a sitting row reads its sitting and only a grade row its grade, so every other row adds no work.
  const exam =
    row.changeType === "exam.starting" || row.changeType === "exam.reminder"
      ? yield* examOf(row)
      : null;
  const grade =
    row.changeType === "grade.released" ? yield* gradeOf(row) : null;
  const missed =
    row.changeType === "assignment.missed" ? yield* missedOf(row) : null;
  return { detail, exam, grade, missed };
});
