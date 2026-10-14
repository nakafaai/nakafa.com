import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { CLASS_LIMIT } from "@repo/backend/confect/classroom/class";
import {
  classOf,
  cohort,
  denied,
  nf,
  period,
  sdUnit,
} from "@repo/backend/test/classroom";
import { journal, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { archive, create, rename } = refs.public.classroom.classes;
const periods = refs.public.tenancy.periods;
const cohorts = refs.public.tenancy.cohorts;

describe("classroom/classes create", () => {
  it.effect(
    "creates an active class named for its subject, and records it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const made = yield* classOf(fixture, x1.id, "Fisika");
        expect(made).toEqual({
          cohortId: x1.id,
          id: expect.any(String),
          name: "Fisika X-1",
          periodId: term.id,
          slug: "fisika-x-1",
          status: "active",
          subject: "Fisika",
        });
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "period.created" } },
          { change: { type: "cohort.created" } },
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: { type: "class.created" },
            owner: { kind: "tenant", tenantId: fixture.tenants.nf },
            subject: { id: made.id, kind: "class" },
          },
        ]);
      })
  );

  it.effect(
    "names the homeroom class of an SD cohort for the cohort alone",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, yield* sdUnit(fixture));
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const homeroom = yield* classOf(fixture, x1.id);
        expect(homeroom).toEqual({
          cohortId: x1.id,
          id: expect.any(String),
          name: "X-1",
          periodId: term.id,
          slug: "x-1",
          status: "active",
        });
        expect(homeroom).not.toHaveProperty("subject");
      })
  );

  it.effect("refuses a class without a subject outside an SD cohort", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const x1 = yield* cohort(fixture, term.id, "X-1");
      const refused = yield* classOf(fixture, x1.id).pipe(Effect.flip);
      expect(refused).toMatchObject({
        _tag: "ClassSubjectRequired",
        code: "CLASS_SUBJECT_REQUIRED",
      });
    })
  );

  it.effect(
    "refuses a subject in an SD cohort, which holds only its homeroom class",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, yield* sdUnit(fixture));
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const refused = yield* classOf(fixture, x1.id, "Fisika").pipe(
          Effect.flip
        );
        expect(refused).toMatchObject({
          _tag: "ClassSubjectNotAllowed",
          code: "CLASS_SUBJECT_NOT_ALLOWED",
        });
      })
  );

  it.effect(
    "gives each class whose address is taken the next free number of its period",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const slugs = yield* Effect.forEach(
          ["Fisika!", "Fisika?", "Fisika."],
          (subject) =>
            classOf(fixture, x1.id, subject).pipe(
              Effect.map((made) => made.slug)
            )
        );
        expect(slugs).toEqual(["fisika-x-1", "fisika-x-1-2", "fisika-x-1-3"]);
      })
  );

  it.effect(
    "refuses a second active class of one name in a cohort, without regard to case",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        yield* classOf(fixture, x1.id, "Fisika");
        const taken = yield* classOf(fixture, x1.id, "fisika").pipe(
          Effect.flip
        );
        expect(taken).toMatchObject({
          _tag: "ClassNameTaken",
          code: "CLASS_NAME_TAKEN",
        });
      })
  );

  it.effect(
    "refuses a second active class of one subject, even after a rename gave the first another name",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        yield* fixture.as("admin").mutation(rename, {
          classId: fisika.id,
          name: "Kimia X-1",
          slug: nf,
        });
        const again = yield* classOf(fixture, x1.id, "Fisika").pipe(
          Effect.flip
        );
        expect(again).toMatchObject({
          _tag: "ClassSubjectTaken",
          code: "CLASS_SUBJECT_TAKEN",
        });
      })
  );

  it.effect(
    "refuses a second active class of one subject after its cohort is renamed",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        yield* classOf(fixture, x1.id, "Fisika");
        yield* fixture
          .as("admin")
          .mutation(cohorts.rename, { cohortId: x1.id, name: "X-2", slug: nf });
        const again = yield* classOf(fixture, x1.id, "Fisika").pipe(
          Effect.flip
        );
        expect(again).toMatchObject({
          _tag: "ClassSubjectTaken",
          code: "CLASS_SUBJECT_TAKEN",
        });
      })
  );

  it.effect(
    "lets a name come back once its class is archived, and keeps the archived address",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const first = yield* classOf(fixture, x1.id, "Fisika");
        yield* fixture
          .as("admin")
          .mutation(archive, { classId: first.id, slug: nf });
        const again = yield* classOf(fixture, x1.id, "Fisika");
        expect(again).toMatchObject({
          slug: "fisika-x-1-2",
          status: "active",
        });
      })
  );

  it.effect(
    "refuses a class whose subject and cohort name hold no letter or digit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const symbols = yield* cohort(fixture, term.id, "??");
        const bare = yield* classOf(fixture, symbols.id, "!!").pipe(
          Effect.flip
        );
        const sdTerm = yield* period(fixture, yield* sdUnit(fixture));
        const sdSymbols = yield* cohort(fixture, sdTerm.id, "??");
        const homeroom = yield* classOf(fixture, sdSymbols.id).pipe(
          Effect.flip
        );
        expect([bare, homeroom]).toMatchObject([
          { _tag: "ClassAddressEmpty", code: "CLASS_ADDRESS_EMPTY" },
          { _tag: "ClassAddressEmpty", code: "CLASS_ADDRESS_EMPTY" },
        ]);
      })
  );

  it.effect(
    "refuses a cohort that holds the most classes it can, archived ones included",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            Effect.forEach(
              Arr.makeBy(CLASS_LIMIT, (index) => index),
              (index) =>
                writer.table("classes").insert({
                  cohortId: x1.id,
                  createdAt: 0,
                  name: `Kelas ${index} X-1`,
                  nameKey: `kelas ${index} x-1`,
                  periodId: term.id,
                  slug: `kelas-${index}-x-1`,
                  status: "archived",
                  subject: `Kelas ${index}`,
                  subjectKey: `kelas ${index}`,
                  tenantId: fixture.tenants.nf,
                  unitId: fixture.units.smp,
                  updatedAt: 0,
                }),
              { discard: true }
            )
          )
        );
        const refusal = yield* classOf(fixture, x1.id, "Fisika").pipe(
          Effect.flip
        );
        expect(refusal).toMatchObject({
          _tag: "ClassLimit",
          code: "CLASS_LIMIT",
        });
      })
  );

  it.effect("refuses a class in an archived period, for every role alike", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const x1 = yield* cohort(fixture, term.id, "X-1");
      yield* fixture.as("admin").mutation(periods.open, {
        periodId: term.id,
        slug: nf,
      });
      yield* fixture.as("admin").mutation(periods.archive, {
        periodId: term.id,
        slug: nf,
      });
      const byAdmin = yield* classOf(fixture, x1.id, "Fisika").pipe(
        Effect.flip
      );
      const byOwner = yield* fixture
        .as("owner")
        .mutation(create, { cohortId: x1.id, slug: nf, subject: "Kimia" })
        .pipe(Effect.flip);
      expect([byAdmin, byOwner]).toMatchObject([
        denied("condition"),
        denied("condition"),
      ]);
    })
  );

  it.effect("refuses a class in a cohort that is archived", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const x1 = yield* cohort(fixture, term.id, "X-1");
      yield* fixture.as("admin").mutation(cohorts.archive, {
        cohortId: x1.id,
        slug: nf,
      });
      const refused = yield* classOf(fixture, x1.id, "Fisika").pipe(
        Effect.flip
      );
      expect(refused).toMatchObject(denied("condition"));
    })
  );

  it.effect("refuses a class in a cohort of an archived unit", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const cohortId = yield* fixture.run(
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
          return yield* writer.table("tenantCohorts").insert({
            grade: 10,
            name: "10A",
            nameKey: "10a",
            periodId,
            status: "active",
            tenantId: fixture.tenants.nf,
            unitId: fixture.units.smk,
          });
        })
      );
      const refused = yield* classOf(fixture, cohortId, "Fisika").pipe(
        Effect.flip
      );
      expect(refused).toMatchObject(denied("condition"));
    })
  );

  it.effect(
    "refuses a cohort of another school, and a create by a non-member",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const otherPeriod = yield* fixture
          .as("otherOwner")
          .mutation(periods.create, {
            end: "2026-12-19",
            name: "Ganjil",
            slug: slugOf("other"),
            start: "2026-07-13",
            unitId: fixture.units.sd,
          });
        const foreign = yield* fixture
          .as("otherOwner")
          .mutation(cohorts.create, {
            grade: 1,
            name: "1A",
            periodId: otherPeriod.id,
            slug: slugOf("other"),
          });
        const foreignRefusal = yield* classOf(
          fixture,
          foreign.id,
          "Fisika"
        ).pipe(Effect.flip);
        const stranger = yield* fixture
          .as("stranger")
          .mutation(create, {
            cohortId: foreign.id,
            slug: nf,
            subject: "Fisika",
          })
          .pipe(Effect.flip);
        expect([foreignRefusal, stranger]).toMatchObject([
          denied("resource"),
          { _tag: "NotMember", code: "NOT_MEMBER" },
        ]);
      })
  );
});
