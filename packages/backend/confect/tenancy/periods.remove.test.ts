import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { journal, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const nf = slugOf("nf");
const { archive, create, list, open, remove } = refs.public.tenancy.periods;
const cohorts = refs.public.tenancy.cohorts;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const missingPeriod = Schema.decodeUnknownSync(Id("tenantPeriods"))(
  "000000000000000099999tenantPeriods"
);

type Fixture = Effect.Success<typeof tenancyFixture>;

/** Creates one planned SMA period as the school's Admin, by its name and its dates. */
const term = (fixture: Fixture, name: string, start: string, end: string) =>
  fixture.as("admin").mutation(create, {
    end,
    name,
    slug: nf,
    start,
    unitId: fixture.units.sma,
  });

/** The names of the SMA unit's periods, as its list reads them. */
const namesOf = (fixture: Fixture) =>
  Effect.map(
    fixture.as("admin").query(list, {
      paginationOpts: { cursor: null, numItems: 10 },
      slug: nf,
      unitId: fixture.units.sma,
    }),
    (page) => Arr.map(page.page, (period) => period.name)
  );

describe("tenancy/periods remove", () => {
  it.effect(
    "deletes a planned and an archived period that hold nothing, and journals each deletion",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const planned = yield* term(
          fixture,
          "Ganjil 2026/2027",
          "2026-07-13",
          "2026-12-19"
        );
        const past = yield* term(
          fixture,
          "Genap 2025/2026",
          "2026-01-05",
          "2026-06-26"
        );
        yield* fixture
          .as("admin")
          .mutation(open, { periodId: past.id, slug: nf });
        yield* fixture
          .as("admin")
          .mutation(archive, { periodId: past.id, slug: nf });
        yield* fixture
          .as("admin")
          .mutation(remove, { periodId: planned.id, slug: nf });
        yield* fixture
          .as("admin")
          .mutation(remove, { periodId: past.id, slug: nf });
        expect(yield* namesOf(fixture)).toEqual([]);
        const entries = yield* fixture.run(journal);
        expect(
          Arr.filter(entries, (entry) => entry.change.type === "period.removed")
        ).toMatchObject([
          { subject: { id: planned.id } },
          { subject: { id: past.id } },
        ]);
      })
  );

  it.effect(
    "refuses the active period and a period that holds a cohort, names why, and keeps both",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const active = yield* term(
          fixture,
          "Ganjil 2026/2027",
          "2026-07-13",
          "2026-12-19"
        );
        yield* fixture
          .as("admin")
          .mutation(open, { periodId: active.id, slug: nf });
        const held = yield* term(
          fixture,
          "Genap 2026/2027",
          "2027-01-04",
          "2027-06-30"
        );
        yield* fixture.as("admin").mutation(cohorts.create, {
          grade: 10,
          name: "X-1",
          periodId: held.id,
          slug: nf,
        });
        const refusals = yield* Effect.forEach([active, held], (period) =>
          fixture
            .as("admin")
            .mutation(remove, { periodId: period.id, slug: nf })
            .pipe(Effect.flip)
        );
        expect(refusals).toMatchObject([
          { _tag: "PeriodInUse", code: "PERIOD_IN_USE", holds: "active" },
          { _tag: "PeriodInUse", code: "PERIOD_IN_USE", holds: "cohorts" },
        ]);
        expect(yield* namesOf(fixture)).toEqual([
          "Genap 2026/2027",
          "Ganjil 2026/2027",
        ]);
      })
  );

  it.effect(
    "refuses a period of another school, and one that does not exist, as a resource",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const foreign = yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantPeriods").insert({
              end: "2026-12-19",
              name: "Ganjil lain",
              start: "2026-07-13",
              status: "planned",
              tenantId: fixture.tenants.other,
              unitId: fixture.units.sd,
            })
          )
        );
        const refusals = yield* Effect.forEach(
          [foreign, missingPeriod],
          (periodId) =>
            fixture
              .as("admin")
              .mutation(remove, { periodId, slug: nf })
              .pipe(Effect.flip)
        );
        expect(refusals).toMatchObject([
          denied("resource"),
          denied("resource"),
        ]);
      })
  );
});
