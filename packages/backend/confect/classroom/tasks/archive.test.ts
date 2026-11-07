import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  denied,
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { schoolViews } from "@repo/backend/test/inbox";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const tasks = refs.public.classroom.tasks;
const inbox = refs.public.notifications.inbox;
const { run } = refs.internal.notifications.tasks;

/** A day in milliseconds. */
const DAY = 86_400_000;

describe("classroom/tasks/archive", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "archives a task out of the class and its students, sends no reminder for it, restores it whole, and refuses a student",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-6");
        const args = { classId: forum.classId, slug: nf };
        const teacher = fixture.as("teacher");
        const student = fixture.as("student");
        const task = yield* teacher.mutation(tasks.publish, {
          ...args,
          category: null,
          clientKey: "archived-task",
          deadline: TENANCY_NOW + DAY,
          examId: null,
          latePolicy: "accept",
          points: 10,
          targets: null,
          text: "Rangkum bab tiga.",
          title: "Rangkuman",
        });
        const slugs = (reader: typeof teacher, archived: boolean | undefined) =>
          Effect.map(
            reader.query(tasks.list, {
              ...args,
              ...firstPage,
              ...(archived === undefined ? {} : { archived }),
            }),
            (listed) => Arr.map(listed.page, (row) => [row.slug, row.archived])
          );

        const refused = yield* student
          .mutation(tasks.archive, { ...args, task: task.slug })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("role"));

        expect(
          yield* teacher.mutation(tasks.archive, { ...args, task: task.slug })
        ).toBeNull();
        expect(yield* slugs(teacher, undefined)).toEqual([]);
        expect(yield* slugs(teacher, true)).toEqual([["rangkuman", true]]);
        // A student finds an archived task nowhere: not listed, and missing by its address.
        expect(yield* slugs(student, true)).toEqual([]);
        const hidden = yield* student
          .query(tasks.get, { ...args, task: task.slug })
          .pipe(Effect.flip);
        expect(hidden).toMatchObject(denied("resource"));
        // Its deadline reminder sends nothing while it is archived.
        yield* fixture.internal.mutation(run, {
          cursor: null,
          notice: "taskDeadline",
          taskId: task.id,
        });
        const rows = yield* student.query(inbox.list, firstPage);
        expect(
          Arr.filter(
            schoolViews(rows.page),
            (row) => row.changeType === "assignment.deadline"
          )
        ).toEqual([]);

        expect(
          yield* teacher.mutation(tasks.restore, { ...args, task: task.slug })
        ).toBeNull();
        expect(yield* slugs(student, false)).toEqual([["rangkuman", false]]);
      })
  );
});
