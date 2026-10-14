import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  classOf,
  cohort,
  denied,
  firstPage,
  nf,
  period,
  teach,
} from "@repo/backend/test/classroom";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { archive, get, list, rename } = refs.public.classroom.classes;
const cohorts = refs.public.tenancy.cohorts;
const periods = refs.public.tenancy.periods;
const placements = refs.public.tenancy.placements;
const grants = refs.public.access.grants;

describe("classroom/classes read and roles", () => {
  it.effect("lets a school leader read a class, and refuses a counselor", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, fixture.units.sma);
      const x1 = yield* cohort(fixture, term.id, "X-1");
      const made = yield* classOf(fixture, x1.id, "Fisika");
      const read = yield* fixture
        .as("principal")
        .query(get, { classId: made.id, slug: nf });
      const refused = yield* fixture
        .as("counselor")
        .query(get, { classId: made.id, slug: nf })
        .pipe(Effect.flip);
      expect(read).toEqual(made);
      expect(refused).toMatchObject(denied("role"));
    })
  );

  it.effect(
    "lets a subject teacher read the class only while the teacher grant stands",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "VII-1");
        const made = yield* classOf(fixture, x1.id, "Fisika");
        const { grantId, personId } = fixture.people.teacher;
        yield* teach(fixture, made.id, personId);
        const read = yield* fixture
          .as("teacher")
          .query(get, { classId: made.id, slug: nf });
        yield* fixture.as("owner").mutation(grants.revoke, { grantId, slug: nf });
        const refused = yield* fixture
          .as("teacher")
          .query(get, { classId: made.id, slug: nf })
          .pipe(Effect.flip);
        expect(read).toEqual(made);
        expect(refused).toMatchObject(denied("role"));
      })
  );

  it.effect(
    "refuses a plan role any change to a class, and a student any list of a period",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.sma);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const made = yield* classOf(fixture, x1.id, "Fisika");
        const renamed = yield* fixture
          .as("principal")
          .mutation(rename, { classId: made.id, name: "Kimia X-1", slug: nf })
          .pipe(Effect.flip);
        const archived = yield* fixture
          .as("principal")
          .mutation(archive, { classId: made.id, slug: nf })
          .pipe(Effect.flip);
        const listed = yield* fixture
          .as("student")
          .query(list, { ...firstPage, periodId: term.id, slug: nf })
          .pipe(Effect.flip);
        expect([renamed, archived, listed]).toMatchObject([
          denied("role"),
          denied("role"),
          denied("role"),
        ]);
      })
  );

  it.effect("lists a period's classes by name, to the school's leaders", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const x1 = yield* cohort(fixture, term.id, "X-1");
      yield* classOf(fixture, x1.id, "Kimia");
      yield* classOf(fixture, x1.id, "Fisika");
      const listed = yield* fixture
        .as("admin")
        .query(list, { ...firstPage, periodId: term.id, slug: nf });
      expect(Arr.map(listed.page, (row) => row.name)).toEqual([
        "Fisika X-1",
        "Kimia X-1",
      ]);
    })
  );

  it.effect(
    "lists the classes of one subject together, by cohort name, before a subject that extends it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const x2 = yield* cohort(fixture, term.id, "X-2");
        yield* classOf(fixture, x1.id, "Fisika Lanjut");
        yield* classOf(fixture, x2.id, "Fisika");
        yield* classOf(fixture, x1.id, "Fisika");
        const listed = yield* fixture
          .as("admin")
          .query(list, { ...firstPage, periodId: term.id, slug: nf });
        expect(Arr.map(listed.page, (row) => row.name)).toEqual([
          "Fisika X-1",
          "Fisika X-2",
          "Fisika Lanjut X-1",
        ]);
      })
  );
});

describe("classroom/classes rename and archive", () => {
  it.effect(
    "renames a class, keeps its address, and refuses a name another active class has",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        yield* classOf(fixture, x1.id, "Kimia");
        const caseOnly = yield* fixture.as("admin").mutation(rename, {
          classId: fisika.id,
          name: "fisika X-1",
          slug: nf,
        });
        const taken = yield* fixture
          .as("admin")
          .mutation(rename, {
            classId: fisika.id,
            name: "KIMIA x-1",
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(caseOnly).toMatchObject({
          name: "fisika X-1",
          slug: "fisika-x-1",
        });
        expect(taken).toMatchObject({
          _tag: "ClassNameTaken",
          code: "CLASS_NAME_TAKEN",
        });
      })
  );

  it.effect(
    "answers a rename to the name a class already has as it stands, and journals nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        const before = yield* fixture.run(journal);
        const same = yield* fixture.as("admin").mutation(rename, {
          classId: fisika.id,
          name: "Fisika X-1",
          slug: nf,
        });
        expect(same).toMatchObject({ name: "Fisika X-1" });
        expect(yield* fixture.run(journal)).toEqual(before);
      })
  );

  it.effect(
    "frees the name of an archived class, then archives a class that refuses writes and stays readable",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        const kimia = yield* classOf(fixture, x1.id, "Kimia");
        yield* fixture
          .as("admin")
          .mutation(archive, { classId: kimia.id, slug: nf });
        const renamed = yield* fixture.as("admin").mutation(rename, {
          classId: fisika.id,
          name: "Kimia X-1",
          slug: nf,
        });
        const archived = yield* fixture
          .as("admin")
          .mutation(archive, { classId: fisika.id, slug: nf });
        const refused = yield* fixture
          .as("admin")
          .mutation(rename, {
            classId: fisika.id,
            name: "Biologi X-1",
            slug: nf,
          })
          .pipe(Effect.flip);
        const read = yield* fixture
          .as("admin")
          .query(get, { classId: fisika.id, slug: nf });
        expect(renamed.name).toBe("Kimia X-1");
        expect(archived.status).toBe("archived");
        expect(refused).toMatchObject(denied("condition"));
        expect(read.status).toBe("archived");
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "period.created" } },
          { change: { type: "cohort.created" } },
          { change: { type: "class.created" } },
          { change: { type: "class.created" } },
          { change: { type: "class.archived" }, subject: { id: kimia.id } },
          { change: { type: "class.renamed" }, subject: { id: fisika.id } },
          { change: { type: "class.archived" }, subject: { id: fisika.id } },
        ]);
      })
  );

  it.effect("refuses a rename once the cohort of the class is archived", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const x1 = yield* cohort(fixture, term.id, "X-1");
      const fisika = yield* classOf(fixture, x1.id, "Fisika");
      yield* fixture.as("admin").mutation(cohorts.archive, {
        cohortId: x1.id,
        slug: nf,
      });
      const refused = yield* fixture
        .as("admin")
        .mutation(rename, { classId: fisika.id, name: "Kimia X-1", slug: nf })
        .pipe(Effect.flip);
      expect(refused).toMatchObject(denied("condition"));
    })
  );
});

describe("classroom/classes of an archived period or unit", () => {
  it.effect(
    "locks an existing class once its period is archived, and keeps it readable",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        yield* fixture.as("admin").mutation(periods.open, {
          periodId: term.id,
          slug: nf,
        });
        yield* fixture.as("admin").mutation(periods.archive, {
          periodId: term.id,
          slug: nf,
        });
        const renamed = yield* fixture
          .as("admin")
          .mutation(rename, { classId: fisika.id, name: "Kimia X-1", slug: nf })
          .pipe(Effect.flip);
        const archived = yield* fixture
          .as("admin")
          .mutation(archive, { classId: fisika.id, slug: nf })
          .pipe(Effect.flip);
        const read = yield* fixture
          .as("admin")
          .query(get, { classId: fisika.id, slug: nf });
        expect([renamed, archived]).toMatchObject([
          denied("condition"),
          denied("condition"),
        ]);
        expect(read.status).toBe("active");
      })
  );

  it.effect(
    "locks a class of an archived unit, even when its own cohort and period are active",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const classId = yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const periodId = yield* writer.table("tenantPeriods").insert({
              end: "2026-12-19",
              name: "Smk",
              start: "2026-07-13",
              status: "active",
              tenantId: fixture.tenants.nf,
              unitId: fixture.units.smk,
            });
            const cohortId = yield* writer.table("tenantCohorts").insert({
              grade: 10,
              name: "10A",
              nameKey: "10a",
              periodId,
              status: "active",
              tenantId: fixture.tenants.nf,
              unitId: fixture.units.smk,
            });
            return yield* writer.table("classes").insert({
              cohortId,
              createdAt: 0,
              name: "Fisika 10A",
              nameKey: "fisika 10a",
              periodId,
              slug: "fisika-10a",
              status: "active",
              subject: "Fisika",
              subjectKey: "fisika",
              tenantId: fixture.tenants.nf,
              unitId: fixture.units.smk,
              updatedAt: 0,
            });
          })
        );
        const refused = yield* fixture
          .as("admin")
          .mutation(rename, { classId, name: "Kimia 10A", slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("condition"));
      })
  );
});

describe("classroom/classes members", () => {
  it.effect(
    "lets a student read the class of their own cohort, and refuses a class of another cohort",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const x2 = yield* cohort(fixture, term.id, "X-2");
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: x1.id,
          personId: fixture.people.student.personId,
          slug: nf,
        });
        const own = yield* classOf(fixture, x1.id, "Fisika");
        const other = yield* classOf(fixture, x2.id, "Fisika");
        const read = yield* fixture
          .as("student")
          .query(get, { classId: own.id, slug: nf });
        const refused = yield* fixture
          .as("student")
          .query(get, { classId: other.id, slug: nf })
          .pipe(Effect.flip);
        expect(read.id).toBe(own.id);
        expect(refused).toMatchObject(denied("role"));
      })
  );

  it.effect(
    "refuses a class of another school to every class function, by its ID",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const foreign = yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const periodId = yield* writer.table("tenantPeriods").insert({
              end: "2026-12-19",
              name: "Asing",
              start: "2026-07-13",
              status: "planned",
              tenantId: fixture.tenants.other,
              unitId: fixture.units.sd,
            });
            const cohortId = yield* writer.table("tenantCohorts").insert({
              grade: 1,
              name: "1A",
              nameKey: "1a",
              periodId,
              status: "active",
              tenantId: fixture.tenants.other,
              unitId: fixture.units.sd,
            });
            const classId = yield* writer.table("classes").insert({
              cohortId,
              createdAt: 0,
              name: "Asing 1A",
              nameKey: "asing 1a",
              periodId,
              slug: "asing-1a",
              status: "active",
              subjectKey: "",
              tenantId: fixture.tenants.other,
              unitId: fixture.units.sd,
              updatedAt: 0,
            });
            return { classId, periodId };
          })
        );
        const failures = yield* Effect.all([
          fixture
            .as("admin")
            .query(get, { classId: foreign.classId, slug: nf })
            .pipe(Effect.flip),
          fixture
            .as("admin")
            .mutation(rename, {
              classId: foreign.classId,
              name: "Asing 2A",
              slug: nf,
            })
            .pipe(Effect.flip),
          fixture
            .as("admin")
            .mutation(archive, { classId: foreign.classId, slug: nf })
            .pipe(Effect.flip),
          fixture
            .as("admin")
            .query(list, {
              ...firstPage,
              periodId: foreign.periodId,
              slug: nf,
            })
            .pipe(Effect.flip),
        ]);
        expect(failures).toMatchObject([
          denied("resource"),
          denied("resource"),
          denied("resource"),
          denied("resource"),
        ]);
      })
  );
});
