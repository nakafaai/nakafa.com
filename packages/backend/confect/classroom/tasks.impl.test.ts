import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  denied,
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { journal, TENANCY_NOW } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect } from "effect";

const tasks = refs.public.classroom.tasks;
const inbox = refs.public.notifications.inbox;

/** A day in milliseconds. */
const DAY = 86_400_000;

describe("classroom/tasks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "publishes sealed tasks under the free address of their title, lists them by deadline, and tells the class",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        const teacher = fixture.as("teacher");
        const publish = (clientKey: string, title: string, deadline: number) =>
          teacher.mutation(tasks.publish, {
            classId: forum.classId,
            clientKey,
            deadline,
            latePolicy: "accept",
            points: 100,
            slug: nf,
            text: "Kerjakan soal 1 sampai 10.",
            title,
          });
        const first = yield* publish("first-task", "Latihan Gerak Lurus", TENANCY_NOW + 2 * DAY);
        const second = yield* publish("second-task", "Latihan Gerak Lurus", TENANCY_NOW + DAY);
        const symbols = yield* publish("third-task", "!!!", TENANCY_NOW + 3 * DAY);
        expect(yield* publish("first-task", "Latihan Gerak Lurus", 0)).toEqual(first);
        expect([first.slug, second.slug, symbols.slug]).toEqual([
          "latihan-gerak-lurus",
          "latihan-gerak-lurus-2",
          "tugas",
        ]);
        const listed = yield* fixture
          .as("student")
          .query(tasks.list, { ...firstPage, classId: forum.classId, slug: nf });
        expect(Arr.map(listed.page, (task) => task.slug)).toEqual([
          "latihan-gerak-lurus-2",
          "latihan-gerak-lurus",
          "tugas",
        ]);
        expect(listed.page[0]).toMatchObject({
          handedIn: 0,
          mine: null,
          text: "Kerjakan soal 1 sampai 10.",
        });
        const stored = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("classroomTasks").get(first.id)
          )
        );
        expect(encodeJsonText(stored.sealedText)).not.toContain("Kerjakan");
        const entries = yield* fixture.run(journal);
        expect(
          Arr.filter(entries, (entry) =>
            encodeJsonText(entry).includes("assignment.published")
          )
        ).toHaveLength(3);
        yield* fixture.finishScheduled();
        const rows = yield* fixture.as("student").query(inbox.list, firstPage);
        expect(Arr.map(rows.page, (row) => row.detail?.task)).toEqual([
          "tugas",
          "latihan-gerak-lurus-2",
          "latihan-gerak-lurus",
        ]);
      })
  );

  it.effect(
    "takes a student's work, again until the deadline, marks late work, refuses work for a closed task, and lets the teacher score it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-2");
        const teacher = fixture.as("teacher");
        const student = fixture.as("student");
        yield* teacher.mutation(tasks.publish, {
          classId: forum.classId,
          clientKey: "open-task",
          deadline: TENANCY_NOW + DAY,
          latePolicy: "accept",
          points: 50,
          slug: nf,
          text: "Tulis ringkasan.",
          title: "Ringkasan",
        });
        yield* teacher.mutation(tasks.publish, {
          classId: forum.classId,
          clientKey: "closed-task",
          deadline: TENANCY_NOW + DAY,
          latePolicy: "close",
          points: 10,
          slug: nf,
          text: "Kumpulkan sebelum besok.",
          title: "Tertutup",
        });
        const handed = yield* student.mutation(tasks.submit, {
          classId: forum.classId,
          slug: nf,
          task: "ringkasan",
          text: "Ringkasan pertama.",
        });
        expect(handed).toMatchObject({ handedIn: 1, mine: { late: false } });
        vi.setSystemTime(TENANCY_NOW + 2 * DAY);
        const again = yield* student.mutation(tasks.submit, {
          classId: forum.classId,
          slug: nf,
          task: "ringkasan",
          text: "Ringkasan kedua.",
        });
        expect(again).toMatchObject({ handedIn: 1, mine: { late: true } });
        const closed = yield* student
          .mutation(tasks.submit, {
            classId: forum.classId,
            slug: nf,
            task: "tertutup",
            text: "Terlambat.",
          })
          .pipe(Effect.flip);
        expect(closed._tag).toBe("TaskClosed");
        const work = yield* teacher.query(tasks.submissions, {
          ...firstPage,
          classId: forum.classId,
          slug: nf,
          task: "ringkasan",
        });
        expect(work.page).toEqual([
          expect.objectContaining({
            late: true,
            person: { id: fixture.people.student.personId, name: "Student" },
            score: null,
            text: "Ringkasan kedua.",
          }),
        ]);
        const submissionId = Arr.getUnsafe(work.page, 0).id;
        const scored = yield* teacher.mutation(tasks.score, {
          classId: forum.classId,
          points: 45,
          slug: nf,
          submissionId,
        });
        expect(scored.score).toBe(45);
        const tooMany = yield* teacher
          .mutation(tasks.score, {
            classId: forum.classId,
            points: 51,
            slug: nf,
            submissionId,
          })
          .pipe(Effect.flip);
        expect(tooMany._tag).toBe("ScoreOutOfRange");
        const mine = yield* student.query(tasks.get, {
          classId: forum.classId,
          slug: nf,
          task: "ringkasan",
        });
        expect(mine.mine).toMatchObject({ late: true, score: 45 });
        const moved = yield* teacher.mutation(tasks.reschedule, {
          classId: forum.classId,
          deadline: TENANCY_NOW + 5 * DAY,
          slug: nf,
          task: "tertutup",
        });
        expect(moved.deadline).toBe(TENANCY_NOW + 5 * DAY);
      })
  );

  it.effect(
    "refuses a student's publish, a teacher's work, and a task or work of another class",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-3");
        const other = yield* forumClass(fixture, term.id, "X-4", false);
        const teacher = fixture.as("teacher");
        yield* teacher.mutation(tasks.publish, {
          classId: other.classId,
          clientKey: "other-task",
          deadline: TENANCY_NOW + DAY,
          latePolicy: "accept",
          points: 10,
          slug: nf,
          text: "Kelas lain.",
          title: "Lain",
        });
        const refusals = yield* Effect.all([
          fixture
            .as("student")
            .mutation(tasks.publish, {
              classId: forum.classId,
              clientKey: "student-task",
              deadline: TENANCY_NOW + DAY,
              latePolicy: "accept",
              points: 10,
              slug: nf,
              text: "Bukan guru.",
              title: "Murid",
            })
            .pipe(Effect.flip),
          teacher
            .mutation(tasks.submit, {
              classId: other.classId,
              slug: nf,
              task: "lain",
              text: "Guru tidak mengumpulkan.",
            })
            .pipe(Effect.flip),
          teacher
            .query(tasks.get, { classId: forum.classId, slug: nf, task: "lain" })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          denied("role"),
          denied("role"),
          denied("resource"),
        ]);
        // Work of one class is refused under another class the teacher also teaches.
        yield* teacher.mutation(tasks.publish, {
          classId: forum.classId,
          clientKey: "own-task",
          deadline: TENANCY_NOW + DAY,
          latePolicy: "accept",
          points: 10,
          slug: nf,
          text: "Kelas sendiri.",
          title: "Sendiri",
        });
        yield* fixture.as("student").mutation(tasks.submit, {
          classId: forum.classId,
          slug: nf,
          task: "sendiri",
          text: "Jawaban.",
        });
        const work = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader
              .table("classroomSubmissions")
              .index("by_taskId_and_personId")
              .take(1)
          )
        );
        const foreign = yield* teacher
          .mutation(tasks.score, {
            classId: other.classId,
            points: 1,
            slug: nf,
            submissionId: Arr.getUnsafe(work, 0)._id,
          })
          .pipe(Effect.flip);
        expect(foreign).toMatchObject(denied("resource"));
      })
  );
});
