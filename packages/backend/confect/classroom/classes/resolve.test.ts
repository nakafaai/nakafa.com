import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  classOf,
  cohort,
  denied,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { resolve } = refs.public.classroom.classes;
const periods = refs.public.tenancy.periods;
const placements = refs.public.tenancy.placements;

describe("classroom/classes resolve", () => {
  it.effect(
    "resolves one active class by its address for a leader and for a student placed in its cohort",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: term.id, slug: nf });
        const x1 = yield* cohort(fixture, term.id, "X-1");
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: x1.id,
          personId: fixture.people.student.personId,
          slug: nf,
        });
        const made = yield* classOf(fixture, x1.id, "Fisika");
        const leader = yield* fixture
          .as("admin")
          .query(resolve, { classSlug: "fisika-x-1", slug: nf });
        const student = yield* fixture
          .as("student")
          .query(resolve, { classSlug: "fisika-x-1", slug: nf });
        expect([leader, student]).toEqual([made, made]);
      })
  );

  it.effect(
    "refuses an address that two active periods of the school both hold as ambiguous",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const smp = yield* period(fixture, fixture.units.smp);
        const sma = yield* period(fixture, fixture.units.sma);
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: smp.id, slug: nf });
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: sma.id, slug: nf });
        const smpCohort = yield* cohort(fixture, smp.id, "X-1");
        const smaCohort = yield* cohort(fixture, sma.id, "X-1");
        yield* classOf(fixture, smpCohort.id, "Fisika");
        yield* classOf(fixture, smaCohort.id, "Fisika");
        const refused = yield* fixture
          .as("admin")
          .query(resolve, { classSlug: "fisika-x-1", slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "ClassAmbiguous",
          code: "CLASS_AMBIGUOUS",
        });
      })
  );

  it.effect("never resolves a class of an archived period", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, fixture.units.smp);
      yield* fixture
        .as("admin")
        .mutation(periods.open, { periodId: term.id, slug: nf });
      const x1 = yield* cohort(fixture, term.id, "X-1");
      const made = yield* classOf(fixture, x1.id, "Fisika");
      const beforeArchive = yield* fixture
        .as("admin")
        .query(resolve, { classSlug: "fisika-x-1", slug: nf });
      yield* fixture
        .as("admin")
        .mutation(periods.archive, { periodId: term.id, slug: nf });
      const afterArchive = yield* fixture
        .as("admin")
        .query(resolve, { classSlug: "fisika-x-1", slug: nf })
        .pipe(Effect.flip);
      expect(beforeArchive).toEqual(made);
      expect(afterArchive).toMatchObject(denied("resource"));
    })
  );

  it.effect(
    "refuses another school's slug, which is not the caller's school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: term.id, slug: nf });
        const x1 = yield* cohort(fixture, term.id, "X-1");
        yield* classOf(fixture, x1.id, "Fisika");
        const refused = yield* fixture
          .as("admin")
          .query(resolve, {
            classSlug: "fisika-x-1",
            slug: slugOf("other"),
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "NotMember",
          code: "NOT_MEMBER",
        });
      })
  );

  it.effect(
    "does not count a class of another school that holds the same address",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: term.id, slug: nf });
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const made = yield* classOf(fixture, x1.id, "Fisika");
        yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const periodId = yield* writer.table("tenantPeriods").insert({
              end: "2026-12-19",
              name: "Asing",
              start: "2026-07-13",
              status: "active",
              tenantId: fixture.tenants.other,
              unitId: fixture.units.sd,
            });
            const cohortId = yield* writer.table("tenantCohorts").insert({
              grade: 1,
              name: "X-1",
              nameKey: "x-1",
              periodId,
              status: "active",
              tenantId: fixture.tenants.other,
              unitId: fixture.units.sd,
            });
            yield* writer.table("classes").insert({
              cohortId,
              createdAt: 0,
              name: "Fisika X-1",
              nameKey: "fisika x-1",
              periodId,
              slug: "fisika-x-1",
              status: "active",
              subject: "Fisika",
              subjectKey: "fisika",
              tenantId: fixture.tenants.other,
              unitId: fixture.units.sd,
              updatedAt: 0,
            });
          })
        );
        const found = yield* fixture
          .as("admin")
          .query(resolve, { classSlug: "fisika-x-1", slug: nf });
        expect(found).toEqual(made);
      })
  );

  it.effect(
    "refuses a member who may not view the class, with the role refusal",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: term.id, slug: nf });
        const x1 = yield* cohort(fixture, term.id, "X-1");
        yield* classOf(fixture, x1.id, "Fisika");
        const refused = yield* fixture
          .as("counselor")
          .query(resolve, { classSlug: "fisika-x-1", slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("role"));
      })
  );
});
