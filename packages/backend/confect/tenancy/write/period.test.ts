import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  archivePeriod,
  reactivatePeriod,
} from "@repo/backend/confect/tenancy/write/period";
import { journal, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const periods = refs.public.tenancy.periods;

type Fixture = Effect.Success<typeof tenancyFixture>;

/** Creates a planned period of the SMP unit as its Admin does. */
const create = (fixture: Fixture, name: string, start: string, end: string) =>
  fixture.as("admin").mutation(periods.create, {
    end,
    name,
    slug: nf,
    start,
    unitId: fixture.units.smp,
  });

/** The stored period, read as the system reads it. */
const readPeriod = (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("tenantPeriods").get(periodId)
    )
  );

describe("tenancy/write period", () => {
  it.effect(
    "archives only an active period, and journals the archive once",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* create(
          fixture,
          "Ganjil 2026/2027",
          "2026-07-13",
          "2026-12-19"
        );
        const actor = {
          id: fixture.people.admin.personId,
          kind: "person" as const,
        };
        const planned = yield* readPeriod(fixture, made.id);
        const refused = yield* fixture.run(
          archivePeriod(actor, planned).pipe(
            Effect.flip,
            Effect.map((error) => error._tag)
          )
        );
        expect(refused).toBe("PeriodNotActive");
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: made.id, slug: nf });
        const active = yield* readPeriod(fixture, made.id);
        const archived = yield* fixture.run(archivePeriod(actor, active));
        expect(archived.status).toBe("archived");
        expect(
          Arr.filter(
            yield* fixture.run(journal),
            (entry) => entry.change.type === "period.archived"
          )
        ).toMatchObject([{ subject: { id: made.id, kind: "period" } }]);
      })
  );

  it.effect(
    "reactivates an archived period only while no other period of its unit is active",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const first = yield* create(
          fixture,
          "Ganjil 2026/2027",
          "2026-07-13",
          "2026-12-19"
        );
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: first.id, slug: nf });
        yield* fixture
          .as("admin")
          .mutation(periods.archive, { periodId: first.id, slug: nf });
        const second = yield* create(
          fixture,
          "Genap 2026/2027",
          "2027-01-04",
          "2027-06-30"
        );
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: second.id, slug: nf });
        const archived = yield* readPeriod(fixture, first.id);
        const blocked = yield* fixture.run(
          reactivatePeriod(archived).pipe(
            Effect.flip,
            Effect.map((error) => error._tag)
          )
        );
        expect(blocked).toBe("PeriodActive");
        yield* fixture
          .as("admin")
          .mutation(periods.archive, { periodId: second.id, slug: nf });
        yield* fixture.run(reactivatePeriod(archived));
        expect((yield* readPeriod(fixture, first.id)).status).toBe("active");
      })
  );
});
