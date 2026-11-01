import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { isSchoolRow } from "@repo/backend/confect/notifications/schema";
import {
  denied,
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { edit, get, list, publish, submit } = refs.public.classroom.tasks;

/** How many notices the inbox holds for a Person. */
const noticesOf = (personId: string) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader
      .table("notifications")
      .index("by_creation_time")
      .take(50)
      .pipe(
        Effect.map(
          (rows) =>
            Arr.filter(
              Arr.filter(rows, isSchoolRow),
              (row) => row.recipientPersonId === personId
            ).length
        )
      )
  );

/** A class whose student is placed in it, a teacher's task for the whole class, and the draft of another. */
const taught = Effect.gen(function* () {
  const fixture = yield* keyedFixture;
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, "X-1");
  const scope = { classId: forum.classId, slug: nf };
  const draft = {
    ...scope,
    deadline: TENANCY_NOW + 86_400_000,
    category: null,
    latePolicy: "accept" as const,
    points: 100,
    text: "Kerjakan soal remedial.",
    title: "Remedial",
  };
  const teacher = fixture.as("teacher");
  const whole = yield* teacher.mutation(publish, {
    ...draft,
    clientKey: "whole-class",
    targets: null,
    title: "Semua",
  });
  const settle = Effect.promise(() =>
    fixture.convex.finishAllScheduledFunctions(vi.runAllTimers)
  );
  return { draft, fixture, forum, scope, settle, teacher, term, whole };
});

describe("classroom/tasks write", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "shows a task for part of the class to its students alone, and every task to its teacher",
    () =>
      Effect.gen(function* () {
        const { draft, fixture, scope, teacher, whole } = yield* taught;
        const student = fixture.as("student");
        const self = fixture.people.student.personId;
        const named = yield* teacher.mutation(publish, {
          ...draft,
          clientKey: "for-the-student",
          targets: [self],
        });
        expect(named.targets).toEqual([self]);
        expect(whole.targets).toBeNull();

        const titles = (role: "student" | "teacher") =>
          fixture
            .as(role)
            .query(list, { ...firstPage, ...scope })
            .pipe(Effect.map(({ page }) => Arr.map(page, (it) => it.title)));
        expect(yield* titles("student")).toHaveLength(2);

        yield* teacher.mutation(edit, {
          ...scope,
          deadline: draft.deadline,
          category: null,
          latePolicy: "accept",
          points: 100,
          targets: [fixture.people.teacher.personId],
          task: named.slug,
          text: draft.text,
          title: draft.title,
        });
        // The student is out of the task now, so it reads as missing to them.
        expect(yield* titles("student")).toEqual(["Semua"]);
        expect(yield* titles("teacher")).toHaveLength(2);
        const task = { ...scope, task: named.slug };
        const refusals = yield* Effect.all([
          student.query(get, task).pipe(Effect.flip),
          student
            .mutation(submit, { ...task, text: "Jawaban" })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          denied("resource"),
          denied("resource"),
        ]);
        expect(yield* teacher.query(get, task)).toMatchObject({
          title: "Remedial",
        });

        // Back to the whole class, it reaches the student again.
        yield* teacher.mutation(edit, {
          ...scope,
          deadline: draft.deadline,
          category: null,
          latePolicy: "accept",
          points: 100,
          targets: null,
          task: named.slug,
          text: draft.text,
          title: draft.title,
        });
        expect(yield* student.query(get, task)).toMatchObject({
          targets: null,
        });
      })
  );

  it.effect("refuses a Person who does not learn in the class", () =>
    Effect.gen(function* () {
      const { draft, fixture, teacher, term } = yield* taught;
      const other = yield* forumClass(fixture, term.id, "X-2", false);
      expect(
        yield* teacher
          .mutation(publish, {
            ...draft,
            classId: other.classId,
            clientKey: "wrong-students",
            targets: [fixture.people.student.personId],
          })
          .pipe(Effect.flip)
      ).toMatchObject(denied("resource"));
    })
  );

  it.effect("tells only the students a task names", () =>
    Effect.gen(function* () {
      const { draft, fixture, settle, teacher } = yield* taught;
      yield* settle;
      const student = fixture.people.student.personId;
      const before = yield* fixture.run(noticesOf(student));
      // Settling runs the clock up to the last deadline, so each task is due after the one before it.
      yield* teacher.mutation(publish, {
        ...draft,
        clientKey: "for-a-teacher",
        deadline: TENANCY_NOW + 30 * 86_400_000,
        targets: [fixture.people.teacher.personId],
      });
      yield* settle;
      expect(yield* fixture.run(noticesOf(student))).toBe(before);
      yield* teacher.mutation(publish, {
        ...draft,
        clientKey: "for-the-student",
        deadline: TENANCY_NOW + 60 * 86_400_000,
        targets: [student],
      });
      yield* settle;
      expect(yield* fixture.run(noticesOf(student))).toBeGreaterThan(before);
    })
  );

  it.effect("tells no student of a task whose deadline has passed", () =>
    Effect.gen(function* () {
      const { draft, fixture, settle, teacher } = yield* taught;
      yield* settle;
      const student = fixture.people.student.personId;
      const before = yield* fixture.run(noticesOf(student));
      yield* teacher.mutation(publish, {
        ...draft,
        clientKey: "last-term",
        deadline: TENANCY_NOW - 1,
        targets: null,
      });
      yield* settle;
      expect(yield* fixture.run(noticesOf(student))).toBe(before);
    })
  );

  it.effect("files a task under a category, and takes it out again", () =>
    Effect.gen(function* () {
      const { draft, scope, teacher } = yield* taught;
      const filed = yield* teacher.mutation(publish, {
        ...draft,
        category: "Remedial",
        clientKey: "filed-task",
        targets: null,
      });
      expect(filed.category).toBe("Remedial");
      const edited = {
        ...scope,
        deadline: draft.deadline,
        latePolicy: "accept" as const,
        points: 100,
        targets: null,
        task: filed.slug,
        text: draft.text,
        title: draft.title,
      };
      const moved = yield* teacher.mutation(edit, {
        ...edited,
        category: "Latihan",
      });
      expect(moved.category).toBe("Latihan");
      const cleared = yield* teacher.mutation(edit, {
        ...edited,
        category: null,
      });
      expect(cleared.category).toBeNull();
    })
  );
});
