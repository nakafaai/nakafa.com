import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { partsOf } from "@repo/backend/confect/notifications/detail";
import { moveTaskNotices } from "@repo/backend/confect/notifications/tasks";
import {
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { IBU } from "@repo/backend/test/guardians";
import {
  scheduledJobs,
  TENANCY_NOW,
  type tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Struct } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;
type TaskId = GenericId.GenericId<"classroomTasks">;
type PersonId = GenericId.GenericId<"tenantPeople">;

const tasks = refs.public.classroom.tasks;
const { run } = refs.internal.notifications.tasks;
const HOUR = Duration.toMillis(Duration.hours(1));
const DAY = Duration.toMillis(Duration.days(1));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** A class with the fixture's student placed in it, and one published task of it due at `deadline`. */
const published = Effect.fn("test.notifications.tasks")(function* (
  fixture: Fixture,
  deadline: number
) {
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, "X-1");
  const task = yield* fixture.as("teacher").mutation(tasks.publish, {
    classId: forum.classId,
    clientKey: "task-notices",
    deadline,
    latePolicy: "accept",
    points: 100,
    slug: nf,
    text: "Kerjakan soal 1 sampai 10.",
    title: "Latihan Gerak Lurus",
  });
  return { classId: forum.classId, taskId: task.id };
});

/** The stored task. */
const taskRow = (fixture: Fixture, taskId: TaskId) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("classroomTasks").get(taskId).pipe(Effect.orDie)
    )
  );

/** The inbox rows and the queued mail of one Person. */
const noticesOf = (fixture: Fixture, personId: PersonId) =>
  fixture.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const rows = yield* reader
        .table("notifications")
        .index("by_recipientPersonId_and_createdAt", (query) =>
          query.eq("recipientPersonId", personId)
        )
        .take(10);
      const mails = yield* reader
        .table("noticeMails")
        .index("by_recipientPersonId_and_dueAt", (query) =>
          query.eq("recipientPersonId", personId)
        )
        .take(10);
      return { mails, rows };
    }).pipe(Effect.orDie)
  );

/** A guardian of the fixture's student with a verified link, holding the given account. */
const guardianOf = (
  fixture: Fixture,
  account: "claimed" | "unclaimed",
  status: "active" | "removed" = "active"
) =>
  fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      const guardianPersonId = yield* writer.table("tenantPeople").insert({
        account:
          account === "claimed"
            ? {
                claimedAt: TENANCY_NOW,
                method: "invite",
                state: "claimed",
                userId: fixture.users.teacher.userId,
              }
            : { state: "unclaimed" },
        kind: "member",
        name: "Ibu Raka",
        status,
        tenantId: fixture.tenants.nf,
      });
      yield* writer.table("guardianLinks").insert({
        email: IBU,
        expiresAt: TENANCY_NOW + 1,
        guardianPersonId,
        mismatches: 0,
        startedBy: fixture.people.admin.personId,
        state: { at: TENANCY_NOW, status: "verified" },
        studentPersonId: fixture.people.student.personId,
        tenantId: fixture.tenants.nf,
      });
      return guardianPersonId;
    }).pipe(Effect.orDie)
  );

describe("notifications/tasks schedule", () => {
  it.effect(
    "keeps a run for each reminder and for the deadline, and moves them with the deadline",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const made = yield* published(fixture, TENANCY_NOW + 3 * DAY);
        const before = yield* taskRow(fixture, made.taskId);
        expect(before.jobs).toHaveLength(3);
        yield* fixture.as("teacher").mutation(tasks.edit, {
          classId: made.classId,
          deadline: TENANCY_NOW + 4 * DAY,
          latePolicy: "accept",
          points: 100,
          slug: nf,
          task: before.slug,
          text: "Kerjakan soal 1 sampai 10.",
          title: "Latihan Gerak Lurus",
        });
        const after = yield* taskRow(fixture, made.taskId);
        expect(after.jobs).toHaveLength(3);
        const jobs = yield* fixture.run(scheduledJobs);
        expect(
          Arr.filter(jobs, (job) => job.state.kind === "canceled").length
        ).toBe(3);
        yield* fixture.as("teacher").mutation(tasks.edit, {
          classId: made.classId,
          deadline: TENANCY_NOW + 4 * DAY,
          latePolicy: "close",
          points: 100,
          slug: nf,
          task: before.slug,
          text: "Kerjakan soal 1 sampai 10.",
          title: "Latihan Gerak Lurus",
        });
        expect((yield* taskRow(fixture, made.taskId)).jobs).toEqual(after.jobs);
      })
  );

  it.effect(
    "sends one reminder at once for the times already past, and nothing for a deadline past",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const close = yield* published(fixture, TENANCY_NOW + HOUR / 2);
        // The reminder at once and the deadline.
        expect((yield* taskRow(fixture, close.taskId)).jobs).toHaveLength(2);
        yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("classroomTasks").get(close.taskId)
          ).pipe(
            Effect.flatMap((task) =>
              moveTaskNotices(
                { ...task, deadline: TENANCY_NOW + 2 * HOUR },
                fixture.units.smp
              )
            ),
            Effect.tap((jobs) =>
              // The reminder at once, the one an hour before, and the deadline.
              Effect.sync(() => expect(jobs).toHaveLength(3))
            ),
            Effect.orDie
          )
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("classroomTasks").get(close.taskId)
          ).pipe(
            Effect.flatMap((task) =>
              moveTaskNotices(
                { ...Struct.omit(task, ["jobs"]), deadline: TENANCY_NOW - DAY },
                fixture.units.smp
              )
            ),
            Effect.tap((jobs) => Effect.sync(() => expect(jobs).toEqual([]))),
            Effect.orDie
          )
        );
      })
  );
});

describe("notifications/tasks run", () => {
  it.effect("reminds a student who has not handed in, and only them", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const made = yield* published(fixture, TENANCY_NOW + 3 * DAY);
      const student = fixture.people.student.personId;
      yield* fixture.internal.mutation(run, {
        cursor: null,
        notice: "taskDeadline",
        taskId: made.taskId,
      });
      const before = yield* noticesOf(fixture, student);
      expect(
        Arr.filter(
          before.rows,
          (row) => row.changeType === "assignment.deadline"
        )
      ).toMatchObject([
        {
          subject: { id: made.classId, kind: "class" },
          taskId: made.taskId,
        },
      ]);
      const task = yield* taskRow(fixture, made.taskId);
      yield* fixture.as("student").mutation(tasks.submit, {
        classId: made.classId,
        slug: nf,
        task: task.slug,
        text: "Sudah selesai.",
      });
      yield* fixture.internal.mutation(run, {
        cursor: null,
        notice: "taskDeadline",
        taskId: made.taskId,
      });
      const after = yield* noticesOf(fixture, student);
      expect(
        Arr.filter(
          after.rows,
          (row) => row.changeType === "assignment.deadline"
        )
      ).toHaveLength(1);
    })
  );

  it.effect(
    "tells each active guardian of a student who missed the deadline, and mails the one with an account",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const made = yield* published(fixture, TENANCY_NOW + 3 * DAY);
        const claimed = yield* guardianOf(fixture, "claimed");
        const unclaimed = yield* guardianOf(fixture, "unclaimed");
        const removed = yield* guardianOf(fixture, "unclaimed", "removed");
        yield* fixture.internal.mutation(run, {
          cursor: null,
          notice: "taskMissed",
          taskId: made.taskId,
        });
        const told = yield* noticesOf(fixture, claimed);
        expect(told.rows).toMatchObject([
          {
            changeType: "assignment.missed",
            studentPersonId: fixture.people.student.personId,
            taskId: made.taskId,
          },
        ]);
        expect(told.mails).toMatchObject([
          { change: "assignment.missed", rank: 1 },
        ]);
        const quiet = yield* noticesOf(fixture, unclaimed);
        expect(quiet.rows).toHaveLength(1);
        expect(quiet.mails).toEqual([]);
        expect((yield* noticesOf(fixture, removed)).rows).toEqual([]);
        const parts = yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const person = yield* reader.table("tenantPeople").get(claimed);
            const tenant = yield* reader
              .table("tenants")
              .get(fixture.tenants.nf);
            const seen = yield* partsOf(
              Arr.getUnsafe(told.rows, 0),
              person,
              tenant
            );
            yield* (yield* DatabaseWriter)
              .table("classroomTasks")
              .delete(made.taskId);
            const gone = yield* partsOf(
              Arr.getUnsafe(told.rows, 0),
              person,
              tenant
            );
            return { gone, seen };
          }).pipe(Effect.orDie)
        );
        expect(parts.seen.missed).toEqual({
          className: "Fisika X-1",
          student: expect.any(String),
        });
        expect(parts.gone.missed).toBeNull();
      })
  );

  it.effect(
    "writes nothing for a task that is gone, an archived unit, or a student who left",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const made = yield* published(fixture, TENANCY_NOW + 3 * DAY);
        const student = fixture.people.student.personId;
        const count = () =>
          Effect.map(
            noticesOf(fixture, student),
            (found) =>
              Arr.filter(
                found.rows,
                (row) => row.changeType === "assignment.deadline"
              ).length
          );
        const before = yield* count();
        const write = (taskId: TaskId) =>
          fixture.internal.mutation(run, {
            cursor: null,
            notice: "taskDeadline",
            taskId,
          });
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantUnits").patch(fixture.units.smp, {
              status: "archived",
            })
          ).pipe(Effect.orDie)
        );
        yield* write(made.taskId);
        expect(yield* count()).toBe(before);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            Effect.all([
              writer.table("tenantUnits").patch(fixture.units.smp, {
                status: "active",
              }),
              writer.table("tenantPeople").patch(student, {
                status: "removed",
              }),
            ])
          ).pipe(Effect.asVoid, Effect.orDie)
        );
        yield* write(made.taskId);
        expect(yield* count()).toBe(before);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("classroomTasks").delete(made.taskId)
          ).pipe(Effect.orDie)
        );
        yield* write(made.taskId);
        expect(yield* count()).toBe(before);
      })
  );

  it.effect("reads the class one page at a time", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const made = yield* published(fixture, TENANCY_NOW + 3 * DAY);
      const task = yield* taskRow(fixture, made.taskId);
      const klass = yield* fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          reader.table("classes").get(task.classId)
        ).pipe(Effect.orDie)
      );
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          Effect.forEach(
            Arr.range(1, 100),
            () =>
              writer
                .table("tenantPeople")
                .insert({
                  account: { state: "unclaimed" },
                  kind: "member",
                  name: "Murid",
                  status: "removed",
                  tenantId: fixture.tenants.nf,
                })
                .pipe(
                  Effect.flatMap((personId) =>
                    writer.table("tenantCohortMembers").insert({
                      cohortId: klass.cohortId,
                      periodId: klass.periodId,
                      personId,
                      tenantId: fixture.tenants.nf,
                    })
                  )
                ),
            { discard: true }
          )
        ).pipe(Effect.orDie)
      );
      const before = (yield* fixture.run(scheduledJobs)).length;
      yield* fixture.internal.mutation(run, {
        cursor: null,
        notice: "taskDeadline",
        taskId: made.taskId,
      });
      const after = yield* fixture.run(scheduledJobs);
      expect(after.length).toBe(before + 1);
    })
  );
});
