import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const { students } = refs.public.tenancy.people;

describe("tenancy/people students", () => {
  it.effect(
    "lists the active students of the school once each, and no teacher or Admin",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const listed = yield* fixture.as("admin").query(students, {
          paginationOpts: { cursor: null, numItems: 50 },
          slug: nf,
        });
        const ids = Arr.map(listed.page, (person) => person.id);
        expect(ids).toContain(fixture.people.student.personId);
        expect(ids).not.toContain(fixture.people.teacher.personId);
        expect(ids).not.toContain(fixture.people.admin.personId);
        expect(Arr.dedupe(ids)).toEqual(ids);
      })
  );
});
