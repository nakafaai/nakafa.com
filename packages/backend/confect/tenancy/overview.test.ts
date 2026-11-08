import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { classOf, openPeriod, period } from "@repo/backend/test/classroom";
import { cohortOf } from "@repo/backend/test/records";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const nf = slugOf("nf");
const { members, overview, remove } = refs.public.tenancy.cohorts;
const assignments = refs.public.tenancy.assignments;
const classes = refs.public.classroom.classes;
const periods = refs.public.tenancy.periods;
const placements = refs.public.tenancy.placements;

describe("tenancy/cohorts overview holds", () => {
  it.effect(
    "counts an archived class and names it as the hold, so the list offers no delete the server refuses",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        yield* openPeriod(fixture, term.id);
        const made = yield* cohortOf(fixture, term.id, "7A", 7);
        const read = fixture
          .as("admin")
          .query(overview, { periodId: term.id, slug: nf });
        expect(yield* read).toMatchObject([{ classes: 0, hold: null }]);
        const taught = yield* classOf(fixture, made.id, "Matematika");
        yield* fixture
          .as("admin")
          .mutation(classes.archive, { classId: taught.id, slug: nf });
        expect(yield* read).toMatchObject([{ classes: 1, hold: "classes" }]);
        expect(
          yield* fixture
            .as("admin")
            .mutation(remove, { cohortId: made.id, slug: nf })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "CohortInUse", holds: "classes" });
      })
  );
});

describe("tenancy/cohorts overview", () => {
  it.effect(
    "counts a cohort's students and classes, and names its homeroom teacher once it has one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* fixture.as("admin").mutation(periods.create, {
          end: "2026-12-19",
          name: "Ganjil 2026/2027",
          slug: nf,
          start: "2026-07-13",
          unitId: fixture.units.smp,
        });
        const made = yield* cohortOf(fixture, term.id, "7A", 7);
        const read = fixture
          .as("admin")
          .query(overview, { periodId: term.id, slug: nf });
        expect(yield* read).toEqual([
          {
            classes: 0,
            hold: null,
            homeroom: null,
            id: made.id,
            name: "7A",
            students: 0,
          },
        ]);
        yield* fixture.as("admin").mutation(assignments.assign, {
          cohortId: made.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: made.id,
          personId: fixture.people.student.personId,
          slug: nf,
        });
        expect(yield* read).toMatchObject([
          { hold: "members", homeroom: expect.any(String), students: 1 },
        ]);
        const placed = fixture.as("admin").query(members, {
          cohortId: made.id,
          paginationOpts: { cursor: null, numItems: 10 },
          slug: nf,
        });
        expect((yield* placed).page).toMatchObject([{ login: null }]);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("schoolLogins").insert({
              name: "siswa-7a",
              personId: fixture.people.student.personId,
              tenantId: fixture.tenants.nf,
            })
          )
        );
        expect((yield* placed).page).toMatchObject([{ login: "siswa-7a" }]);
      })
  );
});
