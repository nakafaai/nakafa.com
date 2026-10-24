import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { CLASS_ADDRESS_LIMIT } from "@repo/backend/confect/classroom/class";
import {
  classOf,
  cohort,
  denied,
  nf,
  period,
  writeClass,
} from "@repo/backend/test/classroom";
import { slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { archive, resolve } = refs.public.classroom.classes;
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
        expect([leader, student]).toMatchObject([made, made]);
        expect(leader.can).toContain("forum.manage");
        expect(student.can).toEqual(
          expect.arrayContaining(["class.view", "forum.read"])
        );
        expect(student.can).not.toContain("forum.manage");
      })
  );

  it.effect(
    "refuses an address that two live classes of the school hold as ambiguous",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const smp = yield* period(fixture, fixture.units.smp);
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: smp.id, slug: nf });
        const smpCohort = yield* cohort(fixture, smp.id, "X-1");
        yield* classOf(fixture, smpCohort.id, "Fisika");
        // `create` never writes a second live holder, so this one is written straight to the store.
        yield* writeClass(
          fixture,
          fixture.units.sma,
          "fisika-x-1",
          "active",
          "active"
        );
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

  it.effect(
    "resolves a class of an archived period read-only, and offers it no write action",
    () =>
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
          .query(resolve, { classSlug: "fisika-x-1", slug: nf });
        expect(beforeArchive).toMatchObject(made);
        expect(afterArchive).toMatchObject(made);
        expect(afterArchive.can).toEqual(
          expect.arrayContaining(["class.view", "forum.read"])
        );
        expect(afterArchive.can).not.toContain("class.manage");
        expect(afterArchive.can).not.toContain("forum.manage");
      })
  );

  it.effect(
    "resolves the active class of an address that an archived class of another period also holds",
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
        const archived = yield* classOf(fixture, smpCohort.id, "Fisika");
        yield* fixture
          .as("admin")
          .mutation(archive, { classId: archived.id, slug: nf });
        const active = yield* classOf(fixture, smaCohort.id, "Fisika");
        const found = yield* fixture
          .as("admin")
          .query(resolve, { classSlug: "fisika-x-1", slug: nf });
        expect(found).toMatchObject(active);
      })
  );

  it.effect(
    "resolves an address that only an archived class holds, read-only",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: term.id, slug: nf });
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const made = yield* classOf(fixture, x1.id, "Fisika");
        yield* fixture
          .as("admin")
          .mutation(archive, { classId: made.id, slug: nf });
        const found = yield* fixture
          .as("admin")
          .query(resolve, { classSlug: "fisika-x-1", slug: nf });
        expect(found).toMatchObject({ id: made.id, status: "archived" });
        expect(found.can).toEqual(
          expect.arrayContaining(["class.view", "forum.read"])
        );
        expect(found.can).not.toContain("class.manage");
        expect(found.can).not.toContain("forum.manage");
      })
  );

  it.effect(
    "refuses an address that two archived classes of the school hold as ambiguous",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const smp = yield* period(fixture, fixture.units.smp);
        const sma = yield* period(fixture, fixture.units.sma);
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: smp.id, slug: nf });
        const smpCohort = yield* cohort(fixture, smp.id, "X-1");
        const smpClass = yield* classOf(fixture, smpCohort.id, "Fisika");
        yield* fixture
          .as("admin")
          .mutation(archive, { classId: smpClass.id, slug: nf });
        // The class of the other unit takes the address once the first one is locked.
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: sma.id, slug: nf });
        const smaCohort = yield* cohort(fixture, sma.id, "X-1");
        const smaClass = yield* classOf(fixture, smaCohort.id, "Fisika");
        yield* fixture
          .as("admin")
          .mutation(archive, { classId: smaClass.id, slug: nf });
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

  it.effect(
    "resolves the live class of an address that a planned class of the next term also holds",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: term.id, slug: nf });
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const made = yield* classOf(fixture, x1.id, "Fisika");
        // `create` gives a planned class of another unit the next number, so this one is written straight to the store.
        yield* writeClass(
          fixture,
          fixture.units.sma,
          "fisika-x-1",
          "planned",
          "active"
        );
        const found = yield* fixture
          .as("admin")
          .query(resolve, { classSlug: "fisika-x-1", slug: nf });
        expect(found).toMatchObject(made);
        expect(found.can).toContain("class.manage");
      })
  );

  it.effect(
    "refuses an address that only a class of a planned period holds, as missing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* writeClass(
          fixture,
          fixture.units.smp,
          "fisika-x-1",
          "planned",
          "active"
        );
        const refused = yield* fixture
          .as("admin")
          .query(resolve, { classSlug: "fisika-x-1", slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("resource"));
      })
  );

  it.effect(
    "refuses an address that more classes hold than one lookup reads, as ambiguous",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* Effect.forEach(
          Arr.makeBy(CLASS_ADDRESS_LIMIT + 1, (index) => index),
          () =>
            writeClass(
              fixture,
              fixture.units.smp,
              "fisika-x-1",
              "archived",
              "archived"
            ),
          { discard: true }
        );
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

  it.effect(
    "resolves a class of an archived unit read-only, as an archived unit stays readable",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* writeClass(
          fixture,
          fixture.units.smk,
          "fisika-x-1",
          "active",
          "active"
        );
        const found = yield* fixture
          .as("admin")
          .query(resolve, { classSlug: "fisika-x-1", slug: nf });
        expect(found).toMatchObject({ slug: "fisika-x-1", status: "active" });
        expect(found.can).toContain("class.view");
        expect(found.can).not.toContain("class.manage");
      })
  );

  it.effect(
    "refuses an address in capitals as missing, because no class holds that spelling",
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
          .query(resolve, { classSlug: "Fisika-X-1", slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("resource"));
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
        expect(found).toMatchObject(made);
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
