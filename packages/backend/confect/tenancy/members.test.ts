import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  foreignCohort,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const nf = slugOf("nf");
const { create, members } = refs.public.tenancy.cohorts;
const periods = refs.public.tenancy.periods;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

type Fixture = Effect.Success<typeof tenancyFixture>;

/** Creates the SMA period of the fixture as its Admin, planned, and returns the period the mutation made. */
const sma = (fixture: Fixture) =>
  fixture.as("admin").mutation(periods.create, {
    end: "2026-12-19",
    name: "Ganjil 2026/2027",
    slug: nf,
    start: "2026-07-13",
    unitId: fixture.units.sma,
  });

/** Creates one cohort of a period as the school's Admin. */
const cohort = (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">,
  name: string,
  grade: number
) => fixture.as("admin").mutation(create, { grade, name, periodId, slug: nf });

/** The cohort members reader, `cohorts:members`, which pages the placements of one cohort. */
describe("tenancy/cohorts members", () => {
  it.effect(
    "lets an Admin read a cohort's members, and refuses a Person placed nowhere in it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const made = yield* cohort(fixture, period.id, "7A", 7);
        const outsider = yield* fixture
          .as("student")
          .query(members, { ...firstPage, cohortId: made.id, slug: nf })
          .pipe(Effect.flip);
        expect(outsider).toMatchObject(denied("role"));
        const memberList = yield* fixture
          .as("admin")
          .query(members, { ...firstPage, cohortId: made.id, slug: nf });
        expect(memberList.page).toEqual([]);
      })
  );

  it.effect(
    "refuses a cohort's members to a reader who may list people but not view the cohort",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const made = yield* cohort(fixture, period.id, "7A", 7);
        const refused = yield* fixture
          .as("counselor")
          .query(members, { ...firstPage, cohortId: made.id, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("role"));
      })
  );

  it.effect("refuses the members of a cohort of another school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const foreign = yield* foreignCohort(fixture);
      const refused = yield* fixture
        .as("admin")
        .query(members, { ...firstPage, cohortId: foreign.id, slug: nf })
        .pipe(Effect.flip);
      expect(refused).toMatchObject(denied("resource"));
    })
  );
});
