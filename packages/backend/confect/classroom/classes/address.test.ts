import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { CLASS_ADDRESS_LIMIT } from "@repo/backend/confect/classroom/class";
import {
  classOf,
  cohort,
  nf,
  openPeriod,
  period,
  writeClass,
} from "@repo/backend/test/classroom";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { resolve } = refs.public.classroom.classes;
const periods = refs.public.tenancy.periods;

describe("classroom/classes address", () => {
  it.effect(
    "gives a class the next free number while a class of another unit holds its address",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const smp = yield* period(fixture, fixture.units.smp);
        const sma = yield* period(fixture, fixture.units.sma);
        yield* openPeriod(fixture, smp.id);
        yield* openPeriod(fixture, sma.id);
        const smpCohort = yield* cohort(fixture, smp.id, "X-1");
        const smaCohort = yield* cohort(fixture, sma.id, "X-1");
        const smpFisika = yield* classOf(fixture, smpCohort.id, "Fisika");
        const smaFisika = yield* classOf(fixture, smaCohort.id, "Fisika");
        expect([smpFisika.slug, smaFisika.slug]).toEqual([
          "fisika-x-1",
          "fisika-x-1-2",
        ]);
      })
  );

  it.effect(
    "gives a class the next free number while a planned class of another unit holds its address, and keeps both addresses when that period opens",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const sma = yield* period(fixture, fixture.units.sma);
        const smaCohort = yield* cohort(fixture, sma.id, "X-1");
        const smaFisika = yield* classOf(fixture, smaCohort.id, "Fisika");
        const smp = yield* period(fixture, fixture.units.smp);
        yield* openPeriod(fixture, smp.id);
        const smpCohort = yield* cohort(fixture, smp.id, "X-1");
        const smpFisika = yield* classOf(fixture, smpCohort.id, "Fisika");
        yield* openPeriod(fixture, sma.id);
        const first = yield* fixture
          .as("admin")
          .query(resolve, { classSlug: "fisika-x-1", slug: nf });
        const second = yield* fixture
          .as("admin")
          .query(resolve, { classSlug: "fisika-x-1-2", slug: nf });
        expect([smaFisika.slug, smpFisika.slug]).toEqual([
          "fisika-x-1",
          "fisika-x-1-2",
        ]);
        expect([first.id, second.id]).toEqual([smaFisika.id, smpFisika.id]);
      })
  );

  it.effect(
    "keeps the base address for a class of the next term of the same unit, while this term's class is active",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        yield* openPeriod(fixture, term.id);
        const termCohort = yield* cohort(fixture, term.id, "X-1");
        yield* classOf(fixture, termCohort.id, "Fisika");
        const next = yield* fixture.as("admin").mutation(periods.create, {
          end: "2027-06-30",
          name: "Genap 2026/2027",
          slug: nf,
          start: "2027-01-04",
          unitId: fixture.units.smp,
        });
        const nextCohort = yield* cohort(fixture, next.id, "X-1");
        const nextFisika = yield* classOf(fixture, nextCohort.id, "Fisika");
        expect(nextFisika.slug).toBe("fisika-x-1");
        yield* fixture
          .as("admin")
          .mutation(periods.archive, { periodId: term.id, slug: nf });
        yield* openPeriod(fixture, next.id);
        const found = yield* fixture
          .as("admin")
          .query(resolve, { classSlug: "fisika-x-1", slug: nf });
        expect(found).toMatchObject(nextFisika);
      })
  );

  it.effect(
    "refuses a class whose address more classes hold than one check reads, as ambiguous",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        yield* Effect.forEach(
          Arr.makeBy(CLASS_ADDRESS_LIMIT + 1, (index) => index),
          () =>
            writeClass(
              fixture,
              fixture.units.sma,
              "fisika-x-1",
              "archived",
              "archived"
            ),
          { discard: true }
        );
        const refusal = yield* classOf(fixture, x1.id, "Fisika").pipe(
          Effect.flip
        );
        expect(refusal).toMatchObject({
          _tag: "ClassAmbiguous",
          code: "CLASS_AMBIGUOUS",
        });
      })
  );
});
