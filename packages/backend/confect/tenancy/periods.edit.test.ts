import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { journal, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const { archive, create, edit, open } = refs.public.tenancy.periods;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});

/** The terms of the school SMA, which keeps the Asia/Jakarta clock. */
const SMA_TERMS = {
  end: "2026-12-19",
  name: "Ganjil 2026/2027",
  start: "2026-07-13",
};

/** Creates one period of the school SMA as its Admin, and returns the period the mutation made. */
const admin = (
  fixture: Effect.Success<typeof tenancyFixture>,
  term: { end: string; name: string; start: string }
) =>
  fixture.as("admin").mutation(create, {
    ...term,
    slug: nf,
    unitId: fixture.units.sma,
  });

/** The term after SMA_TERMS in the same school. */
const SMA_NEXT = {
  end: "2027-06-19",
  name: "Genap 2026/2027",
  start: "2027-01-04",
};

/** The journal entries of one change type. */
const changesOf = (
  entries: Effect.Success<typeof journal>,
  type: "period.rename" | "period.rescheduled"
) => Arr.filter(entries, (entry) => entry.change.type === type);

describe("tenancy/periods edit", () => {
  it.effect(
    "renames a period in place, answers the new name, and journals the rename alone",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* admin(fixture, SMA_TERMS);
        const renamed = yield* fixture.as("admin").mutation(edit, {
          ...SMA_TERMS,
          name: "Ganjil 2026",
          periodId: period.id,
          slug: nf,
        });
        const entries = yield* fixture.run(journal);
        expect(renamed).toEqual({ ...period, name: "Ganjil 2026" });
        expect(changesOf(entries, "period.rename")).toMatchObject([
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: { type: "period.rename" },
            owner: { kind: "tenant", tenantId: fixture.tenants.nf },
            subject: { id: period.id, kind: "period" },
          },
        ]);
        expect(changesOf(entries, "period.rescheduled")).toEqual([]);
      })
  );

  it.effect(
    "moves a period's dates, answers them, and journals the reschedule alone",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* admin(fixture, SMA_TERMS);
        const moved = yield* fixture.as("admin").mutation(edit, {
          end: "2026-12-23",
          name: SMA_TERMS.name,
          periodId: period.id,
          slug: nf,
          start: "2026-07-06",
        });
        const entries = yield* fixture.run(journal);
        expect(moved).toEqual({
          ...period,
          end: "2026-12-23",
          start: "2026-07-06",
        });
        expect(changesOf(entries, "period.rescheduled")).toMatchObject([
          {
            change: { type: "period.rescheduled" },
            subject: { id: period.id, kind: "period" },
          },
        ]);
        expect(changesOf(entries, "period.rename")).toEqual([]);
      })
  );

  it.effect(
    "writes and journals nothing for the name and dates a period already has",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* admin(fixture, SMA_TERMS);
        const before = yield* fixture.run(journal);
        const same = yield* fixture.as("admin").mutation(edit, {
          ...SMA_TERMS,
          periodId: period.id,
          slug: nf,
        });
        expect(same).toEqual(period);
        expect(yield* fixture.run(journal)).toEqual(before);
      })
  );

  it.effect(
    "refuses dates that are not calendar dates or end before they start",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* admin(fixture, SMA_TERMS);
        const refusals = yield* Effect.forEach(
          [
            { end: "2026-12-19", start: "2026-13-01" },
            { end: "2026-07-01", start: "2026-07-13" },
          ],
          (dates) =>
            fixture
              .as("admin")
              .mutation(edit, {
                ...dates,
                name: SMA_TERMS.name,
                periodId: period.id,
                slug: nf,
              })
              .pipe(Effect.flip)
        );
        expect(refusals).toMatchObject([
          { _tag: "PeriodDatesInvalid" },
          { _tag: "PeriodDatesInvalid" },
        ]);
      })
  );

  it.effect(
    "refuses dates that share a day with another period, and never counts the period's own old dates",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const first = yield* admin(fixture, SMA_TERMS);
        const second = yield* admin(fixture, SMA_NEXT);
        const overlap = yield* fixture
          .as("admin")
          .mutation(edit, {
            ...SMA_NEXT,
            periodId: second.id,
            slug: nf,
            start: SMA_TERMS.end,
          })
          .pipe(Effect.flip);
        const longer = yield* fixture.as("admin").mutation(edit, {
          ...SMA_TERMS,
          end: "2026-12-31",
          periodId: first.id,
          slug: nf,
        });
        expect(overlap).toMatchObject({ _tag: "PeriodOverlaps" });
        expect(longer).toEqual({ ...first, end: "2026-12-31" });
      })
  );

  it.effect("refuses a teacher, who does not hold period.manage", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* admin(fixture, SMA_TERMS);
      const denial = yield* fixture
        .as("teacher")
        .mutation(edit, { ...SMA_TERMS, periodId: period.id, slug: nf })
        .pipe(Effect.flip);
      expect(denial).toMatchObject(denied("role"));
    })
  );

  it.effect("refuses to edit an archived period", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* admin(fixture, SMA_TERMS);
      yield* fixture
        .as("admin")
        .mutation(open, { periodId: period.id, slug: nf });
      yield* fixture
        .as("admin")
        .mutation(archive, { periodId: period.id, slug: nf });
      const denial = yield* fixture
        .as("admin")
        .mutation(edit, {
          ...SMA_TERMS,
          name: "Lain",
          periodId: period.id,
          slug: nf,
        })
        .pipe(Effect.flip);
      expect(denial).toMatchObject(denied("condition"));
    })
  );
});
