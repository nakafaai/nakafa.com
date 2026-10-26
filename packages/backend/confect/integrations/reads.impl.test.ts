import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createClient } from "@repo/backend/test/api";
import { cohort, nf, period } from "@repo/backend/test/classroom";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const reads = refs.internal.integrations.reads;

describe("integrations/reads", () => {
  it.effect(
    "reads the periods, cohorts, people, and placements of the client's school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        yield* fixture
          .as("admin")
          .mutation(refs.public.tenancy.placements.place, {
            cohortId: x1.id,
            personId: fixture.people.student.personId,
            slug: nf,
          });
        const client = yield* createClient(fixture);
        const periods = yield* fixture.internal.query(reads.periods, {
          clientId: client.id,
        });
        expect(periods).toMatchObject({
          data: [{ id: term.id, unitId: fixture.units.smp }],
          next: null,
          outcome: "page",
        });
        const cohorts = yield* fixture.internal.query(reads.cohorts, {
          clientId: client.id,
          cursor: null,
          numItems: 100,
          period: term.id,
        });
        expect(cohorts).toMatchObject({
          data: [
            { grade: x1.grade, id: x1.id, name: "X-1", periodId: term.id },
          ],
          outcome: "page",
        });
        const people = yield* fixture.internal.query(reads.people, {
          clientId: client.id,
          cursor: null,
          numItems: 100,
          status: "active",
        });
        expect(people.outcome).toBe("page");
        const rows = people.outcome === "page" ? people.data : [];
        expect(Arr.map(rows, (row) => row.name)).toContain("Student");
        expect(rows[0]).not.toHaveProperty("email");
        expect(Arr.every(rows, (row) => row.name !== "Nakafa Staff")).toBe(
          true
        );
        const placements = yield* fixture.internal.query(reads.placements, {
          clientId: client.id,
          cursor: null,
          numItems: 100,
          period: term.id,
        });
        expect(placements).toEqual({
          data: [
            {
              cohortId: x1.id,
              periodId: term.id,
              personId: fixture.people.student.personId,
            },
          ],
          next: null,
          outcome: "page",
        });
      })
  );

  it.effect(
    "pages people by an opaque cursor, clamped to one hundred rows",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const client = yield* createClient(fixture);
        const first = yield* fixture.internal.query(reads.people, {
          clientId: client.id,
          cursor: null,
          numItems: 0,
          status: "active",
        });
        expect(first.outcome === "page" ? first.data : []).toHaveLength(1);
        expect(first.outcome === "page" ? first.next : null).not.toBeNull();
      })
  );

  it.effect(
    "refuses what the client's action list or scope does not open, and another school's period",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const narrow = yield* createClient(fixture, ["period.view"]);
        const forbidden = { outcome: "forbidden" };
        expect(
          yield* fixture.internal.query(reads.people, {
            clientId: narrow.id,
            cursor: null,
            numItems: 10,
            status: "active",
          })
        ).toEqual(forbidden);
        expect(
          yield* fixture.internal.query(reads.cohorts, {
            clientId: narrow.id,
            cursor: null,
            numItems: 10,
            period: term.id,
          })
        ).toEqual(forbidden);
        const none = yield* createClient(fixture, ["cohort.view"]);
        expect(
          yield* fixture.internal.query(reads.periods, { clientId: none.id })
        ).toEqual(forbidden);
        const sma = yield* createClient(
          fixture,
          ["period.view", "cohort.view"],
          {
            kind: "unit",
            unitId: fixture.units.sma,
          }
        );
        expect(
          yield* fixture.internal.query(reads.periods, { clientId: sma.id })
        ).toEqual({ data: [], next: null, outcome: "page" });
        expect(
          yield* fixture.internal.query(reads.placements, {
            clientId: sma.id,
            cursor: null,
            numItems: 10,
            period: term.id,
          })
        ).toEqual(forbidden);
        const other = yield* fixture
          .as("otherOwner")
          .mutation(refs.public.tenancy.periods.create, {
            end: "2026-12-19",
            name: "Ganjil",
            slug: slugOf("other"),
            start: "2026-07-13",
            unitId: fixture.units.sd,
          });
        const all = yield* createClient(fixture);
        for (const periodId of [other.id, "not-an-id"]) {
          expect(
            yield* fixture.internal.query(reads.cohorts, {
              clientId: all.id,
              cursor: null,
              numItems: 10,
              period: periodId,
            })
          ).toEqual(forbidden);
        }
      })
  );
});
