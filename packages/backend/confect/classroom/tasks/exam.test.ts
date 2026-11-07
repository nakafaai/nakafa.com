import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  openPeriod,
  period,
} from "@repo/backend/test/classroom";
import { examBy } from "@repo/backend/test/exams";
import { keyedExam } from "@repo/backend/test/sittings";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const tasks = refs.public.classroom.tasks;

/** A day, and the week a task that takes late work keeps its exam open past its deadline. */
const DAY = 86_400_000;
const WEEK = 7 * DAY;

/** A token holds at least one character that is no space. */
const WORD = /\S/u;

describe("classroom/tasks/exam", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "runs a task's exam for the class's cohort until its deadline, a week past it for late work, gives the class its token, and runs it once",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        yield* openPeriod(fixture, term.id);
        const examId = yield* keyedExam(fixture, "Ulangan Bab 1");
        const args = { classId: forum.classId, slug: nf };
        const publish = (clientKey: string, latePolicy: "accept" | "close") =>
          fixture.as("teacher").mutation(tasks.publish, {
            ...args,
            category: null,
            clientKey,
            deadline: TENANCY_NOW + DAY,
            examId,
            latePolicy,
            points: 100,
            targets: null,
            text: "Kerjakan di pemutar ujian.",
            title: "Ulangan",
          });
        const task = yield* publish("exam-task", "close");
        expect(task.exam).toMatchObject({ examId });
        // A repeat of the client key answers the task as it stands and schedules nothing more.
        expect(yield* publish("exam-task", "close")).toEqual(task);
        const late = yield* publish("exam-late", "accept");
        // A task with a written answer runs no exam.
        const written = yield* fixture.as("teacher").mutation(tasks.publish, {
          ...args,
          category: null,
          clientKey: "written-task",
          deadline: TENANCY_NOW + DAY,
          examId: null,
          latePolicy: "close",
          points: 10,
          targets: null,
          text: "Tulis ringkasan.",
          title: "Ringkasan",
        });
        expect(written.exam).toBeNull();
        const stored = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            Effect.all([
              reader.table("classes").get(forum.classId),
              reader.table("examSittings").index("by_creation_time").take(10),
            ])
          )
        );
        const [klass, runs] = stored;
        expect(
          Arr.map(runs, (run) => ({
            closesAt: run.closesAt,
            cohortId: run.cohortId,
            examId: run.examId,
            id: run._id,
          }))
        ).toEqual([
          {
            closesAt: TENANCY_NOW + DAY,
            cohortId: klass.cohortId,
            examId,
            id: task.exam?.sittingId,
          },
          {
            closesAt: TENANCY_NOW + DAY + WEEK,
            cohortId: klass.cohortId,
            examId,
            id: late.exam?.sittingId,
          },
        ]);
        // The student reads the run and its token, which the exam player enters with.
        const read = yield* fixture
          .as("student")
          .query(tasks.get, { ...args, task: task.slug });
        expect(read.exam).toEqual(task.exam);
        expect(read.exam?.token).toMatch(WORD);
      })
  );

  it.effect(
    "refuses an exam whose questions are not ready, and publishes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-2");
        yield* openPeriod(fixture, term.id);
        const draft = yield* examBy(fixture, "teacher", "Belum siap");
        const args = { classId: forum.classId, slug: nf };
        const refused = yield* fixture
          .as("teacher")
          .mutation(tasks.publish, {
            ...args,
            category: null,
            clientKey: "unready-task",
            deadline: TENANCY_NOW + DAY,
            examId: draft.id,
            latePolicy: "close",
            points: 100,
            targets: null,
            text: "Belum ada soal.",
            title: "Kosong",
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "QuestionsUnready" });
        const listed = yield* fixture
          .as("teacher")
          .query(tasks.list, { ...args, ...firstPage });
        expect(listed.page).toEqual([]);
      })
  );
});
