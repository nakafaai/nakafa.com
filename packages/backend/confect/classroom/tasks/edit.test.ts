import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  denied,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { journal, TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const tasks = refs.public.classroom.tasks;

/** A day in milliseconds. */
const DAY = 86_400_000;

/** The task the tests publish, as its teacher wrote it first. */
const DRAFT = {
  deadline: TENANCY_NOW + DAY,
  latePolicy: "accept",
  points: 100,
  text: "Kerjakan soal 1 sampai 10.",
  title: "Latihan Gerak Lurus",
} as const;

describe("classroom/tasks edit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "edits every field of a task under its own address, records a moved deadline and a content change apart, and fixes its points once work is handed in",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        const teacher = fixture.as("teacher");
        const classArgs = { classId: forum.classId, slug: nf };
        const published = yield* teacher.mutation(tasks.publish, {
          targets: null,
          ...classArgs,
          ...DRAFT,
          clientKey: "edit-task",
        });
        const edited = yield* teacher.mutation(tasks.edit, {
          targets: null,
          ...classArgs,
          deadline: TENANCY_NOW + 3 * DAY,
          latePolicy: "close",
          points: 50,
          task: published.slug,
          text: "Kerjakan soal 1 sampai 5.",
          title: "Latihan Gerak Lurus Berubah Beraturan",
        });
        expect(edited).toMatchObject({
          deadline: TENANCY_NOW + 3 * DAY,
          id: published.id,
          latePolicy: "close",
          points: 50,
          slug: published.slug,
          text: "Kerjakan soal 1 sampai 5.",
          title: "Latihan Gerak Lurus Berubah Beraturan",
        });
        expect(
          yield* fixture
            .as("student")
            .query(tasks.get, { ...classArgs, task: published.slug })
        ).toMatchObject({ text: "Kerjakan soal 1 sampai 5." });
        // The same fields again change nothing, so nothing more is recorded.
        yield* teacher.mutation(tasks.edit, {
          targets: null,
          ...classArgs,
          deadline: TENANCY_NOW + 3 * DAY,
          latePolicy: "close",
          points: 50,
          task: published.slug,
          text: "Kerjakan soal 1 sampai 5.",
          title: "Latihan Gerak Lurus Berubah Beraturan",
        });
        expect(
          Arr.filter(
            Arr.map(yield* fixture.run(journal), (entry) => entry.change.type),
            (type) =>
              type === "assignment.deadlineChanged" ||
              type === "assignment.edited"
          )
        ).toEqual(["assignment.deadlineChanged", "assignment.edited"]);

        yield* fixture.as("student").mutation(tasks.submit, {
          ...classArgs,
          task: published.slug,
          text: "Jawaban saya.",
        });
        const fixed = yield* teacher
          .mutation(tasks.edit, {
            targets: null,
            ...classArgs,
            deadline: TENANCY_NOW + 3 * DAY,
            latePolicy: "close",
            points: 80,
            task: published.slug,
            text: "Kerjakan soal 1 sampai 5.",
            title: "Latihan Gerak Lurus Berubah Beraturan",
          })
          .pipe(Effect.flip);
        const student = yield* fixture
          .as("student")
          .mutation(tasks.edit, {
            targets: null,
            ...classArgs,
            ...DRAFT,
            task: published.slug,
          })
          .pipe(Effect.flip);
        const missing = yield* teacher
          .mutation(tasks.edit, {
            targets: null,
            ...classArgs,
            ...DRAFT,
            task: "tidak-ada",
          })
          .pipe(Effect.flip);
        expect([fixed, student, missing]).toMatchObject([
          { _tag: "TaskPointsFixed" },
          denied("role"),
          denied("resource"),
        ]);
      })
  );
});
