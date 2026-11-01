import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { Array as Arr, Effect } from "effect";

const { list } = refs.public.classroom.people;

describe("classroom/people", () => {
  it.effect(
    "lists a class's teachers first and its students after, to whoever views the class",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        const args = { classId: forum.classId, slug: nf };
        const listed = yield* fixture.as("student").query(list, args);
        expect(Arr.map(listed, (person) => [person.id, person.kind])).toEqual([
          [fixture.people.teacher.personId, "teacher"],
          [fixture.people.student.personId, "student"],
        ]);
      })
  );

  it.effect(
    "gives a Person's address and whether they joined to who keeps the class, never to a classmate",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-3");
        const args = { classId: forum.classId, slug: nf };
        const kept = yield* fixture.as("teacher").query(list, args);
        expect(Arr.map(kept, (person) => person.joined)).toEqual([true, true]);
        expect(
          Arr.every(kept, (person) => person.email?.includes("@") === true)
        ).toBe(true);
        const seen = yield* fixture.as("student").query(list, args);
        expect(Arr.map(seen, (person) => person.email)).toEqual([null, null]);
      })
  );

  it.effect("refuses a student of another class of the school", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const forum = yield* forumClass(fixture, term.id, "X-2", false);
      const refused = yield* fixture
        .as("student")
        .query(list, { classId: forum.classId, slug: nf })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "AccessDenied" });
    })
  );
});
