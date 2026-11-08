import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { classOf, openPeriod, period } from "@repo/backend/test/classroom";
import { cohortOf } from "@repo/backend/test/records";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const nf = slugOf("nf");
const { overview, remove } = refs.public.tenancy.cohorts;
const classes = refs.public.classroom.classes;

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
