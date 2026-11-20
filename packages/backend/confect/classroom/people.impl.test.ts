import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  forumClass,
  keyedFixture,
  nf,
  period,
  teach,
} from "@repo/backend/test/classroom";
import { grantRole } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Order } from "effect";

const { list } = refs.public.classroom.people;

describe("classroom/people", () => {
  it.effect(
    "lists a class's teachers first and its students after, to whoever views the class",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        // A second teacher, so the teachers are ordered by name among themselves.
        const { principal } = fixture.people;
        yield* fixture.run(
          grantRole(fixture.tenants.nf, principal.personId, "teacher", {
            kind: "unit",
            unitId: fixture.units.smp,
          })
        );
        yield* teach(fixture, forum.classId, principal.personId);
        const args = { classId: forum.classId, slug: nf };
        const listed = yield* fixture.as("student").query(list, args);
        expect(Arr.map(listed, (person) => person.kind)).toEqual([
          "teacher",
          "teacher",
          "student",
        ]);
        const teachers = Arr.map(Arr.take(listed, 2), (person) => person.name);
        expect(teachers).toEqual(Arr.sort(teachers, Order.String));
        expect(Arr.map(listed, (person) => person.id)).toContain(
          fixture.people.student.personId
        );
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
